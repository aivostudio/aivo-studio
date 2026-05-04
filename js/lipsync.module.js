(() => {
  if (window.__AIVO_LIPSYNC_MODULE_BIND__) return;
  window.__AIVO_LIPSYNC_MODULE_BIND__ = true;

  const CREDIT_BY_DURATION = {
    "10": 15,
    "20": 30,
    "30": 45,
    "40": 60,
    "50": 75,
    "60": 90
  };
let lipsyncRecorder = null;
let lipsyncRecordedChunks = [];
let lipsyncRecordedAudioFile = null;
let lipsyncAudioDurationSeconds = 0;
let lipsyncAudioCreditCost = 0;

function getLipsyncAudioMeta(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve({
        durationSeconds: 0,
        creditCost: 0
      });
      return;
    }

    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);

    audio.preload = "metadata";

    audio.onloadedmetadata = () => {
      const durationSeconds = Math.max(1, Math.ceil(Number(audio.duration || 1)));
      const creditCost = Math.ceil(durationSeconds / 2) * 3;

      URL.revokeObjectURL(url);

      resolve({
        durationSeconds,
        creditCost
      });
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);

      resolve({
        durationSeconds: 0,
        creditCost: 0
      });
    };

    audio.src = url;
  });
}

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function getRoot() {
    return qs('.main-panel[data-module="lipsync"]');
  }

  function getSelectedDuration(root) {
    const durationSelect = qs("[data-lipsync-duration]", root);
    return String(durationSelect?.value || "10");
  }

  function getCreditCost(duration) {
    return CREDIT_BY_DURATION[String(duration || "10")] || 15;
  }

function syncGenerateButton(root) {
  const btn = qs("[data-lipsync-generate]", root);
  if (!btn) return;

  const scriptInput = qs("[data-lipsync-script]", root);
  const text = String(scriptInput?.value || "").trim();

  let seconds = 1;
  let credit = 3;

  if (lipsyncRecordedAudioFile && lipsyncAudioDurationSeconds > 0) {
    seconds = lipsyncAudioDurationSeconds;
    credit = lipsyncAudioCreditCost || Math.ceil(seconds / 2) * 3;
  } else {
    const charsPerSecond = 9;
    seconds = Math.max(1, Math.ceil(text.length / charsPerSecond));
    credit = Math.ceil(seconds / 2) * 3;
  }

  btn.dataset.creditCost = String(credit);
  btn.dataset.speechSeconds = String(seconds);
  btn.textContent = `Dudak Senkron Video Üret (${credit} Kredi)`;
}

