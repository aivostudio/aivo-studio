const ALLOWED_DURATIONS = new Set([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

const STYLE_PROMPTS = Object.freeze({
  pop: "modern polished commercial pop instrumental, catchy rhythm, bright memorable advertising feel",
  cinematic: "premium cinematic advertising soundtrack, confident dramatic pulse, polished brand-film character",
  corporate: "clean uplifting corporate advertising instrumental, polished professional brand tone, confident modern pulse, presentation-ready commercial character",
  electronic: "modern electronic commercial instrumental, clean synth pulse, precise contemporary production",
  acoustic: "warm organic acoustic advertising instrumental, tasteful guitar, piano and light percussion, approachable premium brand character, clean commercial pacing",
  classical: "elegant modern classical advertising instrumental, refined orchestral textures, premium timeless character",
  rnb: "smooth contemporary R&B advertising instrumental, tasteful groove, warm modern production",
  latin: "modern Latin commercial instrumental, rhythmic percussion, warm lively premium energy",
});

const ENERGY_PROMPTS = Object.freeze({
  calm: "calm, controlled, warm and elegant energy",
  balanced: "balanced, engaging and professionally paced energy",
  strong: "powerful, energetic and immediately attention-grabbing energy",
});

const STYLE_ALIASES = Object.freeze({
  auto: "auto",
  aivo: "auto",
  recommendation: "auto",
  pop: "pop",
  cinematic: "cinematic",
  sinematik: "cinematic",
  corporate: "corporate",
  kurumsal: "corporate",
  electronic: "electronic",
  elektronik: "electronic",
  acoustic: "acoustic",
  akustik: "acoustic",
  classical: "classical",
  klasik: "classical",
  "r&b": "rnb",
  rnb: "rnb",
  latin: "latin",
});

const ENERGY_ALIASES = Object.freeze({
  calm: "calm",
  sakin: "calm",
  soft: "calm",
  yumuşak: "calm",
  yumusak: "calm",
  balanced: "balanced",
  dengeli: "balanced",
  strong: "strong",
  güçlü: "strong",
  guclu: "strong",
  high: "strong",
  yüksek: "strong",
  yuksek: "strong",
});

const VISUAL_STYLE_PROMPTS = Object.freeze({
  premium: "premium product presentation",
  premium_product: "premium product presentation",
  minimal: "clean minimal visual language",
  luxury: "luxury visual language",
  luks: "luxury visual language",
  social: "fast modern social-media visual language",
  social_media: "fast modern social-media visual language",
  studio: "controlled studio visual language",
  cinematic: "cinematic visual language",
  sinematik: "cinematic visual language",
});

function cleanText(value, maxLength = 240) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeKey(value) {
  return cleanText(value, 50).toLocaleLowerCase("tr-TR");
}

function normalizeDuration(value) {
  const duration = Number(value);
  return Number.isInteger(duration) && ALLOWED_DURATIONS.has(duration) ? duration : 10;
}

function keywordMatch(haystack, words) {
  return words.some((word) => haystack.includes(word));
}

function inferAutomaticProfile(input) {
  const source = [
    input.productName,
    input.brandName,
    input.description,
    input.targetAudience,
    input.cta,
  ]
    .map((value) => normalizeKey(value))
    .join(" ");

  if (
    keywordMatch(source, [
      "lastik",
      "otomobil",
      "araba",
      "motor",
      "otomotiv",
      "vehicle",
      "car ",
      "tire",
      "tyre",
    ])
  ) {
    return { style: "cinematic", energy: "strong", reason: "automotive" };
  }

  if (
    keywordMatch(source, [
      "spor",
      "fitness",
      "ayakkabı",
      "sneaker",
      "koşu",
      "antrenman",
      "sport",
      "workout",
    ])
  ) {
    return { style: "electronic", energy: "strong", reason: "sport" };
  }

  if (
    keywordMatch(source, [
      "çocuk",
      "oyuncak",
      "bebek",
      "kids",
      "child",
      "toy",
    ])
  ) {
    return { style: "pop", energy: "strong", reason: "children" };
  }

  if (
    keywordMatch(source, [
      "parfüm",
      "parfum",
      "perfume",
      "mücevher",
      "jewelry",
      "saat",
      "luxury",
      "lüks",
    ])
  ) {
    return { style: "cinematic", energy: "balanced", reason: "luxury" };
  }

  if (
    keywordMatch(source, [
      "kahve",
      "coffee",
      "kafe",
      "cafe",
      "çikolata",
      "chocolate",
      "tatlı",
      "dessert",
    ])
  ) {
    return { style: "rnb", energy: "calm", reason: "coffee_food" };
  }

  if (
    keywordMatch(source, [
      "restoran",
      "restaurant",
      "yemek",
      "food",
      "mutfak",
      "kitchen",
    ])
  ) {
    return { style: "latin", energy: "balanced", reason: "restaurant" };
  }

  if (
    keywordMatch(source, [
      "kozmetik",
      "cosmetic",
      "bakım",
      "beauty",
      "cilt",
      "skincare",
      "makyaj",
      "makeup",
    ])
  ) {
    return { style: "rnb", energy: "balanced", reason: "beauty" };
  }

  if (
    keywordMatch(source, [
      "teknoloji",
      "technology",
      "yapay zeka",
      "artificial intelligence",
      "uygulama",
      "software",
      "app ",
      "telefon",
      "phone",
      "kulaklık",
      "headphone",
    ])
  ) {
    return { style: "electronic", energy: "balanced", reason: "technology" };
  }

  if (
    keywordMatch(source, [
      "banka",
      "bank",
      "sigorta",
      "insurance",
      "hukuk",
      "law",
      "sağlık",
      "health",
    ])
  ) {
    return { style: "classical", energy: "balanced", reason: "trust" };
  }

  return { style: "cinematic", energy: "balanced", reason: "default" };
}

function resolveMusicProfile(input = {}) {
  const requestedStyle = STYLE_ALIASES[normalizeKey(input.musicStyle)] || "auto";
  const requestedEnergy = ENERGY_ALIASES[normalizeKey(input.musicEnergy)] || "balanced";
  const automatic = inferAutomaticProfile(input);

  return {
    requestedStyle,
    requestedEnergy,
    resolvedStyle: requestedStyle === "auto" ? automatic.style : requestedStyle,
    resolvedEnergy:
      requestedStyle === "auto" && !normalizeKey(input.musicEnergy)
        ? automatic.energy
        : requestedEnergy,
    automaticReason: requestedStyle === "auto" ? automatic.reason : null,
  };
}

function buildAdFilmMusicPrompt(input = {}) {
  const duration = normalizeDuration(input.duration);
  const productName = cleanText(input.productName, 80);
  const brandName = cleanText(input.brandName, 60);
  const description = cleanText(input.description, 420);
  const targetAudience = cleanText(input.targetAudience, 100);
  const cta = cleanText(input.cta, 100);
  const voiceStyle = cleanText(input.voiceStyle, 80);
  const visualStyleKey = normalizeKey(input.visualStyle);
  const visualStyle =
    VISUAL_STYLE_PROMPTS[visualStyleKey] || cleanText(input.visualStyle, 80);
  const voiceEnabled = input.voiceEnabled !== false;

  const profile = resolveMusicProfile(input);
  const stylePrompt = STYLE_PROMPTS[profile.resolvedStyle] || STYLE_PROMPTS.cinematic;
  const energyPrompt =
    ENERGY_PROMPTS[profile.resolvedEnergy] || ENERGY_PROMPTS.balanced;

  const contextParts = [];
  if (productName) contextParts.push(`Product or service: ${productName}.`);
  if (brandName) contextParts.push(`Brand: ${brandName}.`);
  if (description) contextParts.push(`Campaign brief: ${description}.`);
  if (targetAudience) contextParts.push(`Target audience: ${targetAudience}.`);
  if (cta) contextParts.push(`Call to action: ${cta}.`);
  if (visualStyle) contextParts.push(`Match a ${visualStyle}.`);
  if (voiceStyle && voiceEnabled) {
    contextParts.push(`The voice-over character is ${voiceStyle}.`);
  }

  const voiceMixInstruction = voiceEnabled
    ? "Instrumental only. Keep the midrange controlled and leave clear spectral space for a professional voice-over throughout the advertisement."
    : "Instrumental only, with a fuller musical arrangement because no voice-over will be used.";

  const prompt = [
    `Create an exact ${duration}-second original advertising music cue.`,
    stylePrompt + ".",
    energyPrompt + ".",
    ...contextParts,
    voiceMixInstruction,
    "Start immediately with a clear musical identity; no long intro.",
    `Build naturally across ${duration} seconds and reach a clean, decisive brand-ready ending exactly at the final beat.`,
    "Modern polished stereo commercial mix, memorable but not distracting, suitable for final post-production and social-media advertising.",
    "No vocals, no singing, no spoken words, no lyrics, no copyrighted melody imitation, no audio watermark.",
  ]
    .filter(Boolean)
    .join(" ");

  const negativePrompt = [
    "vocals",
    "singing",
    "spoken words",
    "lyrics",
    "voice",
    "choir",
    "copyrighted melody",
    "recognizable song",
    "long intro",
    "abrupt cutoff",
    "uncontrolled fade-out",
    "clipping",
    "distortion",
    "harsh noise",
    "audio watermark",
    "low quality",
  ].join(", ");

  return {
    prompt,
    negativePrompt,
    duration,
    voiceEnabled,
    ...profile,
    engine: "fal-ai/stable-audio-3/medium/text-to-audio",
  };
}

export {
  ALLOWED_DURATIONS,
  STYLE_PROMPTS,
  ENERGY_PROMPTS,
  buildAdFilmMusicPrompt,
  inferAutomaticProfile,
  resolveMusicProfile,
};
