/* /studio.modules/atmosphere.module.js?v=7
   AIVO — AI Atmosfer Video (Basit Mod)
   - Atmosfer: max 2 seçim (tek tıkla seç / kaldır)
   - Uyarı kutusu: #atmWarn
   - CTA kredi: 20
*/

(() => {
  'use strict';

  // ---------- HELPERS ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function toast(type, msg) {
    // varsa global toast manager'ı kullan
    if (window.toast && typeof window.toast[type] === 'function') return window.toast[type](msg);
    if (window.toast && typeof window.toast.show === 'function') return window.toast.show(type, msg);
    // fallback
    console[type === 'error' ? 'error' : 'log']('[toast]', msg);
  }

  // ---------- STATE ----------
  const STATE = {
    mode: 'basic',            // şimdilik basic
    scene: null,              // örn: 'kiskafe'
    effects: [],              // max 2: ['snow','light']
    camera: 'kenburns_soft',  // default
    duration: '8',            // default (string)
    logo: {
      file: null,
      pos: 'br',
      size: 'sm',
      opacity: 0.9
    },
    audio: {
      file: null,
      mode: 'none',
      trim: 'loop_to_fit',
      silentCopy: true
    }
  };

  // ---------- BINDINGS ----------
  function bindAtmosphereEffects() {
    const wrap = $('#atmEffects');
    const warn = $('#atmWarn');
    if (!wrap) return;

    const pills = $$('[data-atm-eff]', wrap);

    const render = () => {
      pills.forEach(btn => {
        const eff = btn.dataset.atmEff;
        const on = STATE.effects.includes(eff);
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (warn) {
        warn.style.display = 'none';
        warn.textContent = '';
      }
    };

    const showWarn = (msg) => {
      if (!warn) return;
      warn.textContent = msg;
      warn.style.display = 'block';
      clearTimeout(showWarn.__t);
      showWarn.__t = setTimeout(() => { warn.style.display = 'none'; }, 1200);
    };

    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-atm-eff]');
      if (!btn) return;

      const eff = btn.dataset.atmEff;

      // 1) seçiliyse kaldır
      if (STATE.effects.includes(eff)) {
        STATE.effects = STATE.effects.filter(x => x !== eff);
        render();
        return;
      }

      // 2) seçili değilse — limit doluysa engelle
      if (STATE.effects.length >= 2) {
        showWarn('En fazla 2 atmosfer seçebilirsin.');
        return;
      }

      // 3) ekle (tek tık)
      STATE.effects = [...STATE.effects, eff];
      render();
    }, { passive: true });

    render();
  }

  function bindCameraDuration() {
    const cam = $('#atmCamera');
    const dur = $('#atmDuration');
    if (cam) {
      cam.addEventListener('change', () => { STATE.camera = cam.value; }, { passive: true });
      STATE.camera = cam.value || STATE.camera;
    }
    if (dur) {
      dur.addEventListener('change', () => { STATE.duration = dur.value; }, { passive: true });
      STATE.duration = dur.value || STATE.duration;
    }
  }

  function bindLogoAudio() {
    const logoFile = $('#atmLogoFile');
    const logoPos = $('#atmLogoPos');
    const logoSize = $('#atmLogoSize');
    const logoOpacity = $('#atmLogoOpacity');

    if (logoFile) {
      logoFile.addEventListener('change', () => {
        STATE.logo.file = logoFile.files && logoFile.files[0] ? logoFile.files[0] : null;
      });
    }
    if (logoPos) {
      logoPos.addEventListener('change', () => { STATE.logo.pos = logoPos.value; }, { passive: true });
      STATE.logo.pos = logoPos.value || STATE.logo.pos;
    }
    if (logoSize) {
      logoSize.addEventListener('change', () => { STATE.logo.size = logoSize.value; }, { passive: true });
      STATE.logo.size = logoSize.value || STATE.logo.size;
    }
    if (logoOpacity) {
      logoOpacity.addEventListener('input', () => { STATE.logo.opacity = parseFloat(logoOpacity.value || '0.9'); }, { passive: true });
      STATE.logo.opacity = parseFloat(logoOpacity.value || '0.9');
    }

    const audioFile = $('#atmAudioFile');
    const audioMode = $('#atmAudioMode');
    const audioTrim = $('#atmAudioTrim');
    const silentCopy = $('#atmSilentCopy');

    if (audioFile) {
      audioFile.addEventListener('change', () => {
        STATE.audio.file = audioFile.files && audioFile.files[0] ? audioFile.files[0] : null;
      });
    }
    if (audioMode) {
      audioMode.addEventListener('change', () => { STATE.audio.mode = audioMode.value; }, { passive: true });
      STATE.audio.mode = audioMode.value || STATE.audio.mode;
    }
    if (audioTrim) {
      audioTrim.addEventListener('change', () => { STATE.audio.trim = audioTrim.value; }, { passive: true });
      STATE.audio.trim = audioTrim.value || STATE.audio.trim;
    }
    if (silentCopy) {
      silentCopy.addEventListener('change', () => { STATE.audio.silentCopy = !!silentCopy.checked; }, { passive: true });
      STATE.audio.silentCopy = !!silentCopy.checked;
    }
  }

  // Sahne kartları senin HTML'de data-atm-scene ile gelirse (opsiyonel)
  function bindScenesOptional() {
    const root = document.querySelector('[data-page="atmosphere"], .page-atmosphere, #atmRoot, #atmPanelBasic, #atmPanel');
    if (!root) return;

    const sceneButtons = $$('[data-atm-scene]', root);
    if (!sceneButtons.length) return;

    const render = () => {
      sceneButtons.forEach(btn => {
        const id = btn.dataset.atmScene;
        const on = STATE.scene === id;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    };

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-atm-scene]');
      if (!btn) return;
      const id = btn.dataset.atmScene;
      STATE.scene = (STATE.scene === id) ? null : id;
      render();
    }, { passive: true });

    render();
  }

  function bindGenerate() {
    const btn = $('#atmGenerateBtn');
    if (!btn) return;

    // CTA text/kredi sabitle (Basit = 20)
    btn.textContent = 'Atmosfer Video Oluştur (20 Kredi)';

    btn.addEventListener('click', async () => {
      // Basit doğrulamalar
      if (!STATE.scene && !(STATE.logo && STATE.logo.file)) {
        // sahne seçimi yoksa yine de izin veriyorsan kaldır; yoksa uyar
        // toast('error', 'Önce bir sahne seçmelisin.');
        // return;
      }

      if (STATE.effects.length < 1) {
        toast('error', 'En az 1 atmosfer seçmelisin.');
        return;
      }

      // Burada backend / jobs entegrasyonu sende.
      // Şimdilik state’i console’a basıp sağ panele job eklemeniz için payload üretelim.
      const payload = {
        type: 'atmosphere_video',
        mode: 'basic',
        credits: 20,
        scene: STATE.scene,
        effects: [...STATE.effects],
        camera: STATE.camera,
        duration: STATE.duration,
        logo: {
          hasFile: !!STATE.logo.file,
          pos: STATE.logo.pos,
          size: STATE.logo.size,
          opacity: STATE.logo.opacity
        },
        audio: {
          hasFile: !!STATE.audio.file,
          mode: STATE.audio.mode,
          trim: STATE.audio.trim,
          silentCopy: STATE.audio.silentCopy
        },
        ts: Date.now()
      };

      // Eğer jobs sistemi varsa burada enqueue edin:
      // window.jobs?.enqueue?.(payload) vb.
      console.log('[ATMOSFER PAYLOAD]', payload);
      toast('success', 'Atmosfer işi kuyruğa eklendi (demo).');

      // İsterseniz burada gerçek API çağrısı yaparsınız:
      // await fetch('/api/jobs/create', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    }, { passive: true });
  }

  // ---------- INIT ----------
  function init() {
    // sayfa/panel gerçekten var mı?
    const hasAtm = document.getElementById('atmEffects') || document.querySelector('[data-page="atmosphere"]') || document.querySelector('.page-atmosphere');
    if (!hasAtm) return;

    bindScenesOptional();
    bindAtmosphereEffects();
    bindCameraDuration();
    bindLogoAudio();
    bindGenerate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