function renderLipsyncAudioEstimate(root) {
  const scriptInput = qs("[data-lipsync-script]", root);
  if (!scriptInput) return;

  let infoEl = qs("[data-lipsync-estimate]", root);

  if (!infoEl) {
    infoEl = document.createElement("div");
    infoEl.setAttribute("data-lipsync-estimate", "1");
    infoEl.className = "lipsync-estimate-box";
    infoEl.style.fontSize = "12px";
    infoEl.style.marginTop = "6px";
    infoEl.style.opacity = "0.8";
    scriptInput.parentNode.appendChild(infoEl);
  }

  const seconds = Math.max(1, Number(lipsyncAudioDurationSeconds || 1));
  const credits = Math.max(3, Number(lipsyncAudioCreditCost || Math.ceil(seconds / 2) * 3));

  infoEl.textContent = `Tahmini: ${seconds} sn • ${credits} kredi`;
  infoEl.style.color = "";
}

  function buildPayload(root) {
    const script = qs("[data-lipsync-script]", root);
    const resolution = qs("[data-lipsync-resolution]", root);
    const duration = getSelectedDuration(root);
    const credit = getCreditCost(duration);

    const aspectEl =
      qs("[data-lipsync-aspect].is-active", root) ||
      qs("[data-lipsync-aspect][aria-pressed='true']", root) ||
      qs('input[name="lipsyncAspect"]:checked', root);

    const aspectRatio = String(
      aspectEl?.dataset?.lipsyncAspect ||
      aspectEl?.value ||
      "16:9"
    ).trim();

    const voiceSelect = qs("[data-lipsync-voice-select]", root);
    const selectedOption = voiceSelect?.selectedOptions?.[0] || null;

    const voiceBtn =
      qs("[data-lipsync-voice].is-active", root) ||
      qs("[data-lipsync-voice]", root);

    const voiceKey = String(
      voiceSelect?.value ||
      voiceBtn?.dataset?.lipsyncVoice ||
      "tranquil_tulin"
    ).trim();

    const voiceName = String(
      selectedOption?.dataset?.voiceName ||
      voiceBtn?.dataset?.lipsyncVoiceName ||
      voiceBtn?.textContent ||
      "Tranquil Tülin"
    )
      .replace("🔊", "")
      .trim();

    return {
      app: "lipsync",
      script: String(script?.value || "").trim(),
      resolution: String(resolution?.value || "1080p"),
      duration,
      aspectRatio,
      aspect_ratio: aspectRatio,
      voice_key: voiceKey,
      voice_name: voiceName,
      estimatedCredits: credit
    };
  }

  async function uploadLipsyncPhotoToR2(file, payload) {
    if (!file) {
      throw new Error("lipsync_missing_photo_file");
    }

    const filename = file.name || `lipsync-photo-${Date.now()}.jpg`;
    const contentType = file.type || "application/octet-stream";
    const promptText = String(payload?.script || "").trim();

    const presignRes = await fetch("/api/r2/scan-and-presign", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        app: "lipsync",
        kind: "image",
        filename,
        contentType,
        prompt: promptText,
        title: filename,
        description: promptText || filename,
        personName: "",
        style: "",
        source: "lipsync_browser_photo_upload"
      })
    });

    const presignData = await presignRes.json().catch(() => null);

    if (!presignRes.ok || !presignData || presignData.ok === false) {
      throw new Error(presignData?.message || presignData?.error || "lipsync_presign_failed");
    }

    const uploadUrl = presignData.uploadUrl || presignData.upload_url || "";
    const publicUrl = presignData.publicUrl || presignData.public_url || presignData.url || "";
    const key = presignData.key || presignData.objectKey || "";

    if (!uploadUrl || !publicUrl || !key) {
      throw new Error("lipsync_presign_invalid");
    }

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "content-type": contentType
      },
      body: file
    });

    if (!putRes.ok) {
      throw new Error(`lipsync_r2_put_failed_${putRes.status}`);
    }

    const scanRes = await fetch("/api/r2/scan-upload", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        app: "lipsync",
        key,
        filename,
        contentType,
        public_url: publicUrl,
        prompt: promptText,
        title: filename,
        description: promptText || filename,
        personName: "",
        style: "",
        source: "lipsync_browser_photo_upload"
      })
    });

    const scanData = await scanRes.json().catch(() => null);

    if (!scanRes.ok || !scanData || scanData.ok === false) {
      throw new Error(scanData?.message || scanData?.error || "lipsync_scan_upload_failed");
    }

    if (scanData.decision && scanData.decision !== "allow") {
      throw new Error(`media_policy_${scanData.decision}`);
    }

    return String(scanData.public_url || publicUrl || "").trim();
  }

  async function uploadLipsyncAudioToR2(file, payload) {
  if (!file) {
    throw new Error("lipsync_missing_audio_file");
  }

  const filename = file.name || `lipsync-audio-${Date.now()}.webm`;
  const contentType = file.type || "audio/webm";
  const promptText = String(payload?.script || filename || "").trim();

  const presignRes = await fetch("/api/r2/scan-and-presign", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      app: "lipsync",
      kind: "audio",
      filename,
      contentType,
      prompt: promptText,
      title: filename,
      description: promptText || filename,
      source: "lipsync_browser_audio_upload"
    })
  });

  const presignData = await presignRes.json().catch(() => null);

  if (!presignRes.ok || !presignData || presignData.ok === false) {
    throw new Error(presignData?.message || presignData?.error || "lipsync_audio_presign_failed");
  }

  const uploadUrl = presignData.uploadUrl || presignData.upload_url || "";
  const publicUrl = presignData.publicUrl || presignData.public_url || presignData.url || "";
  const key = presignData.key || presignData.objectKey || "";

  if (!uploadUrl || !publicUrl || !key) {
    throw new Error("lipsync_audio_presign_invalid");
  }

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": contentType
    },
    body: file
  });

  if (!putRes.ok) {
    throw new Error(`lipsync_audio_r2_put_failed_${putRes.status}`);
  }

  const scanRes = await fetch("/api/r2/scan-upload", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      app: "lipsync",
      kind: "audio",
      key,
      filename,
      contentType,
      public_url: publicUrl,
      prompt: promptText,
      title: filename,
      description: promptText || filename,
      source: "lipsync_browser_audio_upload"
    })
  });

  const scanData = await scanRes.json().catch(() => null);

  if (!scanRes.ok || !scanData || scanData.ok === false) {
    throw new Error(scanData?.message || scanData?.error || "lipsync_audio_scan_upload_failed");
  }

  if (scanData.decision && scanData.decision !== "allow") {
    throw new Error(`media_policy_${scanData.decision}`);
  }

  return String(scanData.public_url || publicUrl || "").trim();
}
  function bindEvents() {
   document.addEventListener("change", async (e) => {
document.addEventListener("input", (e) => {
  const root = getRoot();
  if (!root) return;

  const scriptInput = e.target.closest("[data-lipsync-script]");
  if (!scriptInput || !root.contains(scriptInput)) return;

   const text = String(scriptInput.value || "");
  const trimmedText = text.trim();
  const duration = Number(getSelectedDuration(root) || 10);

  const charsPerSecond = 9;
  const seconds = Math.max(1, Math.ceil(trimmedText.length / charsPerSecond));
  const credits = Math.ceil(seconds / 2) * 3;

  const counterEl = qs("[data-lipsync-counter]", root);
  if (counterEl) {
    counterEl.textContent = `${text.length} / 1200`;
  }

  let infoEl = qs("[data-lipsync-estimate]", root);

  if (!infoEl) {
    infoEl = document.createElement("div");
   infoEl.setAttribute("data-lipsync-estimate", "1");
   infoEl.className = "lipsync-estimate-box";
    infoEl.style.fontSize = "12px";
    infoEl.style.marginTop = "6px";
    infoEl.style.opacity = "0.8";

    scriptInput.parentNode.appendChild(infoEl);
  }

  infoEl.textContent = `Tahmini: ${seconds} sn • ${credits} kredi`;

  if (seconds > duration) {
    infoEl.style.color = "#ff4d4f";
  } else {
    infoEl.style.color = "";
  }

  syncGenerateButton(root);
});
      const root = getRoot();
      if (!root) return;

      const uploadAudioInput = e.target.closest("[data-lipsync-upload-file]");
if (uploadAudioInput && root.contains(uploadAudioInput)) {
  const file = uploadAudioInput.files && uploadAudioInput.files[0] ? uploadAudioInput.files[0] : null;
  if (!file) return;

  lipsyncRecordedAudioFile = file;

const audioMeta = await getLipsyncAudioMeta(file);
lipsyncAudioDurationSeconds = audioMeta.durationSeconds;
lipsyncAudioCreditCost = audioMeta.creditCost;
syncGenerateButton(root);
renderLipsyncAudioEstimate(root);
  
console.log("[LIPSYNC][UPLOADED_AUDIO_META]", {
  durationSeconds: lipsyncAudioDurationSeconds,
  creditCost: lipsyncAudioCreditCost
});

  const boxEl = qs(".lipsync-record-box", root);
  const deviceEl = qs(".lipsync-record-device", root);

  if (boxEl) {
    boxEl.innerHTML = `
      <div class="lipsync-record-confirm-card">
        <button type="button" class="lipsync-record-confirm-play" aria-label="Sesi dinle">
          ▶
        </button>

        <div class="lipsync-record-confirm-info">
          <strong>${file.name}</strong>
          <span>Yüklenen ses hazır</span>
        </div>

        <button type="button" class="lipsync-record-confirm-use" data-lipsync-use-recorded-audio>
          Kullan
        </button>

        <button type="button" class="lipsync-record-confirm-remove" data-lipsync-remove-recorded-audio aria-label="Sesi sil">
          ×
        </button>
      </div>
    `;
  }

  if (deviceEl) {
    deviceEl.textContent = `🎧 Ses hazır: ${file.name}`;
  }

  try { window.toast?.success?.("Ses dosyası seçildi"); } catch {}

  return;
}
      
       const photoInput = e.target.closest("[data-lipsync-photo]");
      if (photoInput && root.contains(photoInput)) {
        const file = photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;
        const empty = qs("[data-lipsync-photo-empty]", root);
        const preview = qs("[data-lipsync-photo-preview]", root);
        const name = qs("[data-lipsync-photo-name]", root);
        const photoLabel = qs(".lipsync-photo-label", root);

        if (!file) return;

        const url = URL.createObjectURL(file);

        if (empty) empty.style.display = "none";

       if (preview) {
  preview.onload = function () {
    const isLandscape = preview.naturalWidth > preview.naturalHeight;

    if (photoLabel) {
      photoLabel.classList.toggle("is-landscape", isLandscape);
      photoLabel.classList.toggle("is-portrait", !isLandscape);
    }
  };

  preview.src = url;
  preview.style.display = "block";
}
        if (photoLabel) {
        photoLabel.style.setProperty("--lipsync-photo-bg", `url("${url}")`);
        photoLabel.classList.add("has-photo-bg");
        }

        if (name) {
        const rawName = file.name || "Fotoğraf";
       const shortName =
       rawName.length > 18
    ? rawName.slice(0, 10) + "..." + rawName.split('.').pop()
    : rawName;

      name.textContent = shortName;
          
          name.style.display = "block";
        }

        console.log("[LIPSYNC][PHOTO_SELECTED]", {
          name: file.name,
          type: file.type,
          size: file.size
        });

        return;
      }
           const voiceSelect = e.target.closest("[data-lipsync-voice-select]");
      if (voiceSelect && root.contains(voiceSelect)) {
        const selectedVoiceKey = String(voiceSelect.value || "tranquil_tulin").trim();

        root.querySelectorAll("[data-lipsync-voice]").forEach((btn) => {
          const isSelected = String(btn.dataset.lipsyncVoice || "").trim() === selectedVoiceKey;
          btn.classList.toggle("is-active", isSelected);
          btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
        });

        console.log("[LIPSYNC][VOICE_SELECT_CHANGED]", {
          voice_key: selectedVoiceKey,
          voice_name: voiceSelect.selectedOptions?.[0]?.dataset?.voiceName || ""
        });

        return;
      }
    const speedRange = e.target.closest('[data-lipsync-voice-speed]');
const volumeRange = e.target.closest('[data-lipsync-voice-volume]');
const durationSelect = e.target.closest("[data-lipsync-duration]");

if (speedRange && root.contains(speedRange)) {
  const val = Number(speedRange.value || 1);
  const label = root.querySelector('[data-lipsync-speed-label]');

  if (label) {
    if (val < 0.9) label.textContent = "Yavaş";
    else if (val > 1.1) label.textContent = "Hızlı";
    else label.textContent = "Normal";
  }

  return;
}

if (volumeRange && root.contains(volumeRange)) {
  const val = Number(volumeRange.value || 1);
  const label = root.querySelector('[data-lipsync-volume-label]');

  if (label) {
    label.textContent = `${Math.round(val * 100)}%`;
  }

  return;
}

if (!durationSelect || !root.contains(durationSelect)) return;
     
      syncGenerateButton(root);
    });

     document.addEventListener("click", async (e) => {
      const root = getRoot();
      if (!root) return;

       const recordTabBtn = e.target.closest("[data-lipsync-record-tab]");
if (recordTabBtn && root.contains(recordTabBtn)) {
  e.preventDefault();

  const mode = String(recordTabBtn.dataset.lipsyncRecordTab || "record");
  const modal = qs("[data-lipsync-record-modal]", root);
  const boxEl = qs(".lipsync-record-box", root);
  const mainBtn = qs("[data-lipsync-record-toggle]", root);
  const deviceEl = qs(".lipsync-record-device", root);

  root.querySelectorAll("[data-lipsync-record-tab]").forEach((btn) => {
    const isActive = String(btn.dataset.lipsyncRecordTab || "") === mode;
    btn.classList.toggle("is-active", isActive);
  });

  if (mode === "upload") {
    if (modal) modal.dataset.mode = "upload";

    if (boxEl) {
      boxEl.classList.remove("is-recording");
      boxEl.innerHTML = `
        <label class="lipsync-upload-dropzone">
          <input type="file" accept="audio/*" data-lipsync-upload-file hidden>
          <span class="lipsync-upload-icon">↥</span>
          <strong>Ses dosyası yükle</strong>
          <small>MP3, WAV veya WEBM dosyası seç</small>
        </label>
      `;
    }

    if (mainBtn) {
      mainBtn.style.display = "none";
    }

    if (deviceEl) {
      deviceEl.textContent = "Hazır ses dosyası bekleniyor...";
    }

    return;
  }

  if (modal) modal.dataset.mode = "record";

  if (boxEl) {
    boxEl.classList.remove("is-recording");
    boxEl.innerHTML = `
      <p>Bir ses kaydı oluştur. Karakterin bu sese göre dudak senkron yapacak.</p>
    `;
  }

  if (mainBtn) {
    mainBtn.style.display = "";
  }

  if (deviceEl) {
    deviceEl.textContent = "🎙 Mikrofon hazır bekleniyor...";
  }

  return;
}

       const uploadOpenBtn = e.target.closest("[data-lipsync-upload-open]");
if (uploadOpenBtn && root.contains(uploadOpenBtn)) {
  e.preventDefault();

  const modal = qs("[data-lipsync-record-modal]", root);
  const uploadTab = qs('[data-lipsync-record-tab="upload"]', root);

  if (modal) {
    modal.hidden = false;
  }

  if (uploadTab) {
    uploadTab.click();
  }

  return;
}
       
const recordOpenBtn = e.target.closest("[data-lipsync-record-open]");
if (recordOpenBtn && root.contains(recordOpenBtn)) {
  e.preventDefault();

  const modal = qs("[data-lipsync-record-modal]", root);
  if (modal) {
    modal.hidden = false;
  }

  return;
}

const recordCloseBtn = e.target.closest("[data-lipsync-record-close]");
if (recordCloseBtn && root.contains(recordCloseBtn)) {
  e.preventDefault();

  const modal = qs("[data-lipsync-record-modal]", root);
  if (modal) {
    modal.hidden = true;
  }

  return;
}
       const recordToggleBtn = e.target.closest("[data-lipsync-record-toggle]");
if (recordToggleBtn && root.contains(recordToggleBtn)) {
  e.preventDefault();

  const deviceEl = qs(".lipsync-record-device", root);
  const boxEl = qs(".lipsync-record-box", root);

if (lipsyncRecorder && lipsyncRecorder.state === "recording") {
  lipsyncRecorder.stop();
  recordToggleBtn.classList.remove("is-recording");

  if (boxEl) {
    boxEl.classList.remove("is-recording");
  }

  if (deviceEl) {
    deviceEl.textContent = "⏳ Kayıt hazırlanıyor...";
  }

  return;
}
  const useRecordedAudioBtn = e.target.closest("[data-lipsync-use-recorded-audio]");
if (useRecordedAudioBtn && root.contains(useRecordedAudioBtn)) {
  e.preventDefault();

  if (!lipsyncRecordedAudioFile) {
    try { window.toast?.error?.("Kayıt bulunamadı"); } catch {}
    return;
  }

  const audioInput = qs("[data-lipsync-audio]", root);
  const audioName = qs("[data-lipsync-audio-name]", root);
  const modal = qs("[data-lipsync-record-modal]", root);

  if (audioInput) {
    const dt = new DataTransfer();
    dt.items.add(lipsyncRecordedAudioFile);
    audioInput.files = dt.files;
  }

 if (audioName) {
  audioName.textContent = "";
}

const scriptInput = qs("[data-lipsync-script]", root);

if (scriptInput) {
  scriptInput.value = "";
  scriptInput.placeholder = "";
  scriptInput.classList.add("has-lipsync-audio-card");

  const oldAudioCard = qs(".lipsync-inline-audio-card", root);
  if (oldAudioCard) oldAudioCard.remove();

  const audioCard = document.createElement("div");
  audioCard.className = "lipsync-inline-audio-card";
  audioCard.innerHTML = `
    <button type="button" class="lipsync-inline-audio-play" data-lipsync-inline-audio-play>
      ▶
    </button>

    <div class="lipsync-inline-audio-info">
      <strong>${lipsyncRecordedAudioFile.name}</strong>
      <span>00:00 / 00:00</span>
    </div>

    <button type="button" class="lipsync-inline-audio-remove" data-lipsync-inline-audio-remove>
      🗑
    </button>
  `;

  scriptInput.insertAdjacentElement("beforebegin", audioCard);
}

  if (modal) {
    modal.hidden = true;
  }

  try {
    window.toast?.success?.("Kayıt seçildi");
  } catch {}

  console.log("[LIPSYNC][RECORDED_AUDIO_SELECTED]", {
    name: lipsyncRecordedAudioFile.name,
    type: lipsyncRecordedAudioFile.type,
    size: lipsyncRecordedAudioFile.size
  });

  return;
}

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    lipsyncRecordedChunks = [];
    lipsyncRecorder = new MediaRecorder(stream);

    lipsyncRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        lipsyncRecordedChunks.push(event.data);
      }
    };

    lipsyncRecorder.onstop = () => {
      const blob = new Blob(lipsyncRecordedChunks, { type: "audio/webm" });
      const filename = `aivo-kayit-${Date.now()}.webm`;

     lipsyncRecordedAudioFile = new File([blob], filename, {
  type: "audio/webm"
});

getLipsyncAudioMeta(lipsyncRecordedAudioFile).then((meta) => {
  lipsyncAudioDurationSeconds = meta.durationSeconds;
  lipsyncAudioCreditCost = meta.creditCost;
  syncGenerateButton(root);
  renderLipsyncAudioEstimate(root);

  console.log("[LIPSYNC][RECORDED_AUDIO_META]", {
    durationSeconds: lipsyncAudioDurationSeconds,
    creditCost: lipsyncAudioCreditCost
  });
});
      stream.getTracks().forEach((track) => track.stop());

      if (deviceEl) {
        deviceEl.textContent = `🎙 Kayıt hazır: ${filename}`;
      }

   if (boxEl) {
  boxEl.innerHTML = `
    <div class="lipsync-record-confirm-card">
      <button type="button" class="lipsync-record-confirm-play" aria-label="Kaydı dinle">
        ▶
      </button>

      <div class="lipsync-record-confirm-info">
        <strong>${filename}</strong>
        <span>Kaydedilen ses hazır</span>
      </div>

      <button type="button" class="lipsync-record-confirm-use" data-lipsync-use-recorded-audio>
        Kullan
      </button>
      <button type="button" class="lipsync-record-confirm-remove" data-lipsync-remove-recorded-audio aria-label="Kaydı sil">
       ×
       </button>
    </div>
  `;
}
    };

 lipsyncRecorder.start();
recordToggleBtn.classList.add("is-recording");

if (boxEl) {
  boxEl.classList.add("is-recording");
  boxEl.innerHTML = `
    <div class="lipsync-recording-state">
      <div class="lipsync-recording-text">Kayıt alınıyor</div>
      <div class="lipsync-recording-time">Durdurmak için tekrar bas</div>
    </div>
  `;
}

if (deviceEl) {
  deviceEl.textContent = "🔴 Kayıt alınıyor... Durdurmak için tekrar bas.";
}
  } catch (err) {
    console.error("[LIPSYNC][RECORD_ERROR]", err);

    if (deviceEl) {
      deviceEl.textContent = "Mikrofon izni alınamadı.";
    }

    try {
      window.toast?.error?.("Mikrofon izni alınamadı");
    } catch {}
  }

  return;
}

            const removePhotoBtn = e.target.closest("[data-lipsync-photo-remove]");
      if (removePhotoBtn && root.contains(removePhotoBtn)) {
        e.preventDefault();
        e.stopPropagation();

        const photoInput = qs("[data-lipsync-photo]", root);
        const photoLabel = qs(".lipsync-photo-label", root);
        const empty = qs("[data-lipsync-photo-empty]", root);
        const preview = qs("[data-lipsync-photo-preview]", root);
        const name = qs("[data-lipsync-photo-name]", root);

        if (photoInput) photoInput.value = "";

        if (preview) {
          preview.removeAttribute("src");
          preview.style.display = "none";
        }

        if (name) {
          name.textContent = "";
          name.style.display = "none";
        }

        if (empty) empty.style.display = "";

        if (photoLabel) {
          photoLabel.classList.remove("has-photo-bg", "is-landscape", "is-portrait");
          photoLabel.style.removeProperty("--lipsync-photo-bg");
        }

        console.log("[LIPSYNC][PHOTO_REMOVED]");
        return;
      }
      
              const voiceBtn = e.target.closest("[data-lipsync-voice]");
      if (voiceBtn && root.contains(voiceBtn)) {
        e.preventDefault();

        const selectedVoiceKey = String(voiceBtn.dataset.lipsyncVoice || "tranquil_tulin").trim();
        const voiceSelect = qs("[data-lipsync-voice-select]", root);

        root.querySelectorAll("[data-lipsync-voice]").forEach((btn) => {
          const isSelected = String(btn.dataset.lipsyncVoice || "").trim() === selectedVoiceKey;
          btn.classList.toggle("is-active", isSelected);
          btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
        });

        if (voiceSelect) {
          voiceSelect.value = selectedVoiceKey;
        }

        console.log("[LIPSYNC][VOICE_SELECTED]", {
          voice_key: selectedVoiceKey,
          voice_name: voiceBtn.dataset.lipsyncVoiceName || ""
        });

        return;
      }

       const useRecordedAudioBtn = e.target.closest("[data-lipsync-use-recorded-audio]");
