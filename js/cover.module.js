// FILE: /js/cover.module.js
console.log("[cover.module] loaded ✅", new Date().toISOString());

// AIVO Cover module — style sync + quality routing + FAL generation + TR/EN UI
(function AIVO_COVER_MODULE() {
  "use strict";

  if (window.__AIVO_COVER_MODULE__) return;
  window.__AIVO_COVER_MODULE__ = true;

  /* =========================================================
     I18N
     ========================================================= */

  const COVER_I18N = {
    tr: {
      "studio.cover.dynamic.promptExample":
        "Örnek:\nGece şehirde yürüyen gizemli kadın, neon ışıklar, sinematik atmosfer\n\nSonra:\nÇölde güçlü kadın lider, arkasında ekip, gün batımı, epik sahne",
      "studio.cover.dynamic.generate": "🖼️ Kapak Üret ({count} Kredi)",
      "studio.cover.dynamic.generating": "Üretiliyor...",
      "studio.cover.dynamic.promptRequired": "Prompt yazmalısın.",
      "studio.cover.dynamic.artistSelected": "Artist seçildi · 6 kredi",
      "studio.cover.dynamic.ultraSelected": "Cinematic Ultra HD seçildi · 9 kredi",
      "studio.cover.dynamic.policyBlocked":
        "Gerçek sanatçı veya siyasetçi adı kullanılamaz. İsim yerine sahneyi ve görsel hissi tarif et.",
      "studio.cover.dynamic.insufficientCredit": "Kredi yetersiz",
      "studio.cover.dynamic.creditDeducted": "{count} kredi düşüldü.",
      "studio.cover.dynamic.generationStarted": "Kapak üretimi başladı.",
      "studio.cover.dynamic.ready": "Kapak hazır.",
      "studio.cover.dynamic.refunded": "İşlem başarısız oldu, kredi iade edildi.",
      "studio.cover.dynamic.failed": "Kapak üretimi tamamlanamadı. Lütfen tekrar deneyin.",
      "studio.cover.dynamic.connectionError": "Bağlantı hatası oluştu. Lütfen tekrar deneyin."
    },
    en: {
      "studio.cover.dynamic.promptExample":
        "Example:\nA mysterious woman walking through a neon city at night, cinematic atmosphere\n\nAnother example:\nA powerful woman leading a team in the desert at sunset, epic scene",
      "studio.cover.dynamic.generate": "🖼️ Generate Cover ({count} Credits)",
      "studio.cover.dynamic.generating": "Generating...",
      "studio.cover.dynamic.promptRequired": "Enter a prompt before generating a cover.",
      "studio.cover.dynamic.artistSelected": "Artist selected · 6 credits",
      "studio.cover.dynamic.ultraSelected": "Cinematic Ultra HD selected · 9 credits",
      "studio.cover.dynamic.policyBlocked":
        "Real artist or politician names cannot be used. Describe the scene and visual mood instead of naming a person.",
      "studio.cover.dynamic.insufficientCredit": "Insufficient credits",
      "studio.cover.dynamic.creditDeducted": "{count} credits deducted.",
      "studio.cover.dynamic.generationStarted": "Cover generation started.",
      "studio.cover.dynamic.ready": "Your cover is ready.",
      "studio.cover.dynamic.refunded": "The operation failed and your credits were refunded.",
      "studio.cover.dynamic.failed": "Cover generation could not be completed. Please try again.",
      "studio.cover.dynamic.connectionError": "A connection error occurred. Please try again."
    }
  };

  function normalizeLanguage(value) {
    const language = String(value || "").trim().toLowerCase();
    return language.startsWith("en") ? "en" : "tr";
  }

  function currentLanguage() {
    return normalizeLanguage(
      window.AIVO_LANG ||
      document.documentElement.lang ||
      localStorage.getItem("aivo_language") ||
      "tr"
    );
  }

  function formatText(value, params) {
    let output = String(value == null ? "" : value);
    if (!params || typeof params !== "object") return output;

    Object.keys(params).forEach((key) => {
      output = output.replace(
        new RegExp(`\\{${key}\\}`, "g"),
        String(params[key])
      );
    });

    return output;
  }

  function registerCoverDictionary() {
    try {
      if (
        window.AIVO_STUDIO_I18N &&
        typeof window.AIVO_STUDIO_I18N.registerPack === "function"
      ) {
        window.AIVO_STUDIO_I18N.registerPack(COVER_I18N);
        return;
      }

      if (window.AIVO_I18N?.tr && window.AIVO_I18N?.en) {
        Object.assign(window.AIVO_I18N.tr, COVER_I18N.tr);
        Object.assign(window.AIVO_I18N.en, COVER_I18N.en);
      }
    } catch (error) {
      console.warn("[cover] dictionary registration failed:", error);
    }
  }

  function coverText(key, params) {
    const language = currentLanguage();

    try {
      if (
        window.AIVO_STUDIO_I18N &&
        typeof window.AIVO_STUDIO_I18N.t === "function"
      ) {
        const translated = window.AIVO_STUDIO_I18N.t(key, "", params);
        if (translated && translated !== key) return translated;
      }
    } catch (_) {}

    try {
      if (typeof window.t === "function") {
        const translated = window.t(key, params);
        if (translated && translated !== key) return formatText(translated, params);
      }
    } catch (_) {}

    return formatText(
      COVER_I18N[language]?.[key] || COVER_I18N.tr[key] || key,
      params
    );
  }

  /* =========================================================
     HELPERS / STATE
     ========================================================= */

  let coverGenerationBusy = false;

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function getRoot() {
    return document.querySelector('section.main-panel[data-module="cover"]');
  }

  function getCoverAssistantState() {
    if (!window.__AIVO_COVER_ASSISTANT_STATE__) {
      window.__AIVO_COVER_ASSISTANT_STATE__ = {
        currentPanel: "cover",
        lastAction: "idle",
        promptPresent: false,
        promptText: "",
        policyState: "allow",
        selectedQuality: "artist",
        creditCost: 6,
        generationState: "idle",
        lastImageUrl: "",
        dbSaved: false,
        visibleError: "",
        visiblePolicyNote: "",
        overlayAttempted: false,
        overlayApplied: false,
        lastJobId: "",
        lastRatio: "1:1",
        lastStyle: "",
        updatedAt: Date.now()
      };
    }

    return window.__AIVO_COVER_ASSISTANT_STATE__;
  }

  function patchCoverAssistantState(patch) {
    const next = {
      ...getCoverAssistantState(),
      ...patch,
      currentPanel: "cover",
      updatedAt: Date.now()
    };

    window.__AIVO_COVER_ASSISTANT_STATE__ = next;

    try {
      window.dispatchEvent(
        new CustomEvent("aivo:assistant:cover_context", {
          detail: { ...next }
        })
      );
    } catch (_) {}

    return next;
  }

  function readCoverPolicyNote(root) {
    return String(root?.querySelector("#coverPolicyNote")?.textContent || "").trim();
  }

  function syncCoverAssistantState(extra = {}) {
    const root = getRoot();
    const promptEl = root ? qs("#coverPrompt", root) : null;
    const generateBtn = root ? qs("#coverGenerateBtn", root) : null;

    const selectedQuality =
      String(root?.dataset?.coverQuality || "artist").toLowerCase() === "ultra"
        ? "ultra"
        : "artist";

    const creditCost =
      Number(
        generateBtn?.getAttribute("data-credit-cost") ||
        (selectedQuality === "ultra" ? 9 : 6)
      ) || (selectedQuality === "ultra" ? 9 : 6);

    return patchCoverAssistantState({
      promptPresent: Boolean(String(promptEl?.value || "").trim()),
      promptText: String(promptEl?.value || "").trim(),
      selectedQuality,
      creditCost,
      lastRatio: String(root ? qs("#coverRatio", root)?.value || "1:1" : "1:1"),
      lastStyle: String(root?.dataset?.coverStyle || ""),
      visiblePolicyNote: readCoverPolicyNote(root),
      ...extra
    });
  }

  window.getCoverAssistantState = getCoverAssistantState;
  window.syncCoverAssistantState = syncCoverAssistantState;

  /* =========================================================
     OPTIONAL TEXT OVERLAY
     ========================================================= */

  async function applyCoverTextOverlay(imageUrl) {
    console.log("[cover overlay entered]", imageUrl);

    const pick = (...selectors) => {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && typeof element.value === "string") return element.value.trim();
        if (
          element &&
          typeof element.textContent === "string" &&
          element.tagName !== "SCRIPT"
        ) {
          return element.textContent.trim();
        }
      }
      return "";
    };

    const artist =
      pick(
        "#coverArtist",
        'input[name="artist"]',
        'input[data-field="artist"]',
        'input[placeholder*="Sanatçı"]'
      ) || pick("#artist", 'input[name="coverArtist"]');

    const title =
      pick(
        "#coverTitle",
        'input[name="title"]',
        'input[data-field="title"]',
        'input[placeholder*="Şarkı"]',
        'input[placeholder*="Parça"]'
      ) || pick("#title", 'input[name="coverTitle"]');

    if (!artist && !title) return { ok: true, finalUrl: imageUrl };

    const response = await fetch("/api/cover/overlay-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, artist, title })
    });

    if (!response.ok) return { ok: false, finalUrl: imageUrl };

    const blob = await response.blob();
    return { ok: true, finalUrl: URL.createObjectURL(blob) };
  }

  function shouldApplyCoverTextOverlay() {
    return false;
  }

  /* =========================================================
     TOAST
     ========================================================= */

  function showToast(type, message) {
    try {
      if (window.toast && typeof window.toast[type] === "function") {
        return window.toast[type](message);
      }
      if (typeof window.toast === "function") return window.toast(message, type);
      if (window.Toast && typeof window.Toast.show === "function") {
        return window.Toast.show(message, type);
      }
    } catch (error) {
      console.warn("[cover] toast failed:", error);
    }

    if (type === "error") console.warn("[cover]", message);
    else console.log("[cover]", message);
  }

  function toastError(message) {
    return showToast("error", message);
  }

  function toastSuccess(message) {
    return showToast("success", message);
  }

  /* =========================================================
     STYLE / QUALITY
     ========================================================= */

  function getStylePrompt(card) {
    if (!card) return "";
    const language = currentLanguage();
    return String(
      card.getAttribute(`data-prompt-${language}`) ||
      card.getAttribute("data-prompt") ||
      ""
    ).trim();
  }

  function setActiveStyle(root, style, options = {}) {
    if (!root || !style) return;

    qsa(".style-pill", root).forEach((button) => {
      const active = (button.getAttribute("data-style") || "") === style;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    qsa(".style-card", root).forEach((button) => {
      const active = (button.getAttribute("data-style") || "") === style;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    const card = root.querySelector(
      `.style-card[data-style="${CSS.escape(style)}"]`
    );
    const promptEl = qs("#coverPrompt", root);
    const stylePrompt = getStylePrompt(card);

    if (promptEl && stylePrompt && options.writePrompt !== false) {
      promptEl.value = stylePrompt;
      promptEl.dispatchEvent(new Event("input", { bubbles: true }));
    }

    root.dataset.coverStyle = style;
    syncCoverAssistantState({
      lastAction: options.lastAction || "style_change",
      lastStyle: style,
      visibleError: ""
    });
  }

  function generateButtonText(credit) {
    return coverText("studio.cover.dynamic.generate", { count: credit });
  }

  function setActiveQuality(root, quality, options = {}) {
    if (!root) return;

    const normalizedQuality =
      String(quality || "artist").toLowerCase() === "ultra" ? "ultra" : "artist";

    qsa(".quality-pill", root).forEach((button) => {
      const active = (button.getAttribute("data-quality") || "") === normalizedQuality;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    root.dataset.coverQuality = normalizedQuality;

    const activeButton = root.querySelector(
      `.quality-pill[data-quality="${CSS.escape(normalizedQuality)}"]`
    );

    const credit =
      Number(
        activeButton?.getAttribute("data-credit-cost") ||
        (normalizedQuality === "ultra" ? 9 : 6)
      ) || (normalizedQuality === "ultra" ? 9 : 6);

    const requiredCredit =
      root.querySelector("#coverRequiredCredit") ||
      root.querySelector(".advanced-credit strong");

    if (requiredCredit) requiredCredit.textContent = String(credit);

    const generateButton = qs("#coverGenerateBtn", root);
    if (generateButton && generateButton.getAttribute("aria-busy") !== "true") {
      generateButton.setAttribute("data-credit-cost", String(credit));
      generateButton.textContent = generateButtonText(credit);
    }

    syncCoverAssistantState({
      lastAction: options.lastAction || "quality_change",
      selectedQuality: normalizedQuality,
      creditCost: credit,
      visibleError: ""
    });
  }

  function applyCoverPromptExample() {
    const root = getRoot();
    if (!root) return;

    const promptEl = qs("#coverPrompt", root);
    if (!promptEl) return;

    promptEl.placeholder = coverText("studio.cover.dynamic.promptExample");
  }

  function refreshSelectedStylePrompt() {
    const root = getRoot();
    if (!root) return;

    const selectedCard = root.querySelector('.style-card[aria-pressed="true"]');
    const promptEl = qs("#coverPrompt", root);
    if (!selectedCard || !promptEl) return;

    const trPrompt = String(selectedCard.getAttribute("data-prompt-tr") || "").trim();
    const enPrompt = String(selectedCard.getAttribute("data-prompt-en") || "").trim();
    const currentValue = String(promptEl.value || "").trim();

    if (!currentValue || currentValue === trPrompt || currentValue === enPrompt) {
      const translatedPrompt = getStylePrompt(selectedCard);
      if (translatedPrompt) {
        promptEl.value = translatedPrompt;
        promptEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  }

  function refreshCoverLanguage() {
    registerCoverDictionary();

    const root = getRoot();
    if (!root) return;

    applyCoverPromptExample();
    refreshSelectedStylePrompt();

    const quality = root.dataset.coverQuality || "artist";
    setActiveQuality(root, quality, { lastAction: "language_change" });

    const policyNote = root.querySelector("#coverPolicyNote");
    if (policyNote && policyNote.style.display !== "none") {
      renderPolicyNote(policyNote);
    }

    try {
      window.AIVO_STUDIO_I18N?.apply?.(root);
    } catch (_) {}
  }

  /* =========================================================
     API
     ========================================================= */

  async function postJSON(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw data?.error || `cover_failed_${response.status}`;
    if (data.ok === false) throw data.error || "cover_failed";
    return data;
  }

  /* =========================================================
     POLICY TERMS
     ========================================================= */

  function lines(value) {
    return String(value || "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const PUBLIC_FIGURE_TERMS = lines(`
recep tayyip erdogan
recep tayyip erdoğan
erdogan
erdoğan
kemal kilicdaroglu
kemal kılıçdaroğlu
kilicdaroglu
kılıçdaroğlu
ekrem imamoglu
ekrem imamoğlu
imamoglu
imamoğlu
mansur yavas
mansur yavaş
devlet bahceli
devlet bahçeli
bahceli
bahçeli
meral aksener
meral akşener
aksener
akşener
ozgur ozel
özgür özel
ozel
özel
selahattin demirtas
selahattin demirtaş
demirtas
demirtaş
umit ozdag
ümit özdağ
ozdag
özdağ
fatih erbakan
temel karamollaoglu
temel karamollaoğlu
muharrem ince
sinan ogan
sinan oğan
ali babacan
ahmet davutoglu
ahmet davutoğlu
davutoglu
davutoğlu
hulusi akar
hakan fidan
mehmet simsek
mehmet şimşek
simsek
şimşek
suleyman soylu
süleyman soylu
soylu
bekir bozdag
bekir bozdağ
bozdag
bozdağ
numan kurtulmus
numan kurtulmuş
kurtulmus
kurtulmuş
omer celik
ömer çelik
celik
çelik
binali yildirim
binali yıldırım
abdullah gul
abdullah gül
gul
gül
ahmet necdet sezer
turgut ozal
turgut özal
ismet inonu
ismet inönü
inonu
inönü
mustafa kemal ataturk
mustafa kemal atatürk
ataturk
atatürk
kemal ataturk
cumhurbaskani
cumhurbaşkanı
cumhurbaskani yardimcisi
cumhurbaşkanı yardımcısı
bakan
milletvekili
belediye baskani
belediye başkanı
vali
kaymakam
siyasetci
siyasetçi
politikaci
politikacı
kamu figuru
kamu figürü
devlet buyugu
devlet büyüğü
donald trump
trump
jd vance
j d vance
vance
keir starmer
starmer
emmanuel macron
macron
friedrich merz
merz
frank walter steinmeier
frank-walter steinmeier
steinmeier
giorgia meloni
meloni
sergio mattarella
mattarella
pedro sanchez
pedro sánchez
sanchez
sánchez
felipe vi
mark carney
carney
claudia sheinbaum
sheinbaum
javier milei
milei
luiz inacio lula da silva
luiz inácio lula da silva
lula
lula da silva
vladimir putin
putin
mikhail mishustin
mishustin
volodymyr zelenskyy
zelenskyy
zelensky
yulia svyrydenko
svyrydenko
xi jinping
jinping
li qiang
narendra modi
modi
droupadi murmu
murmu
benjamin netanyahu
netanyahu
isaac herzog
herzog
masoud pezeshkian
pezeshkian
mojtaba khamenei
khamenei
mohammed bin salman
muhammed bin salman
mbs
salman
king salman
sheikh mohamed bin zayed al nahyan
mohamed bin zayed
mbz
sheikh mohammed bin rashid al maktoum
mohammed bin rashid
bin rashid
abdullah ii
king abdullah
jafar hassan
abdel fattah el sisi
abdel fattah al sisi
sisi
mostafa madbouly
madbouly
abiy ahmed
abiy
william ruto
ruto
paul kagame
kagame
samia suluhu hassan
samia suluhu
samia
cyril ramaphosa
ramaphosa
bola tinubu
tinubu
bassirou diomaye faye
diomaye faye
ousmane sonko
sonko
john mahama
mahama
netumbo nandi ndaitwah
netumbo nandi-ndaitwah
nandi ndaitwah
hassan sheikh mohamud
hassan sheikh
hamza abdi barre
kais saied
kais saïed
saied
saïed
mohamed muizzu
muizzu
anwar ibrahim
anwar
prabowo subianto
prabowo
lawrence wong
wong
tharman shanmugaratnam
tharman
lee jae myung
lee jae-myung
shigeru ishiba
ishiba
naruhito
anura kumara dissanayake
dissanayake
paetongtarn shinawatra
shinawatra
maha vajiralongkorn
to lam
tô lâm
luong cuong
lương cường
pham minh chinh
phạm minh chính
hun manet
hun sen
norodom sihamoni
thongloun sisoulith
sisoulith
sonexay siphandone
shehbaz sharif
sharif
asif ali zardari
zardari
muhammad yunus
yunus
kassym jomart tokayev
kassym-jomart tokayev
tokayev
shavkat mirziyoyev
mirziyoyev
sadyr japarov
japarov
emomali rahmon
rahmon
nikol pashinyan
pashinyan
ilham aliyev
aliyev
irakli kobakhidze
kobakhidze
mikheil kavelashvili
kavelashvili
maia sandu
sandu
aleksandar vucic
aleksandar vučić
vucic
vučić
robert fico
fico
peter pellegrini
pellegrini
andrej plenkovic
andrej plenković
plenkovic
plenković
petr pavel
pavel
donald tusk
tusk
andrzej duda
duda
viktor orban
viktor orbán
orban
orbán
nicusor dan
nicușor dan
ilie bolojan
bolojan
boyko borisov
borisov
rumen radev
radev
kyriakos mitsotakis
mitsotakis
edi rama
rama
zoran milanovic
zoran milanović
milanovic
milanović
andrej babis
andrej babiš
babis
babiš
micheal martin
martin
rodrigo chaves
chaves
gustavo petro
petro
daniel noboa
noboa
nayib bukele
bukele
bernardo arevalo
bernardo arévalo
arevalo
arévalo
xiomara castro
castro
daniel ortega
ortega
rosario murillo
murillo
laurentino cortizo
cortizo
jose raul mulino
josé raúl mulino
mulino
luis abinader
abinader
irfaan ali
ali
chan santokhi
santokhi
nicolas maduro
nicolás maduro
maduro
yamandu orsi
yamandú orsi
orsi
prime minister
president
king
queen
chancellor
taoiseach
premier
head of state
head of government
basbakan
başbakan
  `);

  const ARTIST_NAME_TERMS = lines(`
tarkan
sezen aksu
ajda pekkan
sertab erener
mustafa sandal
kenan dogulu
kenan doğulu
hande yener
demet akalin
demet akalın
gulsen
gülşen
hadise
aleyna tilki
edis
murat boz
simge
simge sagin
simge sağın
sila
sıla
mabel matiz
yildiz tilbe
yıldız tilbe
sibel can
linet
duman
mor ve otesi
mor ve ötesi
teoman
oguzhan koc
oğuzhan koç
cem adrian
haluk levent
baris manco
barış manço
athena
manga
sagopa kajmer
ceza
ezhel
ben fero
gazapizm
uzi
cakal
çakal
semicenk
motive
khontkar
norm ender
selda bagcan
selda bağcan
muslum gurses
müslüm gürses
ibrahim tatlises
ibrahim tatlıses
orhan gencebay
ferdi tayfur
volkan konak
candan ercetin
nazan oncel
nazan öncel
buray
irem derici
melek mosso
madrigal
dedubluman
yalin
yalın
emre aydin
emre aydın
sefo
sertab
  `);

  function normalizePolicyText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/ı/g, "i")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const GENERIC_PUBLIC_FIGURE_TERMS = new Set(
    lines(`
cumhurbaskani
cumhurbaşkanı
cumhurbaskani yardimcisi
cumhurbaşkanı yardımcısı
reisicumhur
bakan
milletvekili
belediye baskani
belediye başkanı
vali
kaymakam
siyasetci
siyasetçi
politikaci
politikacı
kamu figuru
kamu figürü
devlet buyugu
devlet büyüğü
basbakan
başbakan
unlu
ünlü
famous
celebrity
president
politician
prime minister
king
queen
chancellor
taoiseach
premier
head of state
head of government
leader
lider
    `).map(normalizePolicyText)
  );

  const AMBIGUOUS_PUBLIC_FIGURE_TERMS = new Set(
    lines(`
ozel
özel
gul
gül
celik
çelik
soylu
simsek
şimşek
akar
ince
yavas
yavaş
ali
salman
samia
anwar
yunus
pavel
martin
sisi
abiy
    `).map(normalizePolicyText)
  );

  const AMBIGUOUS_ARTIST_TERMS = new Set(
    lines(`
hadise
simge
sila
sıla
duman
manga
athena
ceza
motive
cakal
çakal
yalin
yalın
buray
linet
madrigal
uzi
sefo
edis
sertab
    `).map(normalizePolicyText)
  );

  const ARTIST_CONTEXT_TERMS = lines(`
sanatci
sanatçı
sarkici
şarkıcı
rapci
rapçi
muzisyen
müzisyen
artist
singer
rapper
grup
grubu
grubunun
muzik grubu
müzik grubu
band
tarzinda
tarzında
stilinde
sesiyle
sesinde
sesini
vokalinde
vokalini
soundunda
sarkisi
şarkısı
sarkisini
şarkısını
album
albumu
albümü
albumunun
albümünün
kapagi
kapağı
konseri
in the style of
voice of
sound of
album cover
  `).map(normalizePolicyText);

  function buildCoverPolicyPhraseRegex(term) {
    const normalized = normalizePolicyText(term);
    if (!normalized) return null;

    const pattern = normalized
      .split(" ")
      .filter(Boolean)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s+");

    return new RegExp(`(^|\\s)${pattern}(?=\\s|$)`, "i");
  }

  function containsCoverPolicyPhrase(normalizedText, term) {
    const expression = buildCoverPolicyPhraseRegex(term);
    return expression ? expression.test(normalizedText) : false;
  }

  function hasCoverArtistContext(normalizedText, artistTerm) {
    const artist = normalizePolicyText(artistTerm);
    if (!normalizedText || !artist) return false;

    const words = normalizedText.split(" ").filter(Boolean);
    const artistWords = artist.split(" ").filter(Boolean);
    if (!words.length || !artistWords.length) return false;

    for (let index = 0; index <= words.length - artistWords.length; index += 1) {
      const candidate = words.slice(index, index + artistWords.length).join(" ");
      if (candidate !== artist) continue;

      const contextWindow = words
        .slice(
          Math.max(0, index - 6),
          Math.min(words.length, index + artistWords.length + 6)
        )
        .join(" ");

      return ARTIST_CONTEXT_TERMS.some((contextTerm) =>
        containsCoverPolicyPhrase(contextWindow, contextTerm)
      );
    }

    return false;
  }

  function isCoverPolicyBlocked(raw) {
    const text = normalizePolicyText(raw);
    if (!text) return false;

    const hasPublicFigureName = PUBLIC_FIGURE_TERMS.some((term) => {
      const normalizedTerm = normalizePolicyText(term);
      if (!normalizedTerm) return false;
      if (GENERIC_PUBLIC_FIGURE_TERMS.has(normalizedTerm)) return false;

      const wordCount = normalizedTerm.split(" ").filter(Boolean).length;
      if (
        wordCount === 1 &&
        AMBIGUOUS_PUBLIC_FIGURE_TERMS.has(normalizedTerm)
      ) {
        return false;
      }

      return containsCoverPolicyPhrase(text, normalizedTerm);
    });

const hasArtistName = ARTIST_NAME_TERMS.some((term) => {
  const normalizedTerm = normalizePolicyText(term);

  if (
    !normalizedTerm ||
    !containsCoverPolicyPhrase(text, normalizedTerm)
  ) {
    return false;
  }

  const wordCount =
    normalizedTerm
      .split(" ")
      .filter(Boolean)
      .length;

  if (wordCount >= 2) {
    return true;
  }

  if (
    !AMBIGUOUS_ARTIST_TERMS.has(normalizedTerm)
  ) {
    return true;
  }

  /*
    "manga" aynı zamanda bir görsel sanat türüdür.

    "Japanese manga style" ve "anime manga style"
    gibi görsel tarifleri maNga müzik grubu sanıp
    engellememeliyiz.

    Yalnızca açıkça müzik grubu/sanatçı bağlamında
    kullanıldığında engellenir.
  */
  if (normalizedTerm === "manga") {
    const explicitMangaArtistPhrases = [
      "manga grubu",
      "manga muzik grubu",
      "manga band",
      "band manga",
      "manga artist",
      "manga sanatci",
      "manga album cover",
      "manga albumu",
      "manga sarkisi"
    ].map(normalizePolicyText);

    return explicitMangaArtistPhrases.some(
      (phrase) =>
        containsCoverPolicyPhrase(
          text,
          phrase
        )
    );
  }

  return hasCoverArtistContext(
    text,
    normalizedTerm
  );
});

    return hasPublicFigureName || hasArtistName;
  }

  /* =========================================================
     POLICY UI
     ========================================================= */

  function ensurePolicyAnimationStyle() {
    if (document.getElementById("aivoPolicyPulseStyle")) return;

    const style = document.createElement("style");
    style.id = "aivoPolicyPulseStyle";
    style.textContent = `
      @keyframes aivoPolicyPulse {
        0% {
          box-shadow: inset 0 1px 0 rgba(255,255,255,.04),
            0 0 0 1px rgba(255,120,150,.18),
            0 8px 24px rgba(255,70,110,.10);
        }
        50% {
          box-shadow: inset 0 1px 0 rgba(255,255,255,.05),
            0 0 0 1px rgba(255,120,150,.30),
            0 12px 34px rgba(255,70,110,.18);
        }
        100% {
          box-shadow: inset 0 1px 0 rgba(255,255,255,.04),
            0 0 0 1px rgba(255,120,150,.18),
            0 8px 24px rgba(255,70,110,.10);
        }
      }

      @keyframes aivoPolicyTextGlow {
        0% {
          opacity: .88;
          text-shadow: 0 0 8px rgba(255,255,255,.08),
            0 0 18px rgba(255,120,150,.12);
        }
        50% {
          opacity: 1;
          text-shadow: 0 0 14px rgba(255,255,255,.16),
            0 0 28px rgba(255,120,150,.24);
        }
        100% {
          opacity: .88;
          text-shadow: 0 0 8px rgba(255,255,255,.08),
            0 0 18px rgba(255,120,150,.12);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureCoverPolicyNote(generateButton) {
    const root = getRoot();
    if (!root || !generateButton?.parentElement) return null;

    let policyNote = root.querySelector("#coverPolicyNote");
    if (!policyNote) {
      policyNote = document.createElement("div");
      policyNote.id = "coverPolicyNote";
      Object.assign(policyNote.style, {
        display: "none",
        marginTop: "12px",
        padding: "14px 16px",
        borderRadius: "18px",
        background: "rgba(255,90,120,.10)",
        border: "1px solid rgba(255,120,150,.24)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
        backdropFilter: "blur(10px)",
        webkitBackdropFilter: "blur(10px)",
        textAlign: "center",
        fontSize: "14px",
        fontWeight: "800",
        lineHeight: "1.65",
        letterSpacing: ".01em",
        color: "rgba(255,245,248,.96)"
      });
      generateButton.parentElement.appendChild(policyNote);
    }

    return policyNote;
  }

  function renderPolicyNote(policyNote) {
    if (!policyNote) return;
    const message = coverText("studio.cover.dynamic.policyBlocked");

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
        text-shadow:0 0 10px rgba(255,255,255,.10),
          0 0 22px rgba(255,120,150,.18);
        animation:aivoPolicyTextGlow 1.8s ease-in-out infinite;
      "></span>
    `;

    const span = policyNote.querySelector("span");
    if (span) span.textContent = message;
  }

  function resetCoverPolicyUI(root, promptEl, generateButton) {
    const policyNote = root?.querySelector("#coverPolicyNote");

    if (promptEl) {
      promptEl.style.borderColor = "";
      promptEl.style.boxShadow = "";
      promptEl.style.animation = "";
    }

    if (generateButton) {
      generateButton.style.background = "";
      generateButton.style.borderColor = "";
      generateButton.style.boxShadow = "";
      generateButton.style.cursor = "";
      generateButton.style.filter = "";
      generateButton.style.animation = "";
    }

    if (policyNote) {
      policyNote.style.display = "none";
      policyNote.textContent = "";
    }
  }

  function showBlockedPolicyUI(root, promptEl, generateButton) {
    const policyNote = ensureCoverPolicyNote(generateButton);

    if (promptEl) {
      promptEl.style.borderColor = "rgba(255,110,140,.92)";
      promptEl.style.boxShadow =
        "0 0 0 1px rgba(255,110,140,.28), 0 10px 28px rgba(255,70,110,.10)";
      promptEl.style.animation = "aivoPolicyPulse 1.8s ease-in-out infinite";
    }

    Object.assign(generateButton.style, {
      background:
        "linear-gradient(135deg, rgba(255,93,143,.92), rgba(255,62,62,.92))",
      borderColor: "rgba(255,110,140,.95)",
      boxShadow:
        "0 10px 30px rgba(255,80,120,.22), inset 0 1px 0 rgba(255,255,255,.18)",
      cursor: "not-allowed",
      filter: "saturate(1.05)",
      animation: "aivoPolicyPulse 1.8s ease-in-out infinite"
    });

    if (policyNote) {
      policyNote.style.display = "block";
      renderPolicyNote(policyNote);
    }

    const policyMessage = coverText("studio.cover.dynamic.policyBlocked");
    syncCoverAssistantState({
      lastAction: "policy_blocked",
      policyState: "block",
      generationState: "failed",
      dbSaved: false,
      lastImageUrl: "",
      lastJobId: "",
      visibleError: "policy_blocked",
      visiblePolicyNote: readCoverPolicyNote(root) || policyMessage
    });
  }

  function bindCoverPolicyReset() {
    const root = getRoot();
    if (!root) return;

    const promptEl = qs("#coverPrompt", root);
    const generateButton = qs("#coverGenerateBtn", root);
    if (!promptEl || !generateButton || promptEl.__aivoCoverPolicyResetBound) return;

    promptEl.__aivoCoverPolicyResetBound = true;

    const reset = (action) => {
      resetCoverPolicyUI(root, promptEl, generateButton);
      syncCoverAssistantState({
        lastAction: action,
        policyState: "allow",
        generationState: "idle",
        visibleError: ""
      });
    };

    promptEl.addEventListener("input", () => reset("prompt_input"));
    promptEl.addEventListener("change", () => reset("prompt_change"));
  }

  /* =========================================================
     MODEL PROMPT
     ========================================================= */

  function withTitleSafeArea(prompt) {
    const raw = String(prompt || "").trim();

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
      "no random characters"
    ].join(", ");
  }

  function buildCoverPrompt(prompt, quality) {
    const raw = String(prompt || "").trim();
    const normalizedQuality = String(quality || "artist").toLowerCase();

    if (!raw) return withTitleSafeArea("");

    const safeBase = withTitleSafeArea(raw);
    if (normalizedQuality !== "ultra") return safeBase;

    const shortPrompt = raw.length <= 40 && !/[,.]/.test(raw);
    const multiSubject =
      /\b(ve|ile|izleyen|bakan|karşı|arasında|yanında|üstünde|altında|içinde|kavga eden|koşan|uçan|duran|and|with|watching|facing|between|beside|above|below|inside|fighting|running|flying|standing)\b/i.test(
        raw
      );

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

  /* =========================================================
     GENERATION
     ========================================================= */

  async function generateImages({ prompt, style, ratio, n, quality }) {
    const tasks = [];

    for (let index = 0; index < n; index += 1) {
      const promptVariant = n > 1 ? `${prompt} #${index + 1}` : prompt;
      const modelPrompt = buildCoverPrompt(promptVariant, quality);

      console.log("[cover] promptForModel", {
        quality,
        promptVar: promptVariant,
        promptForModel: modelPrompt
      });

      tasks.push(
        postJSON("/api/providers/fal/predictions/create?app=cover", {
          input: {
            prompt: modelPrompt,
            quality,
            ratio
          }
        }).then((data) => ({
          url:
            data.output ||
            data.imageUrl ||
            data.image_url ||
            data.url ||
            data.fal?.images?.[0]?.url ||
            null,
          prompt: promptVariant,
          raw: data
        }))
      );
    }

    const results = await Promise.all(tasks);
    if (!results.some((item) => item.url)) {
      console.error("[cover] no image url from fal response", results);
      throw new Error("cover_generate_no_image");
    }

    return results;
  }

  async function createCover() {
    const root = getRoot();
    if (!root) return;

    const prompt = String(qs("#coverPrompt", root)?.value || "").trim();
    if (!prompt) {
      toastError(coverText("studio.cover.dynamic.promptRequired"));
      return;
    }

    const style = root.dataset.coverStyle || null;
    const quality = root.dataset.coverQuality || "artist";
    const count = Number(qs("#coverCount", root)?.value || 1);
    const ratio = qs("#coverRatio", root)?.value || "1:1";

    console.log("[cover] generate request", {
      prompt,
      style,
      quality,
      n: count,
      ratio
    });

    const images = await generateImages({
      prompt,
      style,
      ratio,
      n: count,
      quality
    });

    for (const image of images) {
      const originalImageUrl = image.url;
      let displayImageUrl = image.url;

      if (shouldApplyCoverTextOverlay()) {
        const overlay = await applyCoverTextOverlay(image.url);
        if (overlay?.finalUrl) displayImageUrl = overlay.finalUrl;
      }

      try {
        const saved = await postJSON("/api/cover/generate", {
          prompt: image.prompt || prompt,
          style,
          quality,
          ratio,
          imageUrl: originalImageUrl
        });

        console.log("[cover] db saved ✅", saved);

        if (saved?.job_id) {
          syncCoverAssistantState({
            lastAction: "db_saved",
            generationState: "ready",
            dbSaved: true,
            lastImageUrl: displayImageUrl || originalImageUrl || "",
            lastJobId: String(saved.job_id || ""),
            visibleError: "",
            visiblePolicyNote: readCoverPolicyNote(root)
          });

          window.dispatchEvent(
            new CustomEvent("aivo:cover:job_created", {
              detail: {
                app: "cover",
                job_id: saved.job_id,
                prompt: image.prompt || prompt,
                quality,
                style,
                ratio,
                imageUrl: displayImageUrl,
                createdAt: Date.now(),
                meta: {
                  app: "cover",
                  prompt: image.prompt || prompt,
                  quality,
                  style,
                  ratio,
                  originalImageUrl
                }
              }
            })
          );
        }
      } catch (error) {
        console.error("[cover] db write failed", error);
      }
    }

    toastSuccess(coverText("studio.cover.dynamic.ready"));
  }

  /* =========================================================
     CREDIT HELPERS
     ========================================================= */

  async function syncCreditsFromServer() {
    try {
      const response = await fetch("/api/credits/get", {
        credentials: "include",
        cache: "no-store",
        headers: { accept: "application/json" }
      });

      const data = await response.json().catch(() => null);
      if (!data?.ok || typeof data.credits !== "number") return;

      const topCreditCount = document.getElementById("topCreditCount");
      if (topCreditCount) topCreditCount.textContent = String(data.credits);

      if (
        window.AIVO_STORE_V1 &&
        typeof window.AIVO_STORE_V1.setCredits === "function"
      ) {
        window.AIVO_STORE_V1.setCredits(data.credits);
      }
    } catch (_) {}

    try {
      window.syncCreditsUI?.({ force: true });
    } catch (_) {}
  }

  async function runCoverGeneration(root, generateButton) {
    if (
      coverGenerationBusy ||
      generateButton.getAttribute("aria-busy") === "true"
    ) {
      return;
    }

    coverGenerationBusy = true;

    const previousText = generateButton.textContent;

    // Lock the button immediately. Credit validation can take a moment;
    // without this lock, repeated clicks can start multiple generations.
    generateButton.disabled = true;
    generateButton.setAttribute("aria-busy", "true");
    generateButton.textContent = coverText("studio.cover.dynamic.generating");
    generateButton.classList.add("is-loading");

    let consumed = false;
    let consumeTransactionId = null;

    const quality = root.dataset.coverQuality === "ultra" ? "ultra" : "artist";
    const creditCost =
      Number(generateButton.getAttribute("data-credit-cost") || (quality === "ultra" ? 9 : 6)) ||
      (quality === "ultra" ? 9 : 6);

    const creditReason =
      quality === "ultra"
        ? "studio_cover_generate_ultra"
        : "studio_cover_generate_artist";

    const consumeRequestId =
      `cover:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

    async function tryRefund(reason, extraMeta = {}) {
      if (!consumed || !consumeTransactionId || creditCost <= 0) return false;

      try {
        const response = await fetch("/api/credits/refund", {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            accept: "application/json"
          },
          body: JSON.stringify({
            app: "cover",
            action: creditReason,
            amount: creditCost,
            request_id: consumeRequestId,
            related_transaction_id: consumeTransactionId,
            reason,
            meta: {
              source: "cover.module.create",
              quality,
              ratio: qs("#coverRatio", root)?.value || "1:1",
              ...extraMeta
            }
          })
        });

        const data = await response.json().catch(() => null);
        const accepted =
          response.ok &&
          data?.ok &&
          Boolean(data.refunded || data.deduped || data.skipped);

        if (!accepted) return false;

        await syncCreditsFromServer();

        if (data.refunded) {
          toastError(coverText("studio.cover.dynamic.refunded"));
        }

        return true;
      } catch (error) {
        console.error("[cover] refund failed:", error);
        return false;
      }
    }

    try {
      const creditResponse = await fetch("/api/credits/consume-ledger", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify({
          app: "cover",
          action: creditReason,
          cost: creditCost,
          request_id: consumeRequestId,
          reason: creditReason
        })
      });

      let creditData = null;
      try {
        creditData = await creditResponse.json();
      } catch (_) {
        creditData = {
          ok: false,
          error: "non_json_response",
          status: creditResponse.status
        };
      }

      if (!creditResponse.ok || !creditData?.ok) {
        generateButton.disabled = true;
        generateButton.textContent = coverText(
          "studio.cover.dynamic.insufficientCredit"
        );
        generateButton.classList.remove("is-loading");

        syncCoverAssistantState({
          lastAction: "credit_insufficient",
          generationState: "failed",
          dbSaved: false,
          lastImageUrl: "",
          lastJobId: "",
          visibleError: "insufficient_credit",
          visiblePolicyNote: readCoverPolicyNote(root)
        });

        const destination = encodeURIComponent(
          location.pathname + location.search + location.hash
        );
        location.href =
          "/fiyatlandirma.html?from=studio&reason=insufficient_credit&to=" +
          destination;
        return;
      }

      consumed = true;
      consumeTransactionId =
        creditData.transaction_id || creditData.transaction?.id || null;

      syncCoverAssistantState({
        lastAction: "credit_consumed",
        policyState: "allow",
        generationState: "processing",
        creditCost,
        visibleError: "",
        visiblePolicyNote: readCoverPolicyNote(root)
      });

      generateButton.disabled = true;
      generateButton.setAttribute("aria-busy", "true");
      generateButton.textContent = coverText("studio.cover.dynamic.generating");
      generateButton.classList.add("is-loading");

      await syncCreditsFromServer();

      toastSuccess(
        coverText("studio.cover.dynamic.creditDeducted", { count: creditCost })
      );
      toastSuccess(coverText("studio.cover.dynamic.generationStarted"));

      await createCover();
    } catch (error) {
      console.error("[cover] createCover error:", error);

      const refunded = await tryRefund("cover_create_failed", {
        error: String(error?.message || error || "failed")
      });

      syncCoverAssistantState({
        lastAction: refunded ? "create_failed_refunded" : "create_failed",
        generationState: "failed",
        dbSaved: false,
        lastImageUrl: "",
        lastJobId: "",
        visibleError: String(error?.message || error || "cover_create_failed"),
        visiblePolicyNote: readCoverPolicyNote(root)
      });

      if (!refunded) {
        toastError(coverText("studio.cover.dynamic.failed"));
      }
    } finally {
      coverGenerationBusy = false;
      generateButton.disabled = false;
      generateButton.removeAttribute("aria-busy");
      generateButton.classList.remove("is-loading");

      const activeCredit =
        Number(generateButton.getAttribute("data-credit-cost")) || creditCost;
      generateButton.textContent = generateButtonText(activeCredit) || previousText;
    }
  }

  /* =========================================================
     COUNTER / BINDING
     ========================================================= */

  function bindPromptCounter() {
    const root = getRoot();
    if (!root) return;

    const promptEl = qs("#coverPrompt", root);
    if (!promptEl || promptEl.__countBound) return;

    const counterEl =
      qs("#coverPromptCount", root) ||
      qs('[data-role="coverPromptCount"]', root) ||
      Array.from(root.querySelectorAll("*")).find(
        (element) => (element.textContent || "").trim() === "0 / 1000"
      );

    if (!counterEl) return;

    promptEl.__countBound = true;

    const update = () => {
      counterEl.textContent = `${String(promptEl.value || "").length} / 1000`;
    };

    promptEl.addEventListener("input", update);
    promptEl.addEventListener("change", update);
    update();
  }

  function ensureDefaultCoverState() {
    const root = getRoot();
    if (!root) return;

    if (!root.querySelector('.quality-pill[aria-pressed="true"]')) {
      setActiveQuality(root, "artist", { lastAction: "default_quality" });
    } else {
      setActiveQuality(root, root.dataset.coverQuality || "artist", {
        lastAction: "quality_sync"
      });
    }

    const selectedStyle = root.querySelector('.style-card[aria-pressed="true"]');
    if (!selectedStyle) {
      const firstStyle = qs(".style-card[data-style]", root);
      if (firstStyle) {
        setActiveStyle(root, firstStyle.getAttribute("data-style"), {
          writePrompt: false,
          lastAction: "default_style"
        });
      }
    }
  }

  document.addEventListener(
    "click",
    (event) => {
      const root = getRoot();
      if (!root) return;

      const qualityButton = event.target.closest(".quality-pill");
      if (qualityButton && root.contains(qualityButton)) {
        event.preventDefault();
        const quality = qualityButton.getAttribute("data-quality") || "artist";
        setActiveQuality(root, quality);
        toastSuccess(
          coverText(
            quality === "ultra"
              ? "studio.cover.dynamic.ultraSelected"
              : "studio.cover.dynamic.artistSelected"
          )
        );
        return;
      }

      const styleButton = event.target.closest(".style-pill, .style-card");
      if (styleButton && root.contains(styleButton)) {
        event.preventDefault();
        const style = styleButton.getAttribute("data-style");
        if (style) setActiveStyle(root, style);
        return;
      }

      const generateButton = event.target.closest("#coverGenerateBtn");
      if (!generateButton || !root.contains(generateButton)) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }

      if (
        coverGenerationBusy ||
        generateButton.getAttribute("aria-busy") === "true"
      ) {
        return;
      }

      const promptEl = qs("#coverPrompt", root);
      const rawPrompt = String(promptEl?.value || "").trim();
      resetCoverPolicyUI(root, promptEl, generateButton);

      if (!rawPrompt) {
        event.stopPropagation();
        toastError(coverText("studio.cover.dynamic.promptRequired"));
        return;
      }

      if (isCoverPolicyBlocked(rawPrompt)) {
        event.stopPropagation();
        showBlockedPolicyUI(root, promptEl, generateButton);
        return;
      }

      syncCoverAssistantState({
        lastAction: "generate_click",
        policyState: "allow",
        generationState: "processing",
        dbSaved: false,
        lastImageUrl: "",
        lastJobId: "",
        visibleError: "",
        visiblePolicyNote: readCoverPolicyNote(root)
      });

      void runCoverGeneration(root, generateButton);
    },
    true
  );

  /* =========================================================
     LANGUAGE / MODULE EVENTS
     ========================================================= */

  document.addEventListener("aivo:language-change", () => {
    requestAnimationFrame(refreshCoverLanguage);
  });

  document.addEventListener("aivo:studio:i18n-applied", () => {
    requestAnimationFrame(refreshCoverLanguage);
  });

  document.addEventListener("aivo:module:loaded", () => {
    requestAnimationFrame(bootCoverUI);
  });

  document.addEventListener("aivo:studio:module-loaded", () => {
    requestAnimationFrame(bootCoverUI);
  });

  function bootCoverUI() {
    const root = getRoot();
    if (!root) return;

    registerCoverDictionary();
    applyCoverPromptExample();
    bindPromptCounter();
    bindCoverPolicyReset();
    ensureDefaultCoverState();
    refreshCoverLanguage();
  }

  registerCoverDictionary();
  ensurePolicyAnimationStyle();
  bootCoverUI();

  const observer = new MutationObserver((mutations) => {
    const coverAdded = mutations.some((mutation) =>
      Array.from(mutation.addedNodes || []).some((node) => {
        if (!node || node.nodeType !== 1) return false;
        if (node.matches?.('section.main-panel[data-module="cover"]')) return true;
        return Boolean(
          node.querySelector?.('section.main-panel[data-module="cover"]')
        );
      })
    );

    if (coverAdded) requestAnimationFrame(bootCoverUI);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  console.log("[COVER] module READY (TR/EN + style + quality + FAL create)");
})();
