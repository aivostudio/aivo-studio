// ✅ ATM FIX — submit/click handler'ının EN BAŞINA yapıştır (return'lü)
const atmRoot = document.getElementById('atmEffects');
const atmEffects = atmRoot
  ? Array.from(atmRoot.querySelectorAll('button.atm-pill[aria-pressed="true"], button.atm-pill.is-active'))
      .map(b => b.dataset.atmEff)
      .filter(Boolean)
  : [];

window.STATE = window.STATE || {};
window.STATE.atmosphere = window.STATE.atmosphere || {};
window.STATE.atmosphere.effects = atmEffects;

// legacy fallback
window.STATE.effects = atmEffects;
window.STATE.atmEffects = atmEffects;

if (!atmEffects.length) {
  const warn = document.getElementById('atmWarn');
  if (warn) {
    warn.style.display = 'block';
    warn.textContent = 'En az 1 atmosfer seçmelisin.';
    clearTimeout(warn._t);
    warn._t = setTimeout(() => (warn.style.display = 'none'), 1500);
  }
  return;
}
