// A Web Worker that runs a sim's chunks: the .NET runtime of FellowshipSim.SimWorker (published into ./runtime), called
// by simPool.js. Messages in: {id, type: 'start' | 'chunk' | 'combine' | 'finish', runId, ...}. Out: {id, ...} per call, and once
// {type: 'ready', bootMs} when the runtime is up.
const boot = (async () => {
    const began = performance.now();
    const { dotnet } = await import('./runtime/dotnet.js');
    const runtime = await dotnet.create();
    const assembly = runtime.getConfig().mainAssemblyName;
    const exports = await runtime.getAssemblyExports(assembly);
    const chunks = exports.FellowshipSim.SimWorker.SimChunks;
    postMessage({ type: 'ready', bootMs: performance.now() - began });
    return chunks;
})();
boot.then(chunks => {
    // Set once the runtime is up: it takes the worker's message handling over while it starts. The pool sends nothing before 'ready'.
    self.onmessage = ({ data }) => handle(chunks, data);
}, e => postMessage({ type: 'bootError', message: String(e?.message ?? e) }));

function handle(chunks, data) {
    const { id, type, runId } = data;
    try {
        if (type === 'start') {
            const refused = chunks.Start(runId, data.profileJson, data.specJson);
            postMessage(refused ? { id, error: refused } : { id });
        } else if (type === 'chunk') {
            const began = performance.now();
            const json = chunks.RunChunk(runId, data.chunk);
            postMessage({ id, json, ms: performance.now() - began });
        } else if (type === 'combine') {
            const began = performance.now();
            const json = chunks.Combine(data.specJson, data.chunks);
            postMessage({ id, json, ms: performance.now() - began });
        } else if (type === 'finish') {
            chunks.Finish(runId);
            postMessage({ id });
        }
    } catch (e) {
        postMessage({ id, error: String(e?.message ?? e) });
    }
}
