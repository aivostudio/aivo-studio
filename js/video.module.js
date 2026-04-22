console.log("[video.module] loaded ✅", new Date().toISOString());

(function () {
  // ===============================
  // Global guard (tek kez)
  // ===============================
  if (window.__AIVO_VIDEO_MODULE_V2__) return;
  window.__AIVO_VIDEO_MODULE_V2__ = true;

  const ROOT_SEL = 'section[data-module="video"]';
  const POLL_MS = 2000;
  const POLL_MAX = 120; // 4 dk


  function getVideoAssistantState() {
    if (!window.__AIVO_VIDEO_ASSISTANT_STATE__) {
      window.__AIVO_VIDEO_ASSISTANT_STATE__ = {
        currentPanel: "video",
        currentFlow: "video_text_generate",
        policyState: "allow",
        generationState: "idle",
        creditsConsumed: false,
        refundExpected: false,
        refundDone: false,
        creditCost: 0,
        lastJobId: "",
        lastRequestId: "",
        lastVideoUrl: "",
        visibleError: "",
        visiblePolicyNote: "",
        dbSaved: false,
        video: {
          mode: "text",
          promptPresent: false,
          promptText: "",
          imagePromptPresent: false,
          imagePromptText: "",
          ratio: "16:9",
          duration: "5",
          resolution: "720",
          audioEnabled: false,
          imageUploadState: "empty"
        },
        updatedAt: Date.now()
      };
    }

    return window.__AIVO_VIDEO_ASSISTANT_STATE__;
  }

  function patchVideoAssistantState(patch) {
    const prev = getVideoAssistantState();

    const next = {
      ...prev,
      ...patch,
      currentPanel: "video",
      updatedAt: Date.now(),
      video: {
        ...(prev.video || {}),
        ...((patch && patch.video) || {})
      }
    };

    window.__AIVO_VIDEO_ASSISTANT_STATE__ = next;

    try {
      window.dispatchEvent(
        new CustomEvent("aivo:assistant:video_context", {
          detail: { ...next }
        })
      );
    } catch (_) {}

    return next;
  }

  function readVideoPolicyNote(root) {
    return String(qs("#videoPolicyNote", root)?.textContent || "").trim();
  }

  function syncVideoAssistantState(root, extra = {}) {
    const r = root || getRoot();
    const mode = getVideoMode(r);
    const textPrompt = String(qs("#videoPrompt", r)?.value || "").trim();
    const imagePrompt = String(qs("#videoImagePrompt", r)?.value || "").trim();
    const imageInput = qs("#videoImageInput", r);
    const imageUploadState = String(imageInput?.dataset?.uploadStatus || "empty").trim();
    const creditCost =
      typeof extra.creditCost === "number"
        ? Number(extra.creditCost)
        : getVideoCredit(r);

    return patchVideoAssistantState({
      currentFlow: mode === "image" ? "video_image_generate" : "video_text_generate",
      policyState: String(extra.policyState || "allow"),
      generationState: String(extra.generationState || "idle"),
      creditsConsumed: typeof extra.creditsConsumed === "boolean" ? extra.creditsConsumed : false,
      refundExpected: typeof extra.refundExpected === "boolean" ? extra.refundExpected : false,
      refundDone: typeof extra.refundDone === "boolean" ? extra.refundDone : false,
      creditCost,
      lastJobId: String(extra.lastJobId || ""),
      lastRequestId: String(extra.lastRequestId || ""),
      lastVideoUrl: String(extra.lastVideoUrl || ""),
      visibleError: String(extra.visibleError || ""),
      visiblePolicyNote: String(extra.visiblePolicyNote || readVideoPolicyNote(r)),
      dbSaved: typeof extra.dbSaved === "boolean" ? extra.dbSaved : false,
      video: {
        mode,
        promptPresent: !!textPrompt,
        promptText: textPrompt,
        imagePromptPresent: !!imagePrompt,
        imagePromptText: imagePrompt,
        ratio: String(qs("#videoRatio", r)?.value || "16:9"),
        duration: String(qs("#videoDuration", r)?.value || "5"),
        resolution: String(qs("#videoResolution", r)?.value || "720"),
        audioEnabled: !!qs("#audioEnabled", r)?.checked,
        imageUploadState,
        ...((extra && extra.video) || {})
      }
    });
  }

  window.getVideoAssistantState = getVideoAssistantState;
  window.patchVideoAssistantState = patchVideoAssistantState;
  window.syncVideoAssistantState = syncVideoAssistantState;


  // ===============================
  // Policy helpers (Video)
  // ===============================
  const VIDEO_HARD_BLOCK_TERMS = [
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

  const VIDEO_HARD_BLOCK_PATTERNS = [
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

  const VIDEO_PUBLIC_FIGURE_TERMS = [
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

  const VIDEO_ARTIST_NAME_TERMS = [
    "tarkan",
    "sezen aksu",
    "ajda pekkan",
    "sertab erener",
    "mustafa sandal",
    "kenan dogulu",
    "kenan doğulu",
    "hande yener",
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

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function normalizeVideoPolicyText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildVideoPolicyPhraseRegex(term) {
    const normalized = normalizeVideoPolicyText(term);
    if (!normalized) return null;

    const pattern = normalized
      .split(" ")
      .filter(Boolean)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s+");

    return new RegExp(`(^|\\s)${pattern}(?=\\s|$)`, "i");
  }

  function isVideoPolicyBlocked(raw) {
    const text = normalizeVideoPolicyText(raw);

    const hasBlockedTerm =
      VIDEO_HARD_BLOCK_TERMS.some((term) => {
        const rx = buildVideoPolicyPhraseRegex(term);
        return rx ? rx.test(text) : false;
      }) ||
      VIDEO_PUBLIC_FIGURE_TERMS.some((term) => {
        const rx = buildVideoPolicyPhraseRegex(term);
        return rx ? rx.test(text) : false;
      }) ||
      VIDEO_ARTIST_NAME_TERMS.some((term) => {
        const rx = buildVideoPolicyPhraseRegex(term);
        return rx ? rx.test(text) : false;
      });

    const hasBlockedPattern = VIDEO_HARD_BLOCK_PATTERNS.some((rx) => rx.test(raw));
    return !!raw && (hasBlockedTerm || hasBlockedPattern);
  }

  function getVideoCreateButton(root) {
    return (
      qs("#videoGenerateTextBtn", root) ||
      qs("#videoGenerateImageBtn", root) ||
      null
    );
  }

  function ensureVideoPolicyNote(root, btn) {
    if (!root || !btn) return null;

    const mountPoint = btn.parentElement || root;
    let note = qs("#videoPolicyNote", root);

    if (!note) {
      note = document.createElement("div");
      note.id = "videoPolicyNote";
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
    }

    if (note.parentElement !== mountPoint) {
      mountPoint.appendChild(note);
    }

    return note;
  }

  function resetVideoPolicyUI(root) {
    if (!root) return;

    const promptEls = [
      qs("#videoPrompt", root),
      qs("#videoImagePrompt", root)
    ].filter(Boolean);

    const buttons = [
      qs("#videoGenerateTextBtn", root),
      qs("#videoGenerateImageBtn", root)
    ].filter(Boolean);

    const note = qs("#videoPolicyNote", root);

    promptEls.forEach((el) => {
      el.style.borderColor = "";
      el.style.boxShadow = "";
    });

    buttons.forEach((btn) => {
      btn.style.background = "";
      btn.style.borderColor = "";
      btn.style.boxShadow = "";
      btn.style.cursor = "";
      btn.style.filter = "";
    });

    if (note) {
      note.style.display = "none";
      note.textContent = "";
    }
  }

  function emitVideoJobCreated(meta) {
    try {
      window.dispatchEvent(new CustomEvent("aivo:video:job_created", { detail: meta }));
    } catch (e) {
      console.warn("[video] emit failed", e);
    }
  }

  // ===============================
  // Duration + credit helpers (Video UI: 5 / 8 / 10)
  // ===============================
  function clampDuration(n) {
    const allowed = [5, 8, 10];
    const num = Number(n);

    if (!Number.isFinite(num)) return 5;
    if (allowed.includes(num)) return num;

    return allowed.reduce((prev, curr) =>
      Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev
    );
  }

  function getVideoMode(root) {
    const activeTab =
      root?.querySelector('[data-video-tab].is-active')?.dataset?.videoTab ||
      root?.dataset?.videoMode ||
      "text";

    return activeTab === "image" ? "image" : "text";
  }

  function getVideoBaseCredit(duration) {
    const d = clampDuration(duration);
    if (d === 8) return 25;
    if (d === 10) return 30;
    return 20;
  }

  function getVideoCredit(root) {
    const duration = clampDuration(Number(qs("#videoDuration", root)?.value || 5));
    const audioEnabled = !!qs("#audioEnabled", root)?.checked;

    let total = getVideoBaseCredit(duration);

    if (audioEnabled) {
      total += 5;
    }

    return total;
  }

  function syncVideoCreditUI(root) {
    if (!root) return;

    const credit = getVideoCredit(root);

    const textBtn = qs("#videoGenerateTextBtn", root);
    const imageBtn = qs("#videoGenerateImageBtn", root);

    const textBadge =
      qs('[data-video-subview="text"] .badge-beta', root) ||
      qs("#videoGenerateTextBtn", root)?.closest(".card")?.querySelector(".badge-beta") ||
      null;

    const imageBadge =
      qs('[data-video-subview="image"] .badge-beta', root) ||
      qs("#videoGenerateImageBtn", root)?.closest(".card")?.querySelector(".badge-beta") ||
      null;

    if (textBtn) {
      textBtn.dataset.creditCost = String(credit);
      textBtn.textContent = `🎬 Video Oluştur (${credit} Kredi)`;
    }

    if (imageBtn) {
      imageBtn.dataset.creditCost = String(credit);
      imageBtn.textContent = `🎬 Video Oluştur (${credit} Kredi)`;
    }

    if (textBadge) {
      textBadge.textContent = `${credit} Kredi`;
    }

    if (imageBadge) {
      imageBadge.textContent = `${credit} Kredi`;
    }
  }

  // ===============================
  // Robust JSON POST (500'lerde text dönebilir)
  // ===============================
  async function postJSON(url, payload) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await r.text().catch(() => "");
    let j = null;
    try {
      j = text ? JSON.parse(text) : null;
    } catch (_) {
      j = null;
    }

    if (!r.ok) {
      const err =
        (j && (j.error || j.message)) ||
        (text ? text.slice(0, 180) : "") ||
        `request_failed_${r.status}`;
      throw err;
    }

    if (!j) throw "bad_json_response";
    return j;
  }

  // ===============================
  // Poll job -> PPE.apply (video only)
  // ===============================
  function isReadyStatus(s) {
    const v = String(s || "").toLowerCase();
    return v === "ready" || v === "done" || v === "completed" || v === "success";
  }

  function pickVideoOutputs(outputs) {
    if (!Array.isArray(outputs)) return [];
    return outputs.filter((o) => {
      if (!o) return false;
      if (o.type && o.type !== "video") return false;
      const app = o.meta?.app || o.app || o.module;
      return !app || app === "video";
    });
  }

  async function refreshVideoCreditsUI() {
    try {
      const creditGetRes = await fetch("/api/credits/get", {
        credentials: "include",
        cache: "no-store",
        headers: { "accept": "application/json" }
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
    } catch (_) {}

    try { window.syncCreditsUI?.({ force: true }); } catch {}
  }

  async function consumeVideoCredits({ creditCost, creditReason }) {
    const consumeRequestId = `video:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

    const creditRes = await fetch("/api/credits/consume-ledger", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "accept": "application/json"
      },
      body: JSON.stringify({
        app: "video",
        action: creditReason,
        cost: creditCost,
        request_id: consumeRequestId,
        reason: creditReason
      })
    });

    let creditData = null;
    try {
      creditData = await creditRes.json();
    } catch {
      creditData = { ok: false, error: "non_json_response", status: creditRes.status };
    }

    if (!creditRes.ok || !creditData?.ok) {
      syncVideoAssistantState(getRoot(), {
        generationState: "failed",
        creditsConsumed: false,
        refundExpected: false,
        refundDone: false,
        creditCost,
        lastJobId: "",
        lastRequestId: consumeRequestId,
        lastVideoUrl: "",
        visibleError: "insufficient_credit"
      });

      const to = encodeURIComponent(
        location.pathname + location.search + location.hash
      );

      location.href =
        "/fiyatlandirma.html?from=studio&reason=insufficient_credit&to=" + to;

      return null;
    }

    const transactionId =
      creditData?.transaction_id ||
      creditData?.transaction?.id ||
      null;

    await refreshVideoCreditsUI();

    return {
      consumeRequestId,
      transactionId
    };
  }

  async function refundVideoCredits({
    creditCost,
    creditReason,
    consumeRequestId,
    transactionId,
    reason,
    meta = {}
  }) {
    if (!consumeRequestId || !transactionId || creditCost <= 0) return false;

    try {
      const refundRes = await fetch("/api/credits/refund", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "accept": "application/json"
        },
        body: JSON.stringify({
          app: "video",
          action: creditReason,
          amount: creditCost,
          request_id: consumeRequestId,
          related_transaction_id: transactionId,
          reason,
          meta
        })
      });

      const refundData = await refundRes.json().catch(() => null);

      if (refundRes.ok && refundData?.ok && (refundData?.refunded || refundData?.deduped || refundData?.skipped)) {
        await refreshVideoCreditsUI();
        syncVideoAssistantState(getRoot(), {
          generationState: "failed",
          creditsConsumed: true,
          refundExpected: true,
          refundDone: true,
          creditCost,
          lastJobId: String(meta?.job_id || ""),
          lastRequestId: consumeRequestId,
          lastVideoUrl: "",
          visibleError: String(meta?.error || reason || "video_refund_done")
        });
        try { window.toast?.error?.("İşlem başarısız oldu, kredi iade edildi."); } catch {}
        return true;
      }
    } catch (refundErr) {
      console.error("[video] refund failed =", refundErr);
    }

    return false;
  }

  async function pollJob(job_id, refundCtx = null) {
    for (let i = 0; i < POLL_MAX; i++) {
      await sleep(POLL_MS);

      const r = await fetch(`/api/jobs/status?job_id=${encodeURIComponent(job_id)}`);
      const text = await r.text().catch(() => "");
      let j = null;
      try { j = text ? JSON.parse(text) : null; } catch (_) { j = null; }

      if (!j || !j.ok) continue;

      const ready = isReadyStatus(j.status);
      const outs = pickVideoOutputs(j.outputs);

      if (ready && outs.length) {
        const normalizedOutputs = outs.map((o) => ({
          ...o,
          meta: { ...(o.meta || {}), app: "video" },
        }));

        window.PPE?.apply?.({
          state: "COMPLETED",
          outputs: normalizedOutputs,
        });

        window.dispatchEvent(
          new CustomEvent("aivo:video:job_ready", {
            detail: {
              app: "video",
              job_id,
              status: String(j.status || "ready").toLowerCase(),
              mode: refundCtx?.mode || "",
              video: {
                url:
                  normalizedOutputs[0]?.url ||
                  normalizedOutputs[0]?.video_url ||
                  normalizedOutputs[0]?.archive_url ||
                  ""
              },
              outputs: normalizedOutputs,
              raw: j
            }
          })
        );

        syncVideoAssistantState(getRoot(), {
          generationState: "ready",
          creditsConsumed: true,
          refundExpected: false,
          refundDone: false,
          creditCost: Number(refundCtx?.creditCost || getVideoCredit(getRoot()) || 0),
          lastJobId: String(job_id || ""),
          lastRequestId: String(refundCtx?.consumeRequestId || ""),
          lastVideoUrl: String(
            normalizedOutputs[0]?.url ||
            normalizedOutputs[0]?.video_url ||
            normalizedOutputs[0]?.archive_url ||
            ""
          ).trim(),
          visibleError: "",
          dbSaved: true
        });

        try { window.toast?.success?.("Video hazır"); } catch {}
        return;
      }

      if (String(j.status || "").toLowerCase() === "error") {
        let refunded = false;
        if (refundCtx) {
          refunded = await refundVideoCredits({
            creditCost: refundCtx.creditCost,
            creditReason: refundCtx.creditReason,
            consumeRequestId: refundCtx.consumeRequestId,
            transactionId: refundCtx.transactionId,
            reason: "video_job_failed",
            meta: {
              source: "video.poll",
              mode: refundCtx.mode,
              duration: refundCtx.duration,
              aspect_ratio: refundCtx.ratio,
              prompt: refundCtx.prompt || "",
              image_url: refundCtx.image_url || "",
              job_id,
              error: String(j.error || "video_job_error")
            }
          });
        }

        syncVideoAssistantState(getRoot(), {
          generationState: "failed",
          creditsConsumed: true,
          refundExpected: true,
          refundDone: refunded,
          creditCost: Number(refundCtx?.creditCost || getVideoCredit(getRoot()) || 0),
          lastJobId: String(job_id || ""),
          lastRequestId: String(refundCtx?.consumeRequestId || ""),
          lastVideoUrl: "",
          visibleError: String(j.error || "video_job_error")
        });

        window.dispatchEvent(
          new CustomEvent("aivo:video:job_failed", {
            detail: {
              app: "video",
              job_id,
              status: "error",
              remove_placeholder: true,
              raw: j
            }
          })
        );

        window.dispatchEvent(
          new CustomEvent("aivo:video:job_remove", {
            detail: {
              app: "video",
              job_id,
              remove_placeholder: true,
              raw: j
            }
          })
        );

        throw j.error || "video_job_error";
      }
    }

    let timeoutRefunded = false;
    if (refundCtx) {
      timeoutRefunded = await refundVideoCredits({
        creditCost: refundCtx.creditCost,
        creditReason: refundCtx.creditReason,
        consumeRequestId: refundCtx.consumeRequestId,
        transactionId: refundCtx.transactionId,
        reason: "video_poll_timeout",
        meta: {
          source: "video.poll",
          mode: refundCtx.mode,
          duration: refundCtx.duration,
          aspect_ratio: refundCtx.ratio,
          prompt: refundCtx.prompt || "",
          image_url: refundCtx.image_url || "",
          job_id,
          error: "video_poll_timeout"
        }
      });
    }

    syncVideoAssistantState(getRoot(), {
      generationState: "failed",
      creditsConsumed: true,
      refundExpected: true,
      refundDone: timeoutRefunded,
      creditCost: Number(refundCtx?.creditCost || getVideoCredit(getRoot()) || 0),
      lastJobId: String(job_id || ""),
      lastRequestId: String(refundCtx?.consumeRequestId || ""),
      lastVideoUrl: "",
      visibleError: "video_poll_timeout"
    });

    window.dispatchEvent(
      new CustomEvent("aivo:video:job_failed", {
        detail: {
          app: "video",
          job_id,
          status: "timeout",
          remove_placeholder: true,
          raw: { ok: false, error: "video_poll_timeout" }
        }
      })
    );

    window.dispatchEvent(
      new CustomEvent("aivo:video:job_remove", {
        detail: {
          app: "video",
          job_id,
          remove_placeholder: true,
          raw: { ok: false, error: "video_poll_timeout" }
        }
      })
    );

    throw "video_poll_timeout";
  }

  // ===============================
  // Collect UI values safely (root-aware)
  // ===============================
  function getRoot() {
    return document.querySelector(ROOT_SEL) || document;
  }

  function buildCommonPayload(root) {
    const durationRaw = Number(qs("#videoDuration", root)?.value || 5);
    const duration = clampDuration(durationRaw);

    return {
      app: "video",
      model: "gen4.5",
      duration,
      ratio: qs("#videoRatio", root)?.value || "16:9",
      resolution: Number(qs("#videoResolution", root)?.value || 720),
      audio: !!qs("#audioEnabled", root)?.checked,
      credit_cost: getVideoCredit(root),
    };
  }

  function buildVideoPolicyText(root, mode = "text") {
    const common = buildCommonPayload(root);

    const textPrompt = String(qs("#videoPrompt", root)?.value || "").trim();
    const imagePrompt = String(qs("#videoImagePrompt", root)?.value || "").trim();

    return [
      mode === "image" ? imagePrompt : textPrompt,
      common?.model,
      common?.ratio,
      common?.duration,
      common?.resolution
    ]
      .filter(Boolean)
      .join(" ");
  }

  async function createText() {
    const root = getRoot();

    const prompt = (qs("#videoPrompt", root)?.value || "").trim();
    const policyText = buildVideoPolicyText(root, "text");
    const createBtn = qs("#videoGenerateTextBtn", root);
    const policyNote = ensureVideoPolicyNote(root, createBtn);

    if (isVideoPolicyBlocked(policyText)) {
      const promptEl = qs("#videoPrompt", root);

      if (promptEl) {
        promptEl.style.borderColor = "rgba(255,110,140,.92)";
        promptEl.style.boxShadow =
          "0 0 0 1px rgba(255,110,140,.28), 0 10px 28px rgba(255,70,110,.10)";
        promptEl.focus();
      }

      if (createBtn) {
        createBtn.style.background =
          "linear-gradient(135deg, rgba(255,93,143,.92), rgba(255,62,62,.92))";
        createBtn.style.borderColor = "rgba(255,110,140,.95)";
        createBtn.style.boxShadow =
          "0 10px 30px rgba(255,80,120,.22), inset 0 1px 0 rgba(255,255,255,.18)";
        createBtn.style.cursor = "not-allowed";
        createBtn.style.filter = "saturate(1.05)";
      }

      if (policyNote) {
        policyNote.textContent =
          "Bu istek bu haliyle üretilemez. Sanatçı adı, kişi adı veya taklit çağrışımı yerine video sahnesini ve aksiyonu tarif et.";
        policyNote.style.display = "block";
      }

      syncVideoAssistantState(root, {
        currentFlow: "video_text_generate",
        policyState: "block",
        generationState: "failed",
        creditsConsumed: false,
        refundExpected: false,
        refundDone: false,
        creditCost: getVideoCredit(root),
        lastJobId: "",
        lastRequestId: "",
        lastVideoUrl: "",
        visibleError: "policy_blocked",
        visiblePolicyNote: readVideoPolicyNote(root)
      });

      return;
    }

    if (!prompt) {
      try { window.toast?.info?.("Prompt yazmalısın"); } catch {}
      const promptEl = qs("#videoPrompt", root);
      if (promptEl) promptEl.focus();
      return;
    }

    const payload = {
      ...buildCommonPayload(root),
      mode: "text",
      prompt,
    };

    const creditCost = Number(payload.credit_cost || getVideoCredit(root) || 0);
    const creditReason = "studio_video_text_generate";

    syncVideoAssistantState(root, {
      currentFlow: "video_text_generate",
      policyState: "allow",
      generationState: "processing",
      creditsConsumed: false,
      refundExpected: false,
      refundDone: false,
      creditCost,
      lastJobId: "",
      lastRequestId: "",
      lastVideoUrl: "",
      visibleError: ""
    });

    const consumed = await consumeVideoCredits({ creditCost, creditReason });
    if (!consumed) return;

    syncVideoAssistantState(root, {
      currentFlow: "video_text_generate",
      generationState: "processing",
      creditsConsumed: true,
      refundExpected: false,
      refundDone: false,
      creditCost,
      lastJobId: "",
      lastRequestId: consumed.consumeRequestId,
      lastVideoUrl: "",
      visibleError: ""
    });

    try { window.toast?.success?.(`${creditCost} kredi düşüldü`); } catch {}

    try {
      const j = await postJSON("/api/providers/runway/video/create", payload);
      const job = j.job || j;

      job.app = "video";
      window.AIVO_JOBS?.upsert?.(job);

      const job_id = job.job_id || job.id;
      console.log("[video] created(text)", { job_id, job, creditCost });

      syncVideoAssistantState(root, {
        currentFlow: "video_text_generate",
        generationState: "processing",
        creditsConsumed: true,
        refundExpected: false,
        refundDone: false,
        creditCost,
        lastJobId: String(job_id || ""),
        lastRequestId: consumed.consumeRequestId,
        lastVideoUrl: "",
        visibleError: "",
        dbSaved: true
      });

      emitVideoJobCreated({
        app: "video",
        job_id,
        createdAt: Date.now(),
        mode: "text",
        prompt,
        model: payload.model,
        ratio: payload.ratio,
        duration: payload.duration,
        resolution: payload.resolution,
        audio: payload.audio,
        credit_cost: creditCost,
        request_id: consumed.consumeRequestId
      });

      try { window.toast?.success?.("Video hazırlanıyor"); } catch {}

      await pollJob(job_id, {
        mode: "text",
        prompt,
        image_url: "",
        duration: payload.duration,
        ratio: payload.ratio,
        creditCost,
        creditReason,
        consumeRequestId: consumed.consumeRequestId,
        transactionId: consumed.transactionId
      });
    } catch (err) {
      console.error("[video] create(text) error =", err);

      const refunded = await refundVideoCredits({
        creditCost,
        creditReason,
        consumeRequestId: consumed.consumeRequestId,
        transactionId: consumed.transactionId,
        reason: "video_text_create_failed",
        meta: {
          source: "video.create",
          mode: "text",
          duration: payload.duration,
          aspect_ratio: payload.ratio,
          prompt,
          error: String(err?.message || err || "video_text_create_failed")
        }
      });

      syncVideoAssistantState(root, {
        currentFlow: "video_text_generate",
        generationState: "failed",
        creditsConsumed: true,
        refundExpected: true,
        refundDone: refunded,
        creditCost,
        lastJobId: "",
        lastRequestId: consumed.consumeRequestId,
        lastVideoUrl: "",
        visibleError: String(err?.message || err || "video_text_create_failed")
      });

      if (!refunded) {
        throw err;
      }
    }
  }
async function createImage() {
  const root = getRoot();
  resetVideoPolicyUI(root);

  const input = qs("#videoImageInput", root);
  const file = input?.files?.[0];
  const uploadStatus = String(input?.dataset?.uploadStatus || "empty").trim();
  const uploadedImageUrl = String(input?.dataset?.uploadUrl || "").trim();
  const uploadErrorReason = String(input?.dataset?.uploadErrorReason || "").trim();

  const policyText = buildVideoPolicyText(root, "image");
  const createBtn = qs("#videoGenerateImageBtn", root);
  const policyNote = ensureVideoPolicyNote(root, createBtn);

  if (isVideoPolicyBlocked(policyText)) {
    const promptEl = qs("#videoImagePrompt", root);

    if (promptEl) {
      promptEl.style.borderColor = "rgba(255,110,140,.92)";
      promptEl.style.boxShadow =
        "0 0 0 1px rgba(255,110,140,.28), 0 10px 28px rgba(255,70,110,.10)";
      promptEl.focus();
    }

    if (createBtn) {
      createBtn.style.background =
        "linear-gradient(135deg, rgba(255,93,143,.92), rgba(255,62,62,.92))";
      createBtn.style.borderColor = "rgba(255,110,140,.95)";
      createBtn.style.boxShadow =
        "0 10px 30px rgba(255,80,120,.22), inset 0 1px 0 rgba(255,255,255,.18)";
      createBtn.style.cursor = "not-allowed";
      createBtn.style.filter = "saturate(1.05)";
    }

    if (policyNote) {
      policyNote.textContent =
        "Bu istek bu haliyle üretilemez. Sanatçı adı, kişi adı veya taklit çağrışımı yerine video sahnesini ve aksiyonu tarif et.";
      policyNote.style.display = "block";
    }

    syncVideoAssistantState(root, {
      currentFlow: "video_image_generate",
      policyState: "block",
      generationState: "failed",
      creditsConsumed: false,
      refundExpected: false,
      refundDone: false,
      creditCost: getVideoCredit(root),
      lastJobId: "",
      lastRequestId: "",
      lastVideoUrl: "",
      visibleError: "policy_blocked",
      visiblePolicyNote: readVideoPolicyNote(root)
    });

    return;
  }

  if (!file) {
    try {
      window.toast?.info?.("Resim seçmelisin");
    } catch {}
    return;
  }

  if (uploadStatus === "uploading") {
    syncVideoAssistantState(root, {
      currentFlow: "video_image_generate",
      generationState: "failed",
      creditsConsumed: false,
      refundExpected: false,
      refundDone: false,
      creditCost: getVideoCredit(root),
      visibleError: "image_not_ready"
    });
    try {
      window.toast?.info?.("Görsel hâlâ yükleniyor");
    } catch {}
    return;
  }

  if (uploadStatus === "policy_blocked") {
    syncVideoAssistantState(root, {
      currentFlow: "video_image_generate",
      policyState: "block",
      generationState: "failed",
      creditsConsumed: false,
      refundExpected: false,
      refundDone: false,
      creditCost: getVideoCredit(root),
      visibleError: "policy_blocked"
    });
    try {
      window.toast?.error?.("Bu görsel kullanılamaz.");
    } catch {}
    return;
  }

  if (uploadStatus !== "ready" || !uploadedImageUrl) {
    syncVideoAssistantState(root, {
      currentFlow: "video_image_generate",
      generationState: "failed",
      creditsConsumed: false,
      refundExpected: false,
      refundDone: false,
      creditCost: getVideoCredit(root),
      visibleError: uploadErrorReason || "image_upload_failed"
    });
    try {
      window.toast?.error?.("Yükleme hatası");
    } catch {}
    console.warn("[video] create(image) blocked: upload not ready", {
      uploadStatus,
      uploadErrorReason
    });
    return;
  }

  const prompt = (qs("#videoImagePrompt", root)?.value || "").trim();

  const payload = {
    ...buildCommonPayload(root),
    mode: "image",
    prompt,
    image_url: uploadedImageUrl
  };

  const creditCost = Number(payload.credit_cost || getVideoCredit(root) || 0);
  const creditReason = "studio_video_image_generate";

  syncVideoAssistantState(root, {
    currentFlow: "video_image_generate",
    policyState: "allow",
    generationState: "processing",
    creditsConsumed: false,
    refundExpected: false,
    refundDone: false,
    creditCost,
    lastJobId: "",
    lastRequestId: "",
    lastVideoUrl: "",
    visibleError: ""
  });

  const consumed = await consumeVideoCredits({ creditCost, creditReason });
  if (!consumed) return;

  syncVideoAssistantState(root, {
    currentFlow: "video_image_generate",
    generationState: "processing",
    creditsConsumed: true,
    refundExpected: false,
    refundDone: false,
    creditCost,
    lastJobId: "",
    lastRequestId: consumed.consumeRequestId,
    lastVideoUrl: "",
    visibleError: ""
  });

  try {
    window.toast?.success?.(`${creditCost} kredi düşüldü`);
  } catch {}

  try {
    const j = await postJSON("/api/providers/runway/video/create", payload);
    const job = j.job || j;

    job.app = "video";
    window.AIVO_JOBS?.upsert?.(job);

    const job_id = job.job_id || job.id;
    console.log("[video] created(image)", { job_id, job, creditCost, image_url: payload.image_url });

    syncVideoAssistantState(root, {
      currentFlow: "video_image_generate",
      generationState: "processing",
      creditsConsumed: true,
      refundExpected: false,
      refundDone: false,
      creditCost,
      lastJobId: String(job_id || ""),
      lastRequestId: consumed.consumeRequestId,
      lastVideoUrl: "",
      visibleError: "",
      dbSaved: true
    });

    emitVideoJobCreated({
      app: "video",
      job_id,
      createdAt: Date.now(),
      mode: "image",
      model: payload.model,
      prompt: payload.prompt || "",
      image_url: payload.image_url,
      ratio: payload.ratio,
      duration: payload.duration,
      resolution: payload.resolution,
      audio: payload.audio,
      credit_cost: creditCost,
      request_id: consumed.consumeRequestId
    });

    try {
      window.toast?.success?.("Video hazırlanıyor");
    } catch {}

    await pollJob(job_id, {
      mode: "image",
      prompt: payload.prompt || "",
      image_url: payload.image_url || "",
      duration: payload.duration,
      ratio: payload.ratio,
      creditCost,
      creditReason,
      consumeRequestId: consumed.consumeRequestId,
      transactionId: consumed.transactionId
    });
  } catch (err) {
    console.error("[video] create(image) error =", err);

    const refunded = await refundVideoCredits({
      creditCost,
      creditReason,
      consumeRequestId: consumed.consumeRequestId,
      transactionId: consumed.transactionId,
      reason: "video_image_create_failed",
      meta: {
        source: "video.create",
        mode: "image",
        duration: payload.duration,
        aspect_ratio: payload.ratio,
        prompt: payload.prompt || "",
        image_url: payload.image_url || "",
        error: String(err?.message || err || "video_image_create_failed")
      }
    });

    syncVideoAssistantState(root, {
      currentFlow: "video_image_generate",
      generationState: "failed",
      creditsConsumed: true,
      refundExpected: true,
      refundDone: refunded,
      creditCost,
      lastJobId: "",
      lastRequestId: consumed.consumeRequestId,
      lastVideoUrl: "",
      visibleError: String(err?.message || err || "video_image_create_failed")
    });

    if (!refunded) {
      throw err;
    }
  }
}
  function bindVideoPricingUI(root) {
    if (!root || root.__videoPricingBound) return;
    root.__videoPricingBound = true;

    const durationEl = qs("#videoDuration", root);
    const audioEl = qs("#audioEnabled", root);
    const ratioEl = qs("#videoRatio", root);
    const resolutionEl = qs("#videoResolution", root);

    function applyInitialDefaults() {
      if (durationEl && !durationEl.dataset.videoDefaultApplied) {
        durationEl.value = "5";
        durationEl.dataset.videoDefaultApplied = "1";
      }

      if (audioEl && !audioEl.dataset.videoDefaultApplied) {
        audioEl.checked = false;
        audioEl.dataset.videoDefaultApplied = "1";
      }
    }

    function syncDurationDefault() {
      if (!durationEl) return;
      const next = clampDuration(Number(durationEl.value || 5));
      durationEl.value = String(next);
    }

    function refreshPricing() {
      applyInitialDefaults();
      syncDurationDefault();
      syncVideoCreditUI(root);
    }

    if (durationEl) {
      durationEl.addEventListener("change", refreshPricing);
      durationEl.addEventListener("input", refreshPricing);
    }

    if (audioEl) {
      let lastAudioState = !!audioEl.checked;

      function handleAudioToast() {
        const nextAudioState = !!audioEl.checked;

        if (nextAudioState === lastAudioState) return;
        lastAudioState = nextAudioState;

        if (nextAudioState) {
          try { window.toast?.success?.("Ses üretimi açıldı · +5 kredi"); } catch {}
        } else {
          try { window.toast?.success?.("Ses üretimi kapatıldı · -5 kredi"); } catch {}
        }
      }

      audioEl.addEventListener("change", () => {
        handleAudioToast();
        refreshPricing();
      });

      audioEl.addEventListener("input", () => {
        handleAudioToast();
        refreshPricing();
      });
    }

    if (ratioEl) {
      ratioEl.addEventListener("change", refreshPricing);
    }

    if (resolutionEl) {
      resolutionEl.addEventListener("change", refreshPricing);
    }

    refreshPricing();
  }

  // ===============================
  // Buttons (event delegation)
  // ===============================
  function withLoading(btn, fn) {
    if (!btn) return;
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = "Üretiliyor...";
    btn.classList.add("is-loading");

    return Promise.resolve()
      .then(fn)
      .catch((err) => {
        console.error(err);
        alert(String(err));
      })
      .finally(() => {
        btn.disabled = false;
        btn.textContent = prev;
        btn.classList.remove("is-loading");
      });
  }

  document.addEventListener(
    "click",
    (e) => {
      const tBtn = e.target.closest("#videoGenerateTextBtn");
      if (tBtn) {
        e.preventDefault();
        return withLoading(tBtn, createText);
      }

      const iBtn = e.target.closest("#videoGenerateImageBtn");
      if (iBtn) {
        e.preventDefault();
        return withLoading(iBtn, createImage);
      }
    },
    true
  );

  // ===============================
  // Prompt counters + policy reset (bind once)
  // ===============================
  function bindPromptCounter(root) {
    const textPromptEl = qs("#videoPrompt", root);
    const imagePromptEl = qs("#videoImagePrompt", root);

    const textCounterEl =
      qs("#videoPromptCount", root) ||
      qs('[data-role="videoPromptCount"]', root) ||
      Array.from(root.querySelectorAll("*")).find((el) =>
        (el.textContent || "").trim() === "0 / 1000"
      );

    if (textPromptEl && textCounterEl && !textPromptEl.__countBound) {
      textPromptEl.__countBound = true;

      function updateText() {
        const n = (textPromptEl.value || "").length;
        textCounterEl.textContent = `${n} / 1000`;
      }

      textPromptEl.addEventListener("input", () => {
        resetVideoPolicyUI(root);
        updateText();
        syncVideoCreditUI(root);
        syncVideoAssistantState(root, {
          currentFlow: "video_text_generate",
          generationState: "idle",
          visibleError: "",
          policyState: "allow"
        });
      });

      textPromptEl.addEventListener("change", () => {
        resetVideoPolicyUI(root);
        updateText();
        syncVideoCreditUI(root);
      });

      updateText();
    }

    if (imagePromptEl && !imagePromptEl.__countBound) {
      imagePromptEl.__countBound = true;

      imagePromptEl.addEventListener("input", () => {
        resetVideoPolicyUI(root);
        syncVideoCreditUI(root);
      });

      imagePromptEl.addEventListener("change", () => {
        resetVideoPolicyUI(root);
        syncVideoCreditUI(root);
      });
    }
  }

  // ===============================
  // Tabs + Image upload UX (bind once per root)
  // ===============================
function bindTabs(root) {
  if (!root || root.__videoTabsBound) return;

  const tabText = root.querySelector('[data-video-tab="text"]');
  const tabImage = root.querySelector('[data-video-tab="image"]');
  const viewText = root.querySelector('[data-video-subview="text"]');
  const viewImage = root.querySelector('[data-video-subview="image"]');

  if (!tabText || !tabImage || !viewText || !viewImage) return;

  root.__videoTabsBound = true;

  function getImageUploadRefs() {
    return {
      input: root.querySelector("#videoImageInput"),
      fb: root.querySelector("#videoImageFeedback"),
      name: root.querySelector("#videoImageName"),
      clearBtn: root.querySelector("#videoImageClearBtn"),
      bar: root.querySelector("#videoImageBar"),
      pct: root.querySelector("#videoImagePct")
    };
  }

  function setImageUploadState(next = {}) {
    const { input, fb, name, clearBtn, bar, pct } = getImageUploadRefs();
    if (!input) return;

    const status = String(next.status || "empty").trim();
    const uploadUrl = String(next.uploadUrl || "").trim();
    const fileName = String(next.fileName || "").trim();
    const errorReason = String(next.errorReason || "").trim();
    const fileSizeText = next.fileSizeText ? String(next.fileSizeText) : "";

    input.dataset.uploadStatus = status;
    input.dataset.uploadUrl = uploadUrl;
    input.dataset.uploadErrorReason = errorReason;

    if (status === "empty") {
      input.style.pointerEvents = "auto";
      if (fb) fb.style.display = "none";
      if (name) name.textContent = "";
      if (bar) bar.style.width = "0%";
      if (pct) pct.textContent = "0%";
      if (clearBtn) clearBtn.style.display = "none";
      syncVideoAssistantState(root, {
        currentFlow: "video_image_generate",
        generationState: "idle",
        visibleError: "",
        video: { imageUploadState: "empty" }
      });
      return;
    }

    if (fb) fb.style.display = "block";

    if (status === "uploading") {
      input.style.pointerEvents = "none";
      if (name) {
        name.textContent = `Seçildi: ${fileName}${fileSizeText ? ` (${fileSizeText})` : ""} · Yükleniyor...`;
      }
      if (bar) bar.style.width = "35%";
      if (pct) pct.textContent = "35%";
      if (clearBtn) clearBtn.style.display = "none";
      syncVideoAssistantState(root, {
        currentFlow: "video_image_generate",
        generationState: "idle",
        visibleError: "",
        video: { imageUploadState: "uploading" }
      });
      return;
    }

    if (status === "ready") {
      input.style.pointerEvents = "auto";
      if (name) {
        name.textContent = `Seçildi: ${fileName}${fileSizeText ? ` (${fileSizeText})` : ""} · Hazır ✓`;
      }
      if (bar) bar.style.width = "100%";
      if (pct) pct.textContent = "100%";
      if (clearBtn) {
        clearBtn.style.display = "inline-grid";
        clearBtn.style.placeItems = "center";
      }
      syncVideoAssistantState(root, {
        currentFlow: "video_image_generate",
        generationState: "idle",
        visibleError: "",
        video: { imageUploadState: "ready" }
      });
      return;
    }

    if (status === "policy_blocked") {
      input.style.pointerEvents = "auto";
      if (name) {
        name.textContent = `Seçildi: ${fileName}${fileSizeText ? ` (${fileSizeText})` : ""} · Bu görsel kullanılamaz`;
      }
      if (bar) bar.style.width = "100%";
      if (pct) pct.textContent = "100%";
      if (clearBtn) {
        clearBtn.style.display = "inline-grid";
        clearBtn.style.placeItems = "center";
      }
      syncVideoAssistantState(root, {
        currentFlow: "video_image_generate",
        policyState: "block",
        generationState: "failed",
        visibleError: "policy_blocked",
        visiblePolicyNote: readVideoPolicyNote(root),
        video: { imageUploadState: "policy_blocked" }
      });
      return;
    }

    if (status === "error") {
      input.style.pointerEvents = "auto";
      if (name) {
        name.textContent = `Seçildi: ${fileName}${fileSizeText ? ` (${fileSizeText})` : ""} · Yükleme hatası`;
      }
      if (bar) bar.style.width = "100%";
      if (pct) pct.textContent = "100%";
      if (clearBtn) {
        clearBtn.style.display = "inline-grid";
        clearBtn.style.placeItems = "center";
      }
      syncVideoAssistantState(root, {
        currentFlow: "video_image_generate",
        generationState: "failed",
        visibleError: errorReason || "image_upload_failed",
        video: { imageUploadState: "error" }
      });
      return;
    }
  }

  async function uploadVideoFileWithPolicy(file, kind = "image") {
    if (!file) throw new Error("missing_file");

    const contentType = file.type || "application/octet-stream";
    const filename = file.name || `video-input-${Date.now()}`;
    const promptText = String(qs("#videoImagePrompt", root)?.value || "").trim();

    const presign = await postJSON("/api/r2/scan-and-presign", {
      app: "video",
      kind,
      filename,
      contentType,
      prompt: promptText,
      title: filename,
      description: promptText || filename,
      source: "video_image_upload"
    });

    const uploadUrl = String(
      presign.uploadUrl ||
      presign.upload_url ||
      ""
    ).trim();

    const publicUrl = String(
      presign.publicUrl ||
      presign.public_url ||
      presign.url ||
      ""
    ).trim();

    const key = String(
      presign.key ||
      presign.objectKey ||
      ""
    ).trim();

    if (!uploadUrl || !publicUrl || !key) {
      throw new Error("video_image_missing_upload_urls");
    }

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType
      },
      body: file
    });

    if (!putRes.ok) {
      throw new Error(`video_image_r2_put_failed_${putRes.status}`);
    }

    const scanData = await postJSON("/api/r2/scan-upload", {
      app: "video",
      key,
      filename,
      contentType,
      public_url: publicUrl,
      prompt: promptText,
      title: filename,
      description: promptText || filename,
      source: "video_image_upload"
    });

    const decision = String(scanData?.decision || "allow").trim().toLowerCase();
    const finalUrl = String(scanData?.public_url || publicUrl).trim();

    if (decision && decision !== "allow") {
      throw new Error(`media_policy_${decision}`);
    }

    if (!finalUrl) {
      throw new Error("video_image_missing_public_url");
    }

    return {
      url: finalUrl,
      key,
      decision
    };
  }

  function bindImageUploadUX() {
    const { input, clearBtn } = getImageUploadRefs();
    if (!input || input.__uxBound) return;

    input.__uxBound = true;
    input.dataset.uploadStatus = input.dataset.uploadStatus || "empty";
    input.dataset.uploadUrl = input.dataset.uploadUrl || "";
    input.dataset.uploadErrorReason = input.dataset.uploadErrorReason || "";

    if (clearBtn && !clearBtn.__bound) {
      clearBtn.__bound = true;

      clearBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();

        input.value = "";
        resetVideoPolicyUI(root);

        setImageUploadState({
          status: "empty",
          uploadUrl: "",
          fileName: "",
          errorReason: ""
        });
      });
    }

    input.addEventListener("change", async () => {
      const f = input.files?.[0];
      resetVideoPolicyUI(root);

      if (!f) {
        setImageUploadState({
          status: "empty",
          uploadUrl: "",
          fileName: "",
          errorReason: ""
        });
        return;
      }

      const fileSizeText = `${(f.size / 1024 / 1024).toFixed(2)}MB`;

      setImageUploadState({
        status: "uploading",
        uploadUrl: "",
        fileName: f.name,
        fileSizeText,
        errorReason: ""
      });

      try {
        const uploaded = await uploadVideoFileWithPolicy(f, "image");

        setImageUploadState({
          status: "ready",
          uploadUrl: uploaded.url,
          fileName: f.name,
          fileSizeText,
          errorReason: ""
        });
      } catch (err) {
        const errText = String(err?.message || err || "").toLowerCase();
        const isPolicyBlocked =
          errText.includes("media_policy") ||
          errText.includes("public_figure") ||
          errText.includes("celebrity") ||
          errText.includes("protected_person");

        setImageUploadState({
          status: isPolicyBlocked ? "policy_blocked" : "error",
          uploadUrl: "",
          fileName: f.name,
          fileSizeText,
          errorReason: errText
        });

        try {
          window.toast?.error?.(
            isPolicyBlocked ? "Bu görsel kullanılamaz." : "Yükleme hatası"
          );
        } catch {}

        console.error("[video] image upload error =", err);
      }
    });
  }

  function setMode(mode) {
    const isText = mode === "text";
    tabText.classList.toggle("is-active", isText);
    tabImage.classList.toggle("is-active", !isText);

    viewText.classList.toggle("is-active", isText);
    viewImage.classList.toggle("is-active", !isText);

    viewText.style.display = isText ? "" : "none";
    viewImage.style.display = !isText ? "" : "none";

    resetVideoPolicyUI(root);

    if (mode === "image") bindImageUploadUX();

    root.dataset.videoMode = mode;
    syncVideoCreditUI(root);
    syncVideoAssistantState(root, {
      currentFlow: mode === "image" ? "video_image_generate" : "video_text_generate",
      generationState: "idle",
      visibleError: "",
      policyState: "allow"
    });
    console.log("[video.tabs] mode =", mode);
  }

  tabText.addEventListener("click", (e) => {
    e.preventDefault();
    setMode("text");
  });

  tabImage.addEventListener("click", (e) => {
    e.preventDefault();
    setMode("image");
  });

  setMode(root.dataset.videoMode || "text");
  bindImageUploadUX();
  console.log("[video.tabs] bound ✅");
}
  // ===============================
  // Single observer: root geldiğinde bind et, sonra hafif çalışsın
  // ===============================
  function tryBindAll() {
    const root = document.querySelector(ROOT_SEL);
    if (!root) return;

    bindTabs(root);
    bindPromptCounter(root);
    bindVideoPricingUI(root);
    syncVideoAssistantState(root, {
      currentFlow: getVideoMode(root) === "image" ? "video_image_generate" : "video_text_generate",
      generationState: "idle",
      visibleError: "",
      policyState: "allow"
    });
  }

  // İlk çalıştır
  tryBindAll();

  // Router/mount sonrası için tek observer
  const obs = new MutationObserver(() => tryBindAll());
  obs.observe(document.documentElement, { childList: true, subtree: true });

  console.log("[VIDEO] module READY (create + poll + PPE) ✅");
})();
