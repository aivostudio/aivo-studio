const path = require('path');
const fs = require('fs');

const ARTISTS_TR_SEED = require('./policy-data/artists-tr.seed.json');
const PUBLIC_FIGURES_TR_SEED = require('./policy-data/public_figures_tr.seed.json');

const DEFAULT_BLOCK_EXTENSIONS = new Set([
  '.heic',
  '.heif',
]);

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u00c0-\u017f\s._-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sha1File(filePath) {
  try {
    const crypto = require('crypto');
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha1').update(buffer).digest('hex');
  } catch (_) {
    return null;
  }
}

function extnameSafe(filePath, fallbackName = '') {
  const ext = path.extname(String(filePath || fallbackName || '')).toLowerCase();
  return ext || '';
}

function basenameSafe(filePath, fallbackName = '') {
  const base = path.basename(String(filePath || fallbackName || ''));
  return base || '';
}

function uniq(list) {
  return Array.from(new Set((list || []).filter(Boolean)));
}

function limit(list, max = 10) {
  return (list || []).slice(0, max);
}

function buildReferenceIndex() {
  const publicFigureTerms = uniq([
    ...PUBLIC_FIGURES_TR_SEED,
    'cumhurbaskani',
    'cumhurbaşkanı',
    'cumhurbaskani yardimcisi',
    'cumhurbaşkanı yardımcısı',
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
    'president',
    'prime minister',
    'king',
    'queen',
    'celebrity',
    'famous',
    'public figure',
  ]).map(normalizeText);

  const artistTerms = uniq([
    ...ARTISTS_TR_SEED,
    'unlu sarkici',
    'ünlü şarkıcı',
    'sanatci',
    'sanatçı',
    'sarkici',
    'şarkıcı',
    'muzisyen',
    'müzisyen',
  ]).map(normalizeText);

  return {
    publicFigureTerms,
    artistTerms,
    allTerms: uniq([...publicFigureTerms, ...artistTerms]),
  };
}

const REFERENCE_INDEX = buildReferenceIndex();

function findMatchedTerms(text, terms, max = 8) {
  const haystack = normalizeText(text);
  if (!haystack) return [];

  const hits = [];
  for (const term of terms) {
    if (!term) continue;
    if (haystack.includes(term) && !hits.includes(term)) {
      hits.push(term);
    }
    if (hits.length >= max) break;
  }
  return hits;
}

function guessMimeCategory(mime) {
  const value = String(mime || '').toLowerCase();
  if (!value) return 'unknown';
  if (value.startsWith('image/')) return 'image';
  if (value.startsWith('video/')) return 'video';
  if (value.startsWith('audio/')) return 'audio';
  return 'other';
}

function makeDecision({
  decision = 'allow',
  code = 'ALLOW',
  reason = '',
  severity = 'low',
  matchedTerms = [],
  scan = {},
  audit = {},
}) {
  return {
    ok: decision === 'allow',
    decision,
    code,
    reason,
    severity,
    matchedTerms: limit(uniq(matchedTerms), 12),
    scan: {
      engine: scan.engine || 'media-policy-v1',
      hasFace: !!scan.hasFace,
      faceCount: Number(scan.faceCount || 0),
      publicFigureRisk: Number(scan.publicFigureRisk || 0),
      celebrityRisk: Number(scan.celebrityRisk || 0),
      matchedLabel: scan.matchedLabel || null,
      matchedGroup: scan.matchedGroup || null,
      provider: scan.provider || null,
      providerVersion: scan.providerVersion || null,
      raw: scan.raw || null,
    },
    audit: {
      app: audit.app || 'generic',
      fileName: audit.fileName || null,
      mimeType: audit.mimeType || null,
      filePath: audit.filePath || null,
      fileExt: audit.fileExt || null,
      fileHash: audit.fileHash || null,
      source: audit.source || 'upload',
    },
  };
}

function shouldRejectByFileType({ filePath, fileName, mimeType }) {
  const ext = extnameSafe(filePath, fileName);
  const mimeCategory = guessMimeCategory(mimeType);

  if (mimeCategory !== 'image') return null;

  if (DEFAULT_BLOCK_EXTENSIONS.has(ext)) {
    return makeDecision({
      decision: 'block',
      code: 'UNSUPPORTED_IMAGE_TYPE',
      reason: 'Desteklenmeyen görsel formatı.',
      severity: 'medium',
    });
  }

  return null;
}

