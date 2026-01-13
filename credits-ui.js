// credits-ui.js

export async function fetchCredits() {
  const res = await fetch("/api/credits/get", {
    method: "GET",
    credentials: "include",
    headers: { "Accept": "application/json" }
  });

  if (res.status === 401) {
    // Auth yok → UI'ı "misafir" gibi ayarla
    // Burada senin sistemde ne varsa:
    // - auth modal aç
    // - /login sayfasına yönlendir
    // - veya sadece kredi görünümünü gizle
    return { ok: false, unauth: true, credits: 0 };
  }

  if (!res.ok) {
    // 500 vs. → UI'ı kırma, sadece logla
    const text = await res.text().catch(() => "");
    console.error("[credits] fetch failed:", res.status, text);
    return { ok: false, error: true, credits: 0 };
  }

  const data = await res.json();
  // Beklenen örnek: { ok: true, credits: 60 } veya { credits: 60 }
  const credits = Number(data.credits ?? 0);
  return { ok: true, credits };
}

export async function hydrateCreditsUI() {
  const out = await fetchCredits();

  // Örnek UI hedefi (senin DOM'una göre güncelle):
  const el = document.querySelector("[data-credits]");
  if (!el) return out;

  if (out.unauth) {
    el.textContent = "—"; // veya "0"
    el.classList.add("is-unauth");
    return out;
  }

  if (out.ok) {
    el.textContent = String(out.credits);
    el.classList.remove("is-unauth");
  }

  return out;
}
