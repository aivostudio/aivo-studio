// =========================================================
// ✅ FINALIZE CALL (R2 outputs index + output meta create)
// Bu blok generate.js içinde provider job ready olduktan sonra çağrılır
// =========================================================

async function callFinalize({
  provider_job_id,
  internal_job_id,
  output_id_guess
}) {
  // ⚠️ worker gerçek output id döndürüyorsa onu kullan
  // ama yoksa senin sistemde output file adı genelde output_id gibi oluyor

  const fileKey = `jobs/${internal_job_id}/outputs/${output_id_guess}.mp3`;

  const r = await fetch("/api/music/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify({
      provider_job_id,
      internal_job_id,
      file_key: fileKey,
      file_name: `${output_id_guess}.mp3`,
      mime: "audio/mpeg"
    }),
  });

  let j = null;
  try { j = await r.json(); } catch { j = null; }

  if (!r.ok || !j || j.ok === false) {
    console.warn("[generate] finalize failed:", j);
    return {
      ok: false,
      error: j?.error || `HTTP_${r.status}`,
      raw: j
    };
  }

  return j;
}

// =========================================================
// ✅ generate handler içinde kullanımı
// =========================================================

try {
  // burada sen zaten provider generate çağırıyorsun
  // providerResponse = worker generate response gibi düşün

  const providerResponse = workerData; // ⚠️ bunu kendi değişkenine göre ayarla

  const provider_job_id =
    providerResponse?.provider_job_id ||
    providerResponse?.job_id ||
    providerResponse?.id ||
    null;

  if (!provider_job_id) {
    return res.status(200).json({
      ok: false,
      error: "missing_provider_job_id_from_worker",
      raw: providerResponse
    });
  }

  // internal_job_id senin sistemde genelde uuid/test vs.
  // burada kesin olması lazım
  const internal_job_id = internalJobId; // ⚠️ sende hangi değişkense ona bağla

  // worker hazır döndürüyorsa output_id yakala
  const output_id_guess =
    providerResponse?.output_id ||
    providerResponse?.audio?.output_id ||
    "a1b2c3"; // fallback

  // ✅ FINALIZE ÇAĞIR
  const finalizeResult = await callFinalize({
    provider_job_id,
    internal_job_id,
    output_id_guess
  });

  console.log("[generate] finalizeResult:", finalizeResult);

  return res.status(200).json({
    ok: true,
    provider_job_id,
    internal_job_id,
    output_id: finalizeResult?.output_id || null,
    play_url: finalizeResult?.play_url || null,
    finalize: finalizeResult,
    raw_worker: providerResponse
  });

} catch (err) {
  console.error("[generate] finalize pipeline error:", err);
  return res.status(200).json({
    ok: false,
    error: "finalize_pipeline_error",
    message: String(err?.message || err)
  });
}
