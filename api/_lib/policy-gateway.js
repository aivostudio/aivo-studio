const ARTISTS_TR_SEED = require('./policy-data/artists-tr.seed.json');
const PUBLIC_FIGURES_TR_SEED = require('./policy-data/public_figures_tr.seed.json');

const PUBLIC_FIGURE_TERMS = Array.from(
  new Set([
    ...PUBLIC_FIGURES_TR_SEED,
    'cumhurbaskani',
    'cumhurbaşkanı',
    'reisicumhur',
    'bakan',
    'milletvekili',
    'siyasetci',
    'siyasetçi',
    'belediye baskani',
    'belediye başkanı',
    'vali',
    'kaymakam',
    'devlet buyugu',
    'devlet büyüğü',
    'kamu figuru',
    'kamu figürü',
    'politikaci',
    'politikacı',
    'unlu',
    'ünlü',
    'famous',
    'celebrity',
    'president',
    'politician',
  ])
);

const ARTIST_NAME_TERMS = Array.from(new Set([...ARTISTS_TR_SEED]));

const MUSIC_STYLE_TERMS = [
  'gibi',
  'tarzinda',
  'tarzında',
  'stilinde',
  'soundunda',
  'sound',
  'vocalinde',
  'vokalinde',
  'sesiyle',
  'voice',
  'aynisi',
  'aynısı',
  'birebir',
  'benziyor',
  'benzer',
  'same as',
  'in the style of',
  'like',
];

const DEEPFAKE_TERMS = [
  'deepfake',
  'yuzunu koy',
  'yüzünü koy',
  'agzini oynat',
  'ağzını oynat',
  'dudak senkronu',
  'lip sync',
  'voice clone',
  'ses klonu',
  'sesini kopyala',
  'soyluyormus gibi',
  'söylüyormuş gibi',
  'demis gibi',
  'demiş gibi',
  'yapmis gibi',
  'yapmış gibi',
  'fake video',
  'sahte video',
  'sahte konusma',
  'sahte konuşma',
];

const DEFAMATION_TERMS = [
  'rezil',
  'aptal',
  'sahtekar',
  'ahlaksiz',
  'ahlaksız',
  'asalak',
  'salak',
  'gerizekali',
  'gerizekalı',
  'kucuk dusur',
  'küçük düşür',
  'alay et',
  'dalga gec',
  'dalga geç',
  'itibarini boz',
  'itibarını boz',
  'karala',
  'asagila',
  'aşağıla',
  'hakaret',
  'propaganda',
  'manipule et',
  'manipüle et',
];

const PROTECTED_WORK_TERMS = [
  'aynisini yap',
  'aynısını yap',
  'birebir yap',
  'birebir üret',
  'birebir uret',
  'same song',
  'same cover',
  'exact copy',
  'copy this song',
  'copy this melody',
  'copy the melody',
  'copy the chorus',
  'copy the lyrics',
  'bu sarkinin aynisi',
  'bu şarkının aynısı',
  'melodisini kullan',
  'nakaratini kullan',
  'nakaratını kullan',
  'sozlerini kullan',
  'sözlerini kullan',
  'vokalini taklit et',
  'sesini taklit et',
  'sesini kopyala',
  'sesini klonla',
  'voice clone',
  'clone voice',
];

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u00c0-\u017f\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const AMBIGUOUS_SINGLE_WORD_ARTIST_TERMS = new Set(
  [
    'hadise',
    'simge',
    'ozgun',
    'özgün',
    'duman',
    'manga',
    'athena',
    'ceza',
    'motive',
    'contra',
    'cakal',
    'çakal',
    'yalin',
    'yalın',
    'sila',
    'sıla',
    'mabel',
    'fero',
    'buray',
    'linet',
    'bengu',
    'bengü',
  ].map(normalizeText)
);


const VIDEO_GENERIC_PUBLIC_FIGURE_TERMS = new Set(
  [
    'cumhurbaskani',
    'cumhurbaşkanı',
    'cumhurbaskani yardimcisi',
    'cumhurbaşkanı yardımcısı',
    'reisicumhur',
    'bakan',
    'milletvekili',
    'belediye baskani',
    'belediye başkanı',
    'vali',
    'kaymakam',
    'siyasetci',
    'siyasetçi',
    'politikaci',
    'politikacı',
    'kamu figuru',
    'kamu figürü',
    'devlet buyugu',
    'devlet büyüğü',
    'unlu',
    'ünlü',
    'famous',
    'celebrity',
    'president',
    'politician',
    'prime minister',
    'king',
    'queen',
    'chancellor',
    'taoiseach',
    'premier',
    'head of state',
    'head of government',
    'basbakan',
    'başbakan',
  ].map(normalizeText)
);

const VIDEO_DISTINCTIVE_SINGLE_PUBLIC_FIGURE_TERMS = new Set(
  [
    'erdogan',
    'erdoğan',
    'kilicdaroglu',
    'kılıçdaroğlu',
    'imamoglu',
    'imamoğlu',
    'bahceli',
    'bahçeli',
    'aksener',
    'akşener',
    'demirtas',
    'demirtaş',
    'ozdag',
    'özdağ',
    'davutoglu',
    'davutoğlu',
    'ataturk',
    'atatürk',
    'trump',
    'macron',
    'putin',
    'zelensky',
    'zelenskyy',
    'netanyahu',
    'modi',
    'khamenei',
    'maduro',
    'bukele',
    'orban',
    'orbán',
    'milei',
    'lula',
  ].map(normalizeText)
);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildNormalizedPhraseRegex(term) {
  const normalized = normalizeText(term);
  if (!normalized) return null;

  const pattern = normalized
    .split(' ')
    .filter(Boolean)
    .map(escapeRegex)
    .join('\\s+');

  return new RegExp(`(^|\\s)${pattern}(?=\\s|$)`, 'i');
}