if (useRecordedAudioBtn && root.contains(useRecordedAudioBtn)) {
  e.preventDefault();

  if (!lipsyncRecordedAudioFile) {
    try { window.toast?.error?.("Kayıt bulunamadı"); } catch {}
    return;
  }

  const audioInput = qs("[data-lipsync-audio]", root);
  const audioName = qs("[data-lipsync-audio-name]", root);
  const modal = qs("[data-lipsync-record-modal]", root);

  if (audioInput) {
    const dt = new DataTransfer();
    dt.items.add(lipsyncRecordedAudioFile);
    audioInput.files = dt.files;
  }

if (audioName) {
  audioName.textContent = "";
}

const scriptInput = qs("[data-lipsync-script]", root);

if (scriptInput) {
  scriptInput.value = "";
  scriptInput.placeholder = "";
  scriptInput.classList.add("has-lipsync-audio-card");

  const oldAudioCard = qs(".lipsync-inline-audio-card", root);
  if (oldAudioCard) oldAudioCard.remove();

  const audioCard = document.createElement("div");
  audioCard.className = "lipsync-inline-audio-card";
  audioCard.innerHTML = `
    <button type="button" class="lipsync-inline-audio-play" data-lipsync-inline-audio-play>
      ▶
    </button>

    <div class="lipsync-inline-audio-info">
      <strong>${lipsyncRecordedAudioFile.name}</strong>
      <span>00:00 / 00:00</span>
    </div>

    <button type="button" class="lipsync-inline-audio-remove" data-lipsync-inline-audio-remove>
      🗑
    </button>
  `;

  scriptInput.insertAdjacentElement("beforebegin", audioCard);
}

if (modal) {
  modal.hidden = true;
}

  try { window.toast?.success?.("Kayıt seçildi"); } catch {}

  console.log("[LIPSYNC][RECORDED_AUDIO_SELECTED]", lipsyncRecordedAudioFile.name);

  return;
}
       const removeRecordedAudioBtn = e.target.closest("[data-lipsync-remove-recorded-audio]");