function evaluateTextHints({ app, prompt, title, description, personName, style }) {
  const joined = [
    prompt,
    title,
    description,
    personName,
    style,
    app,
  ].filter(Boolean).join(' \n ');

  const publicHits = findMatchedTerms(joined, REFERENCE_INDEX.publicFigureTerms, 10);
  const artistHits = findMatchedTerms(joined, REFERENCE_INDEX.artistTerms, 10);

  const hasStrongRealPersonHint = publicHits.length > 0 || artistHits.length > 0;

  return {
    hasStrongRealPersonHint,
    publicHits,
    artistHits,
    joinedText: joined,
  };
}

/**
 * Buradaki provider hook gerçek görsel tarama entegrasyonu için hazır tutulur.
 * İlk aşamada null döner; sonraki adımda buraya face/public-figure scanner bağlanacak.
 *
 * Beklenen örnek dönüş:
 * {
 *   hasFace: true,
 *   faceCount: 1,
 *   publicFigureRisk: 0.93,
 *   celebrityRisk: 0.88,
 *   matchedLabel: 'recep tayyip erdogan',
 *   matchedGroup: 'public_figure',
 *   provider: 'vision-x',
 *   providerVersion: '2026-04-16',
 *   raw: {...}
 * }
 */
async function runVisionScan(input = {}) {
  const providerUrl = String(process.env.MEDIA_POLICY_VISION_URL || "").trim();
  const providerToken = String(process.env.MEDIA_POLICY_VISION_TOKEN || "").trim();

  const filePath = input.filePath || input.path || null;
  const fileName = input.fileName || basenameSafe(filePath, "");
  const mimeType = String(input.mimeType || "").toLowerCase().trim();
  const app = normalizeText(input.app || "generic") || "generic";

  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  if (!providerUrl) {
    return null;
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString("base64");

    const payload = {
      app,
      fileName,
      mimeType,
      imageBase64: base64,
      referenceIndex: input.referenceIndex || null,
    };

    const headers = {
      "content-type": "application/json",
      "accept": "application/json",
    };

    if (providerToken) {
      headers.authorization = `Bearer ${providerToken}`;
    }

    const res = await fetch(providerUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data.ok === false) {
      return {
        hasFace: false,
        faceCount: 0,
        publicFigureRisk: 0,
        celebrityRisk: 0,
        matchedLabel: null,
        matchedGroup: null,
        provider: "vision-provider",
        providerVersion: null,
        raw: {
          providerUrl,
          httpStatus: res.status,
          response: data,
          note: "vision_provider_request_failed",
        },
      };
    }

    return {
      hasFace: !!data.hasFace,
      faceCount: Number(data.faceCount || 0),
      publicFigureRisk: Number(data.publicFigureRisk || 0),
      celebrityRisk: Number(data.celebrityRisk || 0),
      matchedLabel: data.matchedLabel || null,
      matchedGroup: data.matchedGroup || null,
      provider: data.provider || "vision-provider",
      providerVersion: data.providerVersion || null,
      raw: data.raw || data || null,
    };
  } catch (err) {
    return {
      hasFace: false,
      faceCount: 0,
      publicFigureRisk: 0,
      celebrityRisk: 0,
      matchedLabel: null,
      matchedGroup: null,
      provider: "vision-provider",
      providerVersion: null,
      raw: {
        providerUrl,
        error: err && err.message ? String(err.message) : String(err),
        note: "vision_provider_exception",
      },
    };
  }
}

function blockForHighRiskScan({ app, fileMeta, scanResult }) {
  const publicRisk = Number(scanResult.publicFigureRisk || 0);
  const celebRisk = Number(scanResult.celebrityRisk || 0);
  const hasFace = !!scanResult.hasFace;
  const matchedLabel = scanResult.matchedLabel || null;
  const matchedGroup = scanResult.matchedGroup || null;

  if (!hasFace) {
    return makeDecision({
      decision: 'allow',
      code: 'ALLOW_NO_FACE',
      reason: 'Görselde insan yüzü tespit edilmedi.',
      severity: 'low',
      scan: scanResult,
      audit: fileMeta,
    });
  }

  if (publicRisk >= 0.75 || celebRisk >= 0.75) {
    return makeDecision({
      decision: 'block',
      code: 'PUBLIC_FIGURE_IMAGE_BLOCKED',
      reason: 'Yüklenen görsel kamu figürü / tanınmış kişi / gerçek kişi impersonation riski taşıyor.',
      severity: 'high',
      matchedTerms: matchedLabel ? [matchedLabel] : [],
      scan: {
        ...scanResult,
        matchedGroup: matchedGroup || 'public_figure_risk',
      },
      audit: fileMeta,
    });
  }

  return makeDecision({
    decision: 'allow',
    code: 'ALLOW_LOW_RISK_FACE',
    reason: 'Görsel tarandı, yüksek kamu figürü riski bulunmadı.',
    severity: 'low',
    matchedTerms: matchedLabel ? [matchedLabel] : [],
    scan: scanResult,
    audit: fileMeta,
  });
}

