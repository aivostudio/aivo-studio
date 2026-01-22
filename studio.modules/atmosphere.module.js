// atmosphere.module.js — MAX 2 fix (data-atm-max="99" => sınırsız)
// Bu bloğu modülün init’inde root tanımlandıktan sonra kullan.

const MAX = Math.max(1, parseInt(root.dataset.atmMax || "99", 10));

root.addEventListener("click", (e) => {
  const btn = e.target.closest(".atm-pill");
  if (!btn) return;

  const isOn = btn.classList.contains("is-active");
  const active = [...root.querySelectorAll(".atm-pill.is-active")];

  // ✅ seçim açılacaksa ve limit doluysa engelle
  if (!isOn && active.length >= MAX) {
    window.toast?.error?.(MAX >= 99 ? "Sınırsız seçim açık olmalı (max=99). Başka script limitliyor olabilir." : `En fazla ${MAX} seçim yapabilirsin`);
    return;
  }

  // toggle
  btn.classList.toggle("is-active", !isOn);
  btn.setAttribute("aria-pressed", (!isOn) ? "true" : "false");

  // syncSelected() çağırıyorsan burada bırak
  if (typeof syncSelected === "function") syncSelected();
}, true); // capture=true → legacy çakışmasını azaltır
