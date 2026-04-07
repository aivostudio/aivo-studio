let MEMORY_STORE = globalThis.__AIVO_CARTOON_STUDIO_STATE_STORE__;
if (!MEMORY_STORE) {
  MEMORY_STORE = new Map();
  globalThis.__AIVO_CARTOON_STUDIO_STATE_STORE__ = MEMORY_STORE;
}

function getClientKey(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").trim();
  const realIp = String(req.headers["x-real-ip"] || "").trim();
  const cookie = String(req.headers.cookie || "").trim();

  if (cookie) return `cookie:${cookie}`;
  if (forwardedFor) return `ip:${forwardedFor.split(",")[0].trim()}`;
  if (realIp) return `ip:${realIp}`;
  return "anonymous";
}

function sanitizePayload(body) {
  return {
    app: "cartoon",
    mode: "studio",
    format: String(body?.format || "16:9"),

    scenes: Array.isArray(body?.scenes)
      ? body.scenes.map((scene, index) => ({
          id: String(scene?.id || `scene-${Date.now()}-${index + 1}`),
          title: String(scene?.title || "Sahne"),
          duration: Number(scene?.duration) || 0,
          included: !!scene?.included,
          videoUrl: String(scene?.videoUrl || ""),
          fileName: String(scene?.fileName || "")
        }))
      : [],

    voice: {
      fileName: String(body?.voice?.fileName || ""),
      fileUrl: String(body?.voice?.fileUrl || ""),
      uploadStatus: String(body?.voice?.uploadStatus || "idle")
    },

    logo: {
      fileName: String(body?.logo?.fileName || ""),
      fileUrl: String(body?.logo?.fileUrl || ""),
      uploadStatus: String(body?.logo?.uploadStatus || "idle")
    },

    updatedAt: new Date().toISOString()
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "method_not_allowed"
    });
  }

  try {
    const body = req.body || {};
    const clientKey = getClientKey(req);
    const payload = sanitizePayload(body);

    MEMORY_STORE.set(clientKey, payload);

    return res.status(200).json({
      ok: true,
      saved: true,
      app: payload.app,
      mode: payload.mode,
      updatedAt: payload.updatedAt
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "studio_state_save_failed"
    });
  }
}
