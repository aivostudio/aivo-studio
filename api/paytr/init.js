const user_basket = Buffer.from(
  JSON.stringify([
    [plan + " Paketi", Number(amount) * 100, 1]
  ])
).toString("base64");

const paytr_token = generatePaytrToken({
  merchant_id,
  merchant_key,
  merchant_salt,
  user_ip,
  merchant_oid: oid,
  email,
  payment_amount,
  user_basket,          // ✅ KRİTİK: HASH’E GİRDİ
  test_mode,
});

return json(res, 200, {
  ok: true,
  oid,
  form: {
    merchant_id,
    user_ip,
    merchant_oid: oid,
    email,
    payment_amount,
    currency: "TRY",

    user_basket,

    no_installment: "1",
    max_installment: "0",
    installment_count: "0",

    merchant_ok_url: "https://www.aivo.tr/api/paytr/ok",
    merchant_fail_url: "https://www.aivo.tr/api/paytr/fail",

    timeout_limit: "30",
    debug_on: "1",
    test_mode,
    lang: "tr",

    paytr_token,
  },
});
