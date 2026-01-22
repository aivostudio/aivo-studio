// studio.modules/atmosphere.module.js
(() => {
  // Tek otorite state
  const STATE = (window.__ATM_STATE__ ||= {
    effects: [],
    maxEffects: 3,
  });

  // DOM refs
  const ROOT_SEL = '#atmRoot';           // atmosfere ait kapsayıcı (yoksa ekle)
  const LIST_SEL = '#atmEffects';        // butonların listesi (ID tek olmalı!)
  const BTN_SEL  = '[data-atm-effect]';  // butonların attribute'u
  const SUBMIT_SEL = '[data-atm-generate]'; // "Atmosfer Video Oluştur" butonu

  let root, list;

  function uniq(arr) {
    return Array.from(new Set(arr));
  }

  function setEffects(next) {
    STATE.effects = uniq(next).slice(0, STATE.maxEffects);
    render();
  }

  function toggleEffect(effect) {
    const has = STATE.effects.includes(effect);
    const next = has ? STATE.effects.filter(x => x !== effect) : [...STATE.effects, effect];
    setEffects(next);
  }

  function render() {
    if (!list) return;

    // Buton active state
    list.querySelectorAll(BTN_SEL).forEach(btn => {
      const key = btn.getAttribute('data-atm-effect');
      btn.classList.toggle('is-active', STATE.effects.includes(key));
      btn.setAttribute('aria-pressed', STATE.effects.includes(key) ? 'true' : 'false');
    });

    // (opsiyonel) valid state göstergesi
    root?.classList.toggle('has-selection', STATE.effects.length > 0);
  }

  function validateOrToast() {
    if (STATE.effects.length < 1) {
      // Projedeki tek toast sistemine uyumlu:
      if (window.toast?.error) window.toast.error('En az 1 atmosfer seçmelisin');
      else alert('En az 1 atmosfer seçmelisin');
      return false;
    }
    return true;
  }

  function onClickCapture(e) {
    // Sadece Atmosfer alanında “tek beyin” ol: diğer handler’ların yutmasını engelle
    if (!root || !root.contains(e.target)) return;

    // Capture’da yakala, burada kilitle
    e.preventDefault();
    e.stopPropagation();

    const effectBtn = e.target.closest(BTN_SEL);
    if (effectBtn) {
      const effect = effectBtn.getAttribute('data-atm-effect');
      toggleEffect(effect);
      return;
    }

    const submitBtn = e.target.closest(SUBMIT_SEL);
    if (submitBtn) {
      if (!validateOrToast()) return;

      // Burada artık üretim çağrın neyse onu tetikle (şimdilik örnek)
      // window.atmosphereGenerate?.({ effects: STATE.effects });
      if (window.toast?.success) window.toast.success(`Seçimler: ${STATE.effects.join(', ')}`);
      return;
    }
  }

  function mount() {
    root = document.querySelector(ROOT_SEL) || document; // atmRoot yoksa dokümana düşer ama yine de çalışır
    list = document.querySelector(LIST_SEL);

    // KRİTİK: ID çakışmasını burada yakala
    const dup = document.querySelectorAll(LIST_SEL);
    if (dup.length > 1) {
      console.warn('[ATM] #atmEffects duplicate:', dup.length);
    }

    // Capture listener: diğer JS katmanlarını “bypass”
    window.addEventListener('click', onClickCapture, true);
    render();
  }

  // Dışarı küçük API
  window.atmosphere = {
    mount,
    getState: () => ({ ...STATE, effects: [...STATE.effects] }),
    setEffects,
    clear: () => setEffects([]),
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
