// The pool of Web Workers (worker.js) a sim's chunks run on, called by SimWorkerPool.cs. A browser page has one thread, so
// each worker is a runtime of its own: a run's chunks go to the workers as each one frees up, and the page gets them back
// in chunk order to combine.

/** Most workers: each holds a .NET runtime of its own (tens of MB). */
const MaxWorkers = 16;

const workers = [];
const runs = new Map();
let nextCall = 1;

function spawn() {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    const w = { worker, pending: new Map(), inflight: 0, bootMs: 0 };
    w.ready = new Promise((resolve, reject) => { w.resolve = resolve; w.reject = reject; });
    worker.onmessage = ({ data }) => {
        if (data.type === 'ready') { w.bootMs = data.bootMs; w.resolve(); }
        else if (data.type === 'bootError') w.reject(new Error(data.message));
        else {
            const call = w.pending.get(data.id);
            w.pending.delete(data.id);
            if (call) data.error ? call.reject(new Error(data.error)) : call.resolve(data);
        }
    };
    worker.onerror = e => {
        const error = new Error(e.message || 'The sim worker failed.');
        w.reject(error);
        for (const call of w.pending.values()) call.reject(error);
        w.pending.clear();
    };
    w.ready.catch(() => { });
    return w;
}

function call(w, message) {
    return new Promise((resolve, reject) => {
        const id = nextCall++;
        w.pending.set(id, { resolve, reject });
        w.worker.postMessage({ ...message, id });
    });
}

/** Starts the workers (one fewer than the cores, since the page needs one) and returns how many. They boot in the background. */
export function start() {
    if (workers.length === 0) {
        const count = Math.max(1, Math.min((navigator.hardwareConcurrency || 2) - 1, MaxWorkers));
        for (let i = 0; i < count; i++) workers.push(spawn());
    }
    return workers.length;
}

/**
 * Runs the chunks of a run on up to `wanted` workers. `sink` (a .NET object) hears OnChunk(chunk) as each completes.
 * Resolves to {resultJson (the chunks combined, by a worker: the page's thread would take seconds), cpuMs (the chunks' time
 * on the workers, added up), combineMs (the combine's), workers (used), bootMs (the slowest used worker's start), wallMs}.
 */
export async function run(runId, profileJson, specJson, chunkCount, wanted, sink) {
    const state = { cancelled: false };
    runs.set(runId, state);
    try {
        start();
        const began = performance.now();
        const chosen = [...workers].sort((a, b) => a.inflight - b.inflight)
            .slice(0, Math.max(1, Math.min(wanted, workers.length, chunkCount)));
        await Promise.all(chosen.map(w => w.ready));
        const chunks = new Array(chunkCount);
        let next = 0;
        let cpuMs = 0;
        await Promise.all(chosen.map(async w => {
            w.inflight++;
            try {
                await call(w, { type: 'start', runId, profileJson, specJson });
                try {
                    while (!state.cancelled && next < chunkCount) {
                        const chunk = next++;
                        const reply = await call(w, { type: 'chunk', runId, chunk });
                        chunks[chunk] = reply.json;
                        cpuMs += reply.ms;
                        sink.invokeMethodAsync('OnChunk', chunk);
                    }
                } finally {
                    w.worker.postMessage({ id: 0, type: 'finish', runId });
                }
            } catch (e) {
                state.cancelled = true;
                throw e;
            } finally {
                w.inflight--;
            }
        }));
        if (state.cancelled) throw new DOMException('The sim was cancelled.', 'AbortError');
        const combined = await call(chosen[0], { type: 'combine', specJson, chunks });
        return {
            resultJson: combined.json, combineMs: combined.ms, cpuMs, workers: chosen.length,
            bootMs: Math.max(...chosen.map(w => w.bootMs)), wallMs: performance.now() - began,
        };
    } finally {
        runs.delete(runId);
    }
}

export function cancel(runId) {
    const state = runs.get(runId);
    if (state) state.cancelled = true;
}
