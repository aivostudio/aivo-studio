// api/ad-film/narration/create.js
export const config = { runtime: "nodejs" };

import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

const PRIMARY_MODEL = "fal-ai/elevenlabs/tts/eleven-v3";
const FALLBACK_MODEL = "fal-ai/gemini-3.1-flash-tts";

const LANGUAGES = new Map([
  ["tr", "Turkish (Turkey)"],
  ["en", "English (US)"],
  ["de", "German (Germany)"],
  ["fr", "French (France)"],
  ["es", "Spanish (Spain)"],
  ["it", "Italian (Italy)"],
  ["pt", "Portuguese (Brazil)"],
  ["ar", "Arabic (World)"],
  ["ru", "Russian (Russia)"],
  ["nl", "Dutch (Netherlands)"],
  ["pl", "Polish (Poland)"],
  ["uk", "Ukrainian (Ukraine)"],
  ["hi", "Hindi (India)"],
  ["id", "Indonesian (Indonesia)"],
  ["ms", "Malay (Malaysia)"],
  ["ja", "Japanese (Japan)"],
  ["ko", "Korean (South Korea)"],
  ["zh", "Chinese Mandarin (China)"],
  ["vi", "Vietnamese (Vietnam)"],
  ["th", "Thai (Thailand)"],
]);

const VOICES = {
  warm_female: { primary: "Aria", fallback: "Aoede" },
  professional_male: { primary: "Roger", fallback: "Charon" },
  energetic_male: { primary: "Liam", fallback: "Puck" },
  clear_female: { primary: "Sarah", fallback: "Zephyr" },
};

const STYLES = new Set(["warm", "energetic", "premium", "natural"]);
const SPEEDS = new Set(["slow", "balanced", "fast"]);
const FLOWS = new Set(["natural", "balanced", "emphatic"]);
const RATE = {
  slow: { target: 1.45, max: 1.6 },
  balanced: { target: 1.8, max: 2.0 },
  fast: { target: 2.15, max: 2.4 },
};

function clean(value, max = 1200) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function falKey() {
  return process.env.FAL_KEY || process.env.FAL_API_KEY || "";
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch (_) {
    return { raw: text || "" };
  }
}

