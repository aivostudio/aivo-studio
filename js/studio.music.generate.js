/* ==========================================================
   AIVO Studio – Music Generate (AUTO BIND, PRODUCTION)
   File: /js/studio.music.generate.js
   ========================================================== */

async function generateMusic(payload) {
  const r = await fetch("/api/music/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const j = await r.json();
  if (!j.ok) throw new Error("generate_failed");

  return j.provider_job_id;
}

/* =========================================================
   AIVO Studio — Music Generate (AUTO BIND, PRODUCTION)
   File: /js/studio.music.generate.js
   ========================================================= */
(function AIVO_STUDIO_MUSIC_GENERATE(){
  if (window.__AIVO_STUDIO_MUSIC_GENERATE__) return;
  window.__AIVO_STUDIO_MUSIC_GENERATE__ = true;

  const BTN_ID = "musicGenerateBtn";
  const PROMPT_SEL = "#prompt";

  // ✅ NEW: Ref audio input
  const REF_AUDIO_INPUT_ID = "refAudio";

  let boundBtn = null;
  let isBusy = false;

  // ✅ NEW: Upload state (R2)
  const refAudioState = {
    status: "empty",   // empty | uploading | ready | error
    url: "",
    name: "",
    contentType: ""
  };

  function qs(sel, root=document){ return root.querySelector(sel); }

  function sleep(ms){ return new Promise((r)=>setTimeout(r, ms)); }

  function getPrompt(){
    const el = qs(PROMPT_SEL);
    return (el?.value || "").trim();
  }

  function toastError(msg){
    if (window.toast?.error) return window.toast.error(msg);
    if (window.toast?.info) return window.toast.info(msg);
    console.warn("[music.generate]", msg);
    alert(msg);
  }

  function toastSuccess(msg){
    if (window.toast?.success) return window.toast.success(msg);
    if (window.toast?.info) return window.toast.info(msg);
    console.log("[music.generate]", msg);
  }

  function dispatchJob(job){
    try {
      window.dispatchEvent(new CustomEvent("aivo:job", { detail: job }));
    } catch(e) {
      console.warn("[music.generate] dispatch aivo:job failed:", e);
    }
  }

  // =========================================================
  // ✅ NEW: UI helper for upload-box text
  // - HTML: <label class="upload-box" for="refAudio"> ... <strong>...</strong> <span class="upload-hint">...</span>
  // =========================================================
  function setRefUploadBoxText({ strongText, hintText }){
    const input = document.getElementById(REF_AUDIO_INPUT_ID);
    if (!input) return;

    const label = document.querySelector(`label.upload-box[for="${REF_AUDIO_INPUT_ID}"]`);
    if (!label) return;

    const strongEl = label.querySelector("strong");
    const hintEl = label.querySelector(".upload-hint");

    if (strongEl && typeof strongText === "string") strongEl.textContent = strongText;
    if (hintEl && typeof hintText === "string") hintEl.textContent = hintText;
  }

  // =========================================================
  // ✅ NEW: R2 presign-put + PUT upload (Music ref audio)
  // Backend: POST /api/r2/presign-put
  // body: { app:"music", kind:"ref_audio", filename, contentType }
  // resp: { ok:true, upload_url|uploadUrl, public_url|publicUrl, required_headers? }
  // =========================================================
  async function presignR2({ app, kind, filename, contentType }) {
    const res = await fetch("/api/r2/presign-put", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        app: app || "music",
        kind: kind || "ref_audio",
        filename,
        contentType
      })
    });

    let data = null;
    try { data = await res.json(); }
    catch { data = { ok:false, error:"non_json_response", status: res.status }; }

    if (!res.ok || !data || data.ok === false) {
      throw new Error(data?.error || ("presign_failed:http_" + res.status));
    }

    const uploadUrl = data.uploadUrl || data.upload_url;
    const publicUrl = data.publicUrl || data.public_url || data.url;
    const requiredHeaders = data.required_headers || data.requiredHeaders || null;

    if (!uploadUrl || !publicUrl) throw new Error("presign_missing_urls");
    return { uploadUrl, publicUrl, requiredHeaders };
  }

  async function uploadToR2(file, { app="music", kind="ref_audio" } = {}) {
    if (!file) throw new Error("missing_file");
    const contentType = file.type || "application/octet-stream";
    const filename = file.name || `ref-audio-${Date.now()}`;

    const { uploadUrl, publicUrl, requiredHeaders } = await presignR2({
      app,
      kind,
      filename,
      contentType
    });

    // required_headers varsa onları bas, yoksa Content-Type bas
    const headers = {};
    if (requiredHeaders && typeof requiredHeaders === "object") {
      Object.assign(headers, requiredHeaders);
    } else {
      headers["Content-Type"] = contentType;
    }

    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers,
      body: file
    });

    if (!put.ok) throw new Error("r2_put_failed:http_" + put.status);

    return { url: publicUrl, name: filename, contentType };
  }

  async function handleRefAudioSelected(file){
    // reset
    if (!file) {
      refAudioState.status = "empty";
      refAudioState.url = "";
      refAudioState.name = "";
      refAudioState.contentType = "";

      setRefUploadBoxText({
        strongText: "Ses dosyası seç veya sürükleyip bırak",
        hintText: "MP3, WAV, M4A — maksimum 10MB"
      });
      return;
    }

    // validate size (10MB)
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      toastError("Dosya çok büyük. Maksimum 10MB.");
      // input reset
      try { const input = document.getElementById(REF_AUDIO_INPUT_ID); if (input) input.value = ""; } catch {}
      return;
    }

    refAudioState.status = "uploading";
    refAudioState.url = "";
    refAudioState.name = file.name || "";
    refAudioState.contentType = file.type || "";

    setRefUploadBoxText({
      strongText: "Yükleniyor…",
      hintText: (file.name || "Dosya") + " yükleniyor"
    });

    try {
      const out = await uploadToR2(file, { app: "music", kind: "ref_audio" });

      refAudioState.status = "ready";
      refAudioState.url = out.url;
      refAudioState.name = out.name || file.name || "";
      refAudioState.contentType = out.contentType || file.type || "";

      setRefUploadBoxText({
        strongText: "Hazır ✓",
        hintText: (file.name || refAudioState.name || "Referans ses") + " yüklendi"
      });

      // debug
      window.__MUSIC_REF_AUDIO_URL__ = refAudioState.url;
      window.__MUSIC_REF_AUDIO_NAME__ = refAudioState.name;

      console.log("[music.refaudio] uploaded OK:", {
        url: refAudioState.url,
        name: refAudioState.name,
        contentType: refAudioState.contentType
      });
    } catch (e) {
      console.warn("[music.refaudio] upload failed:", e);

      refAudioState.status = "error";
      refAudioState.url = "";
      refAudioState.contentType = "";

      setRefUploadBoxText({
        strongText: "Yükleme hatası",
        hintText: "Tekrar dene"
      });

      toastError("Referans ses yüklenemedi.");
    }
  }

  // ✅ NEW: bind input change for ref audio
  function bindRefAudio(){
    const input = document.getElementById(REF_AUDIO_INPUT_ID);
    if (!input) return;
    if (input.__bound) return;
    input.__bound = true;

    input.addEventListener("change", async (e) => {
      const f = e?.target?.files?.[0] || null;
      await handleRefAudioSelected(f);
    });

    console.log("[studio.music.generate] refAudio bound OK:", REF_AUDIO_INPUT_ID);
  }

  async function callGenerateAPI(prompt){

    const titleEl  = document.querySelector('#songName');
    const lyricsEl = document.querySelector('#lyrics');
    const vocalEl  = document.querySelector('#vocalType');
    const moodEl   = document.querySelector('#mood');

    const title  = titleEl  ? titleEl.value.trim()  : '';
    const lyrics = lyricsEl ? lyricsEl.value.trim() : '';

    const vocalText = vocalEl
      ? (vocalEl.value || vocalEl.selectedOptions?.[0]?.textContent?.trim() || "")
      : "";

    const moodText = moodEl
      ? (moodEl.value || moodEl.selectedOptions?.[0]?.textContent?.trim() || "")
      : "";

    // placeholder ise boş gönder
    const vocal = (vocalText === "Vokal tipini seç") ? "" : vocalText;
    const mood  = (moodText  === "Ruh halini seç")   ? "" : moodText;

    // mode’u vokale göre ayarla (enstrümantal seçilmediyse vocals)
    const mode = (vocal === "Enstrümantal (Vokalsiz)") ? "instrumental" : "vocals";

    const payload = {
      prompt,
      mode,
      title,
      lyrics,
      vocal,
      mood,

      // ✅ NEW: reference audio url (R2)
      // backend hangi isimleri bekliyorsa diye iki alan birden gönderiyoruz (aynı değer).
      reference_audio_url: (refAudioState.status === "ready" ? refAudioState.url : ""),
      ref_audio_url: (refAudioState.status === "ready" ? refAudioState.url : ""),

      use_credits: true,
      charge: true,
      credits: 5,
      cost: 5,
    };

    const res = await fetch("/api/music/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    let data = null;
    try { data = await res.json(); }
    catch { data = { ok:false, error:"non_json_response", status: res.status }; }

    if (!res.ok || !data?.ok) {
      const errMsg = data?.error || ("http_" + res.status);
      throw new Error("generate_failed:" + errMsg);
    }

    return data;
  }

  async function doGenerate(){
    if (isBusy) return;
    isBusy = true;

    // =========================================================
    // ✅ BUTTON LOADING EFFECT (Cover ile aynı)
    // - basınca disable + "Üretiliyor..." + class is-loading
    // - minimum 3.5s sonra normale döner
    // =========================================================
    const btn = document.getElementById(BTN_ID);
    const t0 = Date.now();
    const prevText = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.classList.add("is-loading");
      btn.textContent = "Üretiliyor...";
      btn.setAttribute("aria-busy", "true");
    }

    try {
      const prompt = getPrompt();
      if (!prompt){
        toastError("Lütfen önce prompt yaz.");
        return;
      }

      // ✅ UI meta: kart başlığı hiçbir aşamada "Müzik Üretimi" ile ezilmeyecek
      const uiTitle  = String(document.querySelector("#songName")?.value || "").trim();
      const uiLyrics = String(document.querySelector("#lyrics")?.value || "").trim();
      const uiPrompt = String(document.querySelector("#prompt")?.value || "").trim();

      window.__LAST_PROMPT__ = prompt;

      // 1) Direkt API
      let result = null;
      try {
        result = await callGenerateAPI(prompt);
      } catch (apiErr) {
        console.warn("[music.generate] /api/music/generate failed, fallback to svc if any:", apiErr);

        // 2) Fallback: eski service
        const svc =
          window.StudioServices ||
          window.AIVO_SERVICES ||
          window.AIVO_APP ||
          null;

        if (svc?.generateMusic && typeof svc.generateMusic === "function"){
          result = await svc.generateMusic({ prompt });
        }
        else if (window.generateMusic && typeof window.generateMusic === "function"){
          result = await window.generateMusic({ prompt });
        }
        else {
          toastError("Generate endpoint hata verdi ve fallback generateMusic fonksiyonu bulunamadı.");
          return;
        }
      }

      // =========================================================
      // ✅ RESULT NORMALIZE (FIXED)
      // - backend artık provider_job_id döndürüyor: prov_music_...
      // - status endpoint bunu bekliyor
      // =========================================================
      const provider_job_id =
        result?.provider_job_id ||
        result?.providerJobId ||
        result?.data?.provider_job_id ||
        result?.data?.providerJobId ||
        null;

      const internal_job_id =
        result?.job_id ||
        result?.jobId ||
        result?.internal_job_id ||
        result?.id ||
        result?.data?.job_id ||
        result?.data?.id ||
        null;

      // ✅ provider_song_ids normalize (2 ayrı şarkı id'si buradan gelecek)
      const provider_song_ids =
        result?.provider_song_ids ||
        result?.providerSongIds ||
        result?.data?.provider_song_ids ||
        result?.data?.providerSongIds ||
        [];

      // Öncelik provider id
      const job_id = provider_job_id || internal_job_id;

      // ✅ KRİTİK: provider_job_id yoksa status poll yapamayız.
      // Fallback internal UUID ile /api/music/status çalışmaz → "hazırlanıyor"da kalır.
      if (!provider_job_id) {
        console.warn("[music.generate] missing provider_job_id, result:", result);
        toastError("TopMediai create başarısız (provider_job_id gelmedi). Lütfen tekrar dene.");
        return;
      }

      if (!job_id){
        console.warn("[music.generate] generate response:", result);
        toastError("Job oluşturuldu ama job_id / provider_job_id gelmedi.");
        return;
      }

      // DEBUG
      window.__LAST_MUSIC_GENERATE_RESPONSE__ = result;
      window.__LAST_MUSIC_JOB_ID__ = job_id;
      window.__LAST_MUSIC_PROVIDER_JOB_ID__ = provider_job_id;
      window.__LAST_MUSIC_INTERNAL_JOB_ID__ = internal_job_id;

      console.log("[music.generate] FULL_RESPONSE:", result);
      console.log("[music.generate] job_id chosen:", job_id, {
        provider_job_id,
        internal_job_id
      });

      const isProviderJob = String(job_id).startsWith("prov_music_");
      const jobType = "music"; // panel key music

      toastSuccess("Müzik üretimi başladı 🎵");

      // 1) Panel event
      dispatchJob({
        type: jobType,
        kind: jobType,

        job_id: job_id,
        id: job_id,

        status: result?.state || result?.status || "queued",

        // ✅ UI meta forward (title boş olabilir, OK)
        title: uiTitle,
        lyrics: uiLyrics,
        prompt: uiPrompt,

        // ✅ NEW: forward ref audio info (debug + panel kullanımı için)
        reference_audio_url: (refAudioState.status === "ready" ? refAudioState.url : ""),
        ref_audio_url: (refAudioState.status === "ready" ? refAudioState.url : ""),

        __ui_state: "processing",
        __audio_src: "",

        // panel.music.js bunu direkt okuyor
        provider_job_id: provider_job_id,

        // ✅ EN KRİTİK: iki kart için farklı provider_song_id'ler buradan gelecek
        provider_song_ids: Array.isArray(provider_song_ids) ? provider_song_ids : [],

        // panel.music.js için gerçek job id (internal) sakla
        __real_job_id: internal_job_id || job_id,

        // debug flagler kalsın
        __provider_job: isProviderJob,
        __provider_job_id: provider_job_id,
        __internal_job_id: internal_job_id,
      });

      // 2) AIVO_JOBS store (varsa)
      try {
        if (window.AIVO_JOBS?.upsert) {
          window.AIVO_JOBS.upsert({
            type: jobType,
            kind: jobType,
            job_id: job_id,
            id: job_id,
            status: result?.state || result?.status || "queued",

            // ✅ UI meta forward (title boş olabilir, OK)
            title: uiTitle,
            lyrics: uiLyrics,
            prompt: uiPrompt,

            // ✅ NEW: store ref url (debug)
            reference_audio_url: (refAudioState.status === "ready" ? refAudioState.url : ""),
            ref_audio_url: (refAudioState.status === "ready" ? refAudioState.url : ""),

            createdAt: new Date().toISOString(),
            __provider_job: isProviderJob,
            __provider_job_id: provider_job_id,
            __internal_job_id: internal_job_id,
          });

          // =========================================================
          // 🔁 POLL STATUS → READY OLUNCA UI'YI GÜNCELLE
          // =========================================================
          if (provider_job_id) {
            const pollInterval = setInterval(async () => {
              try {
                const r = await fetch(
                  `/api/music/status?provider_job_id=${encodeURIComponent(provider_job_id)}`
                );
                const st = await r.json();

                console.log("[music.generate] poll status:", st);

                if (st?.state === "ready" && st?.audio?.src) {
                  clearInterval(pollInterval);

                  console.log("[music.generate] READY → dispatch UI update", st);

                  dispatchJob({
                    type: "music",
                    kind: "music",
                    job_id: provider_job_id,
                    id: provider_job_id,
                    status: "ready",
                    state: "ready",

                    // ✅ UI meta forward AGAIN (READY update title ezmesin)
                    title: uiTitle,
                    lyrics: uiLyrics,
                    prompt: uiPrompt,

                    // ✅ NEW: forward ref url here too
                    reference_audio_url: (refAudioState.status === "ready" ? refAudioState.url : ""),
                    ref_audio_url: (refAudioState.status === "ready" ? refAudioState.url : ""),

                    __ui_state: "ready",
                    __audio_src: st.audio.src,
                    audio: { src: st.audio.src },
                    mp3_url: st.audio.src,
                    output_id: st.output_id,
                    internal_job_id: st.internal_job_id,
                    __provider_job: true,
                    __provider_job_id: provider_job_id,
                    __internal_job_id: st.internal_job_id,
                  });
                }
              } catch (e) {
                console.warn("[music.generate] status poll failed:", e);
              }
            }, 1500);
          }
        }
      } catch(e) {
        console.warn("[music.generate] AIVO_JOBS.upsert failed:", e);
      }

    } catch (e) {
      console.error("[music.generate] error:", e);
      toastError("Müzik üretiminde hata oluştu.");
    } finally {
      // minimum 3.5s loading görünsün (UX: basıldı hissi)
      const minMs = 3500;
      const dt = Date.now() - t0;
      if (dt < minMs) await sleep(minMs - dt);

      if (btn) {
        btn.disabled = false;
        btn.classList.remove("is-loading");
        btn.textContent = prevText || "🎵 Müzik Üret";
        btn.removeAttribute("aria-busy");
      }

      isBusy = false;
    }
  }

  function bind(){
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;

    if (boundBtn === btn) return;
    boundBtn = btn;

    btn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      doGenerate();
      return false;
    });

    console.log("[studio.music.generate] bound OK:", BTN_ID);
  }

  // ✅ NEW: bind ref upload input too
  function bindAll(){
    bind();
    bindRefAudio();
  }

  setInterval(bindAll, 500);

  window.addEventListener("DOMContentLoaded", bindAll);
  window.addEventListener("load", bindAll);

})();
