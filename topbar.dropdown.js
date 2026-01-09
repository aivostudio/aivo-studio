/* =========================================================
   TOPBAR DROPDOWNS — SINGLE OWNER (Products + Corp + User)
   - Click to toggle
   - Outside click closes
   - ESC closes
   - Works on every page with same topbar HTML
   ========================================================= */
(function(){
  if (window.__AIVO_TOPBAR_DROPDOWNS__) return;
  window.__AIVO_TOPBAR_DROPDOWNS__ = true;

  const OPEN_CLASS = "is-open";

  function closestDropdownRoot(el){
    return el && el.closest ? el.closest(".nav-item.has-dropdown, .auth-user, #userMenuWrap") : null;
  }

  function closeAll(except){
    document.querySelectorAll(`.${OPEN_CLASS}`).forEach(n=>{
      if (except && (n === except || n.contains(except))) return;
      n.classList.remove(OPEN_CLASS);
      // aria-expanded sync
      const btn = n.querySelector(':scope > button[aria-haspopup="true"], :scope > button.nav-link[aria-haspopup="true"]');
      if (btn) btn.setAttribute("aria-expanded","false");
    });
  }

  function toggle(root){
    const willOpen = !root.classList.contains(OPEN_CLASS);
    closeAll(root);
    root.classList.toggle(OPEN_CLASS, willOpen);

    const btn = root.querySelector(':scope > button[aria-haspopup="true"], :scope > button.nav-link[aria-haspopup="true"]');
    if (btn) btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
  }

  // Click handlers: any button inside a dropdown root toggles it
  document.addEventListener("click", (e)=>{
    const t = e.target;

    // Toggle buttons:
    const btn = t.closest?.('.nav-item.has-dropdown > button, .auth-user > button, #userMenuWrap > button');
    if (btn){
      const root = closestDropdownRoot(btn);
      if (!root) return;
      e.preventDefault();
      e.stopPropagation();
      toggle(root);
      return;
    }

    // Click inside open panel should not close
    const insideOpen = t.closest?.(`.${OPEN_CLASS} .dropdown, .${OPEN_CLASS} #userMenuPanel`);
    if (insideOpen) return;

    // Outside closes
    closeAll();
  }, true);

  // ESC closes
  document.addEventListener("keydown", (e)=>{
    if (e.key === "Escape") closeAll();
  });
})();