async function enforceMediaPolicy(input = {}) {
  const app = normalizeText(input.app || 'generic') || 'generic';
  const filePath = input.filePath || input.path || null;
  const fileName = input.fileName || basenameSafe(filePath, '');
  const mimeType = String(input.mimeType || input.contentType || '').toLowerCase();
  const source = input.source || 'upload';

  const fileMeta = {
    app,
    fileName: fileName || null,
    mimeType: mimeType || null,
    filePath: filePath || null,
    fileExt: extnameSafe(filePath, fileName) || null,
    fileHash: filePath ? sha1File(filePath) : null,
    source,
  };

  const typeRejection = shouldRejectByFileType({ filePath, fileName, mimeType });
  if (typeRejection) {
    return {
      ...typeRejection,
      audit: {
        ...typeRejection.audit,
        ...fileMeta,
      },
    };
  }

  const mimeCategory = guessMimeCategory(mimeType);
  if (mimeCategory !== 'image') {
    return makeDecision({
      decision: 'allow',
      code: 'ALLOW_NON_IMAGE',
      reason: 'Media policy bu aşamada sadece image upload için aktif.',
      severity: 'low',
      audit: fileMeta,
    });
  }

  const hintResult = evaluateTextHints({
    app,
    prompt: input.prompt,
    title: input.title,
    description: input.description,
    personName: input.personName,
    style: input.style,
  });

  const visionScan = await runVisionScan({
    app,
    filePath,
    fileName,
    mimeType,
    referenceIndex: REFERENCE_INDEX,
  });

  if (visionScan) {
    return blockForHighRiskScan({
      app,
      fileMeta,
      scanResult: visionScan,
    });
  }

  if (hintResult.hasStrongRealPersonHint) {
    return makeDecision({
      decision: 'block',
      code: 'REAL_PERSON_IMAGE_RISK',
      reason:
        'Prompt tarafında kamu figürü, ünlü veya gerçek kişi referansı bulundu. Görsel scan provider henüz bağlı olmadığı için güvenli tarafta bloklandı.',
      severity: 'high',
      matchedTerms: [...hintResult.publicHits, ...hintResult.artistHits],
      scan: {
        engine: 'media-policy-v1',
        hasFace: false,
        faceCount: 0,
        publicFigureRisk: 0.5,
        celebrityRisk: 0.5,
        matchedLabel: hintResult.publicHits[0] || hintResult.artistHits[0] || null,
        matchedGroup: hintResult.publicHits.length ? 'public_figure_text_hint' : 'artist_text_hint',
        provider: null,
        providerVersion: null,
        raw: {
          note: 'Vision provider not connected yet',
        },
      },
      audit: fileMeta,
    });
  }

  return makeDecision({
    decision: 'allow',
    code: 'ALLOW_IMAGE_PENDING_PROVIDER',
    reason:
      'Görsel için merkezi media policy çalıştı. Vision provider henüz bağlı değil; bu yüzden sadece temel güvenlik kontrolleri uygulandı.',
    severity: 'low',
    scan: {
      engine: 'media-policy-v1',
      hasFace: false,
      faceCount: 0,
      publicFigureRisk: 0,
      celebrityRisk: 0,
      matchedLabel: null,
      matchedGroup: null,
      provider: null,
      providerVersion: null,
      raw: {
        note: 'Vision provider not connected yet',
      },
    },
    audit: fileMeta,
  });
}

function mediaPolicyError(result) {
  return {
    ok: false,
    error: result.code || 'MEDIA_POLICY_BLOCKED',
    message:
      result.reason ||
      'Yüklenen görsel, gerçek kişi / kamu figürü / tanınmış kişi güvenlik kurallarına takıldı.',
    policy: result,
  };
}

module.exports = {
  enforceMediaPolicy,
  mediaPolicyError,
  REFERENCE_INDEX,
};
