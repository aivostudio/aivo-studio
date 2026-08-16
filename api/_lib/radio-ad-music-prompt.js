// Radio-specific Stable Audio prompt builder.
const ALLOWED_DURATIONS = new Set([10, 15, 20, 30, 45, 60]);

const STYLE_PROMPTS = Object.freeze({
  cinematic: "premium cinematic radio-ad music bed, confident pulse, polished brand character, modern trailer restraint",
  corporate: "modern corporate advertising music bed, optimistic rhythm, clean trustworthy instrumentation, polished commercial character",
  electronic: "contemporary electronic advertising music bed, precise synth pulse, modern technology character, clean controlled production",
  acoustic: "warm acoustic advertising music bed, organic instruments, approachable human character, polished intimate production",
});

const ENERGY_PROMPTS = Object.freeze({
  soft: "soft, warm and controlled energy that stays clearly behind the narration",
  balanced: "balanced, engaging and professionally paced commercial energy",
  strong: "strong, confident and attention-grabbing energy without overpowering the narration",
  high: "high-energy, fast-moving commercial momentum with disciplined dynamics and a clear brand ending",
});

function clean(value, max = 1200) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function key(value) {
  return clean(value, 80).toLocaleLowerCase("tr-TR");
}

function duration(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && ALLOWED_DURATIONS.has(parsed) ? parsed : 10;
}

function includesAny(source, terms) {
  return terms.some((term) => source.includes(term));
}

function inferProfile(input = {}) {
  const source = [input.text, input.title, input.voiceStyle]
    .map((value) => key(value))
    .join(" ");

  if (includesAny(source, ["aivo", "yapay zeka", "ai ", "teknoloji", "uygulama", "platform", "software", "dijital", "video", "görsel", "muzik", "müzik"])) {
    return { style: "electronic", energy: "balanced", reason: "technology" };
  }
  if (includesAny(source, ["banka", "sigorta", "sağlık", "hukuk", "kurumsal", "güven", "yatırım", "finans"])) {
    return { style: "corporate", energy: "balanced", reason: "trust" };
  }
  if (includesAny(source, ["lüks", "premium", "parfüm", "mücevher", "saat", "otomobil", "araba", "konut", "gayrimenkul"])) {
    return { style: "cinematic", energy: "strong", reason: "premium" };
  }
  if (includesAny(source, ["kahve", "restoran", "doğal", "organik", "aile", "çocuk", "ev", "sıcak"])) {
    return { style: "acoustic", energy: "soft", reason: "warm" };
  }
  if (includesAny(source, ["kampanya", "indirim", "hemen", "şimdi", "fırsat", "spor", "enerji", "hızlı"])) {
    return { style: "electronic", energy: "high", reason: "promotion" };
  }
  return { style: "corporate", energy: "balanced", reason: "default" };
}

function resolveProfile(input = {}) {
  const requestedStyle = ["auto", "cinematic", "corporate", "electronic", "acoustic"].includes(key(input.style))
    ? key(input.style)
    : "auto";
  const requestedEnergy = ["balanced", "soft", "strong", "high"].includes(key(input.energy))
    ? key(input.energy)
    : "balanced";
  const automatic = inferProfile(input);
  return {
    requestedStyle,
    requestedEnergy,
    resolvedStyle: requestedStyle === "auto" ? automatic.style : requestedStyle,
    resolvedEnergy: requestedStyle === "auto" && !clean(input.energy) ? automatic.energy : requestedEnergy,
    automaticReason: requestedStyle === "auto" ? automatic.reason : null,
  };
}

export function buildRadioAdMusicPrompt(input = {}) {
  const seconds = duration(input.duration);
  const narrationText = clean(input.text, 1600);
  const voiceStyle = clean(input.voiceStyle, 80);
  const profile = resolveProfile(input);
  const stylePrompt = STYLE_PROMPTS[profile.resolvedStyle] || STYLE_PROMPTS.corporate;
  const energyPrompt = ENERGY_PROMPTS[profile.resolvedEnergy] || ENERGY_PROMPTS.balanced;

  const prompt = [
    `Create an exact ${seconds}-second original instrumental radio advertising music bed.`,
    stylePrompt + ".",
    energyPrompt + ".",
    voiceStyle ? `Match a ${voiceStyle} professional narration character.` : "",
    narrationText ? `Advertising message context: ${narrationText}.` : "",
    "Begin immediately with a recognizable but original commercial identity; no long intro and no silence at the start.",
    "Leave clear spectral space in the vocal midrange and keep percussion, bass and melodic movement controlled under speech.",
    "Use a clean opening, a subtle lift through the middle, and a decisive brand-ready ending exactly at the final second.",
    "The cue must remain useful under continuous voice-over, with no sudden level jumps and no distracting solo instrument.",
    "Modern polished stereo mix, broadcast-friendly, memorable but restrained, suitable for professional radio post-production.",
    "Instrumental only. No vocals, no singing, no spoken words, no lyrics, no choir, no recognizable copyrighted melody, no watermark.",
  ].filter(Boolean).join(" ");

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
    "silence at beginning",
    "abrupt cutoff",
    "uncontrolled fade",
    "clipping",
    "distortion",
    "harsh noise",
    "audio watermark",
    "low quality",
  ].join(", ");

  return {
    prompt,
    negativePrompt,
    duration: seconds,
    ...profile,
  };
}

export { ALLOWED_DURATIONS, inferProfile, resolveProfile };
