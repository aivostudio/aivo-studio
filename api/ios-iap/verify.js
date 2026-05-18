export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "method_not_allowed",
      });
    }

    const body = req.body || {};
    const productId = String(body.productId || "").trim();
    const transactionId = String(body.transactionId || "").trim();
    const receipt = String(body.receipt || "").trim();

    const CREDIT_PACKAGES = {
      "tr.aivo.credits.25": 25,
      "tr.aivo.credits.100": 100,
      "tr.aivo.credits.200": 200,
      "tr.aivo.credits.500": 500,
    };

    const credits = CREDIT_PACKAGES[productId];

    if (!credits) {
      return res.status(400).json({
        ok: false,
        error: "invalid_product_id",
      });
    }

    if (!transactionId && !receipt) {
      return res.status(400).json({
        ok: false,
        error: "missing_transaction_or_receipt",
      });
    }

    return res.status(200).json({
      ok: true,
      provider: "apple_iap",
      productId,
      transactionId,
      credits,
      verified: false,
      pendingBackendVerification: true,
      message: "iOS IAP payload received. Apple receipt verification and credit ledger write will be connected next.",
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "ios_iap_verify_failed",
      detail: err && err.message ? err.message : "Unknown error",
    });
  }
}
