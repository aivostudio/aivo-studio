async function run() {
  var me = await fetchJson("/api/auth/me");
  if (!me.r.ok || !me.j || me.j.ok !== true) {
    redirectToIndex("");
    return;
  }

  var v = await fetchJson("/api/auth/verified");
  if (v.r.ok && v.j && v.j.ok === true) {
    if (v.j.verified === false && v.j.unknown === false) {
      try { await fetchJson("/api/auth/logout", { method: "POST" }); } catch (_) {}
      try {
        localStorage.removeItem("aivo_logged_in");
        localStorage.removeItem("aivo_user_email");
        localStorage.removeItem("aivo_token");
      } catch (_) {}
      redirectToIndex("reason=email_not_verified");
      return;
    }
  }

  // ✅ login var -> UI otoritesini besle
  try { window.__AIVO_SESSION__ = me.j; } catch(_) {}

  // ✅ login var -> UI minimum görünür yap
  try {
    var u = document.getElementById("authUser");
    var g = document.getElementById("authGuest");
    if (u) u.hidden = false;
    if (g) g.hidden = true;
  } catch(_) {}

  try {
    localStorage.setItem("aivo_logged_in", "1");
    if (me.j && me.j.email) localStorage.setItem("aivo_user_email", me.j.email);
  } catch (_) {}

  unlock();
}

run().catch(function () {
  try { unlock(); } catch(_) {}
  redirectToIndex("");
});