function containsAny(text, terms) {
  const haystack = normalizeText(text);

  return terms.some((term) => {
    const rx = buildNormalizedPhraseRegex(term);
    return rx ? rx.test(haystack) : false;
  });
}

function pickMatchedTerms(text, terms, limit = 6) {
  const haystack = normalizeText(text);
  const hits = [];

  for (const term of terms) {
    const rx = buildNormalizedPhraseRegex(term);

    if (rx && rx.test(haystack) && !hits.includes(term)) {
      hits.push(term);
    }

    if (hits.length >= limit) break;
  }

  return hits;
}

function replaceTermsCaseInsensitive(source, terms, replacement) {
  let output = String(source || '');

  for (const term of terms) {
    const clean = String(term || '').trim();
    if (!clean) continue;

    const pattern = clean
      .split(/\s+/)
      .filter(Boolean)
      .map(escapeRegex)
      .join('\\s+');

    const rx = new RegExp(`(^|\\b)${pattern}(?=\\b|$)`, 'gi');

    output = output.replace(
      rx,
      (match, lead) => `${lead}${replacement}`
    );
  }

  return output;
}

function joinInput(fields) {
  return [
    fields.prompt,
    fields.lyrics,
    fields.style,
    fields.referenceArtist,
    fields.personName,
    fields.title,
    fields.description,
  ]
    .filter(Boolean)
    .join(' \n ');
}

/*
 * Müzik politikasında yalnızca prompt taranır.
 * Şarkı sözleri, başlık, mood ve vokal seçimi taranmaz.
 */
function getMusicPolicyText(fields) {
  return String(fields.prompt || '').trim();
}

function buildSafeAlternative(app) {
  if (app === 'music') {
    return 'Sanatçı adı yerine tür, dönem, tempo, duygu, enstrüman ve vokal karakteri gibi genel tanımlar kullan.';
  }

  if (app === 'video') {
    return 'Gerçek kişi yerine kurgu karakter, anonim persona veya genel sahne tanımı kullan.';
  }

  if (
    app === 'cover' ||
    app === 'image' ||
    app === 'cartoon'
  ) {
    return 'Gerçek kişi veya kamu figürü yerine anonim karakter, genel stil ve güvenli sahne tanımı kullan.';
  }

  return 'Belirli kişi, sanatçı veya eser yerine genel tür, duygu, dönem ve anonim karakter tanımları kullan.';
}