if (removeRecordedAudioBtn && root.contains(removeRecordedAudioBtn)) {
  e.preventDefault();

  if (window.__AIVO_LIPSYNC_RECORD_AUDIO__) {
    window.__AIVO_LIPSYNC_RECORD_AUDIO__.pause();
    window.__AIVO_LIPSYNC_RECORD_AUDIO__.currentTime = 0;
    window.__AIVO_LIPSYNC_RECORD_AUDIO__ = null;
  }

  lipsyncRecordedAudioFile = null;
  lipsyncRecordedChunks = [];

  const boxEl = qs(".lipsync-record-box", root);
  const deviceEl = qs(".lipsync-record-device", root);

  if (boxEl) {
    boxEl.innerHTML = `
      <p>Bir ses kaydı oluştur. Karakterin bu sese göre dudak senkron yapacak.</p>
    `;
  }

  if (deviceEl) {
    deviceEl.textContent = "🎙 Mikrofon hazır bekleniyor...";
  }

  try { window.toast?.success?.("Kayıt silindi"); } catch {}

  return;
}
 const recordedAudioPlayBtn = e.target.closest(".lipsync-record-confirm-play");
if (recordedAudioPlayBtn && root.contains(recordedAudioPlayBtn)) {
  e.preventDefault();

  if (!lipsyncRecordedAudioFile) {
    try { window.toast?.error?.("Dinlenecek kayıt bulunamadı"); } catch {}
    return;
  }

  if (window.__AIVO_LIPSYNC_RECORD_AUDIO__) {
    window.__AIVO_LIPSYNC_RECORD_AUDIO__.pause();
    window.__AIVO_LIPSYNC_RECORD_AUDIO__.currentTime = 0;
    window.__AIVO_LIPSYNC_RECORD_AUDIO__ = null;

    recordedAudioPlayBtn.textContent = "▶";
    recordedAudioPlayBtn.classList.remove("is-playing");
    return;
  }

  const audioUrl = URL.createObjectURL(lipsyncRecordedAudioFile);
  const audio = new Audio(audioUrl);

  window.__AIVO_LIPSYNC_RECORD_AUDIO__ = audio;
  recordedAudioPlayBtn.textContent = "■";
  recordedAudioPlayBtn.classList.add("is-playing");

  audio.addEventListener("ended", () => {
    recordedAudioPlayBtn.textContent = "▶";
    recordedAudioPlayBtn.classList.remove("is-playing");
    window.__AIVO_LIPSYNC_RECORD_AUDIO__ = null;
    URL.revokeObjectURL(audioUrl);
  });

  audio.play().catch((err) => {
    console.error("[LIPSYNC][RECORDED_AUDIO_PLAY_ERROR]", err);

    recordedAudioPlayBtn.textContent = "▶";
    recordedAudioPlayBtn.classList.remove("is-playing");
    window.__AIVO_LIPSYNC_RECORD_AUDIO__ = null;
    URL.revokeObjectURL(audioUrl);

    try { window.toast?.error?.("Ses çalınamadı"); } catch {}
  });

  return;
}
       const inlineAudioPlayBtn = e.target.closest("[data-lipsync-inline-audio-play]");
