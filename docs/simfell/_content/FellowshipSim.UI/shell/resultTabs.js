// Scrolling work of the desktop app's result tabs that C# cannot do: whether the tabs overflow their strip, the arrows
// and the mouse wheel that scroll it, and bringing the selected tab into view.

/** Marks the strip's wrapper with data-overflow, data-at-start and data-at-end, and wires its arrows and wheel. */
export function attach(wrapper) {
  const strip = wrapper.querySelector("[data-strip]");
  const update = () => {
    const overflow = strip.scrollWidth > strip.clientWidth + 1;
    wrapper.toggleAttribute("data-overflow", overflow);
    wrapper.toggleAttribute("data-at-start", strip.scrollLeft <= 1);
    wrapper.toggleAttribute("data-at-end", strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1);
  };
  const onClick = (event) => {
    const arrow = event.target instanceof Element ? event.target.closest("[data-scroll]") : null;
    if (!arrow || !wrapper.contains(arrow)) return;
    strip.scrollBy({ left: Number(arrow.dataset.scroll) * strip.clientWidth * 0.8, behavior: "smooth" });
  };
  // A vertical wheel turn scrolls the strip sideways.
  const onWheel = (event) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollLeft += event.deltaY;
    event.preventDefault();
  };
  const resized = new ResizeObserver(update);
  resized.observe(strip);
  const changed = new MutationObserver(update);
  changed.observe(strip, { childList: true, subtree: true });
  strip.addEventListener("scroll", update, { passive: true });
  strip.addEventListener("wheel", onWheel, { passive: false });
  wrapper.addEventListener("click", onClick);
  update();
  return {
    dispose: () => {
      resized.disconnect();
      changed.disconnect();
      strip.removeEventListener("scroll", update);
      strip.removeEventListener("wheel", onWheel);
      wrapper.removeEventListener("click", onClick);
    },
  };
}

/** Scrolls the selected result tab into view. */
export function reveal(wrapper) {
  wrapper.querySelector("[data-strip] .selected")?.scrollIntoView({ block: "nearest", inline: "nearest" });
}
