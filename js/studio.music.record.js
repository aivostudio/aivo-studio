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
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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

      /* modal */
      .aivoRecModal{
        width:min(920px, calc(100vw - 80px));
        height:min(520px, calc(100vh - 140px));
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
        font-weight:900;
        letter-spacing:.14em;
        color:rgba(255,255,255,.92);
        font-size:20px;
        font-variant-numeric: tabular-nums;
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
        min-height:0;
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
        display:block;
      }

      .aivoRecHint{
        position:absolute;
        left:50%; top:54%;
        transform:translate(-50%,-50%);
        color:rgba(255,255,255,.35);
        font-weight:700;
        pointer-events:none;
        text-align:center;
      }

      .aivoRecBottom{
        height: 140px;
        flex: 0 0 140px;
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

      /* preview area (AIVO style) */
      .aivoRecPreview{
        padding: 14px 16px 16px;
        display:flex;
        gap:14px;
        align-items:center;
        justify-content:space-between;
        border-top:1px solid rgba(255,255,255,.06);
        background: linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.015));
      }

      /* native audio hidden */
      .aivoRecAudio{ display:none !important; }

      .aivoPlyBtn{
        width:84px; height:84px;
        border-radius:18px;
        border:1px solid rgba(255,255,255,.10);
        background:rgba(255,255,255,.06);
        cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        box-shadow: 0 18px 70px rgba(0,0,0,.38);
      }
      .aivoPlyBtn:hover{ background:rgba(255,255,255,.08); }
      .aivoPlyBtn:active{ transform: translateY(1px); }

      .aivoPlyIcon{ width:0; height:0; }
      .aivoPlyIcon[data-icon="play"]{
        border-style: solid;
        border-width: 12px 0 12px 18px;
        border-color: transparent transparent transparent rgba(255,255,255,.92);
        margin-left:3px;
      }
      .aivoPlyIcon[data-icon="pause"]{
        width:18px; height:22px;
        background:
          linear-gradient(to right,
            rgba(255,255,255,.92) 0 42%,
            transparent 42% 58%,
            rgba(255,255,255,.92) 58% 100%);
        border-radius:4px;
      }

      .aivoPlyMid{
        flex:1;
        min-width:0;
        display:flex;
        flex-direction:column;
        gap:10px;
        padding-right:6px;
      }

      .aivoPlySeek{
        width:100%;
        -webkit-appearance:none;
        appearance:none;
        height:12px;
        border-radius:999px;
        background: rgba(255,255,255,.08);
        outline:none;
        border:1px solid rgba(255,255,255,.10);
        overflow:hidden;
      }
      .aivoPlySeek::-webkit-slider-thumb{
        -webkit-appearance:none;
        appearance:none;
        width:18px; height:18px;
        border-radius:999px;
        background: rgba(255,255,255,.92);
        border: 4px solid rgba(120,90,255,.55);
        box-shadow: 0 10px 30px rgba(0,0,0,.35);
        margin-top:-3px;
      }

      .aivoPlyTime{
        display:flex;
        align-items:baseline;
        gap:10px;
        color: rgba(255,255,255,.72);
        font-weight:900;
        letter-spacing:.06em;
        font-variant-numeric: tabular-nums;
      }
      .aivoPlyCur{ color: rgba(255,255,255,.92); }
      .aivoPlySep{ opacity:.45; }
      .aivoPlyDur{ opacity:.70; }

      .aivoRecSave{
        height:46px;
        padding:0 18px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,.14);
        background:rgba(255,255,255,.08);
        color:#fff;
        font-weight:900;
        cursor:pointer;
        white-space:nowrap;
      }
      .aivoRecSave:hover{ background:rgba(255,255,255,.12); }

      /* actions bar (Eita-style) */
      .aivoRecActions{
        display:none;
        align-items:center;
        gap:12px;
        margin-left:4px;
      }
      .aivoRecActions.is-open{ display:flex; }

      .aivoRecActBtn{
        width:56px; height:56px;
        border-radius:999px;
        border:1px solid rgba(255,255,255,.10);
        background: rgba(255,255,255,.08);
        cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        box-shadow: 0 18px 70px rgba(0,0,0,.28);
        user-select:none;
      }
      .aivoRecActBtn:hover{ background: rgba(255,255,255,.12); }
      .aivoRecActBtn:active{ transform: translateY(1px); }

      .aivoRecActIcon{
        width:22px; height:22px;
        display:inline-block;
        background: rgba(255,255,255,.92);
        -webkit-mask-size: contain;
        -webkit-mask-repeat: no-repeat;
        -webkit-mask-position: center;
        mask-size: contain;
        mask-repeat: no-repeat;
        mask-position: center;
      }

      /* simple inline svg masks */
      .aivoRecActIcon[data-i="download"]{
        -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M12 3a1 1 0 0 1 1 1v9.59l2.3-2.29a1 1 0 1 1 1.4 1.42l-4 3.98a1 1 0 0 1-1.4 0l-4-3.98a1 1 0 1 1 1.4-1.42L11 13.59V4a1 1 0 0 1 1-1Zm-7 16a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Z'/%3E%3C/svg%3E");
        mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M12 3a1 1 0 0 1 1 1v9.59l2.3-2.29a1 1 0 1 1 1.4 1.42l-4 3.98a1 1 0 0 1-1.4 0l-4-3.98a1 1 0 1 1 1.4-1.42L11 13.59V4a1 1 0 0 1 1-1Zm-7 16a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Z'/%3E%3C/svg%3E");
      }
      .aivoRecActIcon[data-i="use"]{
        -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M8 5a1 1 0 0 1 1-1h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9a1 1 0 1 1 0-2h9V6H9a1 1 0 0 1-1-1Zm-2.7 6.3a1 1 0 0 1 1.4 0l1.3 1.3V9a1 1 0 1 1 2 0v6a1 1 0 0 1-1 1H3a1 1 0 1 1 0-2h3.6l-1.3-1.3a1 1 0 0 1 0-1.4Z'/%3E%3C/svg%3E");
        mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M8 5a1 1 0 0 1 1-1h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9a1 1 0 1 1 0-2h9V6H9a1 1 0 0 1-1-1Zm-2.7 6.3a1 1 0 0 1 1.4 0l1.3 1.3V9a1 1 0 1 1 2 0v6a1 1 0 0 1-1 1H3a1 1 0 1 1 0-2h3.6l-1.3-1.3a1 1 0 0 1 0-1.4Z'/%3E%3C/svg%3E");
      }
      .aivoRecActIcon[data-i="trash"]{
        -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h1v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h1a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9Zm1 2h4v0H10v0Zm-1 5a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Zm6 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Z'/%3E%3C/svg%3E");
        mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h1v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h1a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9Zm1 2h4v0H10v0Zm-1 5a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Zm6 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Z'/%3E%3C/svg%3E");
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
          <button class="aivoRecSave" type="button">Save</button>
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

    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    return { w: canvas.width, h: canvas.height, dpr };
  }

  function drawWaveformLoop(ctx, canvas, analyser, dataArray, stopFlagRef) {
    function tick() {
      if (stopFlagRef.stop) return;

      const { w, h } = fitCanvas(canvas);

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.00)";
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      analyser.getByteTimeDomainData(dataArray);

      ctx.strokeStyle = "rgba(255,255,255,0.62)";
      ctx.lineWidth = 3;
      ctx.beginPath();

      const sliceWidth = w / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
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

    // WebAudio (waveform)
    let audioCtx = null;
    let analyser = null;
    let dataArray = null;
    let drawStop = { stop: false };

    // Preview player runtime
    let previewAudio = null;
    let previewUrl = "";
    let previewBound = false;
    let isSeeking = false;

    // Last blob (for Save / Download / Use)
    let lastBlob = null;

    // Actions menu state
    let actionsOpen = false;

    // Beep (start/stop)
    const beep = (freq = 880, ms = 70, type = "sine") => {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        const o = ctx.createOscillator();
        const g = ctx.createGain();

        o.type = type;
        o.frequency.value = freq;

        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);

        o.connect(g);
        g.connect(ctx.destination);

        o.start();
        o.stop(ctx.currentTime + ms / 1000 + 0.02);

        setTimeout(() => {
          try { ctx.close(); } catch (_) {}
        }, ms + 80);
      } catch (_) {}
    };

    function cleanup(full = true) {
      try { clearInterval(timer); } catch (_) {}
      timer = null;

      drawStop.stop = true;

      try { mediaRecorder && mediaRecorder.state !== "inactive" && mediaRecorder.stop(); } catch (_) {}
      mediaRecorder = null;

      try { stream && stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
      stream = null;

      try { audioCtx && audioCtx.state !== "closed" && audioCtx.close(); } catch (_) {}
      audioCtx = null;
      analyser = null;
      dataArray = null;

      try { previewAudio && previewAudio.pause(); } catch (_) {}
      previewAudio = null;

      try { previewUrl && URL.revokeObjectURL(previewUrl); } catch (_) {}
      previewUrl = "";

      lastBlob = null;
      actionsOpen = false;

      if (full) {
        document.documentElement.style.overflow = prevOverflow || "";
        ui.overlay.remove();
      }
    }

    function resetToRecordMode() {
      // stop preview
      try { previewAudio && previewAudio.pause(); } catch (_) {}
      previewAudio = null;

      // hide preview
      ui.preview.style.display = "none";

      // clear audio src holders
      try { ui.audioEl.removeAttribute("src"); ui.audioEl.load(); } catch (_) {}
      try { previewUrl && URL.revokeObjectURL(previewUrl); } catch (_) {}
      previewUrl = "";
      lastBlob = null;

      // close actions
      actionsOpen = false;
      const actions = ui.preview.querySelector(".aivoRecActions");
      if (actions) actions.classList.remove("is-open");
      ui.saveBtn.style.display = "";

      // hint back
      ui.hintEl.textContent = "Kayıt için kırmızı düğmeye bas";
    }

    function setTime(sec) {
      ui.timeEl.textContent = fmtTime(sec);
    }

    function ensurePreviewDOM() {
      let plyBtn = ui.preview.querySelector(".aivoPlyBtn");
      let plyIcon = ui.preview.querySelector(".aivoPlyIcon");
      let seek = ui.preview.querySelector(".aivoPlySeek");
      let cur = ui.preview.querySelector(".aivoPlyCur");
      let dur = ui.preview.querySelector(".aivoPlyDur");

      let actions = ui.preview.querySelector(".aivoRecActions");
      let btnDl = ui.preview.querySelector('[data-act="download"]');
      let btnUse = ui.preview.querySelector('[data-act="use"]');
      let btnTrash = ui.preview.querySelector('[data-act="trash"]');

      if (!plyBtn) {
        const saveBtn = ui.preview.querySelector(".aivoRecSave");

        plyBtn = document.createElement("button");
        plyBtn.type = "button";
        plyBtn.className = "aivoPlyBtn";
        plyBtn.setAttribute("aria-label", "Play/Pause");

        plyIcon = document.createElement("span");
        plyIcon.className = "aivoPlyIcon";
        plyIcon.setAttribute("data-icon", "play");
        plyBtn.appendChild(plyIcon);

        const mid = document.createElement("div");
        mid.className = "aivoPlyMid";

        seek = document.createElement("input");
        seek.className = "aivoPlySeek";
        seek.type = "range";
        seek.min = "0";
        seek.max = "1000";
        seek.value = "0";
        seek.step = "1";
        seek.setAttribute("aria-label", "Seek");

        const timeRow = document.createElement("div");
        timeRow.className = "aivoPlyTime";

        cur = document.createElement("span");
        cur.className = "aivoPlyCur";
        cur.textContent = "00:00";

        const sep = document.createElement("span");
        sep.className = "aivoPlySep";
        sep.textContent = "/";

        dur = document.createElement("span");
        dur.className = "aivoPlyDur";
        dur.textContent = "00:00";

        timeRow.appendChild(cur);
        timeRow.appendChild(sep);
        timeRow.appendChild(dur);

        mid.appendChild(seek);
        mid.appendChild(timeRow);

        // actions bar (hidden until Save)
        actions = document.createElement("div");
        actions.className = "aivoRecActions";
        actions.setAttribute("aria-label", "Kayıt işlemleri");

        btnDl = document.createElement("button");
        btnDl.type = "button";
        btnDl.className = "aivoRecActBtn";
        btnDl.setAttribute("data-act", "download");
        btnDl.setAttribute("aria-label", "İndir");
        btnDl.innerHTML = `<span class="aivoRecActIcon" data-i="download"></span>`;

        btnUse = document.createElement("button");
        btnUse.type = "button";
        btnUse.className = "aivoRecActBtn";
        btnUse.setAttribute("data-act", "use");
        btnUse.setAttribute("aria-label", "Kullan");
        btnUse.innerHTML = `<span class="aivoRecActIcon" data-i="use"></span>`;

        btnTrash = document.createElement("button");
        btnTrash.type = "button";
        btnTrash.className = "aivoRecActBtn";
        btnTrash.setAttribute("data-act", "trash");
        btnTrash.setAttribute("aria-label", "Sil");
        btnTrash.innerHTML = `<span class="aivoRecActIcon" data-i="trash"></span>`;

        actions.appendChild(btnDl);
        actions.appendChild(btnUse);
        actions.appendChild(btnTrash);

        if (saveBtn && saveBtn.parentNode) {
          saveBtn.parentNode.insertBefore(plyBtn, saveBtn);
          saveBtn.parentNode.insertBefore(mid, saveBtn);
          saveBtn.parentNode.insertBefore(actions, saveBtn);
        } else {
          ui.preview.appendChild(plyBtn);
          ui.preview.appendChild(mid);
          ui.preview.appendChild(actions);
        }
      }

      return { plyBtn, plyIcon, seek, cur, dur, actions, btnDl, btnUse, btnTrash };
    }

      function audioBufferToWavBlob(audioBuffer) {
      const numChannels = audioBuffer.numberOfChannels || 1;
      const sampleRate = audioBuffer.sampleRate || 44100;
      const format = 1; // PCM
      const bitDepth = 16;

      const samples = audioBuffer.length;
      const blockAlign = (numChannels * bitDepth) / 8;
      const byteRate = sampleRate * blockAlign;
      const dataSize = samples * blockAlign;

      const buffer = new ArrayBuffer(44 + dataSize);
      const view = new DataView(buffer);

      let offset = 0;
      const writeString = (s) => {
        for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
        offset += s.length;
      };

      // RIFF header
      writeString("RIFF");
      view.setUint32(offset, 36 + dataSize, true); offset += 4;
      writeString("WAVE");

      // fmt chunk
      writeString("fmt ");
      view.setUint32(offset, 16, true); offset += 4;          // PCM chunk size
      view.setUint16(offset, format, true); offset += 2;      // audio format
      view.setUint16(offset, numChannels, true); offset += 2; // channels
      view.setUint32(offset, sampleRate, true); offset += 4;  // sample rate
      view.setUint32(offset, byteRate, true); offset += 4;    // byte rate
      view.setUint16(offset, blockAlign, true); offset += 2;  // block align
      view.setUint16(offset, bitDepth, true); offset += 2;    // bits per sample

      // data chunk
      writeString("data");
      view.setUint32(offset, dataSize, true); offset += 4;

      // interleave + convert float32 [-1..1] to int16
      const channelData = [];
      for (let ch = 0; ch < numChannels; ch++) channelData.push(audioBuffer.getChannelData(ch));

      let sampleIndex = 0;
      while (sampleIndex < samples) {
        for (let ch = 0; ch < numChannels; ch++) {
          let s = channelData[ch][sampleIndex] || 0;
          s = Math.max(-1, Math.min(1, s));
          const int16 = s < 0 ? s * 0x8000 : s * 0x7fff;
          view.setInt16(offset, int16, true);
          offset += 2;
        }
        sampleIndex++;
      }

      return new Blob([buffer], { type: "audio/wav" });
    }

    async function blobToWavFile(blob) {
      const arrayBuf = await blob.arrayBuffer();

      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error("AudioContext_not_supported");

      const ctx = new AC();
      try {
        const audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
        const wavBlob = audioBufferToWavBlob(audioBuffer);
        const fileName = `recording-${Date.now()}.wav`;
        return new File([wavBlob], fileName, { type: "audio/wav" });
      } finally {
        try { await ctx.close(); } catch (_) {}
      }
    }

    async function getLastFile() {
      if (!lastBlob && !ui.audioEl.src) return null;

      const blob = lastBlob || (await (await fetch(ui.audioEl.src)).blob());

      // IMPORTANT: Always output WAV so Safari Share Sheet classifies it as Audio (not Video)
      return await blobToWavFile(blob);
    }

    function showActions(open) {
      const { actions } = ensurePreviewDOM();
      actionsOpen = !!open;

      if (actionsOpen) {
        actions.classList.add("is-open");
        ui.saveBtn.style.display = "none";
        ui.hintEl.textContent = "İşlem seç: indir / kullan / sil";
      } else {
        actions.classList.remove("is-open");
        ui.saveBtn.style.display = "";
        ui.hintEl.textContent = "Kaydı dinle → Save ile işlemler";
      }
    }

    async function doDownload(file) {
      try {
        // 1) Safari (macOS) reliable path: Share Sheet (Files/Save)
        // navigator.canShare exists on Safari 16+ (and many modern browsers)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "AIVO Kaydı",
            text: "Kaydı kaydet / paylaş",
          });
          return;
        }

        // 2) Fallback for Chrome/others: <a download>
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name || `recording-${Date.now()}.webm`;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          try { a.remove(); } catch (_) {}
          try { URL.revokeObjectURL(url); } catch (_) {}
        }, 1500);
      } catch (e) {
        console.error("[AIVO][REC] doDownload failed:", e);
        throw e;
      }
    }
    async function doUse(file) {
      // 1) fill ref input (if exists)
      const input = moduleEl.querySelector(SELECTORS.refAudioInput);
      if (input && input.type === "file") {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }

      // 2) event (isteyen dinler)
      window.dispatchEvent(new CustomEvent("aivo:music:recorded", { detail: { file, blob: lastBlob || null } }));

      // 3) close modal ONLY here
      cleanup(true);
    }

    function showPreview(blob) {
      lastBlob = blob;
      actionsOpen = false;

      ui.preview.style.display = "";
      ui.hintEl.textContent = "Kaydı dinle → Save ile işlemler";
      ui.recBtn.classList.remove("is-recording");

      try { previewAudio && previewAudio.pause(); } catch (_) {}
      previewAudio = null;

      try { previewUrl && URL.revokeObjectURL(previewUrl); } catch (_) {}
      previewUrl = URL.createObjectURL(blob);

      // keep hidden audio as source-holder (also useful if somewhere else reads it)
      ui.audioEl.src = previewUrl;

      // controlled Audio()
      previewAudio = new Audio(previewUrl);
      previewAudio.preload = "metadata";

      const { plyBtn, plyIcon, seek, cur, dur, actions, btnDl, btnUse, btnTrash } = ensurePreviewDOM();

      // ensure actions closed on new preview
      actions.classList.remove("is-open");
      ui.saveBtn.style.display = "";

      plyIcon.setAttribute("data-icon", "play");
      cur.textContent = "00:00";
      dur.textContent = "00:00";
      seek.value = "0";
      seek.max = "1000";

      if (!previewBound) {
        previewBound = true;

        // play/pause
        plyBtn.addEventListener("click", () => {
          if (!previewAudio) return;
          if (previewAudio.paused) previewAudio.play().catch(() => {});
          else previewAudio.pause();
        });

        // seek
        seek.addEventListener("input", () => {
          if (!previewAudio) return;
          isSeeking = true;

          const max = Number(seek.max) || 1000;
          const ratio = clamp(Number(seek.value) / max, 0, 1);
          const d = Number(previewAudio.duration) || 0;
          if (d > 0) previewAudio.currentTime = ratio * d;
        });

        seek.addEventListener("change", () => {
          isSeeking = false;
        });

        // actions
        btnDl.addEventListener("click", async () => {
          try {
            const file = await getLastFile();
            if (!file) return;
            await doDownload(file);
            ui.hintEl.textContent = "İndirme başladı.";
          } catch (e) {
            console.error("[AIVO][REC] download failed:", e);
            ui.hintEl.textContent = "İndirme sırasında hata oldu.";
          }
        });

        btnTrash.addEventListener("click", () => {
          resetToRecordMode();
        });

        btnUse.addEventListener("click", async () => {
          try {
            const file = await getLastFile();
            if (!file) return;
            await doUse(file);
          } catch (e) {
            console.error("[AIVO][REC] use failed:", e);
            ui.hintEl.textContent = "Kullan sırasında hata oldu.";
          }
        });
      }

      previewAudio.onloadedmetadata = () => {
        const d = Math.floor(Number(previewAudio.duration) || 0);
        dur.textContent = fmtTime(d);
      };

      previewAudio.onplay = () => {
        plyIcon.setAttribute("data-icon", "pause");
      };

      previewAudio.onpause = () => {
        plyIcon.setAttribute("data-icon", "play");
      };

      previewAudio.ontimeupdate = () => {
        if (!previewAudio) return;

        const t = Math.floor(Number(previewAudio.currentTime) || 0);
        cur.textContent = fmtTime(t);

        const d = Number(previewAudio.duration) || 0;
        if (d > 0 && !isSeeking) {
          const max = Number(seek.max) || 1000;
          seek.value = String(Math.round((previewAudio.currentTime / d) * max));
        }
      };

      previewAudio.onended = () => {
        plyIcon.setAttribute("data-icon", "play");
        try { previewAudio.currentTime = 0; } catch (_) {}
        seek.value = "0";
        cur.textContent = "00:00";
      };
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

      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      dataArray = new Uint8Array(analyser.fftSize);

      source.connect(analyser);

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
      lastBlob = null;
      actionsOpen = false;

      ui.hintEl.textContent = "Kayıt alınıyor… tekrar basınca durur";
      ui.preview.style.display = "none";
      ui.recBtn.classList.add("is-recording");

      try { previewAudio && previewAudio.pause(); } catch (_) {}

      // start beep
      beep(980, 65, "sine");

      const s = await ensureStream();

      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
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

      // stop beep (double tone)
      beep(720, 55, "sine");
      setTimeout(() => beep(520, 75, "sine"), 80);

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

    // Save → artık modal kapatmaz; actions menüsünü açar
    ui.saveBtn.addEventListener("click", async () => {
      if (!lastBlob && !ui.audioEl.src) return;
      showActions(true);
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

    console.log("[AIVO] studio.music.record READY (waveform + player + actions + beep + safari-download)");
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
