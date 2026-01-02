// =========================================================
// INDEX MODULE ROUTER (A/B intent)
// - studio.js'e dokunmadan, vitrin kartından "hangi modül" seçildiğini saklar
// =========================================================
(() => {
  if (window.__AIVO_INDEX_MODULES__) return;
  window.__AIVO_INDEX_MODULES__ = true;

  // capture phase: auth gate'in öncesinde intent yazılsın
  document.addEventListener(
    "click",
    (e) => {
      const el = e.target.closest("[data-next-tool]");
      if (!el) return;

      const tool = (el.getAttribute("data-next-tool") || "").trim();
      if (!tool) return;

      try {
        localStorage.setItem("aivo_next_tool", tool);
        localStorage.setItem("aivo_next_tool_ts", String(Date.now()));
      } catch (_) {}
    },
    true
  );
})();
(() => {
  const els = document.querySelectorAll("#ab-pack .sm-pack__note--press");
  if (!els.length) return;

  const pressOn  = (el) => el.classList.add("is-press");
  const pressOff = (el) => el.classList.remove("is-press");

  els.forEach(el => {
    el.addEventListener("touchstart", () => pressOn(el), { passive: true });
    el.addEventListener("touchend",   () => pressOff(el));
    el.addEventListener("touchcancel",() => pressOff(el));

    el.addEventListener("mousedown",  () => pressOn(el));
    el.addEventListener("mouseup",    () => pressOff(el));
    el.addEventListener("mouseleave", () => pressOff(el));

    // klavye ile de basılsın (Enter/Space)
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { pressOn(el); }
    });
    el.addEventListener("keyup", (e) => {
      if (e.key === "Enter" || e.key === " ") { pressOff(el); }
    });
  });
})();
