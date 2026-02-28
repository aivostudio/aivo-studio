(function () {
  /********************************************************************
   * AIVO – music.module.js (FULL BLOCK)
   * - Basic/Advanced mode toggle (sessionStorage)
   * - Char counters (prompt/lyrics)
   * - Record modal (Suno-style): open → record → stop → preview → save
   *   Save flow: presign-put → PUT blob → store public_url (hidden input)
   ********************************************************************/

  /* =========================
   * Small helpers
   * ========================= */
  const MODE_KEY = "aivo_music_mode";

  function $(root, sel) { return root.querySelector(sel); }
  function $all(root, sel) { return Array.from(root.querySelectorAll(sel)); }

  function toast(msg, type = "info") {
    // prefer existing toast system if present
    if (window.toast && typeof window.toast === "function") return window.toast(msg, type);
    if (window.Toast && typeof window.Toast.show === "function") return window.Toast.show(msg, type);
    console.log(`[toast:${type}]`, msg);
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function ensureHiddenRefUrlInput(module) {
    // We can’t programmatically set <input type="file"> for security.
    // Instead store recorded audio URL here so generator can use it.
    let el = module.querySelector("#refAudioUrl");
    if (!el) {
      el = document.createElement("input");
      el.type = "hidden";
      el.id = "refAudioUrl";
      el.name = "refAudioUrl";
      module.appendChild(el);
    }
    return el;
  }

  /* =========================
   * Char counters
   * ========================= */
  function initMusicCharCounters(module) {
    const counters = module.querySelectorAll(".char-counter[data-counter-for]");
    if (!counters || !counters.length) return;

    const bindOne = (counterEl) => {
      const id = counterEl.getAttribute("data-counter-for");
      if (!id) return;

      const ta = module.querySelector(`#${CSS.escape(id)}`);
      if (!ta) return;

      const maxAttr = ta.getAttribute("maxlength");
      const max =
        (maxAttr && Number(maxAttr)) ||
        (id === "lyrics" ? 5000 : id === "prompt" ? 500 : 0);

      if (ta.__aivoCounterBound) return;
      ta.__aivoCounterBound = true;

      counterEl.setAttribute("aria-live", "polite");

      const render = () => {
        const len = (ta.value || "").length;
        counterEl.textContent = `${len} / ${max}`;
        const over = max > 0 && len > max;
        counterEl.style.color = over ? "#ff4d6d" : "";
        counterEl.style.fontWeight = over ? "700" : "";
      };

      ta.addEventListener("input", render);
      render();
    };

    counters.forEach(bindOne);
  }

  /* =========================
   * Record modal UI
   * ========================= */
  function buildRecordModal() {
    const overlay = document.createElement("div");
    overlay.className = "aivoRecOverlay";
    overlay.innerHTML = `
      <div class="aivoRecModal" role="dialog" aria-modal="true" aria-label="Ses Kaydı">
        <button class="aivoRecClose" type="button" aria-label="Kapat">×</button>

        <div class="aivoRecTop">
          <div class="aivoRecTimer" aria-live="polite">00:00</div>
        </div>

        <div class="aivoRecBody">
          <div class="aivoRecWaveHint">Kayıt için kırmızı düğmeye bas</div>
        </div>

        <div class="aivoRecFooter">
          <button class="aivoRecBtn" type="button" aria-label="Kayıt Başlat/Durdur">
            <span class="dot"></span>
          </button>

          <div class="aivoRecActions" style="display:none;">
            <audio class="aivoRecAudio" controls preload="metadata"></audio>
            <div class="aivoRecActionRow">
              <button class="aivoRecReset" type="button">Baştan</button>
              <button class="aivoRecSave" type="button">Kaydet</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Minimal inline CSS (keeps it self-contained). If you already have modal CSS, you can remove this.
    const style = document.createElement("style");
    style.textContent = `
      .aivoRecOverlay{
        position: fixed; inset: 0; z-index: 99999;
        display:flex; align-items:center; justify-content:center;
        background: rgba(0,0,0,.55);
        backdrop-filter: blur(10px);
      }
      .aivoRecModal{
        width: min(720px, calc(100vw - 32px));
        border-radius: 22px;
        background: rgba(24,24,30,.92);
        border: 1px solid rgba(255,255,255,.08);
        box-shadow: 0 30px 90px rgba(0,0,0,.6);
        overflow: hidden;
        position: relative;
      }
      .aivoRecClose{
        position:absolute; right:14px; top:12px;
        width: 34px; height: 34px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.06);
        color:#fff; font-size:20px; line-height:1;
        cursor:pointer;
      }
      .aivoRecTop{ padding: 18px 18px 10px; display:flex; justify-content:center; }
      .aivoRecTimer{ font-weight:700; letter-spacing:.12em; color: rgba(255,255,255,.9); }
      .aivoRecBody{
        height: 280px;
        display:flex; align-items:center; justify-content:center;
        color: rgba(255,255,255,.45);
        user-select:none;
      }
      .aivoRecFooter{ padding: 14px 18px 18px; }
      .aivoRecBtn{
        width: 84px; height: 84px; border-radius: 999px;
        border: none; cursor:pointer;
        background: #ff3b30;
        box-shadow: 0 10px 30px rgba(255,59,48,.35);
        display:flex; align-items:center; justify-content:center;
        margin: 0 auto;
      }
      .aivoRecBtn .dot{
        width: 22px; height: 22px; border-radius: 6px;
        background: rgba(0,0,0,.25);
      }
      .aivoRecBtn.isRecording{
        background: #ff3b30;
      }
      .aivoRecBtn.isRecording .dot{
        width: 22px; height: 22px; border-radius: 4px;
        background: rgba(0,0,0,.25);
      }
      .aivoRecActions{ margin-top: 14px; }
      .aivoRecAudio{ width: 100%; }
      .aivoRecActionRow{
        display:flex; gap: 10px; margin-top: 10px;
      }
      .aivoRecReset, .aivoRecSave{
        flex:1;
        height: 44px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.06);
        color: #fff;
        cursor: pointer;
        font-weight: 700;
      }
      .aivoRecSave{
        background: rgba(255,255,255,.92);
        color: #111;
        border-color: rgba(255,255,255,.92);
      }
    `;
    overlay.appendChild(style);

    return overlay;
  }

  async function presignAndUploadAudio(blob) {
    // Uses your existing endpoint pattern from other modules.
    // Expected response: { ok:true, upload_url, public_url }
    const filename = `record-${Date.now()}.webm`;
    const contentType = blob.type || "audio/webm";

    const r = await fetch(`/api/r2/presign-put?filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(contentType)}`, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j || j.ok === false || !j.upload_url || !j.public_url) {
      throw new Error(j?.error || "presign_failed");
    }

    const put = await fetch(j.upload_url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob
    });

    if (!put.ok) throw new Error(`upload_failed_${put.status}`);
    return { public_url: j.public_url, filename, contentType };
  }

  function openRecordFlow(module) {
    // Idempotent: one modal at a time
    if (document.querySelector(".aivoRecOverlay")) return;

    const overlay = buildRecordModal();
    document.body.appendChild(overlay);

    const btnClose = overlay.querySelector(".aivoRecClose");
    const timerEl = overlay.querySelector(".aivoRecTimer");
    const recBtn = overlay.querySelector(".aivoRecBtn");
    const actions = overlay.querySelector(".aivoRecActions");
    const audioEl = overlay.querySelector(".aivoRecAudio");
    const btnReset = overlay.querySelector(".aivoRecReset");
    const btnSave = overlay.querySelector(".aivoRecSave");

    let stream = null;
    let recorder = null;
    let chunks = [];
    let startedAt = 0;
    let tick = null;
    let recordedBlob = null;
    let recordedUrl = null;

    function cleanupMedia() {
      try { if (tick) clearInterval(tick); } catch(e) {}
      tick = null;

      try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch(e) {}
      recorder = null;

      try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch(e) {}
      stream = null;

      chunks = [];
      startedAt = 0;

      try {
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      } catch(e) {}
      recordedUrl = null;
      recordedBlob = null;
    }

    function close() {
      cleanupMedia();
      overlay.remove();
    }

    function setTimer() {
      const sec = (Date.now() - startedAt) / 1000;
      timerEl.textContent = formatTime(sec);
    }

    btnClose.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    btnReset.addEventListener("click", () => {
      // Reset to initial state
      try {
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      } catch(e) {}
      recordedUrl = null;
      recordedBlob = null;
      audioEl.removeAttribute("src");
      actions.style.display = "none";
      recBtn.style.display = "";
      timerEl.textContent = "00:00";
    });

    recBtn.addEventListener("click", async () => {
      // Toggle record start/stop
      if (recorder && recorder.state === "recording") {
        // STOP
        try { recorder.stop(); } catch(e) {}
        recBtn.classList.remove("isRecording");
        return;
      }

      // START
      try {
        chunks = [];
        recordedBlob = null;
        recordedUrl = null;

        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size) chunks.push(ev.data);
        };

        recorder.onstop = () => {
          try { if (tick) clearInterval(tick); } catch(e) {}
          tick = null;

          // stop mic tracks
          try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch(e) {}
          stream = null;

          recordedBlob = new Blob(chunks, { type: "audio/webm" });
          recordedUrl = URL.createObjectURL(recordedBlob);

          audioEl.src = recordedUrl;
          actions.style.display = "";
          recBtn.style.display = "none";
        };

        startedAt = Date.now();
        timerEl.textContent = "00:00";
        tick = setInterval(setTimer, 250);

        recBtn.classList.add("isRecording");
        recorder.start();
      } catch (err) {
        console.error("[AIVO] record start failed:", err);
        toast("Mikrofon izni gerekli. Tarayıcıdan izin ver.", "error");
        cleanupMedia();
      }
    });

    btnSave.addEventListener("click", async () => {
      if (!recordedBlob) return;

      btnSave.disabled = true;
      btnSave.textContent = "Kaydediliyor...";

      try {
        const { public_url } = await presignAndUploadAudio(recordedBlob);

        // Store URL for generator to consume later
        const hidden = ensureHiddenRefUrlInput(module);
        hidden.value = public_url;

        // Also update UI text (upload box) if present, so user sees it “selected”
        const refBox = module.querySelector(".form-field:has(#refAudio) .upload-box, #refAudio");
        // safest: try to find label.upload-box under refAudio field
        const refLabel = module.querySelector(".form-field:has(#refAudio) label.upload-box");
        if (refLabel) {
          refLabel.classList.add("has-file");
          refLabel.innerHTML = `<strong>Kayıt hazır</strong><div style="opacity:.75; font-size:12px; margin-top:4px;">Ses kaydı yüklendi</div>`;
        }

        toast("Kayıt kaydedildi ✅", "success");
        close();
      } catch (e) {
        console.error("[AIVO] record save failed:", e);
        toast("Kayıt kaydedilemedi. (upload/presign)", "error");
        btnSave.disabled = false;
        btnSave.textContent = "Kaydet";
      }
    });
  }

  /* =========================
   * Main init
   * ========================= */
  function tryInit() {
    const module = document.querySelector("#moduleHost section[data-module='music']");
    if (!module) return false;

    const switchEl = module.querySelector(".mode-toggle");
    if (!switchEl) return false;

    const modeButtons = Array.from(switchEl.querySelectorAll("[data-mode-button]"));
    const advFields = Array.from(module.querySelectorAll('[data-visible-in="advanced"]'));

    function applyMode(mode) {
      const m = (mode === "advanced") ? "advanced" : "basic";
      module.setAttribute("data-mode", m);
      switchEl.dataset.active = m;
      try { sessionStorage.setItem(MODE_KEY, m); } catch(e) {}

      modeButtons.forEach((btn) => {
        const on = btn.dataset.modeButton === m;
        btn.classList.toggle("isActive", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });

      const showAdv = (m === "advanced");
      advFields.forEach((el) => {
        el.style.display = showAdv ? "" : "none";
      });
    }

    // default
    let saved = "basic";
    try { saved = sessionStorage.getItem(MODE_KEY) || "basic"; } catch(e) {}
    applyMode(saved);

    // bind mode click once
    if (!module.__aivo_mode_bound) {
      module.__aivo_mode_bound = true;
      module.addEventListener("click", (e) => {
        const btn = e.target.closest(".mode-toggle [data-mode-button]");
        if (!btn) return;
        applyMode(btn.dataset.modeButton);
      });
    }

    // counters
    initMusicCharCounters(module);

    // Record button -> modal (advanced only)
    // We bind once and gate by current mode at click time.
    if (!module.__aivo_record_bound) {
      module.__aivo_record_bound = true;
      module.addEventListener("click", (e) => {
        const recBtn = e.target.closest("#musicRecordBtn");
        if (!recBtn) return;

        const mode = module.getAttribute("data-mode") || "basic";
        if (mode !== "advanced") return;

        openRecordFlow(module);
      });
    }

    // backward compat
    window.switchMusicView = function () { return true; };

    console.log("[AIVO] music.module READY (mode toggle ok, counters ok, record modal ok)");
    return true;
  }

  if (tryInit()) return;

  const host = document.getElementById("moduleHost");
  if (!host) return;

  const obs = new MutationObserver(() => {
    if (tryInit()) obs.disconnect();
  });
  obs.observe(host, { childList: true, subtree: true });
})();
/* ============================================================================
   MUSIC — Reference Audio Upload (R2) ✅ single-bind + single-upload
   - Fixes: 2x presign-put → 1x (double bind / double upload engeli)
   - UI: "Hazır ✓" tek satır (fazla .upload-hint varsa boşaltır)
   - Aynı dosya tekrar seçilirse yeniden upload ETMEZ
   - Yeni dosya seçilirse eski upload’ı ABORT eder
   Target: #refAudio
   Writes: window.__MUSIC_REF_AUDIO_URL__  (generate payload burada okuyacak)
   Placement: /js/music.module.js içinde, şu blokla komple REPLACE et:
     // --- guard (double bind engeli)
     if (window.__MUSIC_REF_AUDIO_UPLOAD_BIND__) return;
     window.__MUSIC_REF_AUDIO_UPLOAD_BIND__ = true;
   ile başlayan ref-audio upload kısmının tamamı
   ============================================================================ */

(() => {
  // --- guard (double bind engeli)
  if (window.__MUSIC_REF_AUDIO_UPLOAD_BIND__) return;
  window.__MUSIC_REF_AUDIO_UPLOAD_BIND__ = true;

  // --- tiny helpers
  const qs  = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function setHint(text) {
    // HTML: <label class="upload-box" for="refAudio"> ... <span class="upload-hint">...</span>
    const box = qs('label.upload-box[for="refAudio"]');
    if (!box) return;

    const hints = qsa(".upload-hint", box);
    if (!hints.length) return;

    // ✅ tek satır: ilkine yaz, geri kalanları boşalt
    hints[0].textContent = String(text || "");
    for (let i = 1; i < hints.length; i++) hints[i].textContent = "";
  }

  function toast(type, msg) {
    try {
      const t = window.toast;
      if (type === "error"   && t?.error)   return t.error(msg);
      if (type === "success" && t?.success) return t.success(msg);
      if (t?.info) return t.info(msg);
    } catch {}
    console.log("[music.ref]", type, msg);
  }

  function fileSig(file) {
    if (!file) return "";
    // name+size+mtime aynıysa “aynı dosya” say
    return [file.name, file.size, file.lastModified].join("|");
  }

  // ---- Backend contract:
  // POST /api/r2/presign-put
  // body: { app:"music", kind:"audio", filename, contentType }
  // resp: { ok:true, uploadUrl/publicUrl } (snake_case varyantları da kabul)
  async function presignR2({ app, kind, filename, contentType, signal }) {
    const res = await fetch("/api/r2/presign-put", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal,
      body: JSON.stringify({
        app: app || "music",
        kind,
        filename,
        contentType,
      }),
    });

    if (!res.ok) throw new Error("presign_failed");
    const data = await res.json();
    if (!data || data.ok === false) throw new Error(data?.error || "presign_error");

    const uploadUrl = data.uploadUrl || data.upload_url;
    const publicUrl = data.publicUrl || data.public_url || data.url;
    if (!uploadUrl || !publicUrl) throw new Error("presign_missing_urls");

    return { uploadUrl, publicUrl };
  }

  async function uploadToR2(file, { app = "music", kind = "audio", signal } = {}) {
    if (!file) throw new Error("missing_file");

    const contentType = file.type || "application/octet-stream";
    const filename = file.name || `${kind}-${Date.now()}`;

    const { uploadUrl, publicUrl } = await presignR2({
      app,
      kind,
      filename,
      contentType,
      signal,
    });

    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
      signal,
    });

    if (!put.ok) throw new Error("r2_put_failed");
    return { url: publicUrl, name: filename };
  }

  // --- single bind to the INPUT (document-level change yerine)
  let lastSig = "";
  let inFlight = null; // { controller, sig }

  function bindOnce() {
    const input = qs("#refAudio");
    if (!input) return false;

    // ✅ input-level guard (tek listener)
    if (input.__aivoRefBound) return true;
    input.__aivoRefBound = true;

    input.addEventListener("change", async () => {
      const file = input.files && input.files[0] ? input.files[0] : null;

      // temizle
      if (!file) {
        // önceki upload varsa iptal
        try { inFlight?.controller?.abort?.(); } catch {}
        inFlight = null;
        lastSig = "";

        try { window.__MUSIC_REF_AUDIO_URL__ = ""; } catch {}
        setHint("MP3, WAV, M4A — maksimum 10MB");
        return;
      }

      // boyut guard (10MB)
      const MAX = 10 * 1024 * 1024;
      if (file.size > MAX) {
        toast("error", "Maksimum 10MB");
        try { input.value = ""; } catch {}
        try { window.__MUSIC_REF_AUDIO_URL__ = ""; } catch {}
        setHint("MP3, WAV, M4A — maksimum 10MB");
        return;
      }

      // ✅ aynı dosya tekrar seçildiyse: tekrar upload ETME
      const sig = fileSig(file);
      if (sig && sig === lastSig && window.__MUSIC_REF_AUDIO_URL__) {
        // UI’yı doğru göster (bazı durumlarda reset olabiliyor)
        setHint("Hazır ✓");
        return;
      }

      // ✅ yeni dosya: önceki upload’ı abort et
      try { inFlight?.controller?.abort?.(); } catch {}
      inFlight = null;

      const controller = new AbortController();
      inFlight = { controller, sig };

      setHint("Yükleniyor…");
      input.disabled = true;

      try {
        const out = await uploadToR2(file, {
          app: "music",
          kind: "audio",
          signal: controller.signal,
        });

        // eğer bu upload artık “en güncel” değilse (araya yeni dosya girdiyse) yazma
        if (!inFlight || inFlight.controller !== controller) return;

        // ✅ single source for generate payload
        window.__MUSIC_REF_AUDIO_URL__ = out.url;
        lastSig = sig;

        setHint("Hazır ✓");
        toast("success", "Referans ses yüklendi");
      } catch (err) {
        // abort ise sessiz geç
        if (err?.name === "AbortError") return;

        console.error("[MUSIC][R2] ref audio upload error:", err);
        try { window.__MUSIC_REF_AUDIO_URL__ = ""; } catch {}
        lastSig = "";
        setHint("Yükleme hatası");
        toast("error", "Yükleme hatası");
      } finally {
        // sadece “aktif controller” kapanıyorsa state temizle
        if (inFlight && inFlight.controller === controller) inFlight = null;
        input.disabled = false;
      }
    });

    return true;
  }

  // DOM hazır değilse kısa süre dene (tek bind olacak)
  bindOnce();
  setTimeout(bindOnce, 250);
  setTimeout(bindOnce, 800);
  setTimeout(bindOnce, 1600);
})();