function rewritePrompt(app, original) {
  let output = String(original || '');

  output = output.replace(
    /\b([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+){0,3})\s+(gibi|tarzında|tarzinda|stilinde)\b/gi,
    'modern, özgün ve ticari olarak güvenli bir estetikte'
  );

  output = output.replace(
    /\b(in the style of|like)\s+[A-Za-z][A-Za-z\s.'’-]{1,60}\b/gi,
    'with an original, commercially safe style'
  );

  output = output.replace(
    /\b(birebir|aynısı|aynisi|same as|exact copy)\b/gi,
    'özgün'
  );

  if (app === 'music') {
    output = replaceTermsCaseInsensitive(
      output,
      ARTIST_NAME_TERMS,
      'özgün bir sanatçı kimliğiyle'
    );
  }

  if (
    app === 'video' ||
    app === 'cover' ||
    app === 'image' ||
    app === 'cartoon'
  ) {
    output = replaceTermsCaseInsensitive(
      output,
      PUBLIC_FIGURE_TERMS,
      'anonim bir karakter'
    );
  }

  output = output
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();

  if (app === 'music') {
    return (
      output ||
      'Özgün, ticari olarak güvenli, belirli bir sanatçıyı taklit etmeyen müzik üret.'
    );
  }

  if (app === 'video') {
    return (
      output ||
      'Özgün, anonim karakterlerle, gerçek kişiyi taklit etmeyen güvenli video üret.'
    );
  }

  return (
    output ||
    'Özgün, belirli kişiyi veya korunan eseri taklit etmeyen güvenli içerik üret.'
  );
}

function makeResult({
  decision,
  code = 'OK',
  message = '',
  rewrittenPrompt = null,
  reasons = [],
  matchedTerms = [],
  severity = 'low',
}) {
  return {
    ok: decision !== 'block',
    decision,
    code,
    message,
    rewrittenPrompt,
    reasons,
    matchedTerms,
    severity,
  };
}

/*
 * Hadise, Simge, Duman, Ceza, Motive gibi günlük dilde de
 * kullanılabilecek tek kelimelik isimlerde sanatçı bağlamı aranır.
 */
function hasArtistContextForTerm(text, term) {
  const haystack = normalizeText(text);
  const normalizedArtist = normalizeText(term);

  if (!haystack || !normalizedArtist) {
    return false;
  }

  const artistPattern = normalizedArtist
    .split(' ')
    .filter(Boolean)
    .map(escapeRegex)
    .join('\\s+');

  const possessiveSuffix =
    '(?:\\s*(?:nin|nın|nun|nün|in|ın|un|ün))?';

  const contextAfter = [
    'gibi',
    'tarzinda',
    'tarzında',
    'stilinde',
    'soundunda',
    'vokalinde',
    'sesiyle',
    'sesinde',
    'sesini',
    'vokalini',
    'vokali',
    'sarkisi',
    'sarkısı',
    'sarkisini',
    'sarkısını',
    'parcasi',
    'parcası',
    'parcasini',
    'parcasını',
    'tarzi',
    'tarzı',
    'style',
    'voice',
    'sound',
  ].join('|');

  const contextBefore = [
    'sanatci',
    'sarkici',
    'rapci',
    'muzisyen',
    'artist',
    'singer',
    'rapper',
    'like',
    'in\\s+the\\s+style\\s+of',
    'voice\\s+of',
  ].join('|');

  const rx = new RegExp(
    `(?:^|\\s)${artistPattern}${possessiveSuffix}\\s+(?:${contextAfter})(?=\\s|$)` +
      `|(?:^|\\s)(?:${contextBefore})\\s+${artistPattern}(?=\\s|$)`,
    'i'
  );

  return rx.test(haystack);
}

function pickMatchedMusicArtistTerms(text, limit = 8) {
  const haystack = normalizeText(text);
  const hits = [];

  for (const term of ARTIST_NAME_TERMS) {
    const normalizedTerm = normalizeText(term);

    if (!normalizedTerm) {
      continue;
    }

    const rx = buildNormalizedPhraseRegex(normalizedTerm);

    if (!rx || !rx.test(haystack)) {
      continue;
    }

    const wordCount = normalizedTerm
      .split(' ')
      .filter(Boolean)
      .length;

    const ambiguousSingleWord =
      wordCount === 1 &&
      AMBIGUOUS_SINGLE_WORD_ARTIST_TERMS.has(
        normalizedTerm
      );

    const shouldBlock =
      wordCount >= 2 ||
      !ambiguousSingleWord ||
      hasArtistContextForTerm(
        haystack,
        normalizedTerm
      );

    if (
      shouldBlock &&
      !hits.includes(term)
    ) {
      hits.push(term);
    }

    if (hits.length >= limit) {
      break;
    }
  }

  return hits;
}

/*
 * Atmosfer için yanlış pozitif üretmemesi gereken sanatçı eşleşmesi:
 *
 * Hadise, Duman, Ceza, Simge, Özgün, Manga, Motive gibi günlük dilde
 * başka anlamı da bulunan tek kelimelik adlar Atmosfer promptunda hiçbir
 * koşulda isim filtresi oluşturmaz. Böylece "hafif duman", "ceza alanı",
 * "beklenmedik hadise" gibi normal sahne anlatımları engellenmez.
 *
 * Çok kelimeli veya ayırt edici sanatçı adları engellenmeye devam eder.
 */
function pickMatchedUnambiguousArtistTerms(text, limit = 8) {
  const haystack = normalizeText(text);
  const hits = [];

  for (const term of ARTIST_NAME_TERMS) {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm) continue;

    const wordCount = normalizedTerm
      .split(' ')
      .filter(Boolean)
      .length;

    if (
      wordCount === 1 &&
      AMBIGUOUS_SINGLE_WORD_ARTIST_TERMS.has(normalizedTerm)
    ) {
      continue;
    }

    const rx = buildNormalizedPhraseRegex(normalizedTerm);
    if (!rx || !rx.test(haystack)) continue;

    if (!hits.includes(term)) {
      hits.push(term);
    }

    if (hits.length >= limit) break;
  }

  return hits;
}

function pickMatchedSpecificVideoPublicFigureTerms(text, limit = 8) {
  const haystack = normalizeText(text);
  const hits = [];

  for (const term of PUBLIC_FIGURES_TR_SEED) {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm) continue;
    if (VIDEO_GENERIC_PUBLIC_FIGURE_TERMS.has(normalizedTerm)) continue;

    const wordCount = normalizedTerm
      .split(' ')
      .filter(Boolean)
      .length;

    if (
      wordCount < 2 &&
      !VIDEO_DISTINCTIVE_SINGLE_PUBLIC_FIGURE_TERMS.has(normalizedTerm)
    ) {
      continue;
    }

    const rx = buildNormalizedPhraseRegex(normalizedTerm);
    if (!rx || !rx.test(haystack)) continue;

    if (!hits.includes(term)) {
      hits.push(term);
    }

    if (hits.length >= limit) break;
  }

  return hits;
}

function hasExplicitMusicCopyRequest(text) {
  const normalized = normalizeText(text);

  const turkishPattern =
    /\b(?:melodisini|nakaratini|nakaratını|sozlerini|vokalini|sesini)\s+(?:(?:aynen|birebir)\s+)?(?:kullan|taklit et|kopyala|klonla)\b/i;

  const englishPattern =
    /\b(?:voice clone|clone voice|copy the melody|copy the chorus|copy the lyrics|exact copy|copy this song|copy this melody)\b/i;

  return (
    turkishPattern.test(normalized) ||
    englishPattern.test(normalized)
  );
}

/*
 * Müzik için daraltılmış politika:
 *
 * - Yalnızca prompt taranır.
 * - Lyrics, title, mood ve vocal taranmaz.
 * - Belirgin sanatçı isimleri engellenir.
 * - Günlük dilde kullanılan tek kelimelik isimler,
 *   yalnızca sanatçı bağlamında engellenir.
 * - Açık eser kopyalama ve ses klonlama engellenir.
 */
