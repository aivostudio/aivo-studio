// /studio.modules/atmosphere.module.js
(() => {
  try {
    const STATE = (window.__ATM_STATE__ = window.__ATM_STATE__ || {
      effects: [],
      maxEffects: 2,
    });

    const PAGE_SEL = '[data-page="atmosphere"]';
    const WRAP_SEL = '#atmEffects';
    const BTN_SEL = '[data-atm-eff]';
    const WARN_SEL = '#atmWarn';
    const GEN_SEL  = '[data-atm-generate]';

    function uniq(arr) {
      return Array.from(new Set((arr || []).filter(Boolean)));
    }

    function clampState() {
      STATE.effects = uniq(STATE.effects).slice(0, STATE.maxEffects);
    }

    function getPage() {
      return document.querySelector(PAGE_SEL);
    }

    function isAtmosphereActive(page) {
      // bazı yerlerde "is-active" class'ı page'e basılıyor
      // yoksa da sayfa DOM'da ise çalışsın
      if (!page) return false;
      if (page.classList.contains('is-active')) return true;
      // fallback: page görünür ise (display none değilse)
      const cs = getComputedStyle(page);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
    }

    function setWarn(page, msg) {
      const warn = page.querySelector(WARN_SEL);
      if (!warn) return;
      if (!msg) {
        warn.style.display = 'none';
        warn.textContent = '';
        return;
      }
      warn.textContent = msg;
      warn.style.display = 'block';
    }

    function syncUI(page) {
      clampState();
      const wrap = page.querySelector(WRAP_SEL);
      if (!wrap) return;

      const selected = new Set(STATE.effects);

      wrap.querySelectorAll(BTN_SEL).forEach((btn) => {
        const key = btn.getAttribute('data-atm-eff');
        const on = selected.has(key);
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');

        // ✅ KRİTİK: asla disabled etme (tıklanabilir kalsın)
        btn.disabled = false;
        btn.removeAttribute('disabled');
        btn.style.pointerEvents = 'auto';
      });
    }

    function toggleEffect(page, key) {
      clampState();
      const selected = new Set(STATE.effects);

      if (selected.has(key)) {
        selected.delete(key);
        STATE.effects = Array.from(selected);
        setWarn(page, '');
        syncUI(page);
        return;
      }

      if (selected.size >= STATE.maxEffects) {
        setWarn(page, `En fazla ${STATE.maxEffects} seçim. Önce birini kaldır.`);
        // UI'yi değiştirmiyoruz (3. seçim yok)
        return;
      }

      selected.add(key);
      STATE.effects = Array.from(selected);
      setWarn(page, '');
      syncUI(page);
    }

    function handleEffectClick(e) {
      const page = getPage();
      if (!page) return;

      // sadece atmosphere görünürken
      if (!isAtmosphereActive(page)) return;

      const btn = e.target && e.target.closest ? e.target.closest(`${WRAP_SEL} ${BTN_SEL}`) : null;
      if (!btn) return;

      const wrap = page.querySelector(WRAP_SEL);
      if (!wrap || !wrap.contains(btn)) return;

      // ✅ capture: önce biz yakalayalım
      e.preventDefault();
      e.stopPropagation();

      const key = btn.getAttribute('data-atm-eff');
      if (!key) return;
      toggleEffect(page, key);
    }

    function handleGenerate(e) {
      const page = getPage();
      if (!page) return;
      if (!isAtmosphereActive(page)) return;

      const btn = e.target && e.target.closest ? e.target.closest(GEN_SEL) : null;
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      const mode = btn.getAttribute('data-atm-mode') || 'basic';

      clampState();
      if (!STATE.effects.length) {
        setWarn(page, 'En az 1 atmosfer seçmelisin.');
        // toast varsa:
        window.toast?.error?.('En az 1 atmosfer seçmelisin.');
        return;
      }

      // ✅ şimdilik sadece log/placeholder (backend daha sonra)
      const payload = {
        mode,
        credits: mode === 'basic' ? 20 : 30,
        effects: STATE.effects.slice(),
        camera: document.querySelector('#atmCamera')?.value || 'kenburns_soft',
        duration: Number(document.querySelector('#atmDuration')?.value || 8),
      };

      console.log('[ATM] generate payload:', payload);
      window.toast?.success?.(`Atmosfer isteği alındı (${payload.credits} kredi).`);
    }

    // ✅ GLOBAL CAPTURE LISTENERS (başka js yutsa bile önce biz)
    document.addEventListener('click', handleEffectClick, true);
    document.addEventListener('click', handleGenerate, true);

    // ilk sync
    const page = getPage();
    if (page) {
      // başlangıçta yanlışlıkla html'den is-active basıldıysa temizle
      page.querySelectorAll(`${WRAP_SEL} ${BTN_SEL}.is-active`).forEach((b) => b.classList.remove('is-active'));
      // state boş başlasın
      STATE.effects = Array.isArray(STATE.effects) ? STATE.effects : [];
      clampState();
      syncUI(page);
      setWarn(page, '');
    }

    console.log('[ATM] module mounted ✅', { effects: STATE.effects, max: STATE.maxEffects });
  } catch (err) {
    console.error('[ATM] module error:', err);
  }
})();
