/* =========================================================
   PAYTR RETURN → VERIFY → STORE HOOK (DEV MODE)
   - UI yok (toast/alert/yönlendirme yok)
   - Sadece dev log + ileride doldurulacak hook
   - Aynı oid iki kez işlenmez (idempotent guard)
   ========================================================= */
(function paytrReturnVerifyHook() {
  if (window.__aivoPayTRVerifyHookBound) return;
  window.__aivoPayTRVerifyHookBound = true;

  try {
    var url = new URL(window.location.href);
    var paytr = url.searchParams.get("paytr"); // ok | fail
    var oid = url.searchParams.get("oid");

    if (!paytr || !oid) return;

    // -----------------------------------------------------
    // Idempotent guard (aynı oid tekrar çalışmasın)
    // -----------------------------------------------------
    var handledKey = "AIVO_PAYTR_VERIFY_HANDLED_" + oid;
    if (sessionStorage.getItem(handledKey) === "1") {
      console.warn("[PayTR][RETURN] already handled", oid);
      return;
    }
    sessionStorage.setItem(handledKey, "1");

    // -----------------------------------------------------
    // Verify çağrısı (UI bozma, sessiz)
    // -----------------------------------------------------
    fetch("/api/paytr/verify?oid=" + encodeURIComponent(oid), {
      method: "GET"
    })
      .then(function (r) {
        return r.json().catch(function () {
          return null;
        });
      })
      .then(function (data) {
        if (!data || !data.ok) {
          console.warn("[PayTR][VERIFY][DEV] FAIL", {
            paytr: paytr,
            oid: oid,
            data: data || null
          });
          return;
        }

        // =================================================
        // DEV HOOK (UI YOK)
        // Buraya ileride:
        // - kredi ekleme
        // - fatura oluşturma
        // - toast
        // - yönlendirme
        // bağlanacak
        // =================================================
        console.log("[PayTR][VERIFY][DEV] OK", {
          oid: oid,
          status: data.status || "unknown",
          plan: data.plan || null,
          credits: data.credits || 0,
          amountTRY: data.amountTRY || null,
          total: data.total_amount || null
        });

        // ŞİMDİLİK:
        // - kredi ekleme yok
        // - fatura yok
        // - toast yok
        // - yönlendirme yok
      })
      .catch(function (err) {
        console.error("[PayTR][VERIFY][DEV] ERROR", err);
      });

    // -----------------------------------------------------
    // URL temizle (görsel olarak düzgün kalsın)
    // -----------------------------------------------------
    url.searchParams.delete("paytr");
    url.searchParams.delete("oid");
    window.history.replaceState(
      {},
      "",
      url.pathname +
        (url.searchParams.toString()
          ? "?" + url.searchParams.toString()
          : "")
    );
  } catch (e) {
    console.error("[PayTR][RETURN] handler error", e);
  }
})();
