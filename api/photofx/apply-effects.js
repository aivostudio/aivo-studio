module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "method_not_allowed",
    });
  }

  const body = req.body || {};
  const job_id = body.job_id ? String(body.job_id).trim() : null;

  return res.status(200).json({
    ok: true,
    disabled: true,
    mode: "prompt_enhancer_only",
    step: "effects_bypassed",
    job_id,
    message:
      "PhotoFX apply-effects pipeline is disabled. Selected effects are now used only as hidden prompt enhancers during create.",
  });
};
