// toast.compat.js
(() => {
  const t = window.toast;
  if (!t) return;

  // "kredi/yönlendirme" = warning (kırmızı değil)
  const CREDIT_FLOW_RE =
    /(kredi|yetersiz|satın al|satın\s*alma|kredi\s*al|paket|fiyatlandirma|fiyatlandırma|yönlendir|redirect)/i;

  function classify(type, msg) {
    const s = String(msg || "");
    if (type === "error" && CREDIT_FLOW_RE.test(s)) return "warning";
    return type || "info";
  }

  function emit(msg, type = "info", opts) {
    const finalType = classify(type, msg);
    const fn =
      finalType === "success" ? t.success :
      finalType === "warning" ? t.warning :
      finalType === "error"   ? t.error   :
      t.info;

    return fn?.(msg, opts);
  }

  // Global forwarders (legacy isimler)
  window.toastSafe   = (msg, type, opts) => emit(msg, type, opts);
  window.legacyToast = (msg, type, opts) => emit(msg, type, opts);
  window.showToast   = (msg, type, opts) => emit(msg, type, opts);

  // Eğer projede `toast(msg, type)` gibi bir wrapper varsa:
  window.toastMsg = (msg, type, opts) => emit(msg, type, opts);

  // Bazı dosyalarda direkt window.toast.error(...) ile kredi mesajı basılıyorsa,
  // bunu da “kredi metni ise warning”e çevirerek yakalayalım:
  const origError = t.error?.bind(t);
  if (origError) {
    t.error = (msg, opts) => {
      if (CREDIT_FLOW_RE.test(String(msg || ""))) return t.warning?.(msg, opts);
      return origError(msg, opts);
    };
  }
})();
