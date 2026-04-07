export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "method_not_allowed"
    });
  }

  try {
    const body = req.body || {};

    return res.status(200).json({
      ok: true,
      saved: true,
      app: String(body?.app || "cartoon"),
      mode: String(body?.mode || "studio")
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "studio_state_save_failed"
    });
  }
}
