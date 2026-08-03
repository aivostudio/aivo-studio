(() => {
  const t = window.toast;
  if (!t) return;

  const CREDIT_FLOW_RE = /(kredi|yetersiz|satın al|satın\s*alma|kredi\s*al|paket|fiyatlandirma|fiyatlandırma|yönlendir|redirect)/i;

  function messageText(msg) {
    if (typeof msg === "string") return msg;
    if (msg && typeof msg === "object") return String(msg.message || msg.error || "");