if (inlineAudioPlayBtn && root.contains(inlineAudioPlayBtn)) {
  e.preventDefault();

  if (!lipsyncRecordedAudioFile) {
    try { window.toast?.error?.("Dinlenecek ses bulunamadı"); } catch {}
    return;
  }

  if (window.__AIVO_LIPSYNC_INLINE_AUDIO__) {
    window.__AIVO_LIPSYNC_INLINE_AUDIO__.pause();
    window.__AIVO_LIPSYNC_INLINE_AUDIO__.currentTime = 0;
    window.__AIVO_LIPSYNC_INLINE_AUDIO__ = null;

    inlineAudioPlayBtn.textContent = "▶";
    inlineAudioPlayBtn.classList.remove("is-playing");
    return;
  }

  const audioUrl = URL.createObjectURL(lipsyncRecordedAudioFile);
  const audio = new Audio(audioUrl);

  window.__AIVO_LIPSYNC_INLINE_AUDIO__ = audio;
  inlineAudioPlayBtn.textContent = "■";
  inlineAudioPlayBtn.classList.add("is-playing");

  audio.addEventListener("ended", () => {
    inlineAudioPlayBtn.textContent = "▶";
    inlineAudioPlayBtn.classList.remove("is-playing");
    window.__AIVO_LIPSYNC_INLINE_AUDIO__ = null;
    URL.revokeObjectURL(audioUrl);
  });

  audio.play().catch((err) => {
    console.error("[LIPSYNC][INLINE_AUDIO_PLAY_ERROR]", err);

    inlineAudioPlayBtn.textContent = "▶";
    inlineAudioPlayBtn.classList.remove("is-playing");
    window.__AIVO_LIPSYNC_INLINE_AUDIO__ = null;
    URL.revokeObjectURL(audioUrl);

    try { window.toast?.error?.("Ses çalınamadı"); } catch {}
  });

  return;
}

