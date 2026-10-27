// Caret work of a CodeField. The textarea's value is set here only: C# sends a new value with setValue, and each edit
// goes to C# as one Input call with the caret's place. Keys the completion list takes are prevented here, before C#
// sees them, while the list is shown.

/**
 * Wires the textarea of a CodeField to its component. `field` holds the textarea, `list` is the completion list and
 * `measure` the hidden layer the caret is measured in.
 */
export function attach(field, textarea, list, measure, highlight, component, text) {
  // Until the highlight layer has the textarea's text (data-shown), the textarea shows its own text.
  const markStale = () => {
    if (textarea.value === highlight.dataset.shown) delete field.dataset.stale;
    else field.dataset.stale = "";
  };
  const shown = new MutationObserver(markStale);
  shown.observe(highlight, { attributes: true, attributeFilter: ["data-shown"] });

  // The caret's place in the field: the text before it, laid out like the highlight layer, ends at the caret.
  const place = () => {
    const marker = document.createElement("span");
    marker.textContent = "​";
    measure.replaceChildren(textarea.value.slice(0, textarea.selectionStart), marker);
    const caret = {
      at: textarea.selectionStart,
      left: marker.offsetLeft,
      top: marker.offsetTop + marker.offsetHeight,
      width: field.clientWidth,
      focused: document.activeElement === textarea,
    };
    measure.replaceChildren();
    return caret;
  };

  // The field fits its text.
  const fit = () => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight + 2}px`;
  };

  const caretOnly = () => ({ at: textarea.selectionStart, left: 0, top: 0, width: field.clientWidth, focused: true });

  const onInput = (event) => {
    fit();
    markStale();
    const inputType = event.inputType ?? "";
    const edit = inputType.startsWith("insert") || inputType.startsWith("delete");
    component.invokeMethodAsync("Input", textarea.value, edit, edit ? place() : caretOnly());
  };

  const onKeyDown = (event) => {
    if (event.key === " " && event.ctrlKey) {
      event.preventDefault();
      component.invokeMethodAsync("Key", "Open", place());
      return;
    }
    if (!list.hidden) {
      switch (event.key) {
        case "ArrowDown":
        case "ArrowUp":
        case "Enter":
        case "Tab":
        case "Escape":
          event.preventDefault();
          component.invokeMethodAsync("Key", event.key, caretOnly());
          return;
        case "ArrowLeft":
        case "ArrowRight":
        case "Home":
        case "End":
          component.invokeMethodAsync("Key", event.key, caretOnly());
          break;
      }
    }
    // Enter would put a line break in an action line.
    if (event.key === "Enter") event.preventDefault();
  };

  const onBlur = () => component.invokeMethodAsync("Blur");
  const onClick = () => component.invokeMethodAsync("Click");

  textarea.addEventListener("input", onInput);
  textarea.addEventListener("keydown", onKeyDown);
  textarea.addEventListener("blur", onBlur);
  textarea.addEventListener("click", onClick);

  // A hidden field has no height to fit; it fits its text when it shows, and when its width changes.
  const resized = new ResizeObserver(fit);
  resized.observe(field);

  // The picked item of the completion list stays in view.
  const picked = new MutationObserver(() => list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }));
  picked.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-selected", "hidden"] });

  textarea.value = text;
  fit();
  markStale();

  return {
    /** Writes the text and puts the caret at `at` (at the end when null); returns the caret's place. */
    setValue(value, at) {
      textarea.value = value;
      if (at != null) textarea.setSelectionRange(at, at);
      fit();
      markStale();
      return place();
    },
    dispose() {
      shown.disconnect();
      textarea.removeEventListener("input", onInput);
      textarea.removeEventListener("keydown", onKeyDown);
      textarea.removeEventListener("blur", onBlur);
      textarea.removeEventListener("click", onClick);
      resized.disconnect();
      picked.disconnect();
    },
  };
}
