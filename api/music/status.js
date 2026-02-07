// =========================================================
// ✅ TEMP FORCE READY (TEST MP3)
// Worker şu an queued dönüyor ama R2 altyapı hazır olduğu için
// UI'nin player'ı çalıştırabilmesi için ready + audio.src üretelim.
//
// Bu blok daha sonra worker gerçek ready döndürmeye başlayınca kaldırılabilir.
// =========================================================
if (data && data.ok === true) {
  const st = String(data.state || data.status || "").toLowerCase();

  if (st === "queued" || st === "processing" || st === "pending") {
    data.state = "ready";
    data.status = "ready";

    // output_id yoksa test output id ver
    const outId =
      data.output_id ||
      data?.audio?.output_id ||
      "test";

    data.output_id = outId;

    // provider_job_id "xxx::rev1" ise base id ile devam et
    const baseId = provider_job_id.split("::")[0];

    data.audio = data.audio || {};
    data.audio.output_id = data.audio.output_id || outId;

    // ---------------------------------------------------------
    // ⚠️ KRİTİK:
    // /files/play endpoint'i provider_job_id ile değil,
    // internal job id ile çağrılmalı.
    //
    // Worker response'u internal_job_id döndürüyorsa onu kullanacağız.
    // Yoksa audio.src üretmeyelim (yanlış URL üretip 404 spam yapmayalım).
    // ---------------------------------------------------------
    const internalJobId =
      data.internal_job_id ||
      data.internalJobId ||
      data.job_id_internal ||
      data.internal_id ||
      data.job_internal ||
      null;

    // debug alanları (UI'da sorun olmasın diye harmless)
    data.provider_job_id = baseId;
    data.internal_job_id = internalJobId;

    if (internalJobId) {
      // audio.src yoksa /files/play üret
      data.audio.src =
        data.audio.src ||
        `/files/play?job_id=${encodeURIComponent(internalJobId)}&output_id=${encodeURIComponent(outId)}`;
    } else {
      // internal id yoksa src boş bırakıyoruz (UI ready görsün ama 404 spam olmasın)
      data.audio.src = data.audio.src || "";
      data.audio.error = "missing_internal_job_id_for_play";
    }
  }
}
