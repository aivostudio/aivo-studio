import crypto from "crypto";

function generatePaytrToken({
  merchant_id,
  merchant_key,
  merchant_salt,
  user_ip,
  merchant_oid,
  email,
  payment_amount,
  user_basket,
  test_mode
}) {
  const hashStr =
    merchant_id +
    user_ip +
    merchant_oid +
    email +
    payment_amount +
    user_basket +
    test_mode +
    merchant_salt;

  return crypto
    .createHmac("sha256", merchant_key)
    .update(hashStr)
    .digest("base64");
}
