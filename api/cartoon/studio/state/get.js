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

function buildDefaultState() {
  return {
    format: "16:9",
    scenes: [],
    voice: {
      fileName: "",
      fileUrl: "",
      uploadStatus: "idle"
    },
    logo: {
      fileName: "",
      fileUrl: "",
      uploadStatus: "idle"
    }
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "method_not_allowed"
    });
  }

  try {
    const clientKey = getClientKey(req);
    const saved = MEMORY_STORE.get(clientKey);

    const state = saved && typeof saved === "object"
      ? {
          format: String(saved.format || "16:9"),
          scenes: Array.isArray(saved.scenes)
            ? saved.scenes.map((scene, index) => ({
                id: String(scene?.id || `saved-${Date.now()}-${index + 1}`),
                title: String(scene?.title || "Sahne"),
                duration: Number(scene?.duration) || 0,
                included: !!scene?.included,
                videoUrl: String(scene?.videoUrl || ""),
                fileName: String(scene?.fileName || "")
              }))
            : [],
          voice: {
            fileName: String(saved?.voice?.fileName || ""),
            fileUrl: String(saved?.voice?.fileUrl || ""),
            uploadStatus: String(saved?.voice?.uploadStatus || "idle")
          },
          logo: {
            fileName: String(saved?.logo?.fileName || ""),
            fileUrl: String(saved?.logo?.fileUrl || ""),
            uploadStatus: String(saved?.logo?.uploadStatus || "idle")
          }
        }
      : buildDefaultState();

    return res.status(200).json({
      ok: true,
      ...state
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "studio_state_get_failed"
    });
  }
}
