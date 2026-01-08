(() => {
  const root = document.querySelector(".faq");
  if (!root) return;

  const single = (root.getAttribute("data-accordion") || "single") === "single";
  const items = Array.from(root.querySelectorAll(".faq-item"));

  function getParts(item){
    const btn = item && item.querySelector ? item.querySelector(".faq-q") : null;
    const panel = item && item.querySelector ? item.querySelector(".faq-a") : null;
    const inner = item && item.querySelector ? item.querySelector(".faq-a-inner") : null;
    return { btn, panel, inner };
  }

  function closeItem(item){
    const { btn, panel } = getParts(item);
    if (!btn || !panel) return;
    item.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
    panel.style.height = "0px";
  }

  function openItem(item){
    const { btn, panel, inner } = getParts(item);
    if (!btn || !panel || !inner) return;
    item.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
    panel.style.height = inner.scrollHeight + "px";
  }

  items.forEach(closeItem);

  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".faq-q");
    if (!btn) return;

    const item = btn.closest(".faq-item");
    if (!item) return;

    const isOpen = item.classList.contains("is-open");

    if (single) items.forEach(i => i !== item && closeItem(i));
    if (isOpen) closeItem(item);
    else openItem(item);
  });

  window.addEventListener("resize", () => {
    items.forEach(item => {
      if (!item.classList.contains("is-open")) return;
      const { panel, inner } = getParts(item);
      if (!panel || !inner) return;
      panel.style.height = inner.scrollHeight + "px";
    });
  });
})();
