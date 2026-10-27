// Browser work of the action-list editor that C# cannot do: the drag image of an action, and the condition editor's mode
// kept in the browser's storage.

const modeKey = "apl-condition-mode";

/** Drags an action by its grip as a move, with the whole action as its image. */
export function attachDrag(root) {
  const onDragStart = (event) => {
    const grip = event.target instanceof Element ? event.target.closest("[data-grip]") : null;
    if (!grip || !root.contains(grip)) return;
    event.dataTransfer.effectAllowed = "move";
    const item = grip.closest("li");
    if (item) event.dataTransfer.setDragImage(item, 20, 20);
  };
  root.addEventListener("dragstart", onDragStart);
  return { dispose: () => root.removeEventListener("dragstart", onDragStart) };
}

/** The condition editor's mode the browser keeps; "builder" when it has none or its storage is unavailable. */
export function readConditionMode() {
  try {
    return localStorage.getItem(modeKey) ?? "builder";
  } catch {
    return "builder";
  }
}

export function writeConditionMode(mode) {
  try {
    localStorage.setItem(modeKey, mode);
  } catch {
    // The choice lasts until the page reloads.
  }
}
