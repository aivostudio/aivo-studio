// ✅ Generate öncesi legacy validate köprüsü (en az 1 seç uyarısını bitirir)
(() => {
  const root = document.getElementById("atmEffects");
  const btn = document.getElementById("atmGenerateBtn");
  if (!root || !btn) return;

  const ensureLegacyState = () => {
    const hidden = document.getElementById("atmEffectsValue");

    // checkbox modelinden oku (label + input)
    const selected = [...root.querySelectorAll(".atm-check")]
      .filter(c => c.checked)
      .map(c => c.value);

    const val = selected.join(",");

    // legacy kaynaklar
    root.dataset.selected = val;
    if (hidden) hidden.value = val;

    // ekstra: legacy button selector arıyorsa diye class garanti (zaten var ama emin olalım)
    [...root.querySelectorAll(".atm-pill")].forEach(lab => {
      const inp = lab.querySelector(".atm-check");
      const on = !!inp?.checked;
      lab.classList.toggle("is-active", on);
      lab.setAttribute("aria-pressed", on ? "true" : "false");
    });

    // debug (istersen sonra sil)
    console.log("[ATM PRE-SUBMIT] selected:", selected, "hidden:", hidden?.value, "ds:", root.dataset.selected);
  };

  // capture=true → diğer click handler’lardan önce çalışsın
  btn.addEventListener("click", ensureLegacyState, true);
})();