function enforceMusicPolicy(
  text,
  explicitArtistText = ''
) {
  const contextualArtistHits =
    pickMatchedMusicArtistTerms(text, 8);

  const explicitArtistHits =
    pickMatchedTerms(
      explicitArtistText,
      ARTIST_NAME_TERMS,
      8
    );

  const hitsArtistNames = Array.from(
    new Set([
      ...contextualArtistHits,
      ...explicitArtistHits,
    ])
  ).slice(0, 8);

  const hitsProtected =
    pickMatchedTerms(
      text,
      PROTECTED_WORK_TERMS,
      8
    );

  const hasProtectedWork =
    hitsProtected.length > 0 ||
    hasExplicitMusicCopyRequest(text);

  if (hasProtectedWork) {
    return makeResult({
      decision: 'block',
      code: 'PROTECTED_WORK_MUSIC',
      severity: 'high',
      message:
        'Belirli bir şarkının melodisini, sözlerini veya vokal kimliğini kopyalayan müzik üretilemez.',
      reasons: [
        'protected-work-music',
      ],
      matchedTerms: [
        ...hitsArtistNames,
        ...hitsProtected,
      ].slice(0, 8),
    });
  }

  if (hitsArtistNames.length > 0) {
    return makeResult({
      decision: 'block',
      code: 'ARTIST_NAME_MUSIC',
      severity: 'high',
      message:
        'Belirli bir sanatçı adı kullanılamaz. Sanatçı adı yerine tür, dönem, tempo, duygu ve enstrümanları tarif et.',
      rewrittenPrompt: null,
      reasons: [
        'artist-name-music',
      ],
      matchedTerms:
        hitsArtistNames,
    });
  }

  return null;
}


/*
 * Kapak için daraltılmış politika:
 *
 * - Yalnızca kullanıcının prompt alanı taranır.
 * - Hazır stil, kalite, oran, başlık ve sistem tarafından eklenen metinler
 *   kullanıcı ihlali olarak değerlendirilmez.
 * - Belirgin sanatçı isimleri engellenir.
 * - Hadise, Özgün, Duman, Ceza gibi günlük dilde de kullanılabilen
 *   tek kelimelik sanatçı isimleri yalnızca sanatçı bağlamında engellenir.
 * - Yalnızca seed listesindeki belirli kamu figürü / siyasetçi isimleri
 *   engellenir; başkan, president, king, queen, bakan gibi genel unvanlar
 *   tek başına engellenmez.
 * - Bunların dışındaki yaratıcı anlatımlar değiştirilmeden kabul edilir.
 */
function enforceCoverPolicy(
  text,
  explicitArtistText = '',
  explicitPersonText = ''
) {
  const normalizedCoverText =
    normalizeText(text);

  const visualMangaContext =
    /\b(?:japanese\s+)?manga\s+(?:style|art|illustration|aesthetic|visual|drawing|comic|character)\b/i.test(
      normalizedCoverText
    ) ||
    /\banime(?:\s+\w+){0,5}\s+manga\b/i.test(
      normalizedCoverText
    );

  const explicitMangaBandContext =
    /\bmanga\s+(?:grubu|band|muzik grubu|sarkisi|albumu|konseri|vokali|soundu)\b/i.test(
      normalizedCoverText
    );

  const contextualArtistHits =
    pickMatchedMusicArtistTerms(text, 8)
      .filter((term) => {
        const normalizedTerm =
          normalizeText(term);

        if (normalizedTerm !== 'manga') {
          return true;
        }

        /*
         * "Japanese manga style", "manga art" ve benzeri
         * görsel sanat tanımları maNga müzik grubu değildir.
         *
         * Açık müzik grubu bağlamında kullanılırsa engellenmeye
         * devam eder.
         */
        if (
          visualMangaContext &&
          !explicitMangaBandContext
        ) {
          return false;
        }

        return true;
      });

  const explicitArtistHits =
    pickMatchedTerms(
      explicitArtistText,
      ARTIST_NAME_TERMS,
      8
    );

  const hitsArtistNames = Array.from(
    new Set([
      ...contextualArtistHits,
      ...explicitArtistHits,
    ])
  ).slice(0, 8);

  const publicFigureText = [
    text,
    explicitPersonText,
  ]
    .filter(Boolean)
    .join(' ');

  const hitsPublicFigures =
    pickMatchedTerms(
      publicFigureText,
      PUBLIC_FIGURES_TR_SEED,
      8
    );

  if (hitsArtistNames.length > 0) {
    return makeResult({
      decision: 'block',
      code: 'ARTIST_NAME_COVER',
      severity: 'high',
      message:
        'Gerçek sanatçı adı kapak promptunda kullanılamaz. İsim yerine sahneyi, duyguyu, renkleri ve görsel stili tarif et.',
      rewrittenPrompt: null,
      reasons: [
        'artist-name-cover',
      ],
      matchedTerms:
        hitsArtistNames,
    });
  }

  if (hitsPublicFigures.length > 0) {
    return makeResult({
      decision: 'block',
      code: 'PUBLIC_FIGURE_NAME_COVER',
      severity: 'high',
      message:
        'Gerçek siyasetçi veya kamu figürü adı kapak promptunda kullanılamaz. İsim yerine kurgu bir karakter veya genel sahne tanımı kullan.',
      rewrittenPrompt: null,
      reasons: [
        'public-figure-name-cover',
      ],
      matchedTerms:
        hitsPublicFigures,
    });
  }

  return null;
}

