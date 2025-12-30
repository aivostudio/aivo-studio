// api/env-check.js
module.exports = async function handler(req, res) {
  try {
    const key = process.env.STRIPE_SECRET_KEY || "";

    const p199  = process.env.STRIPE_PRICE_199  || "";
    const p399  = process.env.STRIPE_PRICE_399  || "";
    const p899  = process.env.STRIPE_PRICE_899  || "";
    const p2999 = process.env.STRIPE_PRICE_2999 || "";

    res.status(200).json({
      ok: true,

      // Secret key kontrol
      hasStripeSecretKey: !!key,
      keyPrefix: key ? key.slice(0, 8) : null,      // "sk_test_"
      keyLength: key ? key.length : 0,

      // Price ID kontrol (asıl mesele burada)
      hasPrice199:  !!p199,
      hasPrice399:  !!p399,
      hasPrice899:  !!p899,
      hasPrice2999: !!p2999,

      // Güvenli mini ipucu (tam ID’yi göstermeden)
      price199_prefix:  p199  ? p199.slice(0, 6)  : null, // "price_"
      price399_prefix:  p399  ? p399.slice(0, 6)  : null,
      price899_prefix:  p899  ? p899.slice(0, 6)  : null,
      price2999_prefix: p2999 ? p2999.slice(0, 6) : null
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
