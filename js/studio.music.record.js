// /js/studio.music.record.js
(function () {
  "use strict";

  const SELECTORS = {
    module: "#moduleHost section[data-module='music']",
    recordBtn: "#musicRecordBtn",
    refAudioInput: "#refAudio",
  };

  // ---------- tiny helpers ----------
  const pad2 = (n) => String(n).padStart(2, "0");
  const fmtTime = (sec) => `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}`;

  function injectCSSOnce() {
    if (document.getElementById("aivoRecCSS")) return;
    const css = document.createElement("style");
    css.id = "aivoRecCSS";
    css.textContent = `
      .aivoRecOverlay{
        position:fixed; inset:0; z-index:99999;
        background:rgba(0,0,0,.55);
        display:flex; align-items:center; justify-content:center;
        backdrop-filter: blur(6px);
      }
      .aivoRecModal{
        width:min(920px, calc(100vw - 32px));
        height:min(560px, calc(100vh - 32px));
        border-radius:18px;
        background:rgba(18,18,22,.92);
        border:1px solid rgba(255,255,255,.10);
        box-shadow: 0 30px 90px rgba(0,0,0,.55);
        position:relative;
        display:flex; flex-direction:column;
        overflow:hidden;
      }
      .aivoRecTop{
        padding:16px 18px;
        display:flex; align-items:center; justify-content:center;
        position:relative;
      }
      .aivoRecTime{
        font-weight:800;
        letter-spacing:.12em;
        color:rgba(255,255,255,.92);
        font-size:20px;
      }
      .aivoRecClose{
        position:absolute; right:14px; top:12px;
        width:38px; height:38px;
        border-radius:999px;
        border:1px solid rgba(255,255,255,.14);
        background:rgba(255,255,255,.06);
        color:#fff;
        cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        font-size:22px;
      }
      .aivoRecBody{
        flex:1;
        display:flex;
        align-items:center;
        justify-content:center;
        padding: 10px 18px 0;
      }
      .aivoRecCanvas{
        width:100%;
        height:100%;
        border-radius:14px;
        background:rgba(255,255,255,.02);
      }
      .aivoRecHint{
        position:absolute;
        left:50%; top:54%;
        transform:translate(-50%,-50%);
        color:rgba(255,255,255,.35);
        font-weight:600;
        pointer-events:none;
        text-align:center;
      }
      .aivoRecBottom{
        padding: 12px 18px 18px;
        display:flex; align-items:center; justify-content:center;
        border-top:1px solid rgba(255,255,255,.06);
      }
      .aivoRecBtn{
        width:88px; height:88px;
        border-radius:999px;
        border:none;
        cursor:pointer;
        background: #ff3b30;
        box-shadow: 0 12px 40px rgba(255,59,48,.30);
        position:relative;
        display:flex; align-items:center; justify-content:center;
        outline:none;
      }
      .aivoRecBtn::after{
        content:"";
        width:30px; height:30px;
        border-radius:10px;
        background: rgba(0,0,0,.35);
        box-shadow: inset 0 0 0 2px rgba(255,255,255,.10);
      }
      /* recording state = blink/pulse */
      .aivoRecBtn.is-recording{
        animation: aivoRecPulse 1s ease-in-out infinite;
        box-shadow: 0 14px 60px rgba(255,59,48,.45);
      }
      .aivoRecBtn.is-recording::after{
        background: rgba(0,0,0,.45);
      }
      @keyframes aivoRecPulse{
        0%{ filter:brightness(1); transform:scale(1); }
        50%{ filter:brightness(1.18); transform:scale(1.04); }
        100%{ filter:brightness(1); transform:scale(1); }
      }

      /* preview area */
      .aivoRecPreview{
        padding: 16px 18px 18px;
        display:flex;
        gap:14px;
        align-items:center;
        justify-content:space-between;
        border-top:1px solid rgba(255,255,255,.06);
      }
      .aivoRecAudio{
        width:100%;
        max-width:520px;
      }
      .aivoRecSave{
        height:44px;
        padding:0 18px;
        border-radius:12px;
        border:1px solid rgba(255,255,255,.14);
        background:rgba(255,255,255,.10);
        color:#fff;
        font-weight:800;
        cursor:pointer;
        white-space:nowrap;
      }
    `;
    document.head.appendChild(css);
  }

  // ---------- recorder modal ----------
  function createModal() {
    injectCSSOnce();

    const overlay = document.createElement("div");
    overlay.className = "aivoRecOverlay";
    overlay.innerHTML = `
      <div class="aivoRecModal" role="dialog" aria-modal="true">
        <div class="aivoRecTop">
          <div class="aivoRecTime">00:00</div>
          <button class="aivoRecClose" aria-label="Kapat">×</button>
        </div>

        <div class="aivoRecBody">
          <canvas class="aivoRecCanvas"></canvas>
          <div class="aivoRecHint">Kayıt için kırmızı düğmeye bas</div>
        </div>

        <div class="aivoRecBottom">
          <button class="aivoRecBtn" aria-label="Kayıt başlat / durdur"></button>
        </div>

        <div class="aivoRecPreview" style="display:none">
          <audio class="aivoRecAudio" controls preload="metadata"></audio>
          <button class="aivoRecSave">Save</button>
        </div>
      </div>
    `;

    const modal = overlay.querySelector(".aivoRecModal");
    const closeBtn = overlay.querySelector(".aivoRecClose");
    const timeEl = overlay.querySelector(".aivoRecTime");
    const hintEl = overlay.querySelector(".aivoRecHint");
    const canvas = overlay.querySelector(".aivoRecCanvas");
    const recBtn = overlay.querySelector(".aivoRecBtn");
    const preview = overlay.querySelector(".aivoRecPreview");
    const audioEl = overlay.querySelector(".aivoRecAudio");
    const saveBtn = overlay.querySelector(".aivoRecSave");

    return { overlay, modal, closeBtn, timeEl, hintEl, canvas, recBtn, preview, audioEl, saveBtn };
  }

function fitCanvas(canvas) {
  const parent = canvas.parentElement;
  const width = parent.clientWidth;
  const height = parent.clientHeight;

  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  // CSS size (layout)
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  // Backing store (pixel)
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  // ❗️setTransform YOK (double-scale’i kesiyoruz)
  return { w: canvas.width, h: canvas.height, dpr };
}

  function drawWaveformLoop(ctx, canvas, analyser, dataArray, stopFlagRef) {
    const { w, h } = fitCanvas(canvas);

    function tick() {
      if (stopFlagRef.stop) return;

      // background
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.00)";
      ctx.fillRect(0, 0, w, h);

      // midline
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // waveform
      analyser.getByteTimeDomainData(dataArray);

      ctx.strokeStyle = "rgba(255,255,255,0.60)";
      ctx.lineWidth = 3;
      ctx.beginPath();

      const sliceWidth = w / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0; // 0..2
        const y = (v * h) / 2;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
      }

      ctx.lineTo(w, h / 2);
      ctx.stroke();

      requestAnimationFrame(tick);
    }

    tick();
  }

  async function openRecorder(moduleEl) {
    const ui = createModal();
    document.body.appendChild(ui.overlay);

    // lock scroll
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    let stream = null;
    let mediaRecorder = null;
    let chunks = [];
    let startedAt = 0;
    let timer = null;

    // WebAudio
    let audioCtx = null;
    let analyser = null;
    let dataArray = null;
    let drawStop = { stop: false };

    function cleanup(full = true) {
      try { clearInterval(timer); } catch (_) {}
      timer = null;

      drawStop.stop = true;

      try { mediaRecorder && mediaRecorder.state !== "inactive" && mediaRecorder.stop(); } catch (_) {}
      mediaRecorder = null;

      try { stream && stream.getTracks().forEach(t => t.stop()); } catch (_) {}
      stream = null;

      try { audioCtx && audioCtx.state !== "closed" && audioCtx.close(); } catch (_) {}
      audioCtx = null;
      analyser = null;
      dataArray = null;

      if (full) {
        document.documentElement.style.overflow = prevOverflow || "";
        ui.overlay.remove();
      }
    }

    function setTime(sec) {
      ui.timeEl.textContent = fmtTime(sec);
    }

    function showPreview(blob) {
      ui.preview.style.display = "";
      ui.audioEl.src = URL.createObjectURL(blob);
      ui.hintEl.textContent = "Kaydı dinle → Save ile ekle";
      ui.recBtn.classList.remove("is-recording");
    }

    async function ensureStream() {
      if (stream) return stream;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // analyser pipeline for waveform
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      dataArray = new Uint8Array(analyser.fftSize);

      source.connect(analyser);

      // start drawing immediately (as soon as stream exists)
      const ctx = ui.canvas.getContext("2d");
      drawStop = { stop: false };
      drawWaveformLoop(ctx, ui.canvas, analyser, dataArray, drawStop);

      return stream;
    }

    function startTimer() {
      startedAt = Date.now();
      setTime(0);
      timer = setInterval(() => {
        const sec = Math.floor((Date.now() - startedAt) / 1000);
        setTime(sec);
      }, 250);
    }

    async function startRecording() {
      chunks = [];
      ui.hintEl.textContent = "Kayıt alınıyor… tekrar basınca durur";
      ui.preview.style.display = "none";
      ui.recBtn.classList.add("is-recording");

      const s = await ensureStream();

      // choose mime
      const preferred = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/mpeg",
      ];
      const mimeType = preferred.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";

      mediaRecorder = new MediaRecorder(s, mimeType ? { mimeType } : undefined);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
        showPreview(blob);
      };

      mediaRecorder.start(200);
      startTimer();
    }

    function stopRecording() {
      ui.hintEl.textContent = "Durdu. İşleniyor…";
      ui.recBtn.classList.remove("is-recording");
      try { clearInterval(timer); } catch (_) {}
      timer = null;

      try {
        if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
      } catch (_) {}
    }

    function isRecording() {
      return mediaRecorder && mediaRecorder.state === "recording";
    }

    // close handlers
    ui.closeBtn.addEventListener("click", () => cleanup(true));
    ui.overlay.addEventListener("click", (e) => {
      if (e.target === ui.overlay) cleanup(true);
    });

    // record toggle
    ui.recBtn.addEventListener("click", async () => {
      try {
        if (!isRecording()) await startRecording();
        else stopRecording();
      } catch (err) {
        console.error("[AIVO][REC] start failed:", err);
        ui.hintEl.textContent = "Mikrofon izni gerekli (Safari ayarları → Web Siteleri → Mikrofon)";
        ui.recBtn.classList.remove("is-recording");
      }
    });

    // Save → #refAudio input’una dosya olarak bas
    ui.saveBtn.addEventListener("click", async () => {
      if (!ui.audioEl.src) return;

      try {
        const res = await fetch(ui.audioEl.src);
        const blob = await res.blob();

        const ext =
          (blob.type.includes("mp4") && "m4a") ||
          (blob.type.includes("mpeg") && "mp3") ||
          (blob.type.includes("webm") && "webm") ||
          "webm";

        const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: blob.type || "audio/webm" });

        const input = moduleEl.querySelector(SELECTORS.refAudioInput);
        if (input && input.type === "file") {
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }

        // event (isteyen dinler)
        window.dispatchEvent(new CustomEvent("aivo:music:recorded", { detail: { file, blob } }));

        cleanup(true);
      } catch (e) {
        console.error("[AIVO][REC] save failed:", e);
        ui.hintEl.textContent = "Save sırasında hata oldu.";
      }
    });

    // first paint
    setTime(0);
  }

  // ---------- init ----------
  function tryInit() {
    const moduleEl = document.querySelector(SELECTORS.module);
    if (!moduleEl) return false;

    const btn = moduleEl.querySelector(SELECTORS.recordBtn);
    if (!btn) return false;

    if (btn.__aivoRecBound) return true;
    btn.__aivoRecBound = true;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openRecorder(moduleEl);
    });

    console.log("[AIVO] studio.music.record READY (waveform + blink)");
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
