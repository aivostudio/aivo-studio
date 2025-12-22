module.exports = function handler(req, res) {
  res.status(200).json({
    ok: true,
    hasStripeSecretKey: !!process.env.STRIPE_SECRET_KEY,
    keyPrefix: process.env.STRIPE_SECRET_KEY
      ? process.env.STRIPE_SECRET_KEY.slice(0, 8)
      : null,
    keyLength: process.env.STRIPE_SECRET_KEY
      ? process.env.STRIPE_SECRET_KEY.length
      : 0
  });
};
