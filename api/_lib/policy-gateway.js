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
  'birebir yap',
  'birebir üret',
  'birebir uret',
  'same song',
  'same cover',
  'exact copy',
  'copy this song',
  'copy this melody',
  'bu sarkinin aynisi',
  'bu şarkının aynısı',
  'melodisini kullan',
  'nakaratini kullan',
  'sozlerini kullan',
  'sözlerini kullan',
  'vokalini taklit et',
  'sesini taklit et',
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
    output = output.replace(rx, (match, lead) => `${lead}${replacement}`);
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

function buildSafeAlternative(app) {
  if (app === 'music') {
    return 'Sanatçı adı yerine tür, dönem, tempo, duygu, enstrüman ve vokal karakteri gibi genel tanımlar kullan.';
  }
  if (app === 'video') {
    return 'Gerçek kişi yerine kurgu karakter, anonim persona veya genel sahne tanımı kullan.';
  }
  if (app === 'cover' || app === 'image' || app === 'cartoon') {
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
    output = replaceTermsCaseInsensitive(output, ARTIST_NAME_TERMS, 'özgün bir sanatçı kimliğiyle');
  }

  if (app === 'video' || app === 'cover' || app === 'image' || app === 'cartoon') {
    output = replaceTermsCaseInsensitive(output, PUBLIC_FIGURE_TERMS, 'anonim bir karakter');
  }

  output = output
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();

  if (app === 'music') {
    return output || 'Özgün, ticari olarak güvenli, belirli bir sanatçıyı taklit etmeyen müzik üret.';
  }

  if (app === 'video') {
    return output || 'Özgün, anonim karakterlerle, gerçek kişiyi taklit etmeyen güvenli video üret.';
  }

  return output || 'Özgün, belirli kişiyi veya korunan eseri taklit etmeyen güvenli içerik üret.';
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

function enforceMusicPolicy(text) {
  const hitsArtistNames = pickMatchedTerms(text, ARTIST_NAME_TERMS, 8);
  const hitsStyle = pickMatchedTerms(text, MUSIC_STYLE_TERMS);
  const hitsProtected = pickMatchedTerms(text, PROTECTED_WORK_TERMS);

  const hasArtistName = hitsArtistNames.length > 0;
  const hasStyleIntent = hitsStyle.length > 0;
  const hasProtectedWork = hitsProtected.length > 0;

  if (hasProtectedWork) {
    return makeResult({
      decision: 'block',
      code: 'PROTECTED_WORK_MUSIC',
      severity: 'high',
      message:
        'Belirli bir şarkıyı, sözleri, melodiyi, vokal kimliğini veya düzenlemeyi taklit eden müzik üretilemez.',
      reasons: ['protected-work-music'],
      matchedTerms: [...hitsArtistNames, ...hitsProtected].slice(0, 8),
    });
  }

  if (hasArtistName && hasStyleIntent) {
    return makeResult({
      decision: 'block',
      code: 'ARTIST_STYLE_MUSIC',
      severity: 'high',
      message:
        'Belirli bir sanatçıyı veya tanınan vokal kimliğini taklit eden müzik üretilemez.',
      reasons: ['artist-imitation-music'],
      matchedTerms: [...hitsArtistNames, ...hitsStyle].slice(0, 8),
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
      reasons: ['artist-name-real-person'],
      matchedTerms: hitsArtistNames,
    });
  }
  return null;
}

function enforcePersonPolicy(app, text) {
  const hitsPublic = pickMatchedTerms(text, PUBLIC_FIGURE_TERMS, 8);
  const hitsDefamation = pickMatchedTerms(text, DEFAMATION_TERMS, 8);
  const hitsDeepfake = pickMatchedTerms(text, DEEPFAKE_TERMS, 8);

  const hasPublicFigure = hitsPublic.length > 0;
  const hasDefamation = hitsDefamation.length > 0;
  const hasDeepfake = hitsDeepfake.length > 0;

  if (hasDeepfake) {
    return makeResult({
      decision: 'block',
      code: 'DEEPFAKE_REAL_PERSON',
      severity: 'high',
      message:
        'Gerçek kişi, kamu figürü veya ünlü kişiyi sahte konuşma, deepfake veya yanıltıcı taklit ile gösteren içerik üretilemez.',
      reasons: ['deepfake-real-person'],
      matchedTerms: [...hitsPublic, ...hitsDeepfake].slice(0, 8),
    });
  }

  if (hasPublicFigure && hasDefamation) {
    return makeResult({
      decision: 'block',
      code: 'DEFAMATION_PUBLIC_FIGURE',
      severity: 'high',
      message:
   function enforcePersonPolicy(app, text) {
  const hitsPublic = pickMatchedTerms(text, PUBLIC_FIGURE_TERMS, 8);
  const hitsDefamation = pickMatchedTerms(text, DEFAMATION_TERMS, 8);
  const hitsDeepfake = pickMatchedTerms(text, DEEPFAKE_TERMS, 8);

  const hasPublicFigure = hitsPublic.length > 0;
  const hasDefamation = hitsDefamation.length > 0;
  const hasDeepfake = hitsDeepfake.length > 0;

  const isVisualApp =
    app === 'video' ||
    app === 'cover' ||
    app === 'image' ||
    app === 'cartoon' ||
    app === 'photofx';

  if (hasPublicFigure && hasDeepfake) {
    return makeResult({
      decision: 'block',
      code: 'DEEPFAKE_REAL_PERSON',
      severity: 'high',
      message:
        'Gerçek kişi, kamu figürü veya ünlü kişiyi sahte konuşma, deepfake veya yanıltıcı taklit ile gösteren içerik üretilemez.',
      reasons: ['deepfake-real-person'],
      matchedTerms: [...hitsPublic, ...hitsDeepfake].slice(0, 8),
    });
  }

  if (hasPublicFigure && hasDefamation) {
    return makeResult({
      decision: 'block',
      code: 'DEFAMATION_PUBLIC_FIGURE',
      severity: 'high',
      message:
        'Kamu figürü, siyasetçi, ünlü veya gerçek kişiyi aşağılayan, alay eden ya da itibar zedeleyen içerik üretilemez.',
      reasons: ['defamation-public-figure'],
      matchedTerms: [...hitsPublic, ...hitsDefamation].slice(0, 8),
    });
  }

  if (isVisualApp && hasPublicFigure) {
    return makeResult({
      decision: 'rewrite',
      code: 'PUBLIC_FIGURE_REWRITE',
      severity: 'medium',
      message:
        'Gerçek kişi veya kamu figürü yerine anonim veya kurgu karakterle devam edilmelidir.',
      rewrittenPrompt: null,
      reasons: ['public-figure-rewrite'],
      matchedTerms: hitsPublic,
    });
  }

  if (isVisualApp && hasDeepfake && !hasPublicFigure) {
    return null;
  }

  return null;
}

function enforcePolicy(input = {}) {
  const app = normalizeText(input.app || 'generic');
  const raw = joinInput(input);
  const text = normalizeText(raw);

  if (!text) {
    return makeResult({
      decision: 'allow',
      code: 'EMPTY_INPUT_ALLOW',
      severity: 'low',
      message: 'İstek boş olduğu için policy kontrolü izin verdi.',
      rewrittenPrompt: null,
      reasons: [],
      matchedTerms: [],
    });
  }

  const musicDecision = enforceMusicPolicy(text);
  if (musicDecision) {
    if (musicDecision.decision === 'rewrite') {
      return {
        ...musicDecision,
        rewrittenPrompt: rewritePrompt(app, raw),
      };
    }
    return musicDecision;
  }

  const personDecision = enforcePersonPolicy(app, text);
  if (personDecision) {
    if (personDecision.decision === 'rewrite') {
      return {
        ...personDecision,
        rewrittenPrompt: rewritePrompt(app, raw),
      };
    }
    return personDecision;
  }

  const hasSoftRisk =
    containsAny(text, PUBLIC_FIGURE_TERMS) ||
    containsAny(text, MUSIC_STYLE_TERMS);

  if (hasSoftRisk) {
    return makeResult({
      decision: 'rewrite',
      code: 'SAFE_REWRITE',
      severity: 'medium',
      message: `İstek güvenli genel dile dönüştürüldü. ${buildSafeAlternative(app)}`,
      rewrittenPrompt: rewritePrompt(app, raw),
      reasons: ['soft-risk-rewrite'],
      matchedTerms: [
        ...pickMatchedTerms(text, PUBLIC_FIGURE_TERMS, 3),
        ...pickMatchedTerms(text, MUSIC_STYLE_TERMS, 3),
      ].slice(0, 6),
    });
  }

  return makeResult({
    decision: 'allow',
    code: 'ALLOW',
    severity: 'low',
    message: 'İstek policy kontrolünden geçti.',
    rewrittenPrompt: null,
    reasons: [],
    matchedTerms: [],
  });
}

function policyErrorResponse(result) {
  return {
    ok: false,
    error: result.code || 'POLICY_BLOCKED',
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