/*
 * Atmosfer için daraltılmış politika:
 *
 * - Yalnızca kullanıcının prompt alanı taranır.
 * - Hazır atmosfer stili, ışık, duygu, oran, süre, efektler ve sistem
 *   tarafından eklenen metinler filtre kararına katılmaz.
 * - Duman, Hadise, Ceza, Simge, Özgün, Manga, Motive gibi eş anlamlı veya
 *   günlük dilde kullanılan tek kelimelik sanatçı adları tamamen yok sayılır.
 * - Çok kelimeli veya ayırt edici sanatçı adları engellenir.
 * - Yalnızca seed listesindeki belirli siyasi / kamu figürü isimleri engellenir.
 * - Deepfake, taklit, "gibi", "stilinde", "birebir" ve benzeri risk kelimeleri
 *   Atmosfer promptunda ayrıca blok oluşturmaz.
 * - Görsel yükleme filtresi ayrı media-policy akışında kalır; bu fonksiyon
 *   görsel taramasını değiştirmez.
 */
function enforceAtmoPolicy(
  text,
  explicitArtistText = '',
  explicitPersonText = ''
) {
  const artistText = [
    text,
    explicitArtistText,
  ]
    .filter(Boolean)
    .join(' ');

  const hitsArtistNames =
    pickMatchedUnambiguousArtistTerms(
      artistText,
      8
    );

  const publicFigureText = [
    text,
    explicitPersonText,
  ]
    .filter(Boolean)
    .join(' ');

  const hitsPublicFigures =
    pickMatchedTerms(
      publicFigureText,
      PUBLIC_FIGURES_TR_SEED,
      8
    );

  if (hitsArtistNames.length > 0) {
    return makeResult({
      decision: 'block',
      code: 'ARTIST_NAME_ATMO',
      severity: 'high',
      message:
        'Gerçek sanatçı adı Atmosfer promptunda kullanılamaz. İsim yerine sahneyi, hareketi, ışığı ve video hissini tarif et.',
      rewrittenPrompt: null,
      reasons: [
        'artist-name-atmo',
      ],
      matchedTerms:
        hitsArtistNames,
    });
  }

  if (hitsPublicFigures.length > 0) {
    return makeResult({
      decision: 'block',
      code: 'PUBLIC_FIGURE_NAME_ATMO',
      severity: 'high',
      message:
        'Gerçek siyasetçi veya kamu figürü adı Atmosfer promptunda kullanılamaz. İsim yerine kurgu bir karakter veya genel sahne tanımı kullan.',
      rewrittenPrompt: null,
      reasons: [
        'public-figure-name-atmo',
      ],
      matchedTerms:
        hitsPublicFigures,
    });
  }

  return null;
}

/*
 * PhotoFX için daraltılmış politika:
 *
 * - Yalnızca kullanıcının prompt alanı taranır.
 * - Hazır efektler, presetler, hareket seviyesi, renk, geçiş, oran, süre,
 *   çözünürlük ve sistem tarafından eklenen metinler filtre kararına katılmaz.
 * - Duman, Hadise, Ceza, Simge, Özgün, Manga, Motive gibi günlük dilde
 *   başka anlamı da bulunan tek kelimelik sanatçı adları tamamen yok sayılır.
 * - Çok kelimeli veya ayırt edici sanatçı adları engellenir.
 * - Yalnızca seed listesindeki belirli siyasi / kamu figürü isimleri engellenir.
 * - Deepfake, face swap, gibi, stilinde, birebir ve benzeri genel ifadeler
 *   PhotoFX promptunda ayrıca blok oluşturmaz.
 * - Görsel yükleme filtresi ayrı media-policy akışında aynen kalır.
 */
function enforcePhotoFxPolicy(
  text,
  explicitArtistText = '',
  explicitPersonText = ''
) {
  const artistText = [
    text,
    explicitArtistText,
  ]
    .filter(Boolean)
    .join(' ');

  const hitsArtistNames =
    pickMatchedUnambiguousArtistTerms(
      artistText,
      8
    );

  const publicFigureText = [
    text,
    explicitPersonText,
  ]
    .filter(Boolean)
    .join(' ');

  const hitsPublicFigures =
    pickMatchedTerms(
      publicFigureText,
      PUBLIC_FIGURES_TR_SEED,
      8
    );

  if (hitsArtistNames.length > 0) {
    return makeResult({
      decision: 'block',
      code: 'ARTIST_NAME_PHOTOFX',
      severity: 'high',
      message:
        'Gerçek sanatçı adı Foto Efekt promptunda kullanılamaz. İsim yerine efekti, hareketi ve görsel atmosferi tarif et.',
      rewrittenPrompt: null,
      reasons: [
        'artist-name-photofx',
      ],
      matchedTerms:
        hitsArtistNames,
    });
  }

  if (hitsPublicFigures.length > 0) {
    return makeResult({
      decision: 'block',
      code: 'PUBLIC_FIGURE_NAME_PHOTOFX',
      severity: 'high',
      message:
        'Gerçek siyasetçi veya kamu figürü adı Foto Efekt promptunda kullanılamaz. İsim yerine kurgu bir karakter veya genel sahne tanımı kullan.',
      rewrittenPrompt: null,
      reasons: [
        'public-figure-name-photofx',
      ],
      matchedTerms:
        hitsPublicFigures,
    });
  }

  return null;
}