const inlineAudioRemoveBtn = e.target.closest("[data-lipsync-inline-audio-remove]");
if (inlineAudioRemoveBtn && root.contains(inlineAudioRemoveBtn)) {
  e.preventDefault();

  if (window.__AIVO_LIPSYNC_INLINE_AUDIO__) {
    window.__AIVO_LIPSYNC_INLINE_AUDIO__.pause();
    window.__AIVO_LIPSYNC_INLINE_AUDIO__.currentTime = 0;
    window.__AIVO_LIPSYNC_INLINE_AUDIO__ = null;
  }

  lipsyncRecordedAudioFile = null;
  lipsyncRecordedChunks = [];

  const audioInput = qs("[data-lipsync-audio]", root);
  const audioName = qs("[data-lipsync-audio-name]", root);
  const scriptInput = qs("[data-lipsync-script]", root);
  const audioCard = qs(".lipsync-inline-audio-card", root);

  if (audioInput) audioInput.value = "";

  if (audioName) {
    audioName.textContent = "Ses yüklenmedi.";
  }

  if (scriptInput) {
    scriptInput.classList.remove("has-lipsync-audio-card");
    scriptInput.placeholder = "Ne konuşturmak istiyorsun? Metni buraya yaz...";
  }

  if (audioCard) {
    audioCard.remove();
  }

  try { window.toast?.success?.("Ses kaldırıldı"); } catch {}

  return;
}
      const generateBtn = e.target.closest("[data-lipsync-generate]");
      if (!generateBtn || !root.contains(generateBtn)) return;

      e.preventDefault();

        const payload = buildPayload(root);

      if (!payload.script && !lipsyncRecordedAudioFile) {
  try { window.toast?.info?.("Konuşma metni yazmalısın veya ses dosyası seçmelisin"); } catch {}
  const scriptInput = qs("[data-lipsync-script]", root);
  if (scriptInput) scriptInput.focus();
  console.log("[LIPSYNC][BLOCKED]", "missing_script_or_audio");
  return;
}
     let estimatedSpeechSeconds = 1;
