module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  return res.status(200).json({
    ok: true,
    step: "finalize_route_alive",
    job_id: String(req.body?.job_id || ""),
    force: !!req.body?.force
  });
};
