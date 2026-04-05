(function () {
  if (window.__AIVO_PHOTOFX_MODULE_LOADED__) {
    if (typeof window.__AIVO_PHOTOFX_RETRY_BOOT__ === "function") {
      window.__AIVO_PHOTOFX_RETRY_BOOT__();
    }
    return;
  }

  window.__AIVO_PHOTOFX_MODULE_LOADED__ = true;

  console.log("[PHOTOFX] module script loaded, waiting for root...");

  const LONG_DURATION_VALUES = new Set(["12", "14", "16", "18", "20"]);
    // ------------------------------------------------------------
  // Policy helpers (PhotoFX)
  // ------------------------------------------------------------
  const PFX_HARD_BLOCK_TERMS = [
    "deepfake",
    "face swap",
    "replace face",
    "swap face",
    "yuzunu koy",
    "yüzünü koy",
    "yuzunu ekle",
    "yüzünü ekle",
    "yuzunu kullan",
    "yüzünü kullan",
    "suratini kullan"
  ];

  const PFX_HARD_BLOCK_PATTERNS = [
    /\bgibi\b/i,
    /\btarzında\b/i,
    /\btarzinda\b/i,
    /\bstilinde\b/i,
    /\bin the style of\b/i,
    /\blike\b/i,
    /\bbirebir\b/i,
    /\baynısı\b/i,
    /\baynisi\b/i,
    /\bface of\b/i,
    /\bwith the face of\b/i,
    /\bimpersonat(e|ion)\b/i
  ];

 const PUBLIC_FIGURE_TERMS = [
  "recep tayyip erdogan",
  "recep tayyip erdoğan",
  "erdogan",
  "erdoğan",
  "kemal kilicdaroglu",
  "kemal kılıçdaroğlu",
  "kilicdaroglu",
  "kılıçdaroğlu",
  "ekrem imamoglu",
  "ekrem imamoğlu",
  "imamoglu",
  "imamoğlu",
  "mansur yavas",
  "mansur yavaş",
  "devlet bahceli",
  "devlet bahçeli",
  "bahceli",
  "bahçeli",
  "meral aksener",
  "meral akşener",
  "aksener",
  "akşener",
  "ozgur ozel",
  "özgür özel",
  "ozel",
  "özel",
  "selahattin demirtas",
  "selahattin demirtaş",
  "demirtas",
  "demirtaş",
  "umit ozdag",
  "ümit özdağ",
  "ozdag",
  "özdağ",
  "fatih erbakan",
  "temel karamollaoglu",
  "temel karamollaoğlu",
  "muharrem ince",
  "sinan ogan",
  "sinan oğan",
  "ali babacan",
  "ahmet davutoglu",
  "ahmet davutoğlu",
  "davutoglu",
  "davutoğlu",
  "hulusi akar",
  "hakan fidan",
  "mehmet simsek",
  "mehmet şimşek",
  "simsek",
  "şimşek",
  "suleyman soylu",
  "süleyman soylu",
  "soylu",
  "bekir bozdag",
  "bekir bozdağ",
  "bozdag",
  "bozdağ",
  "numan kurtulmus",
  "numan kurtulmuş",
  "kurtulmus",
  "kurtulmuş",
  "omer celik",
  "ömer çelik",
  "celik",
  "çelik",
  "binali yildirim",
  "binali yıldırım",
  "abdullah gul",
  "abdullah gül",
  "gul",
  "gül",
  "ahmet necdet sezer",
  "turgut ozal",
  "turgut özal",
  "ismet inonu",
  "ismet inönü",
  "inonu",
  "inönü",
  "mustafa kemal ataturk",
  "mustafa kemal atatürk",
  "ataturk",
  "atatürk",
  "kemal ataturk",
  "cumhurbaskani",
  "cumhurbaşkanı",
  "cumhurbaskani yardimcisi",
  "cumhurbaşkanı yardımcısı",
  "bakan",
  "milletvekili",
  "belediye baskani",
  "belediye başkanı",
  "vali",
  "kaymakam",
  "siyasetci",
  "siyasetçi",
  "politikaci",
  "politikacı",
  "kamu figuru",
  "kamu figürü",
  "devlet buyugu",
  "devlet büyüğü",
  "donald trump",
  "trump",
  "jd vance",
  "j d vance",
  "vance",
  "keir starmer",
  "starmer",
  "emmanuel macron",
  "macron",
  "friedrich merz",
  "merz",
  "frank walter steinmeier",
  "frank-walter steinmeier",
  "steinmeier",
  "giorgia meloni",
  "meloni",
  "sergio mattarella",
  "mattarella",
  "pedro sanchez",
  "pedro sánchez",
  "sanchez",
  "sánchez",
  "felipe vi",
  "mark carney",
  "carney",
  "claudia sheinbaum",
  "sheinbaum",
  "javier milei",
  "milei",
  "luiz inacio lula da silva",
  "luiz inácio lula da silva",
  "lula",
  "lula da silva",
  "vladimir putin",
  "putin",
  "mikhail mishustin",
  "mishustin",
  "volodymyr zelenskyy",
  "zelenskyy",
  "zelensky",
  "yulia svyrydenko",
  "svyrydenko",
  "xi jinping",
  "jinping",
  "li qiang",
  "narendra modi",
  "modi",
  "droupadi murmu",
  "murmu",
  "benjamin netanyahu",
  "netanyahu",
  "isaac herzog",
  "herzog",
  "masoud pezeshkian",
  "pezeshkian",
  "mojtaba khamenei",
  "khamenei",
  "mohammed bin salman",
  "muhammed bin salman",
  "mbs",
  "salman",
  "king salman",
  "sheikh mohamed bin zayed al nahyan",
  "mohamed bin zayed",
  "mbz",
  "sheikh mohammed bin rashid al maktoum",
  "mohammed bin rashid",
  "bin rashid",
  "abdullah ii",
  "king abdullah",
  "jafar hassan",
  "abdel fattah el sisi",
  "abdel fattah al sisi",
  "sisi",
  "mostafa madbouly",
  "madbouly",
  "abiy ahmed",
  "abiy",
  "william ruto",
  "ruto",
  "paul kagame",
  "kagame",
  "samia suluhu hassan",
  "samia suluhu",
  "samia",
  "cyril ramaphosa",
  "ramaphosa",
  "bola tinubu",
  "tinubu",
  "bassirou diomaye faye",
  "diomaye faye",
  "ousmane sonko",
  "sonko",
  "john mahama",
  "mahama",
  "netumbo nandi ndaitwah",
  "netumbo nandi-ndaitwah",
  "nandi ndaitwah",
  "hassan sheikh mohamud",
  "hassan sheikh",
  "hamza abdi barre",
  "kais saied",
  "kais saïed",
  "saied",
  "saïed",
  "mohamed muizzu",
  "muizzu",
  "anwar ibrahim",
  "anwar",
  "prabowo subianto",
  "prabowo",
  "lawrence wong",
  "wong",
  "tharman shanmugaratnam",
  "tharman",
  "lee jae myung",
  "lee jae-myung",
  "shigeru ishiba",
  "ishiba",
  "naruhito",
  "anura kumara dissanayake",
  "dissanayake",
  "paetongtarn shinawatra",
  "shinawatra",
  "maha vajiralongkorn",
  "to lam",
  "tô lâm",
  "luong cuong",
  "lương cường",
  "pham minh chinh",
  "phạm minh chính",
  "hun manet",
  "hun sen",
  "norodom sihamoni",
  "thongloun sisoulith",
  "sisoulith",
  "sonexay siphandone",
  "shehbaz sharif",
  "sharif",
  "asif ali zardari",
  "zardari",
  "muhammad yunus",
  "yunus",
  "kassym jomart tokayev",
  "kassym-jomart tokayev",
  "tokayev",
  "shavkat mirziyoyev",
  "mirziyoyev",
  "sadyr japarov",
  "japarov",
  "emomali rahmon",
  "rahmon",
  "nikol pashinyan",
  "pashinyan",
  "ilham aliyev",
  "aliyev",
  "irakli kobakhidze",
  "kobakhidze",
  "mikheil kavelashvili",
  "kavelashvili",
  "maia sandu",
  "sandu",
  "aleksandar vucic",
  "aleksandar vučić",
  "vucic",
  "vučić",
  "robert fico",
  "fico",
  "peter pellegrini",
  "pellegrini",
  "andrej plenkovic",
  "andrej plenković",
  "plenkovic",
  "plenković",
  "petr pavel",
  "pavel",
  "donald tusk",
  "tusk",
  "andrzej duda",
  "duda",
  "viktor orban",
  "viktor orbán",
  "orban",
  "orbán",
  "nicusor dan",
  "nicușor dan",
  "ilie bolojan",
  "bolojan",
  "boyko borisov",
  "borisov",
  "rumen radev",
  "radev",
  "kyriakos mitsotakis",
  "mitsotakis",
  "edi rama",
  "rama",
  "zoran milanovic",
  "zoran milanović",
  "milanovic",
  "milanović",
  "andrej babis",
  "andrej babiš",
  "babis",
  "babiš",
  "micheal martin",
  "martin",
  "rodrigo chaves",
  "chaves",
  "gustavo petro",
  "petro",
  "daniel noboa",
  "noboa",
  "nayib bukele",
  "bukele",
  "bernardo arevalo",
  "bernardo arévalo",
  "arevalo",
  "arévalo",
  "xiomara castro",
  "castro",
  "daniel ortega",
  "ortega",
  "rosario murillo",
  "murillo",
  "laurentino cortizo",
  "cortizo",
  "jose raul mulino",
  "josé raúl mulino",
  "mulino",
  "luis abinader",
  "abinader",
  "irfaan ali",
  "ali",
  "chan santokhi",
  "santokhi",
  "nicolas maduro",
  "nicolás maduro",
  "maduro",
  "yamandu orsi",
  "yamandú orsi",
  "orsi",
  "prime minister",
  "president",
  "king",
  "queen",
  "chancellor",
  "taoiseach",
  "premier",
  "head of state",
  "head of government",
  "basbakan",
  "başbakan"
  ];

  const PFX_ARTIST_NAME_TERMS = [
    "tarkan",
    "sezen aksu",
    "ajda pekkan",
    "sertab erener",
    "mustafa sandal",
    "kenan dogulu",
    "kenan doğulu",
    "handa yener",
    "demet akalin",
    "demet akalın",
    "gulsen",
    "gülşen",
    "hadise",
    "aleyna tilki",
    "edis",
    "murat boz",
    "simge",
    "simge sagin",
    "simge sağın",
    "sila",
    "sıla",
    "mabel matiz",
    "yildiz tilbe",
    "yıldız tilbe",
    "sibel can",
    "linet",
    "duman",
    "mor ve otesi",
    "mor ve ötesi",
    "teoman",
    "oguzhan koc",
    "oğuzhan koç",
    "cem adrian",
    "haluk levent",
    "baris manco",
    "barış manço",
    "athena",
    "manga",
    "sagopa kajmer",
    "ceza",
    "ezhel",
    "ben fero",
    "gazapizm",
    "uzi",
    "cakal",
    "çakal",
    "semicenk",
    "motive",
    "khontkar",
    "norm ender",
    "selda bagcan",
    "selda bağcan",
    "muslum gurses",
    "müslüm gürses",
    "ibrahim tatlises",
    "ibrahim tatlıses",
    "orhan gencebay",
    "ferdi tayfur",
    "volkan konak",
    "candan ercetin",
    "nazan oncel",
    "nazan öncel",
    "buray",
    "irem derici",
    "melek mosso",
    "madrigal",
    "dedubluman",
    "yalin",
    "yalın",
    "emre aydin",
    "emre aydın",
    "sefo",
    "sertab"
  ];

  function normalizePhotoFxPolicyText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildPhotoFxPolicyPhraseRegex(term) {
    const normalized = normalizePhotoFxPolicyText(term);
    if (!normalized) return null;

    const pattern = normalized
      .split(" ")
      .filter(Boolean)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s+");

    return new RegExp(`(^|\\s)${pattern}(?=\\s|$)`, "i");
  }

  function isPhotoFxPolicyBlocked(raw) {
    const text = normalizePhotoFxPolicyText(raw);

    const hasBlockedTerm =
      PFX_HARD_BLOCK_TERMS.some((term) => {
        const rx = buildPhotoFxPolicyPhraseRegex(term);
        return rx ? rx.test(text) : false;
      }) ||
      PUBLIC_FIGURE_TERMS.some((term) => {
        const rx = buildPhotoFxPolicyPhraseRegex(term);
        return rx ? rx.test(text) : false;
      }) ||
      PFX_ARTIST_NAME_TERMS.some((term) => {
        const rx = buildPhotoFxPolicyPhraseRegex(term);
        return rx ? rx.test(text) : false;
      });

    const hasBlockedPattern = PFX_HARD_BLOCK_PATTERNS.some((rx) => rx.test(raw));
    return !!raw && (hasBlockedTerm || hasBlockedPattern);
  }
  function ensurePhotoFxPolicyNote(root, createBtn) {
    if (!root || !createBtn) return null;

    let note = qs("#pfxPolicyNote", root);
    if (note) return note;

    note = document.createElement("div");
    note.id = "pfxPolicyNote";
    note.style.display = "none";
    note.style.marginTop = "14px";
    note.style.padding = "14px 16px";
    note.style.borderRadius = "18px";
    note.style.background = "rgba(255,90,120,.10)";
    note.style.border = "1px solid rgba(255,120,150,.24)";
    note.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,.04)";
    note.style.textAlign = "center";
    note.style.fontSize = "14px";
    note.style.fontWeight = "800";
    note.style.lineHeight = "1.65";
    note.style.color = "rgba(255,245,248,.96)";

    const mountPoint =
      createBtn.parentElement ||
      createBtn.closest(".pfxCreateWrap") ||
      root;

    mountPoint.appendChild(note);
    return note;
  }

  function resetPhotoFxPolicyUI(root) {
    if (!root) return;

    const promptEl = qs("#pfxPrompt", root);
    const createBtn = qs(".pfxCreateBtn", root);
    const note = qs("#pfxPolicyNote", root);

    if (promptEl) {
      promptEl.style.borderColor = "";
      promptEl.style.boxShadow = "";
    }

    if (createBtn) {
      createBtn.style.background = "";
      createBtn.style.borderColor = "";
      createBtn.style.boxShadow = "";
      createBtn.style.cursor = "";
      createBtn.style.filter = "";
    }

    if (note) {
      note.style.display = "none";
      note.textContent = "";
    }
  }

  function buildPhotoFxPolicyText(root, form = null) {
    const payload = form || collectForm(root);

    return [
      payload?.prompt,
      payload?.style,
      ...(Array.isArray(payload?.styles) ? payload.styles : []),
      payload?.motionLevel,
      payload?.effectStrength,
      payload?.colorMood,
      payload?.transitionSpeed,
      payload?.zoomLevel
    ]
      .filter(Boolean)
      .join(" ");
  }

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function getRoot() {
    return document.querySelector('section.pfxPage[data-module="photofx"]');
  }
  function getState(root) {
    if (!root) return null;

    if (!root.__photofxState) {
      root.__photofxState = {
        presets: [],
        imageFile: null,
        endImageFile: null,
        logoFile: null,
        audioFile: null,
        audioFileName: "",
        audioFileUrl: "",
        audioFileUploadPromise: null,
        audioFileUploadStatus: "idle",
        audioFileUploadError: "",
      };
    }

    return root.__photofxState;
  }

  function ensureHiddenInput(root, id, accept) {
    let input = qs(`#${id}`, root);
    if (input) return input;

    input = document.createElement("input");
    input.type = "file";
    input.id = id;
    input.accept = accept || "";

    input.style.position = "absolute";
    input.style.left = "-9999px";
    input.style.top = "0";
    input.style.width = "1px";
    input.style.height = "1px";
    input.style.opacity = "0";
    input.style.pointerEvents = "none";

    root.appendChild(input);
    return input;
  }

  function ensureUploadMetaNode(root, btnId, infoId) {
    const btn = qs(`#${btnId}`, root);
    if (!btn) return null;

    let info = qs(`#${infoId}`, root);
    if (info) return info;

    const wrap = btn.closest(".pfxUploadTool") || btn.parentElement || root;

    info = document.createElement("div");
    info.id = infoId;
    info.className = "pfxUploadMeta";

    wrap.appendChild(info);
    return info;
  }

  function truncateName(name, max = 28) {
    const safe = String(name || "").trim();
    if (!safe) return "";
    if (safe.length <= max) return safe;
    return `${safe.slice(0, max - 1)}…`;
  }

  function renderUploadBadge(node, file, emptyText, clearKey) {
    if (!node) return;

    node.innerHTML = "";

    if (!file) {
      const empty = document.createElement("div");
      empty.className = "pfxUploadEmpty";
      empty.textContent = emptyText || "Dosya seçilmedi";
      node.appendChild(empty);
      return;
    }

    const chip = document.createElement("div");
    chip.className = "pfxUploadChip";

    const name = document.createElement("div");
    name.className = "pfxUploadChipName";
    name.title = file.name || "";
    name.textContent = truncateName(file.name || "");

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "pfxUploadChipClear";
    clearBtn.setAttribute("data-clear-upload", clearKey);
    clearBtn.setAttribute("aria-label", "Seçili dosyayı kaldır");
    clearBtn.textContent = "×";

    chip.appendChild(name);
    chip.appendChild(clearBtn);
    node.appendChild(chip);
  }

  function clearFileSelection(root, key) {
    const state = getState(root);
    if (!state) return;

    if (key === "image") {
      state.imageFile = null;
      const input = qs("#pfxImageInput", root);
      if (input) input.value = "";
    }

    if (key === "end-image") {
      state.endImageFile = null;
      const input = qs("#pfxEndImageInput", root);
      if (input) input.value = "";
    }

    if (key === "logo") {
      state.logoFile = null;
      const input = qs("#pfxLogoInput", root);
      if (input) input.value = "";
    }

    if (key === "audio") {
      state.audioFile = null;
      state.audioFileName = "";
      state.audioFileUrl = "";
      state.audioFileUploadPromise = null;
      state.audioFileUploadStatus = "idle";
      state.audioFileUploadError = "";
      const input = qs("#pfxAudioInput", root);
      if (input) input.value = "";
    }

    renderUploads(root);
  }

  function getSelectedPresets(root) {
    const state = getState(root);
    return Array.isArray(state?.presets) ? state.presets : [];
  }

  function getPhotoFxEstimatedCredits(root) {
    const state = getState(root);
    const selected = getSelectedPresets(root);
    const duration = String(qs("#pfxDuration", root)?.value || "6");

    let total = 30;

    if (duration === "8") total = 35;
    else if (duration === "10") total = 40;
    else if (duration === "12") total = 45;
    else if (duration === "14") total = 50;
    else if (duration === "16") total = 55;
    else if (duration === "18") total = 60;
    else if (duration === "20") total = 65;

    total += selected.length * 5;

    if (state?.logoFile) total += 10;

    const includeMusic =
      String(qs("#pfxIncludeMusic", root)?.value || "no") === "yes";

    if (includeMusic && state?.audioFile) {
      total += 10;
    }

    return total;
  }

  function setPromptCounter(root) {
    const ta = qs("#pfxPrompt", root);
    const count = qs("#pfxPromptCount", root);
    if (!ta || !count) return;

    count.textContent = String((ta.value || "").length);
  }

  function syncCreateButton(root) {
    const createBtn = qs(".pfxCreateBtn", root);
    if (!createBtn) return;

    const totalCredits = getPhotoFxEstimatedCredits(root);

    createBtn.setAttribute("data-credit-cost", String(totalCredits));
    createBtn.textContent = `🎬 Klip Oluştur (${totalCredits} Kredi)`;
  }
  function renderPresets(root) {
    const selected = getSelectedPresets(root);

    qsa(".pfxPresetCard[data-preset]", root).forEach((btn) => {
      const preset = String(btn.getAttribute("data-preset") || "").trim();
      const on = selected.includes(preset);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function renderUploads(root) {
    const state = getState(root);

    const imageMeta = ensureUploadMetaNode(
      root,
      "pfxInlineUploadBtn",
      "pfxImageMeta"
    );

    const endImageMeta = ensureUploadMetaNode(
      root,
      "pfxEndImageUploadBtn",
      "pfxEndImageMeta"
    );

    const logoMeta = ensureUploadMetaNode(
      root,
      "pfxLogoUploadBtn",
      "pfxLogoMeta"
    );

    const audioMeta = ensureUploadMetaNode(
      root,
      "pfxAudioUploadBtn",
      "pfxAudioMeta"
    );

    renderUploadBadge(imageMeta, state.imageFile, "Dosya seçilmedi", "image");

    renderUploadBadge(
      endImageMeta,
      state.endImageFile,
      "Dosya seçilmedi",
      "end-image"
    );

    renderUploadBadge(logoMeta, state.logoFile, "Dosya seçilmedi", "logo");

    renderUploadBadge(audioMeta, state.audioFile, "Dosya seçilmedi", "audio");
  }

  function syncIncludeMusic(root) {
    const includeMusic = qs("#pfxIncludeMusic", root);
    const audioBtn = qs("#pfxAudioUploadBtn", root);
    const audioInput = qs("#pfxAudioInput", root);

    if (!includeMusic || !audioBtn || !audioInput) return;

    const enabled = String(includeMusic.value || "no") === "yes";

    audioBtn.disabled = false;
    audioInput.disabled = false;
    audioBtn.classList.remove("is-disabled");

    audioBtn.dataset.includeMusicEnabled = enabled ? "yes" : "no";
    audioInput.dataset.includeMusicEnabled = enabled ? "yes" : "no";
  }

  function syncDurationRules(root) {
    const durationEl = qs("#pfxDuration", root);
    const resolutionEl = qs("#pfxResolution", root);
    const fpsEl = qs("#pfxFps", root);

    if (!durationEl || !resolutionEl || !fpsEl) return;

    const duration = String(durationEl.value || "6");

    if (LONG_DURATION_VALUES.has(duration)) {
      fpsEl.value = "25";
    }
  }

  async function postJSON(url, payload) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await r.json().catch(() => null);

    if (!r.ok || !j) {
      throw new Error(j?.error || `photofx_failed_${r.status}`);
    }

    if (j.ok === false) {
      throw new Error(j.error || "photofx_failed");
    }

    return j;
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function isReadyStatus(s) {
    const v = String(s || "").toLowerCase();
    return (
      v === "ready" ||
      v === "done" ||
      v === "completed" ||
      v === "complete" ||
      v === "success" ||
      v === "succeeded"
    );
  }

  function pickPhotoFxVideoOutputs(outputs) {
    if (!Array.isArray(outputs)) return [];

    return outputs.filter((o) => {
      if (!o) return false;

      const type = String(
        o.type || o.kind || o?.meta?.type || ""
      ).toLowerCase();

      if (type && type !== "video") return false;

      const app = String(
        o?.meta?.app || o?.app || o?.module || ""
      ).toLowerCase();

      return !app || app === "photofx";
    });
  }

  async function pollPhotoFxJob(job_id, opts = {}) {
    const POLL_MS = 2000;
    const POLL_MAX = 120;

    for (let i = 0; i < POLL_MAX; i++) {
      await sleep(POLL_MS);

      const r = await fetch(
        `/api/jobs/status?job_id=${encodeURIComponent(job_id)}&t=${Date.now()}`
      );
      const text = await r.text().catch(() => "");
      let j = null;

      try {
        j = text ? JSON.parse(text) : null;
      } catch (_) {
        j = null;
      }

      console.log("[photofx] poll =", j);

      if (!j || !j.ok) continue;

      const ready = isReadyStatus(j.status);
      const outs = pickPhotoFxVideoOutputs(j.outputs);
      const directVideoUrl = String(j?.video?.url || j?.video_url || "").trim();

      if (ready && (outs.length || directVideoUrl)) {
        const finalOutputs = outs.length
          ? outs.map((o) => ({
              ...o,
              meta: { ...(o.meta || {}), app: "photofx" },
            }))
          : [
              {
                type: "video",
                url: directVideoUrl,
                meta: { app: "photofx", variant: "provider", is_final: true },
              },
            ];

        const rawMeta = j?.raw?.meta || j?.meta || {};
        const wantsLogo =
          opts.wantsLogo === true ||
          !!(rawMeta?.logo_enabled && String(rawMeta?.logo_url || "").trim());

        const hasLogoOverlay = finalOutputs.some((o) => {
          const variant = String(o?.meta?.variant || "").toLowerCase().trim();
          return variant === "logo_overlay";
        });


     if (wantsLogo && !hasLogoOverlay) {
          const overlaySource =
            finalOutputs.find((o) => {
              const variant = String(o?.meta?.variant || "").toLowerCase().trim();
              return variant === "mux" || variant === "provider";
            })?.url || directVideoUrl;

          const logoUrl = String(rawMeta?.logo_url || "").trim();

          if (overlaySource && logoUrl) {
            const overlayRes = await fetch("/api/photofx/overlay-logo", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                job_id,
                video_url: overlaySource,
                logo_url: logoUrl,
                logo_pos: String(rawMeta?.logo_pos || "br").trim(),
                logo_size: String(rawMeta?.logo_size || "sm").trim(),
                logo_opacity: Number(rawMeta?.logo_opacity ?? 0.85),
              }),
            });

            const overlayJson = await overlayRes.json().catch(() => null);
            console.log("[photofx] overlay logo =", overlayJson);

            if (overlayRes.ok && overlayJson?.ok) {
              const rr = await fetch(
                `/api/jobs/status?job_id=${encodeURIComponent(job_id)}&t=${Date.now()}`
              );
              const rtext = await rr.text().catch(() => "");
              let refreshed = null;

              try {
                refreshed = rtext ? JSON.parse(rtext) : null;
              } catch (_) {
                refreshed = null;
              }

              console.log("[photofx] refreshed after overlay =", refreshed);

              if (refreshed?.ok) {
                const refreshedOuts = pickPhotoFxVideoOutputs(refreshed.outputs);
                const refreshedDirectVideoUrl = String(
                  refreshed?.video?.url ||
                    refreshed?.video_url ||
                    overlayJson.url ||
                    ""
                ).trim();

                const refreshedFinalOutputs = refreshedOuts.length
                  ? refreshedOuts.map((o) => ({
                      ...o,
                      meta: { ...(o.meta || {}), app: "photofx" },
                    }))
                  : [
                      {
                        type: "video",
                        url: refreshedDirectVideoUrl,
                        meta: {
                          app: "photofx",
                          variant: "logo_overlay",
                          is_final: false,
                        },
                      },
                    ];

                window.dispatchEvent(
                  new CustomEvent("aivo:photofx:job_ready", {
                    detail: {
                      app: "photofx",
                      job_id,
                      status: String(refreshed.status || "ready").toLowerCase(),
                      video: refreshedDirectVideoUrl
                        ? { url: refreshedDirectVideoUrl }
                        : null,
                      outputs: refreshedFinalOutputs,
                      raw: refreshed,
                    },
                  })
                );
                return;
              }
            }
          }
        }

        window.dispatchEvent(
          new CustomEvent("aivo:photofx:job_ready", {
            detail: {
              app: "photofx",
              job_id,
              status: String(j.status || "").toLowerCase(),
              video: directVideoUrl ? { url: directVideoUrl } : null,
              outputs: finalOutputs,
              raw: j,
            },
          })
        );

        return;
      }

      if (String(j.status || "").toLowerCase() === "error") {
        throw new Error(j.error || "photofx_job_error");
      }
    }

    throw new Error("photofx_poll_timeout");
  }

  async function uploadViaPresign(file, kind = "asset") {
    if (!file) {
      throw new Error("photofx_missing_file");
    }

    const res = await fetch("/api/r2/presign-put", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app: "photofx",
        kind,
        filename: file?.name || `photofx-${Date.now()}`,
        contentType: file?.type || "application/octet-stream",
        folder: "photofx",
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data.ok === false) {
      throw new Error(data?.error || "photofx_presign_failed");
    }

    const uploadUrl =
      data.uploadUrl ||
      data.upload_url ||
      data.presignedUrl ||
      data.presigned_url ||
      data.putUrl ||
      data.put_url ||
      "";

    const publicUrl =
      data.publicUrl ||
      data.public_url ||
      data.fileUrl ||
      data.file_url ||
      data.url ||
      "";

    if (!uploadUrl || !publicUrl) {
      throw new Error("photofx_upload_presign_invalid");
    }

    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!put.ok) {
      throw new Error(`photofx_upload_put_failed_${put.status}`);
    }

    return String(publicUrl).trim();
  }

  async function uploadFile(file, kind = "asset") {
    if (!file) return "";
    return await uploadViaPresign(file, kind);
  }

  function collectForm(root) {
    const state = getState(root);
    const selectedPresets = getSelectedPresets(root);

    return {
      prompt: String(qs("#pfxPrompt", root)?.value || "").trim(),
      quality: "fast",
      styles: selectedPresets,
      style: selectedPresets[0] || "",
      duration: qs("#pfxDuration", root)?.value || "6",
      ratio: qs("#pfxAspect", root)?.value || "9:16",
      resolution: qs("#pfxResolution", root)?.value || "1080p",
      fps: qs("#pfxFps", root)?.value || "25",
      motionLevel: qs("#pfxMotionLevel", root)?.value || "balanced",
      effectStrength: qs("#pfxEffectPower", root)?.value || "medium",
         colorMood: qs("#pfxColorMood", root)?.value || "original",
      transitionSpeed: qs("#pfxTransitionSpeed", root)?.value || "normal",
      zoomLevel: qs("#pfxZoomLevel", root)?.value || "normal",
      logoPosition: qs("#pfxLogoPosition", root)?.value || "bottom-right",
      includeAudio:
        String(qs("#pfxIncludeMusic", root)?.value || "no") === "yes",
      imageFile: state.imageFile || null,
      endImageFile: state.endImageFile || null,
      logoFile: state.logoFile || null,
      audioFile: state.audioFile || null,
    };
  }

  async function createPhotoFx(root) {
    const form = collectForm(root);
const builtEffects = {
  preset: String(form.style || "").trim(),
  styles: Array.isArray(form.styles) ? [...form.styles] : [],
  effectConfig: {
    motionLevel: String(form.motionLevel || "balanced").trim(),
    effectStrength: String(form.effectStrength || "medium").trim(),
    colorMood: String(form.colorMood || "original").trim(),
    transitionSpeed: String(form.transitionSpeed || "normal").trim(),
    zoomLevel: String(form.zoomLevel || "normal").trim(),
  },
};
    if (!form.prompt) {
      alert("Lütfen klip açıklamasını yaz.");
      return;
    }

    if (!form.imageFile) {
      alert("Lütfen bir ana görsel seç.");
      return;
    }

    if (!form.styles.length) {
      alert("Lütfen en az 1 efekt stili seç.");
      return;
    }

    if (form.includeAudio && !form.audioFile) {
      alert("Müziği videoya dahil etmek için bir audio dosyası seç.");
      return;
    }

    if (LONG_DURATION_VALUES.has(String(form.duration || ""))) {
      form.fps = "25";
    }

    const imageUrl = await uploadFile(form.imageFile, "image");
    const endImageUrl = form.endImageFile
      ? await uploadFile(form.endImageFile, "end-image")
      : "";
    const logoUrl = form.logoFile ? await uploadFile(form.logoFile, "logo") : "";
    const audioUrl =
      form.includeAudio && form.audioFile
        ? statefulAudioUrlOrUploaded(root, form.audioFile)
        : "";

    const providerVariant = "fast";
    const providerModel = "fal-ai/ltx-2.3/image-to-video/fast";

    const providerPayload = {
      prompt: form.prompt,
      quality: "fast",
      preset: form.style,
      styles: form.styles,
      effects: builtEffects,
      image_url: imageUrl,
      end_image_url: endImageUrl || undefined,
      audio_url: audioUrl || undefined,
      aspect_ratio: form.ratio,
      duration: Number(form.duration || 6),
      resolution: form.resolution,
      fps: Number(form.fps || 25),
      motion_level: form.motionLevel,
      effect_strength: form.effectStrength,
      color_mood: form.colorMood,
      transition_speed: form.transitionSpeed,
      zoom_level: form.zoomLevel,
            logo_pos:
        form.logoPosition === "top-left"
          ? "tl"
          : form.logoPosition === "top-right"
            ? "tr"
            : form.logoPosition === "bottom-left"
              ? "bl"
              : form.logoPosition === "bottom-right"
                ? "br"
                : "br",
      include_audio: form.includeAudio,
      meta: {
        app: "photofx",
        provider_variant: providerVariant,
        provider_model: providerModel,
        styles: form.styles,
        effects: builtEffects,
        include_audio: form.includeAudio,
        duration: Number(form.duration || 6),
        resolution: form.resolution,
        fps: Number(form.fps || 25),
        aspect_ratio: form.ratio,
        end_image_url: endImageUrl || "",
              logo_enabled: !!logoUrl,
        logo_name: form.logoFile?.name || "",
        logo_url: logoUrl || "",
        audio_url: audioUrl || "",
        music_url: audioUrl || "",
        logo_pos:
          form.logoPosition === "top-left"
            ? "tl"
            : form.logoPosition === "top-right"
              ? "tr"
              : form.logoPosition === "bottom-left"
                ? "bl"
                : form.logoPosition === "bottom-right"
                  ? "br"
                  : "br",
      },
    };

    const provider = await postJSON(
      "/api/providers/fal/photofx/create",
      providerPayload
    );

    const finalJobId = String(provider?.job_id || "").trim();
    const statusUrl = String(provider?.status_url || "").trim();
    const requestId = String(provider?.request_id || "").trim();

    if (!finalJobId) {
      console.error("[photofx] provider response missing job id", provider);
      throw new Error("photofx_generate_no_job_id");
    }

    window.dispatchEvent(
      new CustomEvent("aivo:photofx:job_created", {
        detail: {
          app: "photofx",
          job_id: finalJobId,
          createdAt: Date.now(),
          meta: {
            app: "photofx",
            prompt: form.prompt,
            styles: form.styles,
            style: form.style,
            quality: "fast",
            ratio: form.ratio,
            duration: form.duration,
            resolution: form.resolution,
            fps: form.fps,
            motionLevel: form.motionLevel,
            effectStrength: form.effectStrength,
            colorMood: form.colorMood,
            transitionSpeed: form.transitionSpeed,
            includeAudio: form.includeAudio,
            imageUrl,
            endImageUrl,
            logoUrl,
            audioUrl,
            provider: "fal",
            provider_variant: providerVariant,
            provider_model: providerModel,
            request_id: requestId,
            status_url: statusUrl,
            logo_enabled: !!logoUrl,
            logo_name: form.logoFile?.name || "",
          },
        },
      })
    );

    console.log("[photofx] create queued ✅", {
      finalJobId,
      requestId,
      statusUrl,
      styles: form.styles,
      duration: form.duration,
      resolution: form.resolution,
      fps: form.fps,
      ratio: form.ratio,
      endImageUrl,
      logoUrl,
    });

    pollPhotoFxJob(finalJobId, {
      wantsLogo: !!logoUrl,
    }).catch((err) => {
      console.error("[photofx] poll error:", err);
    });
  }

  function statefulAudioUrlOrUploaded(root, audioFile) {
    const state = getState(root);
    const readyUrl = String(state?.audioFileUrl || "").trim();
    if (readyUrl) return readyUrl;
    return uploadFile(audioFile, "audio");
  }

  function initStateFromDOM(root) {
    const state = getState(root);
    if (!state) return;

    const activePresets = qsa(".pfxPresetCard.is-active[data-preset]", root)
      .map((btn) => String(btn.getAttribute("data-preset") || "").trim())
      .filter(Boolean);

    state.presets = Array.from(new Set(activePresets));
  }

  function boot() {
    const root = getRoot();
    if (!root) return;

    initStateFromDOM(root);

    ensureHiddenInput(root, "pfxImageInput", "image/*");
    ensureHiddenInput(root, "pfxEndImageInput", "image/*");
    ensureHiddenInput(root, "pfxLogoInput", "image/*");
    ensureHiddenInput(root, "pfxAudioInput", "audio/*");

    ensureUploadMetaNode(root, "pfxInlineUploadBtn", "pfxImageMeta");
    ensureUploadMetaNode(root, "pfxEndImageUploadBtn", "pfxEndImageMeta");
    ensureUploadMetaNode(root, "pfxLogoUploadBtn", "pfxLogoMeta");
    ensureUploadMetaNode(root, "pfxAudioUploadBtn", "pfxAudioMeta");

    setPromptCounter(root);
    syncCreateButton(root);
    renderPresets(root);
    renderUploads(root);
    syncIncludeMusic(root);
    syncDurationRules(root);
    bindEvents(root);
  }

  document.addEventListener(
    "input",
    (e) => {
      const root = getRoot();
      if (!root || !root.contains(e.target)) return;

          if (e.target.matches("#pfxPrompt")) {
        resetPhotoFxPolicyUI(root);
        setPromptCounter(root);
      }
    },
    true
  );
  document.addEventListener(
    "change",
    (e) => {
      const root = getRoot();
      if (!root || !root.contains(e.target)) return;

      const state = getState(root);

          if (
        e.target.matches("#pfxIncludeMusic") ||
        e.target.matches("#pfxDuration") ||
        e.target.matches("#pfxMotionLevel") ||
        e.target.matches("#pfxEffectPower") ||
        e.target.matches("#pfxColorMood") ||
        e.target.matches("#pfxTransitionSpeed") ||
        e.target.matches("#pfxZoomLevel") ||
        e.target.matches("#pfxImageInput") ||
        e.target.matches("#pfxEndImageInput") ||
        e.target.matches("#pfxLogoInput") ||
        e.target.matches("#pfxAudioInput")
      ) {
        resetPhotoFxPolicyUI(root);
      }

      if (e.target.matches("#pfxIncludeMusic")) {
        syncIncludeMusic(root);
        syncCreateButton(root);
        return;
      }

      if (e.target.matches("#pfxDuration")) {
        syncDurationRules(root);
        syncCreateButton(root);
        return;
      }

      if (e.target.matches("#pfxImageInput")) {
        const file = e.target.files?.[0] || null;
        state.imageFile = file;
        renderUploads(root);
        syncCreateButton(root);
        console.log("[photofx] image selected =", file?.name || null);
        return;
      }

      if (e.target.matches("#pfxEndImageInput")) {
        const file = e.target.files?.[0] || null;
        state.endImageFile = file;
        renderUploads(root);
        syncCreateButton(root);
        console.log("[photofx] end image selected =", file?.name || null);
        return;
      }

      if (e.target.matches("#pfxLogoInput")) {
        const file = e.target.files?.[0] || null;
        state.logoFile = file;
        renderUploads(root);
        syncCreateButton(root);
        console.log("[photofx] logo selected =", file?.name || null);
        return;
      }

      if (e.target.matches("#pfxAudioInput")) {
        const file = e.target.files?.[0] || null;
        state.audioFile = file;
        renderUploads(root);
        syncCreateButton(root);
        console.log("[photofx] audio selected =", file?.name || null);
        return;
      }
    },
    true
  );
  function bindEvents(root) {
    if (!root || root.__photofxEventsBound) return;
    root.__photofxEventsBound = true;

    const state = getState(root);

    const includeMusic = qs("#pfxIncludeMusic", root);
    const durationEl = qs("#pfxDuration", root);
    const imageInput = qs("#pfxImageInput", root);
    const endImageInput = qs("#pfxEndImageInput", root);
    const logoInput = qs("#pfxLogoInput", root);
    const audioInput = qs("#pfxAudioInput", root);

    const imageBtn = qs("#pfxInlineUploadBtn", root);
    const endImageBtn = qs("#pfxEndImageUploadBtn", root);
    const logoBtn = qs("#pfxLogoUploadBtn", root);
    const audioBtn = qs("#pfxAudioUploadBtn", root);

    const createBtn = qs(".pfxCreateBtn", root);

    if (includeMusic && !includeMusic.__bound) {
      includeMusic.__bound = true;
      includeMusic.addEventListener("change", () => {
        syncIncludeMusic(root);
      });
    }

    if (durationEl && !durationEl.__bound) {
      durationEl.__bound = true;
      durationEl.addEventListener("change", () => {
        syncDurationRules(root);
      });
    }

    if (imageBtn && imageInput && !imageBtn.__bound) {
      imageBtn.__bound = true;
      imageBtn.addEventListener("click", (e) => {
        e.preventDefault();
        imageInput.click();
      });
    }

    if (endImageBtn && endImageInput && !endImageBtn.__bound) {
      endImageBtn.__bound = true;
      endImageBtn.addEventListener("click", (e) => {
        e.preventDefault();
        endImageInput.click();
      });
    }

    if (logoBtn && logoInput && !logoBtn.__bound) {
      logoBtn.__bound = true;
      logoBtn.addEventListener("click", (e) => {
        e.preventDefault();
        logoInput.click();
      });
    }

    if (audioBtn && audioInput && !audioBtn.__bound) {
      audioBtn.__bound = true;
      audioBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (audioBtn.disabled) return;
        audioInput.click();
      });
    }

    if (imageInput && !imageInput.__bound) {
      imageInput.__bound = true;
      imageInput.addEventListener("change", () => {
        const file = imageInput.files?.[0] || null;
        state.imageFile = file;
        renderUploads(root);
        console.log("[photofx] image selected =", file?.name || null);
      });
    }

    if (endImageInput && !endImageInput.__bound) {
      endImageInput.__bound = true;
      endImageInput.addEventListener("change", () => {
        const file = endImageInput.files?.[0] || null;
        state.endImageFile = file;
        renderUploads(root);
        console.log("[photofx] end image selected =", file?.name || null);
      });
    }

    if (logoInput && !logoInput.__bound) {
      logoInput.__bound = true;
      logoInput.addEventListener("change", () => {
        const file = logoInput.files?.[0] || null;
        state.logoFile = file;
        renderUploads(root);
        console.log("[photofx] logo selected =", file?.name || null);
      });
    }

    if (audioInput && !audioInput.__bound) {
      audioInput.__bound = true;
      audioInput.addEventListener("change", async () => {
        const file = audioInput.files?.[0] || null;
        const audioMeta = ensureUploadMetaNode(
          root,
          "pfxAudioUploadBtn",
          "pfxAudioMeta"
        );

        state.audioFile = null;
        state.audioFileName = file ? file.name : "";
        state.audioFileUrl = "";
        state.audioFileUploadPromise = null;
        state.audioFileUploadStatus = file ? "uploading" : "idle";
        state.audioFileUploadError = "";

        if (!file) {
          renderUploads(root);
          console.log("[photofx] audio selected =", null);
          return;
        }

        if (audioMeta) {
          audioMeta.innerHTML = "";
          const chip = document.createElement("div");
          chip.className = "pfxUploadChip";

          const name = document.createElement("div");
          name.className = "pfxUploadChipName";
          name.title = file.name || "";
          name.textContent = `${truncateName(
            file.name || "",
            22
          )} · Yükleniyor...`;

          chip.appendChild(name);
          audioMeta.appendChild(chip);
        }

        console.log("[photofx] audio uploading =", file?.name || null);

        state.audioFileUploadPromise = uploadFile(file, "audio")
          .then((publicUrl) => {
            state.audioFile = file;
            state.audioFileUrl = String(publicUrl || "").trim();
            state.audioFileUploadStatus = "ready";
            state.audioFileUploadError = "";
            renderUploads(root);
            console.log("[photofx] audio ready =", state.audioFileUrl);
            return state.audioFileUrl;
          })
          .catch((err) => {
            state.audioFile = null;
            state.audioFileUrl = "";
            state.audioFileUploadStatus = "error";
            state.audioFileUploadError = String(
              err?.message || err || "photofx_audio_upload_failed"
            );

            if (audioMeta) {
              audioMeta.innerHTML = "";
              const chip = document.createElement("div");
              chip.className = "pfxUploadChip";

              const name = document.createElement("div");
              name.className = "pfxUploadChipName";
              name.title = file.name || "";
              name.textContent = `${truncateName(
                file.name || "",
                20
              )} · Yükleme hatası`;

              chip.appendChild(name);
              audioMeta.appendChild(chip);
            }

            console.error("[photofx] audio upload error =", err);
            alert(state.audioFileUploadError);
            throw err;
          });
      });
    }

