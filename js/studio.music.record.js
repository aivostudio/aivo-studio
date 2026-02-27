// /js/studio.music.record.js
(function () {
  "use strict";

  const SELECTORS = {
    module: "#moduleHost section[data-module='music']",
    recordBtn: "#musicRecordBtn",
    refAudioInput: "#refAudio",
  };

  const pad2 = (n) => String(n).padStart(2, "0");
  const fmtTime = (sec) => `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}`;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* -------------------------------------------------------------------------- */
  /*                                  CSS                                       */
  /* -------------------------------------------------------------------------- */

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
      }
      .aivoRecPreview{
        padding:14px 16px 16px;
        display:flex;
        gap:14px;
        align-items:center;
        justify-content:space-between;
        border-top:1px solid rgba(255,255,255,.06);
        background: linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.015));
      }
      .aivoRecAudio{ display:none !important; }

      .aivoRecSave{
        height:46px;
        padding:0 18px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,.14);
        background:rgba(255,255,255,.08);
        color:#fff;
        font-weight:900;
        cursor:pointer;
      }

      .aivoRecActions{
        display:none;
        gap:10px;
      }
      .aivoRecAct{
        height:46px;
        padding:0 14px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,.14);
        background:rgba(255,255,255,.08);
        color:#fff;
        font-weight:900;
        cursor:pointer;
      }
    `;
    document.head.appendChild(css);
  }

  /* -------------------------------------------------------------------------- */
  /*                               MODAL BUILD                                  */
  /* -------------------------------------------------------------------------- */

  function createModal() {
    injectCSSOnce();

    const overlay = document.createElement("div");
    overlay.className = "aivoRecOverlay";
    overlay.innerHTML = `
      <div class="aivoRecModal">
        <div class="aivoRecTop">
          <div class="aivoRecTime">00:00</div>
          <button class="aivoRecClose">×</button>
        </div>
        <div class="aivoRecBody">
          <canvas class="aivoRecCanvas"></canvas>
          <div class="aivoRecHint">Kayıt için kırmızı düğmeye bas</div>
        </div>
        <div class="aivoRecBottom">
          <button class="aivoRecBtn"></button>
        </div>
        <div class="aivoRecPreview" style="display:none">
          <audio class="aivoRecAudio" preload="metadata"></audio>
          <button class="aivoRecSave">Save</button>
          <div class="aivoRecActions">
            <button class="aivoRecAct actDownload">İndir</button>
            <button class="aivoRecAct actUse">Kullan</button>
            <button class="aivoRecAct actTrash">Sil</button>
          </div>
        </div>
      </div>
    `;

    return {
      overlay,
      closeBtn: overlay.querySelector(".aivoRecClose"),
      preview: overlay.querySelector(".aivoRecPreview"),
      saveBtn: overlay.querySelector(".aivoRecSave"),
      actions: overlay.querySelector(".aivoRecActions"),
      actDownload: overlay.querySelector(".actDownload"),
      actUse: overlay.querySelector(".actUse"),
      actTrash: overlay.querySelector(".actTrash"),
      audioEl: overlay.querySelector(".aivoRecAudio"),
      recBtn: overlay.querySelector(".aivoRecBtn"),
      hintEl: overlay.querySelector(".aivoRecHint")
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                              RECORDER LOGIC                                */
  /* -------------------------------------------------------------------------- */

  async function openRecorder(moduleEl) {
    const ui = createModal();
    document.body.appendChild(ui.overlay);

    let lastBlob = null;

    function cleanup() {
      document.body.removeChild(ui.overlay);
    }

    ui.closeBtn.onclick = cleanup;

    /* ------------------------- SAVE BEHAVIOR CHANGE ------------------------- */
    ui.saveBtn.onclick = () => {
      if (!lastBlob) return;
      ui.actions.style.display =
        ui.actions.style.display === "flex" ? "none" : "flex";
    };

    /* ---------------------------- DOWNLOAD ---------------------------------- */
    ui.actDownload.onclick = () => {
      if (!lastBlob) return;

      const file = new File([lastBlob], `recording-${Date.now()}.webm`);
      const url = URL.createObjectURL(file);

      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 60000);

      ui.actions.style.display = "none";
    };

    /* ------------------------------- USE ------------------------------------ */
    ui.actUse.onclick = () => {
      if (!lastBlob) return;

      const file = new File([lastBlob], `recording-${Date.now()}.webm`);
      const input = moduleEl.querySelector(SELECTORS.refAudioInput);
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }

      cleanup(); // sadece burada kapanır
    };

    /* ------------------------------ TRASH ----------------------------------- */
    ui.actTrash.onclick = () => {
      lastBlob = null;
      ui.preview.style.display = "none";
      ui.actions.style.display = "none";
      ui.hintEl.textContent = "Kayıt için kırmızı düğmeye bas";
    };

    /* ---------------------------- RECORD ------------------------------------ */
    ui.recBtn.onclick = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = e => chunks.push(e.data);

      recorder.onstop = () => {
        lastBlob = new Blob(chunks, { type: "audio/webm" });
        ui.audioEl.src = URL.createObjectURL(lastBlob);
        ui.preview.style.display = "flex";
        ui.hintEl.textContent = "Kaydı dinle → Save ile işlem yap";
      };

      recorder.start();
      setTimeout(() => recorder.stop(), 3000);
    };
  }

  /* -------------------------------------------------------------------------- */

  function tryInit() {
    const moduleEl = document.querySelector(SELECTORS.module);
    if (!moduleEl) return false;

    const btn = moduleEl.querySelector(SELECTORS.recordBtn);
    if (!btn) return false;

    btn.addEventListener("click", e => {
      e.preventDefault();
      openRecorder(moduleEl);
    });

    return true;
  }

  if (!tryInit()) {
    const obs = new MutationObserver(() => {
      if (tryInit()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }
})();