/*
 * Video / Resimden Video için daraltılmış politika:
 *
 * - Yalnızca kullanıcının prompt alanı taranır.
 * - Model, oran, süre, çözünürlük ve sistem metinleri filtreye katılmaz.
 * - Duman, Hadise, Ceza, Simge, Özgün, Manga ve Motive gibi günlük dilde
 *   kullanılabilen tek kelimelik sanatçı adları tamamen yok sayılır.
 * - Çok kelimeli veya ayırt edici sanatçı adları engellenir.
 * - Yalnızca belirli siyasi / kamu figürü isimleri engellenir.
 * - Gibi, stilinde, birebir, deepfake, face swap ve benzeri genel ifadeler
 *   prompt tarafında ayrıca blok oluşturmaz.
 * - Yüklenen görselin media-policy taraması bu fonksiyondan ayrıdır ve kalır.
 */
function enforceVideoPolicy(
  text,
  explicitArtistText = '',
  explicitPersonText = ''
) {
  const artistText = [
    text,
    explicitArtistText,
  ]
    .filter(Boolean)
    .join(' ');

  const hitsArtistNames =
    pickMatchedUnambiguousArtistTerms(
      artistText,
      8
    );

  const publicFigureText = [
    text,
    explicitPersonText,
  ]
    .filter(Boolean)
    .join(' ');

  const hitsPublicFigures =
    pickMatchedSpecificVideoPublicFigureTerms(
      publicFigureText,
      8
    );

  if (hitsArtistNames.length > 0) {
    return makeResult({
      decision: 'block',
      code: 'ARTIST_NAME_VIDEO',
      severity: 'high',
      message:
        'Gerçek sanatçı adı video promptunda kullanılamaz. İsim yerine sahneyi, hareketi ve video hissini tarif et.',
      rewrittenPrompt: null,
      reasons: [
        'artist-name-video',
      ],
      matchedTerms:
        hitsArtistNames,
    });
  }

  if (hitsPublicFigures.length > 0) {
    return makeResult({
      decision: 'block',
      code: 'PUBLIC_FIGURE_NAME_VIDEO',
      severity: 'high',
      message:
        'Gerçek siyasetçi veya kamu figürü adı video promptunda kullanılamaz. İsim yerine kurgu bir karakter veya genel sahne tanımı kullan.',
      rewrittenPrompt: null,
      reasons: [
        'public-figure-name-video',
      ],
      matchedTerms:
        hitsPublicFigures,
    });
  }

  return null;
}

/*
 * Müzik dışındaki uygulamaların mevcut sanatçı
 * kontrolü aynen korunur.
 */
function enforceLegacyArtistPolicy(text) {
  const hitsArtistNames =
    pickMatchedTerms(
      text,
      ARTIST_NAME_TERMS,
      8
    );

  const hitsStyle =
    pickMatchedTerms(
      text,
      MUSIC_STYLE_TERMS
    );

  const hitsProtected =
    pickMatchedTerms(
      text,
      PROTECTED_WORK_TERMS
    );

  const hasArtistName =
    hitsArtistNames.length > 0;

  const hasStyleIntent =
    hitsStyle.length > 0;

  const hasProtectedWork =
    hitsProtected.length > 0;

  if (hasProtectedWork) {
    return makeResult({
      decision: 'block',
      code: 'PROTECTED_WORK_MUSIC',
      severity: 'high',
      message:
        'Belirli bir şarkıyı, sözleri, melodiyi, vokal kimliğini veya düzenlemeyi taklit eden müzik üretilemez.',
      reasons: [
        'protected-work-music',
      ],
      matchedTerms: [
        ...hitsArtistNames,
        ...hitsProtected,
      ].slice(0, 8),
    });
  }

  if (
    hasArtistName &&
    hasStyleIntent
  ) {
    return makeResult({
      decision: 'block',
      code: 'ARTIST_STYLE_MUSIC',
      severity: 'high',
      message:
        'Belirli bir sanatçıyı veya tanınan vokal kimliğini taklit eden müzik üretilemez.',
      reasons: [
        'artist-imitation-music',
      ],
      matchedTerms: [
        ...hitsArtistNames,
        ...hitsStyle,
      ].slice(0, 8),
    });
  }

  if (hasArtistName) {
    return makeResult({
      decision: 'block',
      code: 'ARTIST_NAME_REAL_PERSON',
      severity: 'high',
      message:
        'Belirli bir sanatçı, ünlü veya tanınan gerçek kişiyi doğrudan hedef alan video, görsel veya benzeri içerik üretilemez.',
      rewrittenPrompt: null,
      reasons: [
        'artist-name-real-person',
      ],
      matchedTerms:
        hitsArtistNames,
    });
  }

  return null;
}

