const merchant_id = process.env.PAYTR_MERCHANT_ID;
const merchant_key = process.env.PAYTR_MERCHANT_KEY;
const merchant_salt = process.env.PAYTR_MERCHANT_SALT;

if (!merchant_id || !merchant_key || !merchant_salt) {
  return json(res, 500, {
    ok: false,
    error: "PAYTR_ENV_MISSING",
    missing: {
      PAYTR_MERCHANT_ID: !merchant_id,
      PAYTR_MERCHANT_KEY: !merchant_key,
      PAYTR_MERCHANT_SALT: !merchant_salt,
    },
  });
}