let estimatedCreditCost = 3;

if (lipsyncRecordedAudioFile && lipsyncAudioDurationSeconds > 0) {
  estimatedSpeechSeconds = lipsyncAudioDurationSeconds;
  estimatedCreditCost = lipsyncAudioCreditCost || Math.ceil(estimatedSpeechSeconds / 2) * 3;

  payload.audioDurationSeconds = estimatedSpeechSeconds;
  payload.audio_duration_seconds = estimatedSpeechSeconds;
  payload.hasAudioFile = true;
  payload.has_audio_file = true;
} else {
  const charsPerSecond = 13;
  estimatedSpeechSeconds = Math.max(1, Math.ceil(payload.script.length / charsPerSecond));
  estimatedCreditCost = Math.ceil(estimatedSpeechSeconds / 2) * 3;

  payload.hasAudioFile = false;
  payload.has_audio_file = false;
}

const maxSpeechSeconds = Number(payload.duration || 10);

payload.estimatedSpeechSeconds = estimatedSpeechSeconds;
payload.estimated_speech_seconds = estimatedSpeechSeconds;
payload.estimatedCredits = estimatedCreditCost;
payload.estimated_credits = estimatedCreditCost;

       if (estimatedSpeechSeconds > maxSpeechSeconds) {
        try {
       window.toast?.error?.(
      `Bu metin yaklaşık ${estimatedSpeechSeconds} saniye sürer. Seçilen süre ${maxSpeechSeconds} saniye.`
      );
       } catch {}

  console.log("[LIPSYNC][BLOCKED]", {
    reason: "script_too_long",
    estimatedSpeechSeconds,
    maxSpeechSeconds
  });

  return;
}
         const photoInput = qs("[data-lipsync-photo]", root);
      const photoFile = photoInput && photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;

      if (!photoFile) {
        try { window.toast?.info?.("Fotoğraf yüklemelisin"); } catch {}
        const photoLabel = qs(".lipsync-photo-label", root);
        if (photoLabel) photoLabel.scrollIntoView({ behavior: "smooth", block: "center" });
        console.log("[LIPSYNC][BLOCKED]", "missing_photo");
        return;
      }

      let imageUrl = "";