function words(text) {
  try {
    return text.match(/[\p{L}\p{N}]+(?:[’'\-.][\p{L}\p{N}]+)*/gu) || [];
  } catch (_) {
    return text.split(/\s+/).filter(Boolean);
  }
}

function timing(text, duration, speed) {
  const count = words(text).length;
  const rate = RATE[speed] || RATE.balanced;
  const commas = (text.match(/[,;:]/g) || []).length;
  const stops = (text.match(/[.!?…]/g) || []).length;
  const estimatedSeconds = count / rate.target + commas * 0.12 + stops * 0.28;
  return {
    wordCount: count,
    maxWords: Math.max(5, Math.floor(duration * rate.max)),
    estimatedSeconds: Number(estimatedSeconds.toFixed(2)),
  };
}

function activeGeneration(project) {
  const generation = project?.narrationGeneration;
  if (!generation || !["queued", "processing"].includes(String(generation.status))) return false;
  const startedAt = Date.parse(generation.startedAt || "");
  return Number.isFinite(startedAt) && Date.now() - startedAt < 12 * 60 * 1000;
}

function primarySettings(style, flow) {
  const base = {
    warm: { stability: 0.56, similarity_boost: 0.78, style: 0.3 },
    energetic: { stability: 0.34, similarity_boost: 0.75, style: 0.68 },
    premium: { stability: 0.72, similarity_boost: 0.82, style: 0.22 },
    natural: { stability: 0.5, similarity_boost: 0.76, style: 0.16 },
  }[style] || { stability: 0.5, similarity_boost: 0.76, style: 0.2 };

  let stability = base.stability;
  let styleAmount = base.style;
  if (flow === "natural") { stability += 0.05; styleAmount -= 0.04; }
  if (flow === "emphatic") { stability -= 0.08; styleAmount += 0.14; }
  return {
    stability: Math.max(0.2, Math.min(0.85, Number(stability.toFixed(2)))),
    similarity_boost: base.similarity_boost,
    style: Math.max(0, Math.min(0.85, Number(styleAmount.toFixed(2)))),
  };
}

function speedValue(speed) {
  return speed === "slow" ? 0.88 : speed === "fast" ? 1.12 : 1;
}

function fallbackInstructions(style, speed, flow, language) {
  const styleText = {
    warm: "Warm, reassuring and trustworthy commercial delivery.",
    energetic: "Energetic, confident and lively advertising delivery.",
    premium: "Premium, calm, polished and cinematic commercial delivery.",
    natural: "Natural, conversational and human delivery.",
  }[style];
  const speedText = speed === "slow" ? "Use a measured pace." : speed === "fast" ? "Use a brisk but clearly intelligible pace." : "Use a balanced pace.";
  const flowText = flow === "emphatic" ? "Emphasize the key product and brand words." : flow === "balanced" ? "Keep emphasis controlled and balanced." : "Use smooth, natural phrasing and pauses.";
  return `${styleText} ${speedText} ${flowText} Speak only the supplied text in ${language}. Do not add, remove or translate any words.`;
}

function providerInput(provider, settings) {
  const voice = VOICES[settings.voice] || VOICES.warm_female;
  if (provider === "primary") {
    return {
      text: settings.text,
      voice: voice.primary,
      language_code: settings.language,
      speed: speedValue(settings.speed),
      ...primarySettings(settings.voiceStyle, settings.flow),
      apply_text_normalization: "auto",
      output_format: "mp3_44100_128",
    };
  }

  return {
    prompt: settings.text,
    style_instructions: fallbackInstructions(
      settings.voiceStyle,
      settings.speed,
      settings.flow,
      LANGUAGES.get(settings.language)
    ),
    voice: voice.fallback,
    language_code: LANGUAGES.get(settings.language),
    output_format: "mp3",
  };
}

async function queue(provider, settings, key) {
  const model = provider === "primary" ? PRIMARY_MODEL : FALLBACK_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ ...providerInput(provider, settings) }),
      signal: controller.signal,
    });
    const data = parseJson(await response.text().catch(() => ""));
    const requestId = clean(data?.request_id || data?.requestId || data?.id, 240);
    const statusUrl = clean(data?.status_url || data?.statusUrl || data?.urls?.status, 1600);
    const responseUrl = clean(data?.response_url || data?.responseUrl || data?.urls?.response, 1600);
    return { ok: response.ok && !!requestId, status: response.status, data, model, requestId, statusUrl, responseUrl };
  } catch (error) {
    return { ok: false, status: 504, data: { message: String(error?.message || error) }, model };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projectId = clean(req.body?.projectId, 120);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    const project = await getOwnedProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });
    if (activeGeneration(project)) {
      return sendJson(res, 409, { ok: false, error: "narration_generation_in_progress", generation: project.narrationGeneration });
    }

    const text = clean(req.body?.text, 650);
    const language = clean(req.body?.language, 10).toLowerCase();
    const voice = clean(req.body?.voice, 40).toLowerCase();
    const voiceStyle = clean(req.body?.voiceStyle, 30).toLowerCase();
    const speed = clean(req.body?.speed, 20).toLowerCase();
    const flow = clean(req.body?.flow, 20).toLowerCase();
    const duration = Number.parseInt(req.body?.duration, 10);

    if (text.length < 3) return sendJson(res, 400, { ok: false, error: "missing_narration_text" });
    if (!LANGUAGES.has(language)) return sendJson(res, 400, { ok: false, error: "unsupported_language" });
    if (!VOICES[voice]) return sendJson(res, 400, { ok: false, error: "unsupported_voice" });
    if (!STYLES.has(voiceStyle)) return sendJson(res, 400, { ok: false, error: "unsupported_voice_style" });
    if (!SPEEDS.has(speed)) return sendJson(res, 400, { ok: false, error: "unsupported_speed" });
    if (!FLOWS.has(flow)) return sendJson(res, 400, { ok: false, error: "unsupported_flow" });
    if (!Number.isFinite(duration) || duration < 4 || duration > 20) {
      return sendJson(res, 400, { ok: false, error: "invalid_duration" });
    }

    const measured = timing(text, duration, speed);
    if (measured.wordCount > measured.maxWords || measured.estimatedSeconds > duration + 0.5) {
      return sendJson(res, 400, {
        ok: false,
        error: "narration_too_long",
        word_count: measured.wordCount,
        max_words: measured.maxWords,
        estimated_seconds: measured.estimatedSeconds,
      });
    }

    const key = falKey();
    if (!key) return sendJson(res, 500, { ok: false, error: "missing_fal_key" });

    const settings = { text, language, voice, voiceStyle, speed, flow, duration };
    let queued = await queue("primary", settings, key);
    let provider = "primary";
    let fallbackUsed = false;

    if (!queued.ok) {
      queued = await queue("fallback", settings, key);
      provider = "fallback";
      fallbackUsed = true;
    }

    if (!queued.ok) {
      return sendJson(res, 502, {
        ok: false,
        error: "narration_queue_failed",
        fal_status: queued.status,
        fal_response: queued.data,
      });
    }

    const now = new Date().toISOString();
    const nextProject = await saveProject(user, {
      ...project,
      narration: {
        ...(project.narration || {}),
        enabled: true,
        text,
        language,
        voice,
        voiceStyle,
        speed,
        flow,
        audio: null,
      },
      narrationGeneration: {
        provider,
        model: queued.model,
        requestId: queued.requestId,
        statusUrl: queued.statusUrl || null,
        responseUrl: queued.responseUrl || null,
        status: "queued",
        fallbackUsed,
        startedAt: now,
        updatedAt: now,
        completedAt: null,
        error: null,
        input: settings,
        timing: measured,
      },
    });

    return sendJson(res, 200, {
      ok: true,
      projectId,
      status: "IN_QUEUE",
      fallback_used: fallbackUsed,
      timing: measured,
      narration: nextProject.narration,
    });
  } catch (error) {
    console.error("[ad-film/narration/create]", error);
    return sendJson(res, 500, { ok: false, error: "server_error", message: String(error?.message || error) });
  }
}
