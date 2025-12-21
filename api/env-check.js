export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    hasStripeSecretKey: Boolean(process.env.STRIPE_SECRET_KEY)
  });
}