if (!window.__AIVO_PHOTOFX_DOC_CLICK_BOUND__) {
  window.__AIVO_PHOTOFX_DOC_CLICK_BOUND__ = true;

  document.addEventListener(
    "click",
    (e) => {
      const nextRoot = getRoot();
      if (!nextRoot) return;

      const clearBtn = e.target.closest("[data-clear-upload]");
      if (clearBtn && nextRoot.contains(clearBtn)) {
        e.preventDefault();
        e.stopPropagation();

        const clearKey = String(
          clearBtn.getAttribute("data-clear-upload") || ""
        ).trim();

        if (clearKey) {
          clearFileSelection(nextRoot, clearKey);
        }
        return;
      }

        const presetCard = e.target.closest(".pfxPresetCard[data-preset]");
      if (presetCard && nextRoot.contains(presetCard)) {
        e.preventDefault();

        const nextState = getState(nextRoot);
        const preset = String(
          presetCard.getAttribute("data-preset") || ""
        ).trim();

        if (!preset) return;

        if (nextState.presets.includes(preset)) {
          nextState.presets = nextState.presets.filter((x) => x !== preset);
        } else {
          nextState.presets = [...nextState.presets, preset];
        }

        resetPhotoFxPolicyUI(nextRoot);
        renderPresets(nextRoot);
        syncCreateButton(nextRoot);
      }
    },
    true
  );
}

    if (createBtn && !createBtn.__bound) {
      createBtn.__bound = true;
      createBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        const policyText = buildPhotoFxPolicyText(root);
        const policyNote = ensurePhotoFxPolicyNote(root, createBtn);
        const promptEl = qs("#pfxPrompt", root);

        if (isPhotoFxPolicyBlocked(policyText)) {
          if (promptEl) {
            promptEl.style.borderColor = "rgba(255,110,140,.92)";
            promptEl.style.boxShadow =
              "0 0 0 1px rgba(255,110,140,.28), 0 10px 28px rgba(255,70,110,.10)";
            promptEl.focus();
          }

          createBtn.style.background =
            "linear-gradient(135deg, rgba(255,93,143,.92), rgba(255,62,62,.92))";
          createBtn.style.borderColor = "rgba(255,110,140,.95)";
          createBtn.style.boxShadow =
            "0 10px 30px rgba(255,80,120,.22), inset 0 1px 0 rgba(255,255,255,.18)";
          createBtn.style.cursor = "not-allowed";
          createBtn.style.filter = "saturate(1.05)";

          if (policyNote) {
            policyNote.textContent =
              "Bu istek bu haliyle üretilemez. Sanatçı adı, kişi adı veya taklit çağrışımı yerine efekti, geçişi ve görsel atmosferi tarif et.";
            policyNote.style.display = "block";
          }

          return;
        }

        const credit = createBtn.getAttribute("data-credit-cost") || "8";
        const creditCost = Number(credit) || getPhotoFxEstimatedCredits(root);
        const creditReason = "studio_photofx_generate";

        const creditRes = await fetch("/api/credits/consume", {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "accept": "application/json"
          },
          body: JSON.stringify({
            cost: creditCost,
            reason: creditReason
          })
        });

        let creditData = null;
        try {
          creditData = await creditRes.json();
        } catch {
          creditData = {
            ok: false,
            error: "non_json_response",
            status: creditRes.status
          };
        }

        if (!creditRes.ok || !creditData?.ok) {
          const msg =
            creditData?.error ||
            creditData?.message ||
            "Kredi düşülemedi. Lütfen bakiyeni kontrol et.";

          alert(String(msg));
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

            if (
              window.AIVO_STORE_V1 &&
              typeof window.AIVO_STORE_V1.setCredits === "function"
            ) {
              window.AIVO_STORE_V1.setCredits(creditGetData.credits);
            }
          }
        } catch {}

        createBtn.disabled = true;
        createBtn.classList.add("is-loading");
        createBtn.textContent = "Üretiliyor...";

        createPhotoFx(root)
          .catch((err) => {
            console.error("[photofx] create error:", err);
            alert(String(err?.message || err || "photofx_create_failed"));
          })
          .finally(() => {
            createBtn.disabled = false;
            createBtn.classList.remove("is-loading");
            createBtn.textContent = `🎬 Klip Oluştur (${credit} Kredi)`;
          });
      });
    }
  }

   function retryBoot(attempt = 0) {
    const root = getRoot();
    const presetCards = root ? qsa(".pfxPresetCard[data-preset]", root) : [];
    const createBtn = root ? qs(".pfxCreateBtn", root) : null;

    const domReady = !!root && presetCards.length > 0 && !!createBtn;

    if (domReady) {
      if (!root.__photofxBooted) {
        root.__photofxBooted = true;
        boot();
        console.log("[PHOTOFX] module READY ✅");
      }
      return true;
    }

    if (attempt >= 40) {
     console.log("[PHOTOFX] root/children not ready after retry limit", {
        hasRoot: !!root,
        presetCards: presetCards.length,
        hasCreateBtn: !!createBtn,
      });
      return false;
    }

    setTimeout(() => retryBoot(attempt + 1), 250);
    return false;
  }

  function scheduleRetryBoot() {
    setTimeout(() => retryBoot(), 0);
    setTimeout(() => retryBoot(), 150);
    setTimeout(() => retryBoot(), 400);
    setTimeout(() => retryBoot(), 900);
  }

  window.__AIVO_PHOTOFX_RETRY_BOOT__ = scheduleRetryBoot;

  if (!window.__AIVO_PHOTOFX_DOM_OBSERVER__) {
    window.__AIVO_PHOTOFX_DOM_OBSERVER__ = new MutationObserver(() => {
      const root = getRoot();
      if (!root) return;
      if (root.__photofxBooted) return;
      scheduleRetryBoot();
    });

    window.__AIVO_PHOTOFX_DOM_OBSERVER__.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  window.__AIVO_PHOTOFX_INIT__ = function () {
    scheduleRetryBoot();
  };
})();
