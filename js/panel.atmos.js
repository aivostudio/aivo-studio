(function () {
  function hookSuperPromptCounter() {
    const el = document.getElementById("atmSuperPrompt");
    const out = document.getElementById("atmSuperPromptCount");
    if (!el || !out) return false;

    if (el.__atmCounterBound) return true;
    el.__atmCounterBound = true;

    const update = () => {
      const n = el.value.length || 0;
      out.textContent = String(n);
      out.style.color = (n > 900) ? "#ff6b6b" : "rgba(255,255,255,.7)";
    };

    update();
    el.addEventListener("input", update);
    return true;
  }

  // Panel mount sonrası yakalamak için
  const observer = new MutationObserver(() => {
    hookSuperPromptCounter();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // İlk deneme
  hookSuperPromptCounter();
})();

