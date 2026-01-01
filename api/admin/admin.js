// admin/admin.js
(function(){
  const $ = (id) => document.getElementById(id);

  function getEmailFromStorage(){
    const keys = ["aivo_user_email", "user_email", "email"]; // gerekirse arttırırız
    for (const k of keys){
      const v = String(localStorage.getItem(k) || "").trim().toLowerCase();
      if (v && v.includes("@")) return v;
    }
    return "";
  }

  const who = getEmailFromStorage();
  $("who").textContent = who ? `Giriş: ${who}` : "Giriş bulunamadı";

  async function adminAuth(){
    const email = getEmailFromStorage();
    if (!email) {
      $("authState").textContent = "localStorage içinde email bulunamadı. Studio’da login ol, sonra tekrar dene.";
      return false;
    }
    const r = await fetch(`/api/admin/auth?email=${encodeURIComponent(email)}`);
    const j = await r.json();
    $("authState").textContent = j.ok ? "✅ Admin yetkisi OK" : "⛔ Admin yetkisi YOK (ADMIN_EMAILS allowlist kontrol)";
    return !!j.ok;
  }

  $("btnCheck").addEventListener("click", adminAuth);

  $("btnGetCredits").addEventListener("click", async () => {
    if (!await adminAuth()) return;
    const email = String($("qEmail").value || "").trim().toLowerCase();
    const r = await fetch(`/api/admin/credits-get?email=${encodeURIComponent(email)}`);
    $("creditsOut").textContent = JSON.stringify(await r.json(), null, 2);
  });

  $("btnAdjust").addEventListener("click", async () => {
    if (!await adminAuth()) return;
    const email = String($("aEmail").value || "").trim().toLowerCase();
    const delta = Number(String($("aDelta").value || "").trim());
    const reason = String($("aReason").value || "").trim() || "manual_adjust";

    const r = await fetch(`/api/admin/credits-adjust`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ email, delta, reason })
    });
    $("adjustOut").textContent = JSON.stringify(await r.json(), null, 2);
  });

  $("btnPurchases").addEventListener("click", async () => {
    if (!await adminAuth()) return;
    const r = await fetch(`/api/admin/purchases`);
    $("pOut").textContent = JSON.stringify(await r.json(), null, 2);
  });

  // sayfa açılınca bir kez kontrol
  adminAuth().catch(()=>{});
})();
