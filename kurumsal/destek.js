(() => {
  const root = document.querySelector(".faq");
  if (!root) return;

  const single = (root.getAttribute("data-accordion") || "single") === "single";
  const items = Array.from(root.querySelectorAll(".faq-item"));

  function closeItem(item){
    const btn = item.querySelector(".faq-q");
    const panel = item.querySelector(".faq-a");
    item.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
    panel.style.height = "0px";
  }

  function openItem(item){
    const btn = item.querySelector(".faq-q");
    const panel = item.querySelector(".faq-a");
    const inner = item.querySelector(".faq-a-inner");

    item.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
    panel.style.height = inner.scrollHeight + "px";
  }

  // init: kapalı
  items.forEach(closeItem);

  // click
  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".faq-q");
    if (!btn) return;

    const item = btn.closest(".faq-item");
    const isOpen = item.classList.contains("is-open");

    if (single) items.forEach(i => i !== item && closeItem(i));
    if (isOpen) closeItem(item);
    else openItem(item);
  });

  // resize: açık panel yüksekliğini güncelle
  window.addEventListener("resize", () => {
    items.forEach(item => {
      if (!item.classList.contains("is-open")) return;
      const panel = item.querySelector(".faq-a");
      const inner = item.querySelector(".faq-a-inner");
      panel.style.height = inner.scrollHeight + "px";
    });
  });
})();
