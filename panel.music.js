/* =========================================================
   AIVO Studio - Music Right Panel
   File: /panel.music.js

   - Desktop TR / EN support
   - Music list, playback, search and progress
   - Download, lyrics, delete and stems actions
   - DB hydration, provider polling and local cache
   ========================================================= */

(function AIVO_PANEL_MUSIC() {
  "use strict";

  if (window.__AIVO_PANEL_MUSIC__) return;
  window.__AIVO_PANEL_MUSIC__ = true;

  const PANEL_KEY = "music";
  const LS_KEY_LEGACY = "aivo.music.jobs.v4";
  const WORKER_ORIGIN = "https://aivo-archive-worker.aivostudioapp.workers.dev";
  const MUSIC_WORKER_ORIGIN = WORKER_ORIGIN;

  const PANEL_DICTIONARY = {
    tr: {
      "studio.music.panel.title": "Müziklerim",
      "studio.music.panel.retention": "⚠️ Müzik dosyaları 14 gün saklanır.",
      "studio.music.panel.searchPlaceholder": "Müziklerde ara...",
      "studio.music.panel.empty": "Henüz müzik yok.",
      "studio.music.panel.noResults": "Aramana uygun müzik bulunamadı.",
      "studio.music.panel.untitled": "İsimsiz Müzik",
      "studio.music.panel.status.ready": "Hazır",
      "studio.music.panel.status.processing": "Hazırlanıyor…",
      "studio.music.panel.status.failed": "Üretim başarısız",
      "studio.music.panel.error.generic": "Üretim tamamlanamadı.",
      "studio.music.panel.error.providerBalance": "Müzik sağlayıcısında yeterli bakiye bulunmuyor.",
      "studio.music.panel.error.policy": "İstek müzik sağlayıcısının içerik kontrolü tarafından reddedildi.",
      "studio.music.panel.action.playPause": "Oynat/Durdur",
      "studio.music.panel.action.progress": "İlerleme",
      "studio.music.panel.action.splitStems": "Parçaları Ayır",
      "studio.music.panel.action.download": "Dosyayı İndir",
      "studio.music.panel.action.lyrics": "Şarkı Sözleri",
      "studio.music.panel.action.delete": "Müziği Sil",
      "studio.music.panel.notReady": "Henüz hazır değil.",
      "studio.music.panel.playFailed": "Müzik oynatılamadı.",
      "studio.music.panel.noDownload": "İndirilecek dosya yok.",
      "studio.music.panel.downloadStarted": "İndirme başlatıldı.",
      "studio.music.panel.downloadFailed": "Dosya indirilemedi.",
      "studio.music.panel.readyToast": "Müzik hazır.",
      "studio.music.panel.stems.ready": "Stems Hazır",
      "studio.music.panel.stems.processing": "Stems…",
      "studio.music.panel.stems.failed": "Stems Hata",
      "studio.music.panel.stems.separating": "Parçalar ayrıştırılıyor…",
      "studio.music.panel.stems.downloadWithin": "24 saat içinde indirin.",
      "studio.music.panel.stems.downloadVocals": "Vokalleri indir",
      "studio.music.panel.stems.downloadDrums": "Davulları indir",
      "studio.music.panel.stems.downloadBass": "Bası indir",
      "studio.music.panel.stems.downloadGuitar": "Gitarı indir",
      "studio.music.panel.stems.downloadPiano": "Piyanoyu indir",
      "studio.music.panel.stems.readyToast": "Kanal ayırma hazır.",
      "studio.music.panel.stems.alreadyReady": "Stems zaten hazır.",
      "studio.music.panel.stems.preparing": "Stems hazırlanıyor…",
      "studio.music.panel.stems.musicFirst": "Önce müzik hazır olmalı.",
      "studio.music.panel.stems.started": "Kanal ayırma işlemi başladı.",
      "studio.music.panel.stems.startFailed": "Stems başlatılamadı.",
      "studio.music.panel.stems.refunded": "İşlem başarısız oldu, kredi iade edildi.",
      "studio.music.panel.stems.noChannel": "İndirilecek kanal yok.",
      "studio.music.panel.stems.downloadStarted": "Kanal indirme başlatıldı.",
      "studio.music.panel.lyrics.song": "Şarkı",
      "studio.music.panel.lyrics.none": "Bu şarkıda söz yok.",
      "studio.music.panel.lyrics.dialogLabel": "Şarkı Sözleri",
      "studio.music.panel.lyrics.title": "Şarkı Sözleri — {title}",
      "studio.music.panel.lyrics.copy": "Kopyala",
      "studio.music.panel.lyrics.close": "Kapat",
      "studio.music.panel.lyrics.copied": "Kopyalandı.",
      "studio.music.panel.lyrics.copyFailed": "Kopyalama başarısız.",
      "studio.music.panel.delete.dbMissing": "DB job id bulunamadı.",
      "studio.music.panel.delete.failed": "Silme başarısız.",
      "studio.music.panel.delete.error": "Silme hatası.",
      "studio.music.panel.delete.success": "Silindi.",
      "studio.music.panel.stems.modal.close": "Kapat",
      "studio.music.panel.stems.modal.title": "Kanal Ayırma",
      "studio.music.panel.stems.modal.description": "Bu işlem 5 kredi kullanır. Devam edilsin mi?",
      "studio.music.panel.stems.modal.fine": "Bu işlem başlamadan önce kredi kesilir.",
      "studio.music.panel.stems.modal.cancel": "İptal",
      "studio.music.panel.stems.modal.confirm": "Onayla (5 Kredi)",
      "studio.music.panel.stems.modal.loading": "Yükleniyor...",
      "studio.music.panel.stems.creditFailed": "Kredi düşürülemedi. Lütfen bakiyeni kontrol et.",
      "studio.music.panel.stems.creditConsumed": "5 kredi düşüldü."
    },
    en: {
      "studio.music.panel.title": "My Music",
      "studio.music.panel.retention": "⚠️ Music files are stored for 14 days.",
      "studio.music.panel.searchPlaceholder": "Search music...",
      "studio.music.panel.empty": "No music yet.",
      "studio.music.panel.noResults": "No music matches your search.",
      "studio.music.panel.untitled": "Untitled Track",
      "studio.music.panel.status.ready": "Ready",
      "studio.music.panel.status.processing": "Preparing…",
      "studio.music.panel.status.failed": "Generation failed",
      "studio.music.panel.error.generic": "Music generation could not be completed.",
      "studio.music.panel.error.providerBalance": "The music provider does not have sufficient balance.",
      "studio.music.panel.error.policy": "The request was rejected by the music provider's content checks.",
      "studio.music.panel.action.playPause": "Play/Pause",
      "studio.music.panel.action.progress": "Progress",
      "studio.music.panel.action.splitStems": "Split Stems",
      "studio.music.panel.action.download": "Download File",
      "studio.music.panel.action.lyrics": "Lyrics",
      "studio.music.panel.action.delete": "Delete Music",
      "studio.music.panel.notReady": "The music is not ready yet.",
      "studio.music.panel.playFailed": "The music could not be played.",
      "studio.music.panel.noDownload": "There is no file to download.",
      "studio.music.panel.downloadStarted": "Download started.",
      "studio.music.panel.downloadFailed": "The file could not be downloaded.",
      "studio.music.panel.readyToast": "Your music is ready.",
      "studio.music.panel.stems.ready": "Stems Ready",
      "studio.music.panel.stems.processing": "Stems…",
      "studio.music.panel.stems.failed": "Stems Failed",
      "studio.music.panel.stems.separating": "Separating stems…",
      "studio.music.panel.stems.downloadWithin": "Download within 24 hours.",
      "studio.music.panel.stems.downloadVocals": "Download vocals",
      "studio.music.panel.stems.downloadDrums": "Download drums",
      "studio.music.panel.stems.downloadBass": "Download bass",
      "studio.music.panel.stems.downloadGuitar": "Download guitar",
      "studio.music.panel.stems.downloadPiano": "Download piano",
      "studio.music.panel.stems.readyToast": "Stem separation is ready.",
      "studio.music.panel.stems.alreadyReady": "The stems are already ready.",
      "studio.music.panel.stems.preparing": "Stems are being prepared…",
      "studio.music.panel.stems.musicFirst": "The music must be ready first.",
      "studio.music.panel.stems.started": "Stem separation started.",
      "studio.music.panel.stems.startFailed": "Stem separation could not be started.",
      "studio.music.panel.stems.refunded": "The operation failed and the credits were refunded.",
      "studio.music.panel.stems.noChannel": "There is no stem to download.",
      "studio.music.panel.stems.downloadStarted": "Stem download started.",
      "studio.music.panel.lyrics.song": "Song",
      "studio.music.panel.lyrics.none": "This song has no lyrics.",
      "studio.music.panel.lyrics.dialogLabel": "Lyrics",
      "studio.music.panel.lyrics.title": "Lyrics — {title}",
      "studio.music.panel.lyrics.copy": "Copy",
      "studio.music.panel.lyrics.close": "Close",
      "studio.music.panel.lyrics.copied": "Copied.",
      "studio.music.panel.lyrics.copyFailed": "Copy failed.",
      "studio.music.panel.delete.dbMissing": "The database job ID could not be found.",
      "studio.music.panel.delete.failed": "The music could not be deleted.",
      "studio.music.panel.delete.error": "An error occurred while deleting the music.",
      "studio.music.panel.delete.success": "Deleted.",
      "studio.music.panel.stems.modal.close": "Close",
      "studio.music.panel.stems.modal.title": "Split Stems",
      "studio.music.panel.stems.modal.description": "This operation uses 5 credits. Continue?",
      "studio.music.panel.stems.modal.fine": "Credits are deducted before the operation starts.",
      "studio.music.panel.stems.modal.cancel": "Cancel",
      "studio.music.panel.stems.modal.confirm": "Confirm (5 Credits)",
      "studio.music.panel.stems.modal.loading": "Loading...",
      "studio.music.panel.stems.creditFailed": "Credits could not be deducted. Please check your balance.",
      "studio.music.panel.stems.creditConsumed": "5 credits deducted."
    }
  };

  let dbCtrl = null;
  let hostEl = null;
  let listEl = null;
  let alive = false;
  let jobs = [];
  let rehydrateMusicPanel = null;
  let onMusicVisibilityChange = null;
  let audioEl = null;
  let rafId = 0;
  let eqRaf = 0;
  let eqLastTs = 0;
  let currentJobId = null;
  let searchQuery = "";

  window.selectedJobId = window.selectedJobId || "";

  const hiddenDeletedIds = new Set();
  const hiddenDeletedBaseIds = new Set();
  const hiddenDeletedDbIds = new Set();
  const eqBarsCache = { jobId: null, bars: null };

  const pollTimers = window.__AIVO_MUSIC_POLL_TIMERS__ || new Map();
  window.__AIVO_MUSIC_POLL_TIMERS__ = pollTimers;

  const pollBusy = new Set();
  const pollLast = new Map();

  const stemsTimers = window.__AIVO_MUSIC_STEMS_TIMERS__ || new Map();
  window.__AIVO_MUSIC_STEMS_TIMERS__ = stemsTimers;

  const readyToasted = window.__AIVO_MUSIC_READY_TOASTED__ || new Set();
  window.__AIVO_MUSIC_READY_TOASTED__ = readyToasted;

  const errorToasted = window.__AIVO_MUSIC_ERROR_TOASTED__ || new Set();
  window.__AIVO_MUSIC_ERROR_TOASTED__ = errorToasted;

  function registerDictionary() {
    try {
      if (window.AIVO_STUDIO_I18N?.registerPack) {
        window.AIVO_STUDIO_I18N.registerPack(PANEL_DICTIONARY);
        return;
      }

      if (window.AIVO_I18N?.tr && window.AIVO_I18N?.en) {
        Object.assign(window.AIVO_I18N.tr, PANEL_DICTIONARY.tr);
        Object.assign(window.AIVO_I18N.en, PANEL_DICTIONARY.en);
      }
    } catch (error) {
      console.warn("[panel.music] dictionary registration failed", error);
    }
  }

  function currentLanguage() {
    try {
      const fromStudio = window.AIVO_STUDIO_I18N?.getLanguage?.();
      if (String(fromStudio || "").toLowerCase().startsWith("en")) return "en";
      if (String(fromStudio || "").toLowerCase().startsWith("tr")) return "tr";
    } catch (_) {}

    const raw = String(window.AIVO_LANG || document.documentElement.lang || "tr").toLowerCase();
    return raw.startsWith("en") ? "en" : "tr";
  }

  function formatText(value, parameters) {
    let output = String(value == null ? "" : value);
    if (!parameters || typeof parameters !== "object") return output;

    Object.keys(parameters).forEach((key) => {
      output = output.replace(new RegExp("\\{" + key + "\\}", "g"), String(parameters[key]));
    });

    return output;
  }

  function mt(key, parameters) {
    try {
      const translated = window.AIVO_STUDIO_I18N?.t?.(key, "", parameters);
      if (translated && translated !== key) return translated;
    } catch (_) {}

    try {
      const translated = window.t?.(key, parameters);
      if (translated && translated !== key) return formatText(translated, parameters);
    } catch (_) {}

    const language = currentLanguage();
    return formatText(
      PANEL_DICTIONARY[language]?.[key] || PANEL_DICTIONARY.tr[key] || key,
      parameters
    );
  }

  function waitForReady(callback) {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (
        window.RightPanel &&
        typeof window.RightPanel.register === "function" &&
        window.DBJobs &&
        typeof window.DBJobs.create === "function"
      ) {
        clearInterval(timer);
        callback();
      } else if (Date.now() - startedAt > 8000) {
        clearInterval(timer);
        console.warn("[panel.music] RightPanel/DBJobs not ready after 8s");
      }
    }, 50);
  }

  const qs = (selector, root = document) => root.querySelector(selector);

  function toast(type, message) {
    try {
      const api = window.toast;
      if (!api) return;
      if (type === "info" && api.info) return api.info(message);
      if (type === "success" && api.success) return api.success(message);
      if (type === "error" && api.error) return api.error(message);
      if (api.show) return api.show(message);
    } catch (_) {}
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function norm(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\s+/g, " ");
  }

  function isMusicApp(value) {
    const normalized = norm(value);
    return normalized === "music" || normalized.includes("music");
  }

  function toMs(value) {
    if (value == null) return 0;
    if (typeof value === "number" && Number.isFinite(value)) return value;

    const text = String(value).trim();
    if (!text) return 0;

    if (/^\d{10,13}$/.test(text)) {
      const number = Number(text);
      return Number.isFinite(number) ? number : 0;
    }

    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(text) && !text.includes("T")) {
      const parsedIso = Date.parse(text.replace(" ", "T") + "Z");
      if (Number.isFinite(parsedIso)) return parsedIso;
    }

    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function uiState(status) {
    const normalized = String(status || "").trim().toLowerCase();
    if (["ready", "done", "completed", "success", "succeeded", "complete"].includes(normalized)) {
      return "ready";
    }
    if (["error", "failed", "fail", "failure", "rejected", "cancelled", "canceled"].includes(normalized)) {
      return "error";
    }
    return "processing";
  }

  function fmtTime(seconds) {
    let value = Number(seconds || 0);
    if (!Number.isFinite(value) || value < 0) value = 0;
    const minutes = Math.floor(value / 60);
    const remaining = Math.floor(value % 60);
    return `${minutes}:${String(remaining).padStart(2, "0")}`;
  }

  function getJobId(value) {
    return String(value?.job_id || value?.id || "").trim();
  }

  function getBaseIdFromJobId(jobId) {
    return String(jobId || "").trim().split("::")[0].trim();
  }

  function getVariantOfJobId(jobId) {
    const value = String(jobId || "").trim();
    if (value.endsWith("::orig")) return "orig";
    if (value.endsWith("::rev1")) return "rev1";
    return "";
  }

  function buildFamilyIds(baseId) {
    const value = String(baseId || "").trim();
    return value ? [`${value}::orig`, `${value}::rev1`] : [];
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(value || "").trim()
    );
  }

  function isRowDeleted(row) {
    return Boolean(row?.deleted_at || row?.deletedAt || row?.meta?.deleted_at || row?.meta?.deletedAt);
  }

  function getRowDbId(row) {
    return String(row?.id || row?.job_id || row?.uuid || "").trim();
  }

  function getRowProviderJobId(row) {
    return String(
      row?.meta?.provider_job_id ||
      row?.meta?.providerJobId ||
      row?.provider_job_id ||
      row?.providerJobId ||
      ""
    ).trim();
  }

  function getRowBaseId(row) {
    const mapped = mapDbJobToCards(row);
    if (mapped.length) return getBaseIdFromJobId(getJobId(mapped[0]));

    const provider = getRowProviderJobId(row);
    if (provider) return provider;

    return String(row?.job_id || row?.id || "").trim();
  }

  function isHiddenJobId(jobId) {
    const id = String(jobId || "").trim();
    if (!id) return false;
    if (hiddenDeletedIds.has(id)) return true;
    const baseId = getBaseIdFromJobId(id);
    return Boolean(baseId && hiddenDeletedBaseIds.has(baseId));
  }

  function isHiddenRow(row) {
    const dbId = getRowDbId(row);
    if (dbId && hiddenDeletedDbIds.has(dbId)) return true;
    const baseId = getRowBaseId(row);
    return Boolean(baseId && hiddenDeletedBaseIds.has(baseId));
  }

  function getCookieValue(name) {
    try {
      const parts = String(document.cookie || "").split(";").map((part) => part.trim());
      for (const part of parts) {
        if (!part) continue;
        const index = part.indexOf("=");
        if (index < 0) continue;
        if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
      }
    } catch (_) {}
    return "";
  }

  function safeKeyPart(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function getMusicCacheScope() {
    try {
      const authRaw = localStorage.getItem("aivo_auth_unified_v1");
      if (authRaw) {
        const auth = JSON.parse(authRaw);
        const email = String(auth?.email || auth?.user?.email || auth?.profile?.email || "").trim();
        if (email) return `mail:${safeKeyPart(email)}`;

        const userId = String(auth?.user_id || auth?.userId || auth?.user?.id || "").trim();
        if (userId) return `uid:${safeKeyPart(userId)}`;
      }
    } catch (_) {}

    const sessionId = String(getCookieValue("aivo_session") || "").trim();
    return sessionId ? `sess:${safeKeyPart(sessionId.slice(0, 24))}` : "guest";
  }

  function getMusicCacheKey() {
    return `aivo.music.jobs.v5.${getMusicCacheScope()}`;
  }

  function clearLegacyMusicCache() {
    try { localStorage.removeItem(LS_KEY_LEGACY); } catch (_) {}
  }

  function saveJobs() {
    try {
      clearLegacyMusicCache();
      const scope = getMusicCacheScope();
      const safeJobs = Array.isArray(jobs)
        ? jobs.slice(0, 200).map((item) => ({ ...item, __cache_scope: scope }))
        : [];
      localStorage.setItem(getMusicCacheKey(), JSON.stringify(safeJobs));
    } catch (_) {}
  }

  function loadJobs() {
    try {
      clearLegacyMusicCache();
      const scope = getMusicCacheScope();
      const items = JSON.parse(localStorage.getItem(getMusicCacheKey()) || "[]");
      if (!Array.isArray(items)) return [];
      return items.filter((item) => String(item?.__cache_scope || "").trim() === scope);
    } catch (_) {
      return [];
    }
  }

  function mergePreferDbButKeepReady(oldItem, dbItem) {
    const output = { ...oldItem, ...dbItem };

    const oldSrc = String(oldItem?.__audio_src || "").trim();
    const dbSrc = String(dbItem?.__audio_src || "").trim();
    if (!dbSrc && oldSrc) output.__audio_src = oldSrc;

    const oldState = uiState(oldItem?.__ui_state);
    const dbState = uiState(dbItem?.__ui_state);
    if (oldState === "ready" && dbState !== "ready" && output.__audio_src) output.__ui_state = "ready";
    if (oldState === "error" && dbState === "processing" && !output.__audio_src) output.__ui_state = "error";

    const keepIfMissing = (key) => {
      const oldValue = String(oldItem?.[key] || "").trim();
      const newValue = String(output?.[key] || "").trim();
      if (!newValue && oldValue) output[key] = oldItem[key];
    };

    [
      "__error_message",
      "__fail_code",
      "__duration",
      "__db_job_id",
      "provider_job_id",
      "__provider_song_id"
    ].forEach(keepIfMissing);

    return output;
  }

  function upsertJob(job) {
    const id = getJobId(job);
    if (!id || isHiddenJobId(id)) return;

    const baseId = getBaseIdFromJobId(id);
    if (baseId && hiddenDeletedBaseIds.has(baseId)) return;

    const index = jobs.findIndex((item) => getJobId(item) === id);
    if (index >= 0) jobs[index] = mergePreferDbButKeepReady(jobs[index], job);
    else jobs.unshift(job);

    saveJobs();
  }

  function clearPoll(jobId) {
    const id = String(jobId || "").trim();
    const timer = pollTimers.get(id);
    if (timer) clearTimeout(timer);
    pollTimers.delete(id);
  }

  function clearAllPolls() {
    for (const timer of pollTimers.values()) clearTimeout(timer);
    pollTimers.clear();
  }

  function schedulePoll(jobId, delay) {
    const id = String(jobId || "").trim();
    if (!alive || !id || isHiddenJobId(id)) return;

    const existing = jobs.find((item) => getJobId(item) === id) || {};
    const state = uiState(existing.__ui_state);
    if (state === "error") return;
    if (state === "ready" && String(existing.__audio_src || "").trim()) return;
    if (pollTimers.has(id)) return;

    const timer = setTimeout(() => {
      pollTimers.delete(id);
      poll(id);
    }, delay);

    pollTimers.set(id, timer);
  }

  function removeJob(jobId) {
    const id = String(jobId || "").trim();
    if (!id) return;

    hiddenDeletedIds.add(id);
    const baseId = getBaseIdFromJobId(id);
    if (baseId) hiddenDeletedBaseIds.add(baseId);

    if (currentJobId === id && audioEl) {
      try { audioEl.pause(); } catch (_) {}
      currentJobId = null;
      eqBarsCache.jobId = null;
      eqBarsCache.bars = null;
      stopRaf();
    }

    clearPoll(id);
    pollBusy.delete(id);
    pollLast.delete(id);
    jobs = jobs.filter((item) => getJobId(item) !== id);
    saveJobs();
    render();
  }

  function bindEqBarsForCurrentJob() {
    if (!currentJobId || !hostEl) {
      eqBarsCache.jobId = null;
      eqBarsCache.bars = null;
      return null;
    }

    const id = String(currentJobId);
    if (eqBarsCache.jobId === id && eqBarsCache.bars?.length) return eqBarsCache.bars;

    const card = hostEl.querySelector(`.aivo-player-card[data-job-id="${CSS.escape(id)}"]`);
    if (!card) {
      eqBarsCache.jobId = id;
      eqBarsCache.bars = null;
      return null;
    }

    const bars = card.querySelectorAll(".aivo-player-btn .aivo-eq i");
    eqBarsCache.jobId = id;
    eqBarsCache.bars = bars?.length ? bars : null;

    eqBarsCache.bars?.forEach((bar) => {
      bar.style.willChange = "transform";
      bar.style.transformOrigin = "50% 100%";
    });

    return eqBarsCache.bars;
  }

  function initEqEngine() {
    if (!audioEl || audioEl.__eqInited) return;
    audioEl.__eqInited = true;

    let context = null;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      context = new AudioContextClass();
    } catch (error) {
      console.warn("[music:eq] AudioContext not available", error);
      return;
    }

    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.85;

    let sourceNode = null;
    try {
      sourceNode = context.createMediaElementSource(audioEl);
    } catch (error) {
      console.warn("[music:eq] createMediaElementSource failed", error);
      return;
    }

    sourceNode.connect(analyser);
    analyser.connect(context.destination);

    audioEl.__eq = {
      ctx: context,
      analyser,
      freq: new Uint8Array(analyser.frequencyBinCount)
    };

    audioEl.addEventListener("play", () => {
      try { context.resume?.(); } catch (_) {}
      bindEqBarsForCurrentJob();
      startEqLoop();
    }, { passive: true });

    audioEl.addEventListener("pause", stopEqLoop, { passive: true });
    audioEl.addEventListener("ended", stopEqLoop, { passive: true });
  }

  function startEqLoop() {
    if (eqRaf) return;
    eqLastTs = 0;
    eqTick();
  }

  function stopEqLoop() {
    if (eqRaf) {
      cancelAnimationFrame(eqRaf);
      eqRaf = 0;
    }
    setEqBars(0.08, 0.06, 0.04);
  }

  function bandAverage(array, start, end) {
    let sum = 0;
    let count = 0;
    for (let index = Math.max(0, start); index < Math.min(array.length, end); index += 1) {
      sum += array[index];
      count += 1;
    }
    return count ? sum / count : 0;
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function setEqBars(low, mid, high) {
    if (!currentJobId || !hostEl) return;
    const bars = bindEqBarsForCurrentJob();
    if (!bars?.length) return;

    const values = [
      0.20 + high * 0.70,
      0.25 + mid * 0.85,
      0.30 + low,
      0.25 + low * 1.15,
      0.30 + low,
      0.25 + mid * 0.85,
      0.20 + high * 0.70
    ];

    bars.forEach((bar, index) => {
      const value = clamp01(values[index] ?? 0.2);
      bar.style.transform = `scaleY(${0.15 + value * 1.15})`;
    });
  }

  function eqTick() {
    eqRaf = requestAnimationFrame(eqTick);
    if (!audioEl || audioEl.paused || !audioEl.__eq) return;

    const now = performance.now();
    if (now - eqLastTs < 33) return;
    eqLastTs = now;

    const { analyser, freq } = audioEl.__eq;
    analyser.getByteFrequencyData(freq);

    setEqBars(
      clamp01(bandAverage(freq, 2, 10) / 255),
      clamp01(bandAverage(freq, 10, 28) / 255),
      clamp01(bandAverage(freq, 28, 60) / 255)
    );
  }

  function ensureAudio() {
    if (audioEl) return audioEl;

    audioEl = document.getElementById("aivoAudio");
    if (!audioEl) {
      audioEl = document.createElement("audio");
      audioEl.id = "aivoAudio";
      audioEl.preload = "metadata";
      audioEl.crossOrigin = "anonymous";
      audioEl.style.display = "none";
      document.body.appendChild(audioEl);
    }

    initEqEngine();

    audioEl.onloadedmetadata = updateProgressUI;
    audioEl.ontimeupdate = updateProgressUI;
    audioEl.onended = () => {
      updateProgressUI();
      setCardPlaying(currentJobId, false);
      currentJobId = null;
      eqBarsCache.jobId = null;
      eqBarsCache.bars = null;
      stopRaf();
    };
    audioEl.onpause = () => {
      updateProgressUI();
      if (currentJobId) setCardPlaying(currentJobId, false);
      stopRaf();
    };
    audioEl.onplay = () => {
      if (currentJobId) setCardPlaying(currentJobId, true);
      bindEqBarsForCurrentJob();
      updateProgressUI();
      startRaf();
    };

    return audioEl;
  }

  function stemProxyUrl(url, label) {
    const cleanUrl = String(url || "").trim();
    if (!cleanUrl) return "";
    const name = String(label || "stem").trim() || "stem";
    return "/api/media/convert-wav?url=" + encodeURIComponent(cleanUrl) + "&filename=" + encodeURIComponent(name + ".wav");
  }

  function renderCard(job) {
    const jobId = getJobId(job);
    const state = uiState(job.__ui_state || "processing");

    const title =
      String(job?.title || "").trim() ||
      String(job?.lyrics || "").replace(/\r/g, "").split("\n").map((line) => line.trim()).find(Boolean) ||
      String(job?.prompt || "").trim().split(/\s+/).slice(0, 2).join(" ") ||
      mt("studio.music.panel.untitled");

    const subtitle = state === "error"
      ? String(job.__error_message || job.error_message || job.subtitle || mt("studio.music.panel.error.generic"))
      : String(job.subtitle || "");

    const duration = job.duration || job.__duration || "";
    const date = job.created_at || job.createdAt || job.__createdAt || "";
    const isReady = state === "ready" && Boolean(job.__audio_src);
    const isPlaying = isReady && String(currentJobId || "") === String(jobId || "") && audioEl && !audioEl.paused;

    const statusTag = isReady
      ? `<span class="aivo-tag is-ready">${esc(mt("studio.music.panel.status.ready"))}</span>`
      : state === "error"
        ? `<span class="aivo-tag is-error">${esc(mt("studio.music.panel.status.failed"))}</span>`
        : `<span class="aivo-tag is-loading">${esc(mt("studio.music.panel.status.processing"))}</span>`;

    const playPauseLabel = esc(mt("studio.music.panel.action.playPause"));
    const playButton = `
      <button
        class="aivo-player-btn"
        data-action="toggle-play"
        aria-label="${playPauseLabel}"
        title="${playPauseLabel}"
        ${isReady ? "" : "disabled"}
        style="${isReady ? "" : "opacity:.45; cursor:not-allowed;"}"
      >
        <svg class="icon-play" viewBox="0 0 24 24" fill="none" style="${isPlaying ? "display:none" : ""}">
          <path d="M8 5v14l11-7z" fill="currentColor"></path>
        </svg>
        <svg class="icon-pause" viewBox="0 0 24 24" fill="none" style="${isPlaying ? "" : "display:none"}">
          <path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor"></path>
        </svg>
        <span class="aivo-eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
      </button>`;

    const stems = job?.stems || job?.__stems || null;
    const stemsStatus = String(stems?.status || "").toLowerCase();
    const stemsOutput = stems?.output || null;

    const stemsBadge =
      stemsStatus === "succeeded"
        ? `<span class="aivo-tag is-ready">${esc(mt("studio.music.panel.stems.ready"))}</span>`
        : ["starting", "processing"].includes(stemsStatus)
          ? `<span class="aivo-tag is-loading">${esc(mt("studio.music.panel.stems.processing"))}</span>`
          : stemsStatus === "failed"
            ? `<span class="aivo-tag is-error">${esc(mt("studio.music.panel.stems.failed"))}</span>`
            : "";

    const stemButton = (url, label, filename, icon, translationKey) => {
      if (!url) return "";
      const titleText = esc(mt(translationKey));
      return `<button class="aivo-stem aivo-stem-ic" type="button" data-action="stem-download" data-url="${esc(stemProxyUrl(url, label))}" data-filename="${esc(filename)}" title="${titleText}" aria-label="${titleText}">${icon}</button>`;
    };

    const stemsControls = stemsStatus === "succeeded" && stemsOutput
      ? `
        <div class="aivo-stems aivo-stems-icons" aria-label="Stems">
          ${stemButton(stemsOutput.vocals, "Vocals", "Vocals.wav", "🎤", "studio.music.panel.stems.downloadVocals")}
          ${stemButton(stemsOutput.drums, "Drums", "Drums.wav", "🥁", "studio.music.panel.stems.downloadDrums")}
          ${stemButton(stemsOutput.bass, "Bass", "Bass.wav", "🔊", "studio.music.panel.stems.downloadBass")}
          ${stemButton(stemsOutput.guitar, "Guitar", "Guitar.wav", "🎸", "studio.music.panel.stems.downloadGuitar")}
          ${stemButton(stemsOutput.piano, "Piano", "Piano.wav", "🎹", "studio.music.panel.stems.downloadPiano")}
          <div class="aivo-stems-note">${esc(mt("studio.music.panel.stems.downloadWithin"))}</div>
        </div>`
      : ["starting", "processing"].includes(stemsStatus)
        ? `<div class="aivo-stems aivo-stems-status">${esc(mt("studio.music.panel.stems.separating"))}</div>`
        : stemsStatus === "failed"
          ? `<div class="aivo-stems aivo-stems-status">${esc(mt("studio.music.panel.stems.failed"))}</div>`
          : "";

    const splitLabel = esc(mt("studio.music.panel.action.splitStems"));
    const downloadLabel = esc(mt("studio.music.panel.action.download"));
    const lyricsLabel = esc(mt("studio.music.panel.action.lyrics"));
    const deleteLabel = esc(mt("studio.music.panel.action.delete"));
    const progressLabel = esc(mt("studio.music.panel.action.progress"));

    return `
      <div
        class="aivo-player-card ${isReady ? "is-ready" : state === "error" ? "is-error" : "is-loading is-processing"} ${isPlaying ? "is-playing" : ""}"
        data-job-id="${esc(jobId)}"
        data-src="${esc(job.__audio_src || "")}"
        data-provider-song-id="${esc(job.__provider_song_id || "")}"
      >
        <div class="aivo-player-left">${playButton}</div>
        <div class="aivo-player-mid">
          <div class="aivo-player-titleRow">
            <div class="aivo-player-title">${esc(title)}</div>
            <div class="aivo-player-tags">${statusTag} ${stemsBadge}</div>
          </div>
          <div class="aivo-player-sub">${esc(subtitle)}</div>
          <div class="aivo-player-meta">
            <span class="meta-dur">${duration ? esc(duration) : "0:00"}</span>
            <span class="aivo-player-dot"></span>
            <span class="meta-date">${date ? esc(date) : ""}</span>
          </div>
          <div class="aivo-progress" title="${progressLabel}"><i style="width:${esc(job.__progress || 0)}%"></i></div>
          <div class="aivo-player-controls">${stemsControls}</div>
        </div>
        <div class="aivo-player-actions">
          <button class="aivo-action is-accent" data-action="stems_5_confirm" title="${splitLabel}" aria-label="${splitLabel}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <path d="M4 12h4M10 12h4M16 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          <button class="aivo-action is-blue" data-action="download" title="${downloadLabel}" aria-label="${downloadLabel}">⬇</button>
          <button class="aivo-action" data-action="lyrics" title="${lyricsLabel}" aria-label="${lyricsLabel}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
              <path d="M14 3v6h6" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="aivo-action is-danger" data-action="delete" title="${deleteLabel}" aria-label="${deleteLabel}">🗑</button>
        </div>
      </div>`;
  }

  function getMusicCardTitle(job) {
    return String(job?.title || "").trim() ||
      String(job?.lyrics || "").replace(/\r/g, "").split("\n").map((line) => line.trim()).find(Boolean) ||
      String(job?.prompt || "").trim().split(/\s+/).slice(0, 2).join(" ") ||
      "";
  }

  function buildMusicSearchHaystack(job) {
    return [getMusicCardTitle(job), String(job?.subtitle || "").trim()]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function render() {
    if (!alive || !hostEl || !listEl) return;
    if (window.RightPanel?.getCurrentKey?.() !== PANEL_KEY) return;

    const view = jobs.filter((job) => {
      const id = getJobId(job);
      return Boolean(id && !isHiddenJobId(id));
    });

    view.sort((a, b) => {
      const aId = getJobId(a);
      const bId = getJobId(b);
      const aBase = getBaseIdFromJobId(aId);
      const bBase = getBaseIdFromJobId(bId);
      const aTime = toMs(a?.created_at) || toMs(a?.createdAt) || toMs(a?.__createdAt) || 0;
      const bTime = toMs(b?.created_at) || toMs(b?.createdAt) || toMs(b?.__createdAt) || 0;

      if (bTime !== aTime) return bTime - aTime;
      if (bBase !== aBase) return bBase.localeCompare(aBase);

      const aRank = aId.endsWith("::orig") ? 0 : aId.endsWith("::rev1") ? 1 : 9;
      const bRank = bId.endsWith("::orig") ? 0 : bId.endsWith("::rev1") ? 1 : 9;
      return aRank - bRank;
    });

    const query = String(searchQuery || "").trim().toLowerCase();
    const filtered = query ? view.filter((job) => buildMusicSearchHaystack(job).includes(query)) : view;

    if (!filtered.length) {
      listEl.innerHTML = `<div class="aivo-empty"><div class="aivo-empty-sub">${esc(
        query ? mt("studio.music.panel.noResults") : mt("studio.music.panel.empty")
      )}</div></div>`;
      return;
    }

    listEl.innerHTML = filtered.map(renderCard).join("");
    eqBarsCache.jobId = null;
    eqBarsCache.bars = null;

    if (currentJobId && audioEl && !audioEl.paused) {
      setCardPlaying(currentJobId, true);
      bindEqBarsForCurrentJob();
      updateProgressUI();
      startRaf();
    }
  }

  function getCard(jobId) {
    if (!hostEl) return null;
    return qs(`.aivo-player-card[data-job-id="${CSS.escape(String(jobId || ""))}"]`, hostEl);
  }

  function setCardPlaying(jobId, isPlaying) {
    if (!jobId) return;
    const card = getCard(jobId);
    if (!card) return;

    const playIcon = qs(".icon-play", card);
    const pauseIcon = qs(".icon-pause", card);
    if (playIcon && pauseIcon) {
      playIcon.style.display = isPlaying ? "none" : "";
      pauseIcon.style.display = isPlaying ? "" : "none";
    }

    card.classList.toggle("is-playing", Boolean(isPlaying));
  }

  function updateProgressUI() {
    if (!audioEl || !currentJobId) return;
    const card = getCard(currentJobId);
    if (!card) return;

    const duration = audioEl.duration || 0;
    const current = audioEl.currentTime || 0;
    const percentage = duration > 0 ? Math.max(0, Math.min(100, (current / duration) * 100)) : 0;

    const bar = qs(".aivo-progress i", card);
    if (bar) bar.style.width = percentage.toFixed(2) + "%";

    const durationElement = qs(".meta-dur", card);
    if (durationElement && duration > 0) {
      durationElement.textContent = `${fmtTime(current)} / ${fmtTime(duration)}`;
    }
  }

  function startRaf() {
    stopRaf();
    const tick = () => {
      updateProgressUI();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function stopRaf() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  async function togglePlayFromCard(card) {
    if (!card) return;

    const jobId = String(card.getAttribute("data-job-id") || "").trim();
    if (!jobId || isHiddenJobId(jobId)) return;

    const existing = jobs.find((item) => getJobId(item) === jobId) || {};
    const source = String(existing.__audio_src || card.dataset.src || "").trim();

    if (!source) {
      toast("info", mt("studio.music.panel.notReady"));
      return;
    }

    const audio = ensureAudio();

    if (currentJobId && currentJobId !== jobId) {
      setCardPlaying(currentJobId, false);
      try { audio.pause(); } catch (_) {}
    }

    if (currentJobId === jobId && !audio.paused) {
      try { audio.pause(); } catch (_) {}
      setCardPlaying(jobId, false);
      return;
    }

    currentJobId = jobId;
    setCardPlaying(jobId, true);
    eqBarsCache.jobId = null;
    eqBarsCache.bars = null;
    bindEqBarsForCurrentJob();

    try {
      if (audio.src !== source) audio.src = source;
      await audio.play();
    } catch (error) {
      console.warn("[panel.music] play failed", {
        jobId,
        source,
        providerSongId: String(existing.__provider_song_id || ""),
        uiState: String(existing.__ui_state || ""),
        errorName: String(error?.name || ""),
        errorMessage: String(error?.message || error || ""),
        audioCurrentSrc: String(audio?.currentSrc || ""),
        audioNetworkState: Number(audio?.networkState || 0),
        audioReadyState: Number(audio?.readyState || 0)
      });
      setCardPlaying(jobId, false);
      toast("error", mt("studio.music.panel.playFailed"));
    }
  }

  function onProgressSeek(event) {
    const progress = event.target.closest(".aivo-progress");
    if (!progress) return;

    const card = event.target.closest(".aivo-player-card");
    if (!card) return;

    const jobId = card.getAttribute("data-job-id");
    if (!jobId || jobId !== currentJobId) return;
    if (!audioEl || !Number.isFinite(audioEl.duration) || audioEl.duration <= 0) return;

    const rectangle = progress.getBoundingClientRect();
    const x = Math.min(Math.max(0, event.clientX - rectangle.left), rectangle.width);
    audioEl.currentTime = (rectangle.width > 0 ? x / rectangle.width : 0) * audioEl.duration;
    updateProgressUI();
  }

  async function downloadBlobFile(url, filename) {
    let cleanUrl = String(url || "").trim();
    if (!cleanUrl) return false;

    cleanUrl = cleanUrl.includes("#") ? cleanUrl.split("#")[0] : cleanUrl;

    if (cleanUrl.includes("/api/media/proxy?url=")) {
      try {
        const encoded = cleanUrl.split("url=")[1] || "";
        cleanUrl = decodeURIComponent(encoded).split("#")[0];
      } catch (_) {}
    }

    try {
      const response = await fetch(cleanUrl, { method: "GET", cache: "no-store" });
      if (!response.ok) throw new Error("download_fetch_failed_" + response.status);

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      return true;
    } catch (error) {
      console.error("[panel.music] download failed", error);
      window.open(cleanUrl, "_blank", "noopener");
      return false;
    }
  }

  async function actionDownload(card) {
    const jobId = String(card?.getAttribute("data-job-id") || "").trim();
    const existing = jobs.find((item) => getJobId(item) === jobId) || {};
    const source = String(existing.__audio_src || card?.dataset?.src || "").trim();

    if (!source) {
      toast("error", mt("studio.music.panel.noDownload"));
      return;
    }

    const downloaded = await downloadBlobFile(source, "music.mp3");
    if (downloaded) toast("success", mt("studio.music.panel.downloadStarted"));
    else toast("error", mt("studio.music.panel.downloadFailed"));
  }

  function stemsSet(jobId, patch) {
    const index = jobs.findIndex((item) => getJobId(item) === jobId);
    if (index < 0) return;

    const current = jobs[index].stems || jobs[index].__stems || {};
    jobs[index] = {
      ...jobs[index],
      stems: { ...current, ...patch, __ts: Date.now() }
    };
    saveJobs();
  }

  async function stemsPost(body) {
    const response = await fetch("/api/music/stems", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      throw new Error(data?.error || data?.message || "http_" + response.status);
    }
    return data;
  }

  function stemsClearTimer(jobId) {
    const timer = stemsTimers.get(jobId);
    if (timer) clearTimeout(timer);
    stemsTimers.delete(jobId);
  }

  function stemsSchedulePoll(jobId, delay) {
    if (!alive || !jobId || isHiddenJobId(jobId) || stemsTimers.has(jobId)) return;

    const timer = setTimeout(() => {
      stemsTimers.delete(jobId);
      stemsPoll(jobId);
    }, delay);

    stemsTimers.set(jobId, timer);
  }

  async function stemsPoll(jobId) {
    if (!alive || !jobId || isHiddenJobId(jobId)) return;

    const existing = jobs.find((item) => getJobId(item) === jobId) || {};
    const stems = existing.stems || existing.__stems || {};
    const predictionId = String(stems.prediction_id || "").trim();
    if (!predictionId) return;

    try {
      const response = await stemsPost({ prediction_id: predictionId });
      const status = String(response.status || "").toLowerCase();
      if (isHiddenJobId(jobId)) return;

      if (status === "succeeded") {
        stemsSet(jobId, { status: "succeeded", output: response.output || null, error: "" });
        render();
        toast("success", mt("studio.music.panel.stems.readyToast"));
        return;
      }

      if (["failed", "canceled", "cancelled"].includes(status)) {
        stemsSet(jobId, { status: "failed", error: response.error || status });
        render();
        return;
      }

      stemsSet(jobId, { status: status || "processing" });
      render();
      stemsSchedulePoll(jobId, 2500);
    } catch (error) {
      stemsSet(jobId, { status: "failed", error: String(error?.message || error || "failed") });
      render();
    }
  }

  async function actionStems(card, options = {}) {
    const jobId = String(options?.job_id || card?.getAttribute("data-job-id") || "").trim();
    if (!jobId || isHiddenJobId(jobId)) return;

    const consumeTransactionId = String(options?.consume_transaction_id || "").trim();
    const consumeAmount = Number(options?.consume_amount || 0) || 0;
    const consumeAction = String(options?.consume_action || "music_stems_split").trim();
    const consumeRequestId = String(options?.consume_request_id || `stems:${jobId}`).trim();

    const existing = jobs.find((item) => getJobId(item) === jobId) || {};
    const source = String(existing.__audio_src || card?.dataset?.src || "").trim();
    if (!source) {
      toast("info", mt("studio.music.panel.stems.musicFirst"));
      return;
    }

    const currentStems = existing.stems || existing.__stems || {};
    const currentStatus = String(currentStems.status || "").toLowerCase();
    const currentPredictionId = String(currentStems.prediction_id || "").trim();

    if (currentStatus === "succeeded") {
      toast("info", mt("studio.music.panel.stems.alreadyReady"));
      return;
    }

    if (currentPredictionId && ["starting", "processing"].includes(currentStatus)) {
      stemsSchedulePoll(jobId, 200);
      toast("info", mt("studio.music.panel.stems.preparing"));
      return;
    }

    async function tryRefund(reason, extraMeta = {}) {
      if (!consumeTransactionId || consumeAmount <= 0) return false;

      try {
        const refundResponse = await fetch("/api/credits/refund", {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            accept: "application/json"
          },
          body: JSON.stringify({
            app: "music",
            action: consumeAction,
            amount: consumeAmount,
            request_id: consumeRequestId,
            job_id: jobId,
            related_transaction_id: consumeTransactionId,
            reason,
            meta: {
              source: "panel.music.actionStems",
              ...extraMeta
            }
          })
        });

        const refundData = await refundResponse.json().catch(() => null);
        const accepted = refundResponse.ok && refundData?.ok && (
          refundData?.refunded || refundData?.deduped || refundData?.skipped
        );

        if (!accepted) return false;

        if (refundData?.refunded) {
          try {
            const creditsResponse = await fetch("/api/credits/get", {
              credentials: "include",
              cache: "no-store",
              headers: { accept: "application/json" }
            });
            const creditsData = await creditsResponse.json().catch(() => null);
            if (creditsData?.ok && typeof creditsData.credits === "number") {
              const topCreditCount = document.getElementById("topCreditCount");
              if (topCreditCount) topCreditCount.textContent = String(creditsData.credits);
              window.AIVO_STORE_V1?.setCredits?.(creditsData.credits);
            }
          } catch (_) {}

          try { window.syncCreditsUI?.({ force: true }); } catch (_) {}
          toast("error", mt("studio.music.panel.stems.refunded"));
        }

        return true;
      } catch (error) {
        console.warn("[panel.music] refund failed", error);
        return false;
      }
    }

    stemsClearTimer(jobId);
    stemsSet(jobId, { status: "starting", prediction_id: "", output: null, error: "" });
    render();
    toast("info", mt("studio.music.panel.stems.started"));

    try {
      const response = await stemsPost({ audio_url: source });
      const predictionId = String(response.id || response.prediction_id || "").trim();
      const status = String(response.status || "starting").toLowerCase();

      if (!predictionId) {
        await tryRefund("stems_start_missing_prediction_id", { stems_response: response || null });
        throw new Error("missing_prediction_id");
      }

      if (isHiddenJobId(jobId)) return;
      stemsSet(jobId, { status: status || "starting", prediction_id: predictionId, output: null, error: "" });
      render();
      stemsSchedulePoll(jobId, 1200);
    } catch (error) {
      await tryRefund("stems_start_failed", {
        error: String(error?.message || error || "failed")
      });
      stemsSet(jobId, { status: "failed", error: String(error?.message || error || "failed") });
      render();
      toast("error", mt("studio.music.panel.stems.startFailed"));
    }
  }

  function actionLyrics(card) {
    const jobId = String(card?.getAttribute("data-job-id") || "").trim();
    if (!jobId) return;

    document.getElementById("aivoLyricsModal")?.remove();

    const existing = jobs.find((item) => getJobId(item) === jobId) || {};
    const title =
      String(existing.title || "").trim() ||
      String(card?.querySelector?.(".aivo-player-title")?.textContent || "").trim() ||
      mt("studio.music.panel.lyrics.song");

    const lyrics = String(existing.lyrics || "").trim();
    if (!lyrics) {
      toast("info", mt("studio.music.panel.lyrics.none"));
      return;
    }

    const durationText =
      String(existing.__duration || existing.duration || "").trim() ||
      String(card?.querySelector?.(".meta-dur")?.textContent || "").trim();

    const dateText =
      String(existing.__createdAt || existing.created_at || existing.createdAt || "").trim() ||
      String(card?.querySelector?.(".meta-date")?.textContent || "").trim();

    if (!document.getElementById("aivoLyricsModalStyle")) {
      const style = document.createElement("style");
      style.id = "aivoLyricsModalStyle";
      style.textContent = `
#aivoLyricsModal{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.58);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);animation:aivoFadeIn .18s ease-out}
@keyframes aivoFadeIn{from{opacity:0}to{opacity:1}}
#aivoLyricsModal .aivoLm{width:min(860px,96vw);max-height:min(78vh,760px);border-radius:18px;overflow:hidden;position:relative;background:linear-gradient(180deg,rgba(30,18,56,.92),rgba(10,12,22,.92));border:1px solid rgba(140,100,255,.22);box-shadow:0 28px 90px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.04) inset;transform:translateY(6px) scale(.99);animation:aivoPop .18s ease-out forwards}
@keyframes aivoPop{to{transform:translateY(0) scale(1)}}
#aivoLyricsModal .aivoLmTop{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 12px;border-bottom:1px solid rgba(255,255,255,.06)}
#aivoLyricsModal .aivoLmLeft{display:flex;gap:12px;align-items:center;min-width:0}
#aivoLyricsModal .aivoLmIcon{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;flex:0 0 auto;background:linear-gradient(135deg,#7c5cff,#ff4fd8);box-shadow:0 10px 28px rgba(124,92,255,.25)}
#aivoLyricsModal .aivoLmTitleWrap{min-width:0}
#aivoLyricsModal .aivoLmTitle{font-weight:800;font-size:16px;letter-spacing:.2px;color:rgba(255,255,255,.95);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#aivoLyricsModal .aivoLmMeta{margin-top:2px;font-size:12px;color:rgba(255,255,255,.55);display:flex;gap:10px;align-items:center;flex-wrap:wrap}
#aivoLyricsModal .aivoLmDot{width:4px;height:4px;border-radius:99px;background:rgba(255,255,255,.28);display:inline-block}
#aivoLyricsModal .aivoLmBtns{display:flex;gap:10px;align-items:center}
#aivoLyricsModal .aivoLmBtn{border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:rgba(255,255,255,.92);border-radius:12px;padding:9px 12px;font-weight:700;font-size:13px;cursor:pointer;display:flex;gap:8px;align-items:center}
#aivoLyricsModal .aivoLmBtn:hover{background:rgba(255,255,255,.10)}
#aivoLyricsModal .aivoLmX{width:40px;height:40px;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:rgba(255,255,255,.75);cursor:pointer;font-size:18px;line-height:0}
#aivoLyricsModal .aivoLmX:hover{background:rgba(255,255,255,.10);color:rgba(255,255,255,.92)}
#aivoLyricsModal .aivoLmBody{padding:16px;max-height:calc(min(78vh,760px) - 72px);overflow:auto}
#aivoLyricsModal .aivoLmBody::-webkit-scrollbar{width:10px}
#aivoLyricsModal .aivoLmBody::-webkit-scrollbar-thumb{background:rgba(140,100,255,.28);border-radius:999px;border:2px solid rgba(10,12,22,.6)}
#aivoLyricsModal .aivoLmBody::-webkit-scrollbar-track{background:rgba(255,255,255,.04)}
#aivoLyricsModal .aivoLmLyrics{white-space:pre-wrap;line-height:1.6;font-size:14px;color:rgba(255,255,255,.84);padding:14px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}`;
      document.head.appendChild(style);
    }

    const modal = document.createElement("div");
    modal.id = "aivoLyricsModal";

    const dialogLabel = esc(mt("studio.music.panel.lyrics.dialogLabel"));
    const copyLabel = esc(mt("studio.music.panel.lyrics.copy"));
    const closeLabel = esc(mt("studio.music.panel.lyrics.close"));

    modal.innerHTML = `
      <div class="aivoLm" role="dialog" aria-modal="true" aria-label="${dialogLabel}">
        <div class="aivoLmTop">
          <div class="aivoLmLeft">
            <div class="aivoLmIcon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M9 18V5l12-2v13" stroke="rgba(255,255,255,.92)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M9 16a3 3 0 1 0 0 6a3 3 0 0 0 0-6Z" fill="rgba(255,255,255,.92)"/>
                <path d="M21 14a3 3 0 1 0 0 6a3 3 0 0 0 0-6Z" fill="rgba(255,255,255,.92)"/>
              </svg>
            </div>
            <div class="aivoLmTitleWrap">
              <div class="aivoLmTitle">${esc(mt("studio.music.panel.lyrics.title", { title }))}</div>
              <div class="aivoLmMeta">
                <span>${durationText ? esc(durationText) : "—"}</span>
                <span class="aivoLmDot"></span>
                <span>${dateText ? esc(dateText) : " "}</span>
              </div>
            </div>
          </div>
          <div class="aivoLmBtns">
            <button class="aivoLmBtn" type="button" data-lyr-action="copy" title="${copyLabel}"><span aria-hidden="true">📋</span> ${copyLabel}</button>
            <button class="aivoLmX" type="button" data-lyr-action="close" aria-label="${closeLabel}" title="${closeLabel}">×</button>
          </div>
        </div>
        <div class="aivoLmBody"><div class="aivoLmLyrics" id="aivoLmLyricsText">${esc(lyrics)}</div></div>
      </div>`;

    const closeLyricsModal = () => document.getElementById("aivoLyricsModal")?.remove();

    modal.addEventListener("click", async (event) => {
      const actionButton = event.target.closest("[data-lyr-action]");
      if (actionButton) {
        const action = actionButton.getAttribute("data-lyr-action");
        if (action === "close") return closeLyricsModal();
        if (action === "copy") {
          try {
            await navigator.clipboard.writeText(lyrics);
            toast("success", mt("studio.music.panel.lyrics.copied"));
          } catch (_) {
            try {
              const textarea = document.createElement("textarea");
              textarea.value = lyrics;
              textarea.style.position = "fixed";
              textarea.style.left = "-9999px";
              document.body.appendChild(textarea);
              textarea.select();
              document.execCommand("copy");
              textarea.remove();
              toast("success", mt("studio.music.panel.lyrics.copied"));
            } catch (_) {
              toast("error", mt("studio.music.panel.lyrics.copyFailed"));
            }
          }
          return;
        }
      }

      if (event.target === modal) closeLyricsModal();
    });

    const onEscape = (event) => {
      if (event.key === "Escape") {
        closeLyricsModal();
        document.removeEventListener("keydown", onEscape, true);
      }
    };

    document.addEventListener("keydown", onEscape, true);
    document.body.appendChild(modal);
  }

  async function resolveDbRowForDelete(jobId, baseId) {
    const familyIds = new Set(buildFamilyIds(baseId));
    familyIds.add(String(jobId || "").trim());

    const familyJobs = jobs.filter((item) => {
      const id = getJobId(item);
      return id && familyIds.has(id);
    });

    for (const item of familyJobs) {
      const dbId = String(item?.__db_job_id || item?.db_job_id || "").trim();
      if (isUuid(dbId)) return { dbJobId: dbId, row: null, source: "memory_uuid" };
    }

    let memoryFallback = "";
    for (const item of familyJobs) {
      const dbId = String(item?.__db_job_id || item?.db_job_id || "").trim();
      if (dbId && !memoryFallback) memoryFallback = dbId;
    }

    try {
      const response = await fetch("/api/jobs/list?app=music", {
        method: "GET",
        credentials: "include",
        headers: { accept: "application/json" },
        cache: "no-store"
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        return memoryFallback
          ? { dbJobId: memoryFallback, row: null, source: "memory_any" }
          : { dbJobId: "", row: null, source: "list_fail" };
      }

      const items = Array.isArray(data.items) ? data.items : Array.isArray(data.jobs) ? data.jobs : [];
      for (const row of items) {
        if (!row || isRowDeleted(row)) continue;

        const rowDbId = getRowDbId(row);
        const rowBaseId = getRowBaseId(row);
        const cardIds = mapDbJobToCards(row).map((card) => getJobId(card)).filter(Boolean);
        const providerSongIds = Array.isArray(row?.meta?.provider_song_ids)
          ? row.meta.provider_song_ids.map((value) => String(value || "").trim()).filter(Boolean)
          : Array.isArray(row?.provider_song_ids)
            ? row.provider_song_ids.map((value) => String(value || "").trim()).filter(Boolean)
            : [];

        const matches =
          (rowDbId && familyIds.has(rowDbId)) ||
          (rowBaseId && rowBaseId === baseId) ||
          cardIds.some((id) => familyIds.has(id)) ||
          providerSongIds.includes(baseId);

        if (matches) return { dbJobId: rowDbId, row, source: "list" };
      }
    } catch (error) {
      console.warn("[panel.music] resolveDbRowForDelete failed", error);
    }

    return memoryFallback
      ? { dbJobId: memoryFallback, row: null, source: "memory_any" }
      : { dbJobId: "", row: null, source: "none" };
  }

  function removeCardLocally(jobId) {
    hiddenDeletedIds.add(jobId);
    clearPoll(jobId);
    pollBusy.delete(jobId);
    pollLast.delete(jobId);
    stemsClearTimer(jobId);

    if (currentJobId === jobId && audioEl) {
      try { audioEl.pause(); } catch (_) {}
      currentJobId = null;
      eqBarsCache.jobId = null;
      eqBarsCache.bars = null;
      stopRaf();
    }

    jobs = jobs.filter((item) => getJobId(item) !== jobId);
    saveJobs();
    render();
  }

  async function actionDelete(card) {
    const jobId = String(card?.getAttribute("data-job-id") || "").trim();
    console.log("[MUSIC_DELETE_FN]", { jobId });
    if (!jobId) return;

    const baseId = getBaseIdFromJobId(jobId);
    const isRevision = getVariantOfJobId(jobId) === "rev1";
    const otherId = isRevision ? `${baseId}::orig` : `${baseId}::rev1`;
    const otherStillExists = jobs.some((item) => getJobId(item) === otherId);

    if (otherStillExists) {
      try {
        const dbJobId = String(jobs.find((item) => getJobId(item) === jobId)?.__db_job_id || "").trim();
        if (!dbJobId) {
          toast("error", mt("studio.music.panel.delete.dbMissing"));
          return;
        }

        const response = await fetch("/api/jobs/delete", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            job_id: dbJobId,
            app: "music",
            variant: getVariantOfJobId(jobId)
          })
        });

        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.ok) {
          toast("error", mt("studio.music.panel.delete.failed"));
          return;
        }

        removeCardLocally(jobId);
        toast("success", mt("studio.music.panel.delete.success"));
        return;
      } catch (error) {
        console.warn("[panel.music] variant delete failed", error);
        toast("error", mt("studio.music.panel.delete.error"));
        return;
      }
    }

    const { dbJobId } = await resolveDbRowForDelete(jobId, baseId);
    if (!dbJobId) {
      removeCardLocally(jobId);
      toast("success", mt("studio.music.panel.delete.success"));
      return;
    }

    try {
      const response = await fetch("/api/jobs/delete", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job_id: dbJobId })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        const staleNotFound = response.status === 404 || String(data?.error || "").trim() === "not_found_or_not_owned";
        if (staleNotFound) {
          removeCardLocally(jobId);
          toast("success", mt("studio.music.panel.delete.success"));
          return;
        }

        toast("error", mt("studio.music.panel.delete.failed"));
        return;
      }

      removeCardLocally(jobId);
      toast("success", mt("studio.music.panel.delete.success"));
      try { await hydrateFromDBOnce(); } catch (_) {}
      try { dbCtrl?.hydrate?.(); } catch (_) {}
    } catch (error) {
      console.warn("[panel.music] delete failed", error);
      toast("error", mt("studio.music.panel.delete.error"));
    }
  }

  async function onCardClick(event) {
    const button = event.target.closest("[data-action]");
    const card = event.target.closest(".aivo-player-card");
    if (!card) return;

    document.querySelectorAll(".aivo-player-card").forEach((element) => {
      element.removeAttribute("data-selected-music-card");
      element.classList.remove("is-selected");
      element.removeAttribute("aria-selected");
    });

    card.setAttribute("data-selected-music-card", "true");
    card.classList.add("is-selected");
    card.setAttribute("aria-selected", "true");
    window.selectedJobId = String(card.getAttribute("data-job-id") || "").trim();

    const action = button?.dataset?.action || null;
    if (!action) return;

    event.preventDefault();
    event.stopPropagation();

    if (action === "stems_5_confirm") {
      const jobId =
        card.getAttribute("data-job-id") ||
        card.dataset.jobId ||
        card.getAttribute("data-track-id") ||
        card.dataset.trackId ||
        card.getAttribute("data-provider-job-id") ||
        card.dataset.providerJobId ||
        "";

      window.openStemConfirmModal?.({
        job_id: jobId,
        onConfirm: async ({
          job_id: confirmedJobId,
          consume_transaction_id: transactionId,
          consume_amount: amount,
          consume_action: consumeAction,
          consume_request_id: requestId
        } = {}) => {
          console.debug("[stems] confirmed 5 credits", {
            job_id: confirmedJobId || jobId,
            consume_transaction_id: transactionId,
            consume_amount: amount,
            consume_action: consumeAction,
            consume_request_id: requestId
          });

          await actionStems(card, {
            job_id: confirmedJobId || jobId,
            consume_transaction_id: transactionId || null,
            consume_amount: Number(amount || 0) || 0,
            consume_action: consumeAction || "music_stems_split",
            consume_request_id: requestId || ""
          });
        }
      });
      return;
    }

    if (action === "toggle-play") return togglePlayFromCard(card);
    if (action === "stems") return actionStems(card);
    if (action === "lyrics") return actionLyrics(card);
    if (action === "download") return actionDownload(card);

    if (action === "stem-download") {
      const url = String(button?.dataset?.url || "").trim();
      const filename = String(button?.dataset?.filename || "stem.wav").trim();
      if (!url) {
        toast("error", mt("studio.music.panel.stems.noChannel"));
        return;
      }

      const downloaded = await downloadBlobFile(url, filename);
      if (downloaded) toast("success", mt("studio.music.panel.stems.downloadStarted"));
      else toast("error", mt("studio.music.panel.downloadFailed"));
      return;
    }

    if (action === "delete") return actionDelete(card);
  }

  function getTopMediaItems(data) {
    if (Array.isArray(data?.topmediai?.data)) return data.topmediai.data;
    if (Array.isArray(data?.topmediai?.data?.data)) return data.topmediai.data.data;
    return [];
  }

  function pickFailureFromStatus(data) {
    const failures = Array.isArray(data?.failures) ? data.failures : [];
    const providerItems = getTopMediaItems(data);
    const failedItem =
      failures[0] ||
      providerItems.find((item) =>
        Number(item?.status) === 3 ||
        (item?.fail_code != null && String(item.fail_code).trim() !== "" && String(item.fail_code).trim() !== "0") ||
        String(item?.fail_reason || "").trim() ||
        /fail|error|reject/i.test(String(item?.state || ""))
      ) ||
      null;

    const failCode = String(
      data?.fail_code ||
      failedItem?.fail_code ||
      failedItem?.failCode ||
      ""
    ).trim();

    const rawReason = String(
      data?.message ||
      data?.fail_reason ||
      data?.error_message ||
      failedItem?.fail_reason ||
      failedItem?.failReason ||
      data?.detail ||
      ""
    ).trim();

    const reasonLower = rawReason.toLowerCase();
    let message = rawReason || mt("studio.music.panel.error.generic");

    if (reasonLower.includes("insufficient account balance")) {
      message = mt("studio.music.panel.error.providerBalance");
    } else if (reasonLower.includes("musician infringement") || reasonLower.includes("artist name")) {
      message = mt("studio.music.panel.error.policy");
    }

    const state = uiState(data?.status || data?.state || failedItem?.state);
    const hasFailure =
      state === "error" ||
      Boolean(failCode) ||
      Boolean(rawReason) ||
      failures.length > 0 ||
      Number(failedItem?.status) === 3;

    return { hasFailure, failCode, message };
  }

  function markJobFailed(id, existing, failure) {
    const baseId = getBaseIdFromJobId(id);
    const errorMessage = String(failure?.message || mt("studio.music.panel.error.generic")).trim();

    upsertJob({
      ...existing,
      job_id: id,
      id,
      __ui_state: "error",
      __audio_src: "",
      __pending_src: "",
      __pending_output_id: "",
      __pending_duration: "",
      __error_message: errorMessage,
      __fail_code: String(failure?.failCode || "").trim(),
      __should_ready_toast: false
    });

    clearPoll(id);
    pollLast.delete(id);
    render();

    const toastKey = baseId || id;
    if (toastKey && !errorToasted.has(toastKey)) {
      errorToasted.add(toastKey);
      toast("error", errorMessage);
    }
  }

  function pickAudioFromStatus(data) {
    const topMedia = getTopMediaItems(data)[0] || null;
    return {
      src: String(
        data?.audio?.src ||
        data?.audio_src ||
        data?.result?.audio?.src ||
        data?.result?.src ||
        data?.job?.audio?.src ||
        topMedia?.audio_url ||
        ""
      ).trim(),
      duration:
        data?.duration ||
        data?.audio?.duration ||
        data?.result?.duration ||
        topMedia?.duration ||
        "",
      output_id: String(
        data?.audio?.output_id ||
        data?.output_id ||
        data?.result?.output_id ||
        data?.job?.output_id ||
        ""
      ).trim(),
      title: String(data?.title || topMedia?.title || data?.job?.title || "").trim(),
      state: String(data?.state || data?.status || data?.job?.status || "").trim()
    };
  }

  async function poll(cardId) {
    const id = String(cardId || "").trim();
    if (!alive || !id || isHiddenJobId(id)) return;

    const now = Date.now();
    const last = pollLast.get(id) || 0;
    if (now - last < 1200 || pollBusy.has(id)) return;

    pollLast.set(id, now);
    pollBusy.add(id);

    try {
      clearPoll(id);
      if (isHiddenJobId(id)) return;

      const existing = jobs.find((item) => getJobId(item) === id) || {};
      const existingState = uiState(existing.__ui_state);
      if (existingState === "error") return;
      if (existingState === "ready" && String(existing.__audio_src || "").trim()) return;

      const providerSongId = String(existing.__provider_song_id || "").trim();
      const providerBase = getBaseIdFromJobId(id);
      const query = encodeURIComponent(providerSongId || providerBase);

      const response = await fetch(`/api/music/status?provider_job_id=${query}`, {
        cache: "no-store",
        credentials: "include"
      });

      const data = await response.json().catch(() => null);
      if (isHiddenJobId(id)) return;

      if (!response.ok || !data) {
        schedulePoll(id, 1800);
        return;
      }

      const failure = pickFailureFromStatus(data);
      if (data.ok === false) {
        if (failure.hasFailure) {
          markJobFailed(id, existing, failure);
          return;
        }
        schedulePoll(id, 1800);
        return;
      }

      const { src, duration, output_id: outputId, title, state } = pickAudioFromStatus(data);
      const normalizedState = uiState(state);
      const playUrl = !src && providerBase && outputId
        ? `${MUSIC_WORKER_ORIGIN}/files/play?job_id=${encodeURIComponent(providerBase)}&output_id=${encodeURIComponent(outputId)}`
        : "";

      const baseId = providerBase;
      const isOriginal = id.endsWith("::orig");
      const otherId = isOriginal ? `${baseId}::rev1` : `${baseId}::orig`;
      const gotAudio = Boolean(src || playUrl);

      const next = {
        job_id: id,
        id,
        __ui_state: gotAudio ? "processing" : normalizedState,
        __pending_src: src || playUrl || "",
        __pending_output_id: outputId || existing.output_id || ""
      };

      if (duration) next.__pending_duration = String(duration);
      if (title) next.title = title;
      if (existing.__db_job_id) next.__db_job_id = existing.__db_job_id;
      if (existing.provider_job_id) next.provider_job_id = existing.provider_job_id;
      if (existing.__provider_song_id) next.__provider_song_id = existing.__provider_song_id;

      if (normalizedState === "error" || failure.hasFailure) {
        markJobFailed(id, { ...existing, ...next }, failure);
        return;
      }

      upsertJob(next);
      const readySource = String(src || playUrl || "").trim();

      if (normalizedState === "ready" && readySource) {
        const shouldReadyToast = Boolean(existing.__should_ready_toast);

        upsertJob({
          job_id: id,
          id,
          __ui_state: "ready",
          __audio_src: readySource,
          __should_ready_toast: false,
          output_id: outputId || existing.output_id || "",
          ...(duration ? { __duration: String(duration) } : {}),
          __pending_src: "",
          __pending_output_id: "",
          __pending_duration: "",
          __db_job_id: String(existing.__db_job_id || "").trim(),
          provider_job_id: String(existing.provider_job_id || "").trim(),
          __provider_song_id: String(existing.__provider_song_id || "").trim(),
          ...(title ? { title } : {})
        });

        clearPoll(id);
        pollBusy.delete(id);
        render();

        if (shouldReadyToast && id && !readyToasted.has(id)) {
          readyToasted.add(id);
          toast("success", mt("studio.music.panel.readyToast"));
        }
        return;
      }

      const existingCurrent = jobs.find((item) => getJobId(item) === id) || {};
      const existingOther = jobs.find((item) => getJobId(item) === otherId) || {};
      const familyWasAlreadyReady =
        uiState(existingCurrent.__ui_state) === "ready" && Boolean(String(existingCurrent.__audio_src || "").trim()) &&
        uiState(existingOther.__ui_state) === "ready" && Boolean(String(existingOther.__audio_src || "").trim());

      const currentSource = String(existingCurrent.__pending_src || existingCurrent.__audio_src || "").trim();
      const otherSource = String(existingOther.__pending_src || existingOther.__audio_src || "").trim();

      if (currentSource && otherSource) {
        const currentOutput = String(existingCurrent.__pending_output_id || existingCurrent.output_id || "").trim();
        const otherOutput = String(existingOther.__pending_output_id || existingOther.output_id || "").trim();
        const currentDuration = String(existingCurrent.__pending_duration || existingCurrent.__duration || "").trim();
        const otherDuration = String(existingOther.__pending_duration || existingOther.__duration || "").trim();

        upsertJob({
          job_id: id,
          id,
          __ui_state: "ready",
          __audio_src: currentSource,
          output_id: currentOutput,
          ...(currentDuration ? { __duration: currentDuration } : {}),
          __pending_src: "",
          __pending_output_id: "",
          __pending_duration: "",
          __db_job_id: String(existingCurrent.__db_job_id || existing.__db_job_id || "").trim(),
          provider_job_id: String(existingCurrent.provider_job_id || existing.provider_job_id || "").trim(),
          __provider_song_id: String(existingCurrent.__provider_song_id || existing.__provider_song_id || "").trim()
        });

        upsertJob({
          job_id: otherId,
          id: otherId,
          __ui_state: "ready",
          __audio_src: otherSource,
          output_id: otherOutput,
          ...(otherDuration ? { __duration: otherDuration } : {}),
          __pending_src: "",
          __pending_output_id: "",
          __pending_duration: "",
          __db_job_id: String(existingOther.__db_job_id || existing.__db_job_id || "").trim(),
          provider_job_id: String(existingOther.provider_job_id || existing.provider_job_id || "").trim(),
          __provider_song_id: String(existingOther.__provider_song_id || "").trim()
        });

        render();
        if (baseId && !readyToasted.has(baseId) && !familyWasAlreadyReady) {
          readyToasted.add(baseId);
          toast("success", mt("studio.music.panel.readyToast"));
        }
        return;
      }

      render();
      schedulePoll(id, 1600);
    } catch (_) {
      schedulePoll(id, 2000);
    } finally {
      pollBusy.delete(id);
    }
  }

  function mapDbJobToCards(row) {
    if (!row || isRowDeleted(row)) return [];

    const meta = row?.meta || {};
    const appGuess = String(row?.app || meta?.app || meta?.module || meta?.routeKey || "").trim();
    if (appGuess && !isMusicApp(appGuess)) return [];

    const providerJobId = getRowProviderJobId(row);
    const dbJobId = getRowDbId(row);
    const baseId = providerJobId || String(row?.provider_job_id || row?.providerJobId || row?.job_id || row?.id || "").trim();
    if (!baseId) return [];

    const songIds = Array.isArray(meta?.provider_song_ids)
      ? meta.provider_song_ids
      : Array.isArray(row?.provider_song_ids)
        ? row.provider_song_ids
        : [];

    const originalSongId = String(songIds[0] || providerJobId || baseId).trim();
    const revisionSongId = String(songIds[1] || songIds[0] || providerJobId || baseId).trim();
    const deletedVariants = Array.isArray(meta?.deleted_variants)
      ? meta.deleted_variants.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
      : [];

    const createdMs = toMs(row?.created_at) || toMs(row?.createdAt) || toMs(meta?.created_at) || Date.now();
    const rawStatus = norm(row?.db_status || row?.status || row?.state || "");
    const state = ["ready", "done", "completed", "success", "succeeded"].includes(rawStatus)
      ? "ready"
      : ["error", "failed", "fail"].includes(rawStatus)
        ? "error"
        : "processing";

    const audioSource = String(
      meta?.audio_src ||
      meta?.audioUrl ||
      row?.audio_src ||
      row?.audioUrl ||
      row?.result?.audio?.src ||
      row?.result?.src ||
      ""
    ).trim();

    const duration = String(meta?.duration || row?.duration || row?.result?.duration || "").trim();
    const providerFailures = Array.isArray(meta?.provider_failures) ? meta.provider_failures : [];
    const firstProviderFailure = providerFailures[0] || null;
    const errorMessage = String(
      meta?.error_message ||
      meta?.fail_reason ||
      row?.error_message ||
      row?.message ||
      firstProviderFailure?.fail_reason ||
      ""
    ).trim();
    const failCode = String(
      meta?.fail_code ||
      row?.fail_code ||
      firstProviderFailure?.fail_code ||
      ""
    ).trim();

    const common = {
      type: "music",
      __db_job_id: dbJobId,
      provider_job_id: providerJobId || baseId,
      __ui_state: state,
      __audio_src: audioSource,
      createdAt: createdMs,
      __createdAt: row?.created_at || meta?.created_at || "",
      created_at: row?.created_at || meta?.created_at || "",
      updated_at: row?.updated_at || meta?.updated_at || "",
      title: String(meta?.title || row?.title || "").trim(),
      lyrics: String(meta?.lyrics || row?.lyrics || "").trim(),
      prompt: String(meta?.prompt || row?.prompt || "").trim(),
      subtitle: String(meta?.subtitle || "").trim(),
      __duration: duration,
      __error_message: errorMessage,
      __fail_code: failCode
    };

    const cards = [];
    if (!deletedVariants.includes("orig")) {
      cards.push({
        ...common,
        job_id: `${baseId}::orig`,
        id: `${baseId}::orig`,
        __provider_song_id: originalSongId
      });
    }

    if (!deletedVariants.includes("rev1")) {
      cards.push({
        ...common,
        job_id: `${baseId}::rev1`,
        id: `${baseId}::rev1`,
        __provider_song_id: revisionSongId
      });
    }

    return cards;
  }

  function onJob(event) {
    const payload = event?.detail || event || {};
    const baseId = String(payload.provider_job_id || payload.job_id || payload.id || "").trim();
    if (!baseId || hiddenDeletedBaseIds.has(baseId)) return;

    const originalId = `${baseId}::orig`;
    const revisionId = `${baseId}::rev1`;
    const providerJobId = String(payload.provider_job_id || "").trim();
    const rawSongIds = Array.isArray(payload.provider_song_ids) ? payload.provider_song_ids : [];
    const originalSongId = String(rawSongIds[0] || providerJobId || baseId).trim();
    const revisionSongId = String(rawSongIds[1] || rawSongIds[0] || providerJobId || baseId).trim();
    const safeTitle = String(payload.title || "").trim();

    const common = {
      type: "music",
      subtitle: String(payload.subtitle || "").trim(),
      provider_job_id: providerJobId,
      __ui_state: "processing",
      __audio_src: "",
      __should_ready_toast: true,
      title: safeTitle,
      lyrics: String(payload.lyrics || "").trim(),
      prompt: String(payload.prompt || "").trim(),
      __createdAt: payload.created_at || payload.createdAt || "",
      createdAt: Date.now()
    };

    upsertJob({ ...common, job_id: originalId, id: originalId, __provider_song_id: originalSongId });
    upsertJob({ ...common, job_id: revisionId, id: revisionId, __provider_song_id: revisionSongId });

    render();
    poll(originalId);
    poll(revisionId);
  }

  function setMusicHostForEvents(element) {
    if (!window.__AIVO_MUSIC_EVENTS__) {
      window.__AIVO_MUSIC_EVENTS__ = { attached: false, host: null };
    }

    window.__AIVO_MUSIC_EVENTS__.host = element || null;
    if (window.__AIVO_MUSIC_EVENTS__.attached) return;
    window.__AIVO_MUSIC_EVENTS__.attached = true;

    window.addEventListener("click", (event) => {
      try {
        if (window.RightPanel?.getCurrentKey?.() !== PANEL_KEY) return;
        const host = window.__AIVO_MUSIC_EVENTS__.host;
        if (!host || !host.contains(event.target)) return;
        onCardClick(event);
      } catch (error) {
        console.warn("[panel.music] click handler error", error);
      }
    }, true);

    window.addEventListener("pointerdown", (event) => {
      try {
        if (window.RightPanel?.getCurrentKey?.() !== PANEL_KEY) return;
        const host = window.__AIVO_MUSIC_EVENTS__.host;
        if (!host || !host.contains(event.target)) return;
        if (event.target.closest(".aivo-progress")) onProgressSeek(event);
      } catch (error) {
        console.warn("[panel.music] pointer handler error", error);
      }
    }, true);
  }

  function onSearch(query) {
    searchQuery = String(query || "").trim().toLowerCase();
    render();
  }

  function getHeader() {
    return {
      title: mt("studio.music.panel.title"),
      meta: mt("studio.music.panel.retention"),
      searchPlaceholder: mt("studio.music.panel.searchPlaceholder"),
      searchEnabled: true,
      resetSearch: false
    };
  }

  function hydrateMergeWithDbRows(rows) {
    const dbCards = [];

    for (const row of Array.isArray(rows) ? rows : []) {
      if (!row || isRowDeleted(row) || isHiddenRow(row)) continue;
      const cards = mapDbJobToCards(row);
      if (cards.length) dbCards.push(...cards);
    }

    const byId = new Map();
    for (const card of dbCards) {
      const id = getJobId(card);
      if (!id || isHiddenJobId(id)) continue;
      byId.set(id, card);
    }

    for (const oldItem of jobs) {
      const id = getJobId(oldItem);
      if (!id || isHiddenJobId(id)) continue;
      if (byId.has(id)) byId.set(id, mergePreferDbButKeepReady(oldItem, byId.get(id)));
    }

    jobs = Array.from(byId.values());
    saveJobs();
    render();
  }

  async function hydrateFromDBOnce() {
    try {
      const response = await fetch("/api/jobs/list?app=music", {
        method: "GET",
        credentials: "include",
        headers: { accept: "application/json" },
        cache: "no-store"
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) return;

      const items = Array.isArray(data.items) ? data.items : Array.isArray(data.jobs) ? data.jobs : [];
      hydrateMergeWithDbRows(items);
    } catch (error) {
      console.warn("[panel.music] hydrateFromDBOnce error", error);
    }
  }

  function mount(contentElement) {
    hostEl = contentElement;
    alive = true;
    setMusicHostForEvents(hostEl);

    hostEl.innerHTML = `
      <div class="rp-players">
        <div class="rp-playerCard">
          <div class="rp-body" id="musicList"></div>
        </div>
      </div>
      <style>
        .aivo-empty-loading{display:flex;align-items:center;justify-content:center;min-height:120px}
        .aivo-empty-pulse{animation:aivoMusicPulse 1.15s ease-in-out infinite}
        @keyframes aivoMusicPulse{0%{opacity:.38}50%{opacity:1}100%{opacity:.38}}
        .aivo-stems-icons{margin-top:8px!important;display:flex!important;flex-wrap:wrap!important;gap:6px!important;align-items:center!important;justify-content:flex-start!important}
        .aivo-stems-note{display:block;flex-basis:100%;margin-top:6px;font-size:12px;opacity:.7}
        .aivo-stems-icons .aivo-stem-ic{display:inline-flex!important;flex:0 0 26px!important;width:26px!important;min-width:26px!important;max-width:26px!important;height:26px!important;min-height:26px!important;max-height:26px!important;padding:0!important;margin:0!important;align-items:center!important;justify-content:center!important;border-radius:10px!important;border:1px solid rgba(255,255,255,.12)!important;background:rgba(255,255,255,.06)!important;text-decoration:none!important;user-select:none!important;line-height:1!important;font-size:13px!important}
        .aivo-stems-icons .aivo-stem-ic:active{transform:translateY(1px)!important}
      </style>`;

    listEl = hostEl.querySelector("#musicList");
    if (listEl) listEl.className = "aivo-player-list";

    ensureAudio();

    const mainAudio = document.getElementById("mainAudio");
    if (mainAudio) {
      try { mainAudio.pause?.(); } catch (_) {}
      mainAudio.removeAttribute("src");
      try { mainAudio.load?.(); } catch (_) {}
      mainAudio.style.display = "none";
    }

    jobs = loadJobs().filter((job) => {
      const id = getJobId(job);
      if (!id || isHiddenJobId(id)) return false;

      const state = String(job?.__ui_state || "").trim().toLowerCase();
      const source = String(job?.__audio_src || "").trim();
      return (state === "ready" && source) || state === "error" || Boolean(source);
    });

    render();
    hydrateFromDBOnce();

    try { dbCtrl?.destroy?.(); } catch (_) {}
    dbCtrl = null;

    if (window.DBJobs?.create) {
      dbCtrl = window.DBJobs.create({
        app: "music",
        debug: false,
        pollIntervalMs: 4000,
        hydrateEveryMs: 15000,
        acceptJob: (job) => {
          if (!job || isRowDeleted(job)) return false;
          const app = String(job?.app || job?.meta?.app || job?.meta?.module || job?.meta?.routeKey || "").trim();
          if (app && !isMusicApp(app)) return false;

          const baseId = getRowBaseId(job);
          const dbId = getRowDbId(job);
          if (baseId && hiddenDeletedBaseIds.has(baseId)) return false;
          if (dbId && hiddenDeletedDbIds.has(dbId)) return false;
          return true;
        },
        acceptOutput: (output) => {
          const type = norm(output?.type || output?.kind || output?.meta?.type || output?.meta?.kind || "");
          return !type || type === "audio";
        },
        onChange: (items) => {
          if (!alive) return;
          hydrateMergeWithDbRows(items);
          jobs.slice(0, 60).forEach((job) => {
            const id = getJobId(job);
            if (id && !isHiddenJobId(id) && uiState(job?.__ui_state) === "processing") poll(id);
          });
        }
      });
    }

    window.addEventListener("aivo:job", onJob, true);

    rehydrateMusicPanel = async () => {
      try { await hydrateFromDBOnce(); } catch (_) {}
      try { dbCtrl?.hydrate?.(); } catch (_) {}
    };

    onMusicVisibilityChange = () => {
      if (document.visibilityState === "visible") rehydrateMusicPanel?.();
    };

    window.addEventListener("focus", rehydrateMusicPanel);
    window.addEventListener("pageshow", rehydrateMusicPanel);
    document.addEventListener("visibilitychange", onMusicVisibilityChange);

    setTimeout(() => rehydrateMusicPanel?.(), 350);
    setTimeout(() => rehydrateMusicPanel?.(), 1200);

    jobs.slice(0, 60).forEach((job) => {
      const id = getJobId(job);
      if (id && !isHiddenJobId(id) && uiState(job?.__ui_state) === "processing") poll(id);
    });

    return destroy;
  }

  function destroy() {
    alive = false;
    setMusicHostForEvents(null);
    window.removeEventListener("aivo:job", onJob, true);
    window.removeEventListener("focus", rehydrateMusicPanel);
    window.removeEventListener("pageshow", rehydrateMusicPanel);
    document.removeEventListener("visibilitychange", onMusicVisibilityChange);
    clearAllPolls();
    stopRaf();
    stopEqLoop();

    try { dbCtrl?.destroy?.(); } catch (_) {}
    dbCtrl = null;

    try { audioEl?.pause?.(); } catch (_) {}
    currentJobId = null;
    eqBarsCache.jobId = null;
    eqBarsCache.bars = null;
    hostEl = null;
    listEl = null;
  }

  function register() {
    window.RightPanel.register(PANEL_KEY, { getHeader, mount, destroy, onSearch });
    console.log("[panel.music] registered");
  }

  function refreshPanelLanguage() {
    registerDictionary();

    if (window.RightPanel?.getCurrentKey?.() === PANEL_KEY) {
      try { window.RightPanel.setHeader?.(getHeader()); } catch (_) {}
      render();
    }
  }

  function ensureStemConfirmModalHelpers() {
    if (window.openStemConfirmModal) return;

    const modalId = "aivoStemConfirmModal";

    function closeStemConfirmModal() {
      document.getElementById(modalId)?.remove();
    }

    function openStemConfirmModal({ job_id: jobId, onConfirm }) {
      closeStemConfirmModal();

      const overlay = document.createElement("div");
      overlay.id = modalId;

      const closeLabel = esc(mt("studio.music.panel.stems.modal.close"));
      overlay.innerHTML = `
        <div class="aivoStemOverlay" role="dialog" aria-modal="true">
          <div class="aivoStemModal">
            <button class="aivoStemX" type="button" aria-label="${closeLabel}">×</button>
            <div class="aivoStemTitle">${esc(mt("studio.music.panel.stems.modal.title"))}</div>
            <div class="aivoStemDesc">${esc(mt("studio.music.panel.stems.modal.description"))}</div>
            <div class="aivoStemFine">${esc(mt("studio.music.panel.stems.modal.fine"))}</div>
            <div class="aivoStemBtns">
              <button class="aivoStemBtn aivoStemCancel" type="button">${esc(mt("studio.music.panel.stems.modal.cancel"))}</button>
              <button class="aivoStemBtn aivoStemOk" type="button">${esc(mt("studio.music.panel.stems.modal.confirm"))}</button>
            </div>
          </div>
        </div>
        <style>
          .aivoStemOverlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:18px}
          .aivoStemModal{width:min(520px,96vw);border-radius:18px;background:rgba(20,20,24,.92);border:1px solid rgba(255,255,255,.10);box-shadow:0 20px 60px rgba(0,0,0,.55);padding:18px 18px 16px;position:relative}
          .aivoStemX{position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font-size:22px;line-height:32px;cursor:pointer}
          .aivoStemTitle{color:#fff;font-weight:700;font-size:18px;margin-bottom:6px}
          .aivoStemDesc{color:rgba(255,255,255,.82);font-size:14px;line-height:1.35}
          .aivoStemFine{margin-top:8px;color:rgba(255,255,255,.55);font-size:12px}
          .aivoStemBtns{margin-top:14px;display:flex;gap:10px;justify-content:flex-end}
          .aivoStemBtn{border-radius:12px;padding:10px 12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;cursor:pointer;font-weight:600}
          .aivoStemBtn:hover{background:rgba(255,255,255,.10)}
          .aivoStemOk{background:rgba(140,90,255,.28);border:1px solid rgba(160,120,255,.45)}
          .aivoStemOk:hover{background:rgba(140,90,255,.36)}
          .aivoStemBtn[disabled]{opacity:.55;cursor:not-allowed}
        </style>`;

      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) closeStemConfirmModal();
      });

      const closeButton = overlay.querySelector(".aivoStemX");
      const cancelButton = overlay.querySelector(".aivoStemCancel");
      const confirmButton = overlay.querySelector(".aivoStemOk");

      closeButton.addEventListener("click", closeStemConfirmModal);
      cancelButton.addEventListener("click", closeStemConfirmModal);

      let locked = false;
      confirmButton.addEventListener("click", async () => {
        if (locked) return;
        locked = true;
        confirmButton.disabled = true;
        const previousText = confirmButton.textContent;
        confirmButton.textContent = mt("studio.music.panel.stems.modal.loading");

        try {
          const consumeAction = "music_stems_split";
          const consumeAmount = 5;
          const consumeRequestId = `stems:${jobId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

          const creditResponse = await fetch("/api/credits/consume-ledger", {
            method: "POST",
            credentials: "include",
            headers: {
              "content-type": "application/json",
              accept: "application/json"
            },
            body: JSON.stringify({
              app: "music",
              action: consumeAction,
              cost: consumeAmount,
              request_id: consumeRequestId,
              job_id: jobId,
              reason: consumeAction
            })
          });

          const creditData = await creditResponse.json().catch(() => ({
            ok: false,
            error: "non_json_response",
            status: creditResponse.status
          }));

          if (!creditResponse.ok || !creditData?.ok) {
            const insufficient = creditResponse.status === 402 || creditData?.error === "insufficient_credits";
            if (insufficient) {
              closeStemConfirmModal();
              try { window.location.href = "/fiyatlandirma.html"; } catch (_) {}
              return;
            }

            toast("error", mt("studio.music.panel.stems.creditFailed"));
            confirmButton.disabled = false;
            confirmButton.textContent = previousText;
            locked = false;
            return;
          }

          try {
            const creditsResponse = await fetch("/api/credits/get", {
              credentials: "include",
              cache: "no-store",
              headers: { accept: "application/json" }
            });
            const creditsData = await creditsResponse.json().catch(() => null);

            if (creditsData?.ok && typeof creditsData.credits === "number") {
              const topCreditCount = document.getElementById("topCreditCount");
              if (topCreditCount) topCreditCount.textContent = String(creditsData.credits);
              window.AIVO_STORE_V1?.setCredits?.(creditsData.credits);
            }
          } catch (_) {}

          toast("success", mt("studio.music.panel.stems.creditConsumed"));

          await onConfirm?.({
            job_id: jobId,
            consume_transaction_id: creditData?.transaction_id || creditData?.transaction?.id || null,
            consume_amount: consumeAmount,
            consume_action: consumeAction,
            consume_request_id: consumeRequestId
          });

          closeStemConfirmModal();
        } catch (error) {
          console.error("[stems] confirm failed", error);
          confirmButton.disabled = false;
          confirmButton.textContent = previousText;
          locked = false;
        }
      });

      document.body.appendChild(overlay);

      const onEscape = (event) => {
        if (event.key === "Escape") {
          document.removeEventListener("keydown", onEscape);
          closeStemConfirmModal();
        }
      };
      document.addEventListener("keydown", onEscape);

      console.debug("[stems] open confirm modal", { job_id: jobId });
    }

    window.openStemConfirmModal = openStemConfirmModal;
    window.closeStemConfirmModal = closeStemConfirmModal;
  }

  registerDictionary();
  ensureStemConfirmModalHelpers();
  waitForReady(register);

  document.addEventListener("aivo:language-change", refreshPanelLanguage);
  document.addEventListener("aivo:studio:i18n-applied", refreshPanelLanguage);

  window.addEventListener("pageshow", (event) => {
    try {
      if (event?.persisted) waitForReady(register);
    } catch (_) {}
  }, { passive: true });
})();