function enforcePersonPolicy(app, text) {
  const hitsPublic =
    pickMatchedTerms(
      text,
      PUBLIC_FIGURE_TERMS,
      8
    );

  const hitsDefamation =
    pickMatchedTerms(
      text,
      DEFAMATION_TERMS,
      8
    );

  const hitsDeepfake =
    pickMatchedTerms(
      text,
      DEEPFAKE_TERMS,
      8
    );

  const hasPublicFigure =
    hitsPublic.length > 0;

  const hasDefamation =
    hitsDefamation.length > 0;

  const hasDeepfake =
    hitsDeepfake.length > 0;

  const isVisualApp =
    app === 'video' ||
    app === 'cover' ||
    app === 'image' ||
    app === 'cartoon' ||
    app === 'photofx';

  if (
    hasPublicFigure &&
    hasDeepfake
  ) {
    return makeResult({
      decision: 'block',
      code: 'DEEPFAKE_REAL_PERSON',
      severity: 'high',
      message:
        'Gerçek kişi, kamu figürü veya ünlü kişiyi sahte konuşma, deepfake veya yanıltıcı taklit ile gösteren içerik üretilemez.',
      reasons: [
        'deepfake-real-person',
      ],
      matchedTerms: [
        ...hitsPublic,
        ...hitsDeepfake,
      ].slice(0, 8),
    });
  }

  if (
    hasPublicFigure &&
    hasDefamation
  ) {
    return makeResult({
      decision: 'block',
      code: 'DEFAMATION_PUBLIC_FIGURE',
      severity: 'high',
      message:
        'Kamu figürü, siyasetçi, ünlü veya gerçek kişiyi aşağılayan, alay eden ya da itibar zedeleyen içerik üretilemez.',
      reasons: [
        'defamation-public-figure',
      ],
      matchedTerms: [
        ...hitsPublic,
        ...hitsDefamation,
      ].slice(0, 8),
    });
  }

  if (
    isVisualApp &&
    hasPublicFigure
  ) {
    return makeResult({
      decision: 'rewrite',
      code: 'PUBLIC_FIGURE_REWRITE',
      severity: 'medium',
      message:
        'Gerçek kişi veya kamu figürü yerine anonim veya kurgu karakterle devam edilmelidir.',
      rewrittenPrompt: null,
      reasons: [
        'public-figure-rewrite',
      ],
      matchedTerms:
        hitsPublic,
    });
  }

  if (
    isVisualApp &&
    hasDeepfake &&
    !hasPublicFigure
  ) {
    return null;
  }

  return null;
}