try {
  generateBtn.disabled = true;
  generateBtn.textContent = "Fotoğraf yükleniyor...";

  imageUrl = await uploadLipsyncPhotoToR2(photoFile, payload);

  if (!imageUrl) {
    throw new Error("lipsync_photo_url_missing");
  }

  payload.image_url = imageUrl;
  payload.imageUrl = imageUrl;

  console.log("[LIPSYNC][PHOTO_R2_OK]", imageUrl);

  if (lipsyncRecordedAudioFile) {
    generateBtn.textContent = "Ses yükleniyor...";

    const audioUrl = await uploadLipsyncAudioToR2(lipsyncRecordedAudioFile, payload);

    if (!audioUrl) {
      throw new Error("lipsync_audio_url_missing");
    }

    payload.audio_url = audioUrl;
    payload.audioUrl = audioUrl;

    console.log("[LIPSYNC][AUDIO_R2_OK]", audioUrl);
  }
} catch (uploadErr) {
        console.error("[LIPSYNC][PHOTO_R2_ERROR]", uploadErr);

        try {
          window.toast?.error?.("Fotoğraf yüklenemedi");
        } catch {}

        syncGenerateButton(root);
        generateBtn.disabled = false;
        return;
      }
     const creditCost = Number(payload.estimatedCredits || 3);
      const creditReason = "studio_lipsync_generate";
      const consumeRequestId = `lipsync:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

      const creditRes = await fetch("/api/credits/consume-ledger", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "accept": "application/json"
        },
        body: JSON.stringify({
          app: "lipsync",
          action: creditReason,
          cost: creditCost,
          request_id: consumeRequestId,
          reason: creditReason
        })
      });

      const creditData = await creditRes.json().catch(() => null);

      if (!creditRes.ok || !creditData || creditData.ok !== true) {
        console.warn("[LIPSYNC][CREDIT_BLOCKED]", creditData);

        try {
          window.toast?.error?.("Yetersiz kredi");
        } catch {}

        return;
      }

      try {
        const creditGetRes = await fetch("/api/credits/get", {
          credentials: "include",
          cache: "no-store",
          headers: {
            "accept": "application/json"
          }
        });

        const creditGetData = await creditGetRes.json().catch(() => null);

        if (creditGetData?.ok && typeof creditGetData.credits === "number") {
          const topCreditCountEl = document.getElementById("topCreditCount");
          if (topCreditCountEl) {
            topCreditCountEl.textContent = String(creditGetData.credits);
          }

          if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.setCredits === "function") {
            window.AIVO_STORE_V1.setCredits(creditGetData.credits);
          }
        }
      } catch {}

      try {
        window.toast?.success?.(`${creditCost} kredi düşüldü`);
      } catch {}
     generateBtn.disabled = true;
     generateBtn.textContent = "Video hazırlanıyor...";

      fetch("/api/lipsync/create", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      })
        .then(async (res) => {
          const data = await res.json().catch(() => null);

         if (!res.ok || !data || data.ok !== true) {
      if (data?.error === "script_too_long") {
         const message = String(
      data?.message ||
      "Bu metin seçilen süre için çok uzun. Lütfen daha kısa yaz veya daha uzun süre seç."
    );

        try {
      window.toast?.error?.(message);
          } catch {}

         throw new Error("script_too_long_handled");
         }

         throw new Error(data?.error || "lipsync_create_failed");
         }

          console.log("[LIPSYNC][CREATE_OK]", data);

         try {
        window.toast?.success?.("Video oluşturuldu");
      } catch {}

          const jobId = String(data.job_id || "").trim();

          if (!jobId) {
            throw new Error("missing_lipsync_job_id");
          }

          window.dispatchEvent(
            new CustomEvent("aivo:lipsync:job_created", {
              detail: {
                app: "lipsync",
                job_id: jobId,
                status: data.status || "queued",
                createdAt: Date.now(),
                meta: {
                  app: "lipsync",
                  script: payload.script,
                  resolution: payload.resolution,
                  duration: payload.duration,
                  estimatedCredits: payload.estimatedCredits
                }
              }
            })
          );
                    let tries = 0;

          const poll = async () => {
            tries += 1;

            try {
              const statusRes = await fetch(
                "/api/jobs/status?job_id=" + encodeURIComponent(jobId) + "&debug=1",
                {
                  method: "GET",
                  cache: "no-store"
                }
              );

              const statusData = await statusRes.json().catch(() => null);

              console.log("[LIPSYNC][STATUS]", statusData);
             if (String(statusData?.status || "").toLowerCase() === "ready") {
               window.dispatchEvent(new CustomEvent("aivo:lipsync:job_ready", {
              detail: {
      job_id: statusData.job_id,
      app: "lipsync",
      video: statusData.video || null,
      outputs: statusData.outputs || [],
      raw: statusData
      }
     }));
    }
              const status = String(
                statusData?.status ||
                statusData?.db_status ||
                ""
              ).trim().toLowerCase();

            if (status === "ready" || status === "done") {

  try {
    window.toast?.success?.("Lipsync video hazır");
  } catch {}

  // 🔥 FINALIZE CALL
  try {
    await fetch("/api/lipsync/finalize", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        job_id: jobId
      })
    });

    console.log("[LIPSYNC][FINALIZE_TRIGGERED]", jobId);
  } catch (e) {
    console.error("[LIPSYNC][FINALIZE_ERROR]", e);
  }

  return;
}

              if (status === "error") {
                try {
                  window.toast?.error?.("Lipsync üretimi başarısız oldu");
                } catch {}
                return;
              }

              if (tries < 80) {
                setTimeout(poll, 5000);
              }
            } catch (err) {
              console.error("[LIPSYNC][STATUS_ERROR]", err);

              if (tries < 80) {
                setTimeout(poll, 5000);
              }
            }
          };

          poll();
          return data;
        })
        .catch((err) => {
          console.error("[LIPSYNC][CREATE_ERROR]", err);

          try {
            window.toast?.error?.("Lipsync job oluşturulamadı");
          } catch {}
        })
        .finally(() => {
          syncGenerateButton(root);
          generateBtn.disabled = false;
        });
    });
  }

  function init() {
    const root = getRoot();
    if (!root) return false;

    syncGenerateButton(root);
    if (!root.dataset.lipsyncVoiceRangeBind) {
  root.dataset.lipsyncVoiceRangeBind = "1";

  const speedRange = root.querySelector("[data-lipsync-voice-speed]");
  const volumeRange = root.querySelector("[data-lipsync-voice-volume]");
  const speedLabel = root.querySelector("[data-lipsync-speed-label]");
  const volumeLabel = root.querySelector("[data-lipsync-volume-label]");

  if (speedRange && speedLabel) {
    speedRange.addEventListener("input", () => {
      const val = Number(speedRange.value || 1);

      if (val < 0.9) speedLabel.textContent = "Yavaş";
      else if (val > 1.1) speedLabel.textContent = "Hızlı";
      else speedLabel.textContent = "Normal";
    });
  }

  if (volumeRange && volumeLabel) {
    volumeRange.addEventListener("input", () => {
      const val = Number(volumeRange.value || 1);
      volumeLabel.textContent = `${Math.round(val * 100)}%`;
    });
  }
}
    return true;
  }

  bindEvents();

  if (!init()) {
    const observer = new MutationObserver(() => {
      if (init()) observer.disconnect();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
})();
