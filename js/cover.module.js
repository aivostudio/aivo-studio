// FILE: cover.module.js
console.log("[cover.module] loaded ✅", new Date().toISOString());

// cover.module.js — FULL BLOCK (style sync + quality routing + FAL generate + PPE.apply)
(function () {
  // --- COVER TEXT OVERLAY (auto) ---
  async function applyCoverTextOverlay(imageUrl) {
    console.log("[cover overlay entered]", imageUrl);

    const pick = (...sels) => {
      for (const s of sels) {
        const el = document.querySelector(s);
        if (el && typeof el.value === "string") return el.value.trim();
        if (el && typeof el.textContent === "string" && el.tagName !== "SCRIPT") return el.textContent.trim();
      }
      return "";
    };

    const artist =
      pick('#coverArtist', 'input[name="artist"]', 'input[data-field="artist"]', 'input[placeholder*="Sanatçı"]') ||
      pick('#artist', 'input[name="coverArtist"]');

    const title =
      pick('#coverTitle', 'input[name="title"]', 'input[data-field="title"]', 'input[placeholder*="Şarkı"]', 'input[placeholder*="Parça"]') ||
      pick('#title', 'input[name="coverTitle"]');

    console.log("[cover overlay values]", { artist, title });

    if (!artist && !title) return { ok: true, finalUrl: imageUrl };

    console.log("[cover overlay payload]", { imageUrl, artist, title });

    const r = await fetch("/api/cover/overlay-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, artist, title }),
    });

    if (!r.ok) {
      return { ok: false, finalUrl: imageUrl };
    }

    const blob = await r.blob();
    const finalUrl = URL.createObjectURL(blob);
    return { ok: true, finalUrl };
  }

  function shouldApplyCoverTextOverlay() {
    return false;
  }

  if (window.__AIVO_COVER_MODULE__) return;
  window.__AIVO_COVER_MODULE__ = true;

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function getRoot() {
    return document.querySelector('section.main-panel[data-module="cover"]');
  }

  function setActiveStyle(root, style) {
    if (!root || !style) return;

    qsa(".style-pill", root).forEach((b) => {
      const on = (b.getAttribute("data-style") || "") === style;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });

    qsa(".style-card", root).forEach((b) => {
      const on = (b.getAttribute("data-style") || "") === style;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });

    const card = root.querySelector(`.style-card[data-style="${CSS.escape(style)}"]`);
    const stylePrompt = card ? (card.getAttribute("data-prompt") || "").trim() : "";
    const ta = qs("#coverPrompt", root);

    if (ta && stylePrompt) {
      ta.value = stylePrompt;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }

    root.dataset.coverStyle = style;
    console.log("[cover] style =", style);
  }

  function setActiveQuality(root, quality) {
    if (!root) return;

    const q = String(quality || "artist").toLowerCase() === "ultra" ? "ultra" : "artist";

    qsa(".quality-pill", root).forEach((b) => {
      const on = (b.getAttribute("data-quality") || "") === q;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });

    root.dataset.coverQuality = q;

    const activeBtn = root.querySelector(`.quality-pill[data-quality="${CSS.escape(q)}"]`);
    const credit =
      Number(activeBtn?.getAttribute("data-credit-cost") || (q === "ultra" ? 9 : 6)) ||
      (q === "ultra" ? 9 : 6);

    const advStrong = root.querySelector(".advanced-credit strong");
    if (advStrong) advStrong.textContent = String(credit);

    const gen = qs("#coverGenerateBtn", root);
    if (gen) {
      gen.setAttribute("data-credit-cost", String(credit));
      gen.textContent = `🖼️ Kapak Üret (${credit} Kredi)`;
    }

    console.log("[cover] quality =", q, "credit =", credit);
  }

  async function postJSON(url, payload) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await r.json().catch(() => null);
    if (!r.ok || !j) throw j?.error || `cover_failed_${r.status}`;
    if (j.ok === false) throw j.error || "cover_failed";
    return j;
  }

    const HARD_BLOCK_TERMS = [
    "deepfake",
    "face swap",
    "yuzunu koy",
    "yüzünü koy",
    "yuzunu ekle",
    "yüzünü ekle",
    "replace face",
    "swap face"
  ];

  const HARD_BLOCK_PATTERNS = [
    /\bgibi\b/i,
    /\btarzında\b/i,
    /\btarzinda\b/i,
    /\bstilinde\b/i,
    /\bin the style of\b/i,
    /\blike\b/i,
    /\bbirebir\b/i,
    /\baynısı\b/i,
    /\baynisi\b/i,
    /\byuzuyle\b/i,
    /\byüzüyle\b/i,
    /\byuzunu kullan\b/i,
    /\byüzünü kullan\b/i,
    /\bsuratini kullan\b/i,
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
  const ARTIST_NAME_TERMS = [
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

  function normalizePolicyText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function ensureCoverPolicyNote(generateBtn) {
    const root = getRoot();
    if (!root || !generateBtn || !generateBtn.parentElement) return null;

    let policyNote = root.querySelector("#coverPolicyNote");
    if (!policyNote) {
      policyNote = document.createElement("div");
      policyNote.id = "coverPolicyNote";
      policyNote.style.display = "none";
      policyNote.style.marginTop = "12px";
      policyNote.style.padding = "14px 16px";
      policyNote.style.borderRadius = "18px";
      policyNote.style.background = "rgba(255,90,120,.10)";
      policyNote.style.border = "1px solid rgba(255,120,150,.24)";
      policyNote.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,.04)";
      policyNote.style.backdropFilter = "blur(10px)";
      policyNote.style.webkitBackdropFilter = "blur(10px)";
      policyNote.style.textAlign = "center";
      policyNote.style.fontSize = "14px";
      policyNote.style.fontWeight = "800";
      policyNote.style.lineHeight = "1.65";
      policyNote.style.letterSpacing = ".01em";
      policyNote.style.color = "rgba(255,245,248,.96)";
      generateBtn.parentElement.appendChild(policyNote);
    }

    return policyNote;
  }

  function resetCoverPolicyUI(root, promptEl, generateBtn) {
    const policyNote = root?.querySelector("#coverPolicyNote");

    if (promptEl) {
      promptEl.style.borderColor = "";
      promptEl.style.boxShadow = "";
      promptEl.style.animation = "";
    }

    if (generateBtn) {
      generateBtn.style.background = "";
      generateBtn.style.borderColor = "";
      generateBtn.style.boxShadow = "";
      generateBtn.style.cursor = "";
      generateBtn.style.filter = "";
      generateBtn.style.animation = "";
    }

    if (policyNote) {
      policyNote.style.display = "none";
      policyNote.textContent = "";
    }
  }

  function isCoverPolicyBlocked(raw) {
    const text = normalizePolicyText(raw);

    const hasBlockedTerm =
      HARD_BLOCK_TERMS.some((term) => text.includes(normalizePolicyText(term))) ||
      PUBLIC_FIGURE_TERMS.some((term) => text.includes(normalizePolicyText(term))) ||
      ARTIST_NAME_TERMS.some((term) => text.includes(normalizePolicyText(term)));

    const hasBlockedPattern = HARD_BLOCK_PATTERNS.some((rx) => rx.test(raw));
    return !!raw && (hasBlockedTerm || hasBlockedPattern);
  }
    if (!document.getElementById("aivoPolicyPulseStyle")) {
    const style = document.createElement("style");
    style.id = "aivoPolicyPulseStyle";
    style.textContent = `
      @keyframes aivoPolicyPulse {
        0% {
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.04),
            0 0 0 1px rgba(255,120,150,.18),
            0 8px 24px rgba(255,70,110,.10);
        }
        50% {
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.05),
            0 0 0 1px rgba(255,120,150,.30),
            0 12px 34px rgba(255,70,110,.18);
        }
        100% {
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.04),
            0 0 0 1px rgba(255,120,150,.18),
            0 8px 24px rgba(255,70,110,.10);
        }
      }

      @keyframes aivoPolicyTextGlow {
        0% {
          opacity: .88;
          text-shadow: 0 0 8px rgba(255,255,255,.08), 0 0 18px rgba(255,120,150,.12);
        }
        50% {
          opacity: 1;
          text-shadow: 0 0 14px rgba(255,255,255,.16), 0 0 28px rgba(255,120,150,.24);
        }
        100% {
          opacity: .88;
          text-shadow: 0 0 8px rgba(255,255,255,.08), 0 0 18px rgba(255,120,150,.12);
        }
      }
    `;
    document.head.appendChild(style);
  }
    function bindCoverPolicyReset() {
    const root = getRoot();
    if (!root) return;

    const promptEl = qs("#coverPrompt", root);
    const gen = qs("#coverGenerateBtn", root);

    if (!promptEl || !gen || promptEl.__aivoCoverPolicyResetBound) return;
    promptEl.__aivoCoverPolicyResetBound = true;

    promptEl.addEventListener("input", () => {
      resetCoverPolicyUI(root, promptEl, gen);
    });

    promptEl.addEventListener("change", () => {
      resetCoverPolicyUI(root, promptEl, gen);
    });
  }
  // --- COVER PROMPT COMPOSITION: premium title-friendly cover layout ---
  function withTitleSafeArea(p) {
    const raw = String(p || "").trim();

    return [
      raw,
      "premium music cover artwork",
      "spotify and apple music quality album cover",
      "real commercial single cover design",
      "clean balanced composition",
      "strong focal subject",
      "cinematic lighting",
      "premium color grading",
      "polished depth",
      "minimal clutter",
      "no text",
      "no typography",
      "no letters",
      "no words",
      "no logo",
      "no watermark",
      "no fake text",
      "no random characters",
    ].join(", ");
  }
function buildCoverPrompt(prompt, quality) {
  const raw = String(prompt || "").trim();
  const q = String(quality || "artist").toLowerCase();

  if (!raw) {
    return withTitleSafeArea("");
  }

  const safeBase = withTitleSafeArea(raw);

  if (q !== "ultra") {
    return safeBase;
  }

  const shortPrompt = raw.length <= 40 && !/[,.]/.test(raw);
  const multiSubject =
    /\b(ve|ile|izleyen|bakan|karşı|arasında|yanında|üstünde|altında|içinde|kavga eden|koşan|uçan|duran)\b/i.test(raw);

  if (shortPrompt && !multiSubject) {
    return [
      `Kapak görseli için ana özne yalnızca ${raw} olsun.`,
      `Görselin merkezinde net, baskın ve gerçekçi şekilde ${raw} yer alsın.`,
      "Başka hayvan, insan, insan yüzü, kadın, erkek, portre, manzara veya alakasız nesne olmasın.",
      `${raw} doğal ortamında görünsün.`,
      "Sinematik ışık, premium renkler, temiz kompozisyon, yüksek detay, kapak tasarımına uygun güçlü odak olsun.",
      "Yazı, harf, logo, watermark, tipografi olmasın.",
      safeBase
    ].join(" ");
  }

  if (multiSubject) {
    return [
      "Kapak görselinde kullanıcı isteğine tam sadık kal.",
      `İstenen sahne tam olarak şudur: ${raw}.`,
      "Promptta geçen tüm özneleri eksiksiz koru.",
      "Özneler arasındaki ilişkiyi, aksiyonu ve yönleri bozma.",
      "Hiçbir özneyi çıkarma, azaltma, tek özneye düşürme veya başka ana özne icat etme.",
      "İnsan, kadın yüzü, erkek yüzü, portre, beauty shot, fashion shot veya alakasız karakter ekleme; yalnızca promptta açıkça varsa kullan.",
      "Alakasız manzara, gökyüzü, dağ, dekoratif arka plan veya boş estetik sahne üretme.",
      "Kompozisyon tek sahnede net olsun; ana aksiyon açıkça anlaşılsın; sahne dağılmasın.",
      "Prompt kısa olsa bile kelimeleri yeniden yorumlama; kelimeleri olduğu gibi sahneye çevir.",
      "Sinematik ışık, premium renkler, temiz cover kompozisyonu, yüksek detay olsun.",
      "Yazı, harf, logo, watermark, tipografi olmasın.",
      safeBase
    ].join(" ");
  }

  return [
    `Kullanıcı isteğine sadık kal: ${raw}.`,
    "Ana özneyi doğru koru, alakasız özne üretme.",
    "İnsan yüzü, portre, kadın, erkek veya alakasız manzara ekleme; prompt açıkça istemiyorsa kullanma.",
    "Temiz, güçlü, premium cover kompozisyonu üret.",
    "Yazı, harf, logo, watermark, tipografi olmasın.",
    safeBase
  ].join(" ");
}

  // n adet görsel için FAL create’i n kere çağır (sync url döner)
  async function generateImages({ prompt, style, ratio, n, quality }) {
    const tasks = [];

    for (let i = 0; i < n; i++) {
      const promptVar = n > 1 ? `${prompt} #${i + 1}` : prompt;
      const promptForModel = buildCoverPrompt(promptVar, quality);

      console.log("[cover] promptForModel", {
        quality,
        promptVar,
        promptForModel,
      });

      tasks.push(
        postJSON("/api/providers/fal/predictions/create?app=cover", {
          input: {
            prompt: promptForModel,
            quality,
            ratio,
          },
        }).then((j) => {
          const url =
            j.output ||
            j.imageUrl ||
            j.image_url ||
            j.url ||
            j.fal?.images?.[0]?.url ||
            null;

          return {
            url,
            prompt: promptVar,
            raw: j,
          };
        })
      );
    }

    const results = await Promise.all(tasks);
    const urls = results.map((x) => x.url).filter(Boolean);

    if (!urls.length) {
      console.error("[cover] no image url from fal response", results);
      throw "cover_generate_no_image";
    }

    return results;
  }

  async function createCover() {
    const root = getRoot();
    if (!root) return;

    const prompt = (qs("#coverPrompt", root)?.value || "").trim();
    if (!prompt) return alert("Lütfen görüntü açıklaması yaz.");

    const style = root.dataset.coverStyle || null;
    const quality = root.dataset.coverQuality || "artist";
    const n = Number(qs("#coverCount", root)?.value || 1);
    const ratio = qs("#coverRatio", root)?.value || "1:1";

    console.log("[cover] generate request", { prompt, style, quality, n, ratio });

    const imgs = await generateImages({ prompt, style, ratio, n, quality });

    for (const img of imgs) {
      console.log("[cover overlay start]", img.url);

      const originalImageUrl = img.url;
      let displayImageUrl = img.url;

      if (shouldApplyCoverTextOverlay()) {
        const over = await applyCoverTextOverlay(img.url);
        if (over?.finalUrl) {
          displayImageUrl = over.finalUrl;
        }
      }

      try {
        const db = await postJSON("/api/cover/generate", {
          prompt: img.prompt || prompt,
          style,
          quality,
          ratio,
          imageUrl: originalImageUrl,
        });

        console.log("[cover] db saved ✅", db);

        if (db?.job_id) {
          window.dispatchEvent(
            new CustomEvent("aivo:cover:job_created", {
              detail: {
                app: "cover",
                job_id: db.job_id,
                prompt: img.prompt || prompt,
                quality,
                style,
                ratio,
                imageUrl: displayImageUrl,
                createdAt: Date.now(),
                meta: {
                  app: "cover",
                  prompt: img.prompt || prompt,
                  quality,
                  style,
                  ratio,
                  originalImageUrl,
                },
              },
            })
          );
        }
      } catch (e) {
        console.error("[cover] db write failed", e);
      }
    }
  }

  // --- PROMPT CHAR COUNT (opsiyonel) ---
  function bindPromptCounter() {
    const root = getRoot();
    if (!root) return;

    const promptEl = qs("#coverPrompt", root);
    if (!promptEl || promptEl.__countBound) return;

    const counterEl =
      qs("#coverPromptCount", root) ||
      qs('[data-role="coverPromptCount"]', root) ||
      Array.from(root.querySelectorAll("*")).find((el) => (el.textContent || "").trim() === "0 / 1000");

    if (!counterEl) return;

    promptEl.__countBound = true;

    function update() {
      const n = (promptEl.value || "").length;
      counterEl.textContent = `${n} / 1000`;
    }

    promptEl.addEventListener("input", update);
    promptEl.addEventListener("change", update);
    update();
  }

  document.addEventListener(
    "click",
    (e) => {
      const root = getRoot();
      if (!root) return;

      const qp = e.target.closest(".quality-pill");
      if (qp && root.contains(qp)) {
        e.preventDefault();
        const q = qp.getAttribute("data-quality") || "artist";
        setActiveQuality(root, q);
        return;
      }

      const pill = e.target.closest(".style-pill");
      if (pill && root.contains(pill)) {
        e.preventDefault();
        const style = pill.getAttribute("data-style");
        setActiveStyle(root, style);
        return;
      }

      const card = e.target.closest(".style-card");
      if (card && root.contains(card)) {
        e.preventDefault();
        const style = card.getAttribute("data-style");
        setActiveStyle(root, style);
        return;
      }

          const gen = e.target.closest("#coverGenerateBtn");
      if (gen && root.contains(gen)) {
        e.preventDefault();

        const promptEl = qs("#coverPrompt", root);
        const raw = String(promptEl?.value || "").trim();

        resetCoverPolicyUI(root, promptEl, gen);

        if (isCoverPolicyBlocked(raw)) {
          const policyNote = ensureCoverPolicyNote(gen);

          e.stopPropagation();

          if (promptEl) {
            promptEl.style.borderColor = "rgba(255,110,140,.92)";
            promptEl.style.boxShadow = "0 0 0 1px rgba(255,110,140,.28), 0 10px 28px rgba(255,70,110,.10)";
            promptEl.style.animation = "aivoPolicyPulse 1.8s ease-in-out infinite";
          }

          gen.style.background = "linear-gradient(135deg, rgba(255,93,143,.92), rgba(255,62,62,.92))";
          gen.style.borderColor = "rgba(255,110,140,.95)";
          gen.style.boxShadow = "0 10px 30px rgba(255,80,120,.22), inset 0 1px 0 rgba(255,255,255,.18)";
          gen.style.cursor = "not-allowed";
          gen.style.filter = "saturate(1.05)";
          gen.style.animation = "aivoPolicyPulse 1.8s ease-in-out infinite";

          if (policyNote) {
            policyNote.style.display = "block";
            policyNote.innerHTML = `
              <span style="
                display:inline-block;
                width:100%;
                margin:0;
                padding:0;
                border:none;
                outline:none;
                box-shadow:none;
                background:none;
                text-align:center;
                font-size:14px;
                font-weight:800;
                line-height:1.65;
                letter-spacing:.01em;
                color:rgba(255,245,248,.96);
                text-shadow:0 0 10px rgba(255,255,255,.10), 0 0 22px rgba(255,120,150,.18);
                animation:aivoPolicyTextGlow 1.8s ease-in-out infinite;
              ">Bu istek bu haliyle üretilemez. Sanatçı adı, kişi adı veya taklit çağrışımı yerine sahneyi ve görsel hissi tarif et.</span>
            `;
          }

          return;
        }

              gen.disabled = true;
        const prev = gen.textContent;
        gen.textContent = "Üretiliyor...";
        gen.classList.add("is-loading");

        (async () => {
          try {
            const creditCost =
              Number(gen.getAttribute("data-credit-cost") || (root.dataset.coverQuality === "ultra" ? 9 : 6)) ||
              (root.dataset.coverQuality === "ultra" ? 9 : 6);

            const creditReason =
              root.dataset.coverQuality === "ultra"
                ? "studio_cover_generate_ultra"
                : "studio_cover_generate_artist";

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
            try { creditData = await creditRes.json(); }
            catch { creditData = { ok:false, error:"non_json_response", status: creditRes.status }; }

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

            await createCover();
          } catch (err) {
            console.error("[cover] createCover error:", err);
            alert(String(err));
          } finally {
            gen.disabled = false;
            gen.textContent = prev;
            gen.classList.remove("is-loading");
          }
        })();

        return;
      }
    },
    true
  );

  (function selectDefaultStyle() {
    const root = getRoot();
    if (!root) return;
    const first = qs(".style-card[data-style]", root);
    if (first) setActiveStyle(root, first.getAttribute("data-style"));
  })();

  (function selectDefaultQuality() {
    const root = getRoot();
    if (!root) return;
    setActiveQuality(root, "artist");
  })();

  bindPromptCounter();

  function ensureDefaultCoverQuality() {
    const root = getRoot();
    if (!root) return;

    const artist = root.querySelector('.quality-pill[data-quality="artist"]');
    if (!artist) return;

    const hasSelected = root.querySelector('.quality-pill[aria-pressed="true"]');
    if (!hasSelected) {
      setActiveQuality(root, "artist");
    }
  }

  ensureDefaultCoverQuality();

  new MutationObserver(() => {
    bindPromptCounter();
      bindCoverPolicyReset();
    ensureDefaultCoverQuality();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  console.log("[COVER] module READY (style + quality + FAL create + PPE)");
})();