function enforcePolicy(input = {}) {
  const app =
    normalizeText(
      input.app ||
      'generic'
    );

  /*
   * Müzik diğer uygulamalardan ayrıdır.
   */
  if (app === 'music') {
    const rawMusic =
      getMusicPolicyText(input);

    const textMusic =
      normalizeText(rawMusic);

    if (!textMusic) {
      return makeResult({
        decision: 'allow',
        code: 'EMPTY_INPUT_ALLOW',
        severity: 'low',
        message:
          'İstek boş olduğu için policy kontrolü izin verdi.',
        rewrittenPrompt: null,
        reasons: [],
        matchedTerms: [],
      });
    }

    const musicDecision =
      enforceMusicPolicy(
        textMusic,
        String(
          input.referenceArtist ||
          input.artist ||
          ''
        ).trim()
      );

    if (musicDecision) {
      return musicDecision;
    }

    return makeResult({
      decision: 'allow',
      code: 'MUSIC_ALLOW',
      severity: 'low',
      message:
        'Müzik isteği policy kontrolünden geçti.',
      rewrittenPrompt: null,
      reasons: [],
      matchedTerms: [],
    });
  }


  /*
   * Kapak, eski ortak müzik-dışı filtreden ayrıdır.
   * Yalnızca kullanıcının promptu ile açık sanatçı / kişi alanları taranır.
   */
  if (app === 'cover') {
    const rawCover =
      String(input.prompt || '').trim();

    const textCover =
      normalizeText(rawCover);

    if (!textCover) {
      return makeResult({
        decision: 'allow',
        code: 'EMPTY_INPUT_ALLOW',
        severity: 'low',
        message:
          'İstek boş olduğu için policy kontrolü izin verdi.',
        rewrittenPrompt: null,
        reasons: [],
        matchedTerms: [],
      });
    }

    const coverDecision =
      enforceCoverPolicy(
        textCover,
        String(
          input.referenceArtist ||
          input.artist ||
          ''
        ).trim(),
        String(
          input.personName ||
          ''
        ).trim()
      );

    if (coverDecision) {
      return coverDecision;
    }

    return makeResult({
      decision: 'allow',
      code: 'COVER_ALLOW',
      severity: 'low',
      message:
        'Kapak isteği policy kontrolünden geçti.',
      rewrittenPrompt: null,
      reasons: [],
      matchedTerms: [],
    });
  }

  /*
   * Atmosfer, eski ortak müzik-dışı filtreden ayrıdır.
   * Yalnızca prompttaki ayırt edici sanatçı adları ile belirli siyasi /
   * kamu figürü adları kontrol edilir. Eş anlamlı tek kelimelik sanatçı
   * adları ve genel risk kelimeleri Atmosfer için filtre oluşturmaz.
   */
  if (app === 'atmo' || app === 'atmosphere') {
    const rawAtmo =
      String(input.prompt || '').trim();

    const textAtmo =
      normalizeText(rawAtmo);

    if (!textAtmo) {
      return makeResult({
        decision: 'allow',
        code: 'EMPTY_INPUT_ALLOW',
        severity: 'low',
        message:
          'İstek boş olduğu için policy kontrolü izin verdi.',
        rewrittenPrompt: null,
        reasons: [],
        matchedTerms: [],
      });
    }

    const atmoDecision =
      enforceAtmoPolicy(
        textAtmo,
        String(
          input.referenceArtist ||
          input.artist ||
          ''
        ).trim(),
        String(
          input.personName ||
          ''
        ).trim()
      );

    if (atmoDecision) {
      return atmoDecision;
    }

    return makeResult({
      decision: 'allow',
      code: 'ATMO_ALLOW',
      severity: 'low',
      message:
        'Atmosfer isteği policy kontrolünden geçti.',
      rewrittenPrompt: null,
      reasons: [],
      matchedTerms: [],
    });
  }

  /*
   * PhotoFX, eski ortak müzik-dışı filtreden ayrıdır.
   * Yalnızca prompttaki ayırt edici sanatçı adları ile belirli siyasi /
   * kamu figürü adları kontrol edilir. Eş anlamlı tek kelimelik sanatçı
   * adları ve diğer genel risk kelimeleri PhotoFX için filtre oluşturmaz.
   */
  if (app === 'photofx' || app === 'photo-fx') {
    const rawPhotoFx =
      String(input.prompt || '').trim();

    const textPhotoFx =
      normalizeText(rawPhotoFx);

    if (!textPhotoFx) {
      return makeResult({
        decision: 'allow',
        code: 'EMPTY_INPUT_ALLOW',
        severity: 'low',
        message:
          'İstek boş olduğu için policy kontrolü izin verdi.',
        rewrittenPrompt: null,
        reasons: [],
        matchedTerms: [],
      });
    }

    const photoFxDecision =
      enforcePhotoFxPolicy(
        textPhotoFx,
        String(
          input.referenceArtist ||
          input.artist ||
          ''
        ).trim(),
        String(
          input.personName ||
          ''
        ).trim()
      );

    if (photoFxDecision) {
      return photoFxDecision;
    }

    return makeResult({
      decision: 'allow',
      code: 'PHOTOFX_ALLOW',
      severity: 'low',
      message:
        'Foto Efekt isteği policy kontrolünden geçti.',
      rewrittenPrompt: null,
      reasons: [],
      matchedTerms: [],
    });
  }

  /*
   * Video ve Resimden Video, eski ortak müzik-dışı filtreden ayrıdır.
   * Yalnızca prompttaki ayırt edici sanatçı adları ile belirli siyasi /
   * kamu figürü adları kontrol edilir. Görsel yükleme filtresi ayrı kalır.
   */
  if (app === 'video' || app === 'image-to-video' || app === 'image_video') {
    const rawVideo =
      String(input.prompt || '').trim();

    const textVideo =
      normalizeText(rawVideo);

    if (!textVideo) {
      return makeResult({
        decision: 'allow',
        code: 'EMPTY_INPUT_ALLOW',
        severity: 'low',
        message:
          'İstek boş olduğu için policy kontrolü izin verdi.',
        rewrittenPrompt: null,
        reasons: [],
        matchedTerms: [],
      });
    }

    const videoDecision =
      enforceVideoPolicy(
        textVideo,
        String(
          input.referenceArtist ||
          input.artist ||
          ''
        ).trim(),
        String(
          input.personName ||
          ''
        ).trim()
      );

    if (videoDecision) {
      return videoDecision;
    }

    return makeResult({
      decision: 'allow',
      code: 'VIDEO_ALLOW',
      severity: 'low',
      message:
        'Video isteği policy kontrolünden geçti.',
      rewrittenPrompt: null,
      reasons: [],
      matchedTerms: [],
    });
  }

  /*
   * Müzik dışındaki diğer uygulamalar mevcut ortak akışı kullanır.
   */
  const raw =
    joinInput(input);

  const text =
    normalizeText(raw);

  if (!text) {
    return makeResult({
      decision: 'allow',
      code: 'EMPTY_INPUT_ALLOW',
      severity: 'low',
      message:
        'İstek boş olduğu için policy kontrolü izin verdi.',
      rewrittenPrompt: null,
      reasons: [],
      matchedTerms: [],
    });
  }

  const artistDecision =
    enforceLegacyArtistPolicy(text);

  if (artistDecision) {
    if (
      artistDecision.decision ===
      'rewrite'
    ) {
      return {
        ...artistDecision,
        rewrittenPrompt:
          rewritePrompt(
            app,
            raw
          ),
      };
    }

    return artistDecision;
  }

  const personDecision =
    enforcePersonPolicy(
      app,
      text
    );

  if (personDecision) {
    if (
      personDecision.decision ===
      'rewrite'
    ) {
      return {
        ...personDecision,
        rewrittenPrompt:
          rewritePrompt(
            app,
            raw
          ),
      };
    }

    return personDecision;
  }

  const hasSoftRisk =
    containsAny(
      text,
      PUBLIC_FIGURE_TERMS
    ) ||
    containsAny(
      text,
      MUSIC_STYLE_TERMS
    );

  if (hasSoftRisk) {
    return makeResult({
      decision: 'rewrite',
      code: 'SAFE_REWRITE',
      severity: 'medium',
      message:
        `İstek güvenli genel dile dönüştürüldü. ${buildSafeAlternative(app)}`,
      rewrittenPrompt:
        rewritePrompt(
          app,
          raw
        ),
      reasons: [
        'soft-risk-rewrite',
      ],
      matchedTerms: [
        ...pickMatchedTerms(
          text,
          PUBLIC_FIGURE_TERMS,
          3
        ),
        ...pickMatchedTerms(
          text,
          MUSIC_STYLE_TERMS,
          3
        ),
      ].slice(0, 6),
    });
  }

  return makeResult({
    decision: 'allow',
    code: 'ALLOW',
    severity: 'low',
    message:
      'İstek policy kontrolünden geçti.',
    rewrittenPrompt: null,
    reasons: [],
    matchedTerms: [],
  });
}

function policyErrorResponse(result) {
  return {
    ok: false,
    error:
      result.code ||
      'POLICY_BLOCKED',
    message:
      result.message ||
      'Belirli sanatçı, kamu figürü veya gerçek kişiyi taklit eden veya aşağılayan içerik üretemem.',
    safe_alternative:
      'Sanatçı adı yerine tür ve duygu, kişi adı yerine kurgu karakter, gerçek kişi yerine anonim stil kullan.',
    policy: result,
  };
}

module.exports = {
  enforcePolicy,
  policyErrorResponse,
};
