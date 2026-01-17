// /admin/admin.js
(function () {
  const $ = (id) => document.getElementById(id);

  // 1) Sayfa ilk açılışta KİLİTLİ başlasın
  document.body.classList.add("is-locked");

  function showLocked(msg) {
    const lock = $("lockScreen");
    const lockMsg = $("lockMsg");
    if (lock) lock.style.display = "block";
    if (lockMsg) lockMsg.textContent = msg || "Admin yetkin yok veya giriş bulunamadı.";
  }

  function showUnlocked() {
    document.body.classList.remove("is-locked");
    const lock = $("lockScreen");
    if (lock) lock.style.display = "none";
  }

  // 2) LocalStorage’dan email bul
  function getEmailFromStorage() {
    const keys = ["aivo_user_email", "user_email", "email", "aivo_email", "auth_email"];
    for (let i = 0; i < keys.length; i++) {
      const v = String(localStorage.getItem(keys[i]) || "").trim().toLowerCase();
      if (v && v.includes("@")) return v;
    }
    return "";
  }

  function isEmailLike(v) {
    const s = String(v || "").trim().toLowerCase();
    return s.includes("@") && s.includes(".");
  }

  // küçük yardımcılar
  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function fmtDate(v) {
    if (!v) return "";
    try { return new Date(v).toLocaleString("tr-TR"); } catch { return String(v); }
  }

  // 3) Admin AUTH kontrolü
  async function adminAuth() {
    const email = getEmailFromStorage();

    if (!email) {
      showLocked("Giriş bulunamadı. Önce Studio’da admin e-posta ile giriş yap.");
      return { ok: false, reason: "no_email" };
    }

    try {
      const res = await fetch("/api/admin/auth?email=" + encodeURIComponent(email), { cache: "no-store" });
      const json = await res.json();

      if (json && json.ok) {
        showUnlocked();
        return { ok: true, email };
      }

      showLocked("Bu hesap admin allowlist’inde değil (ADMIN_EMAILS).");
      return { ok: false, reason: "not_allowed", email };
    } catch (err) {
      showLocked("Admin auth kontrolü başarısız. /api/admin/auth erişimini kontrol et.");
      return { ok: false, reason: "fetch_error", email };
    }
  }

  // ====== USERS (KAYITLAR) MODÜLÜ ======
  function initUsersModule(state) {
    const btnUsersRefresh = $("btnUsersRefresh");
    const usersSearch = $("usersSearch");
    const usersStatus = $("usersStatus");
    const usersTbody = $("usersTbody");

    if (!usersTbody) return; // UI eklenmemişse sessiz çık

    let last = [];

    function render(list) {
      const q = String(usersSearch?.value || "").trim().toLowerCase();
      const filtered = q
        ? list.filter((u) => String(u.email || u.userEmail || "").toLowerCase().includes(q))
        : list;

      if (!filtered.length) {
        usersTbody.innerHTML =
          `<tr><td colspan="4" class="muted" style="padding:10px 6px;">Kayıt bulunamadı.</td></tr>`;
        return;
      }

      usersTbody.innerHTML = filtered
        .map((u) => {
          const email = escapeHtml(u.email || u.userEmail || "");
          const role = escapeHtml(u.role || "");
          const created = escapeHtml(fmtDate(u.createdAt || u.created || u.ts));
          const updated = escapeHtml(fmtDate(u.updatedAt || u.updated));
          return `
            <tr>
              <td style="padding:8px 6px; border-top:1px solid rgba(255,255,255,.08);">${email}</td>
              <td style="padding:8px 6px; border-top:1px solid rgba(255,255,255,.08);">${role}</td>
              <td style="padding:8px 6px; border-top:1px solid rgba(255,255,255,.08);">${created}</td>
              <td style="padding:8px 6px; border-top:1px solid rgba(255,255,255,.08);">${updated}</td>
            </tr>
          `;
        })
        .join("");
    }

    async function loadUsers() {
      if (usersStatus) usersStatus.textContent = "Yükleniyor...";
      usersTbody.innerHTML =
        `<tr><td colspan="4" class="muted" style="padding:10px 6px;">Yükleniyor...</td></tr>`;

      try {
        // bazı backend’lerde admin param gerekiyor (sen credits’te kullanıyorsun)
        const url = "/api/admin/users/get?admin=" + encodeURIComponent(state.email);

        const r = await fetch(url, { cache: "no-store", credentials: "include" });

        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          if (usersStatus) usersStatus.textContent = "Hata: " + r.status;
          usersTbody.innerHTML =
            `<tr><td colspan="4" class="muted" style="padding:10px 6px;">
              API hata verdi: ${r.status}<br>${escapeHtml(txt).slice(0, 300)}
            </td></tr>`;
          return;
        }

        const data = await r.json();
        last = Array.isArray(data) ? data : (data.users || data.items || []);
        if (usersStatus) usersStatus.textContent = "Toplam: " + last.length;
        render(last);
      } catch (e) {
        if (usersStatus) usersStatus.textContent = "Hata: fetch";
        usersTbody.innerHTML =
          `<tr><td colspan="4" class="muted" style="padding:10px 6px;">
            İstek atılamadı: ${escapeHtml(e?.message || e)}
          </td></tr>`;
      }
    }

    if (btnUsersRefresh) btnUsersRefresh.addEventListener("click", loadUsers);
    if (usersSearch) usersSearch.addEventListener("input", () => render(last));

    // sayfa açılınca otomatik yükle
    loadUsers();
  }
  // ====== /USERS ======

  // 4) SAYFA AÇILIŞ GATE
  adminAuth().then((state) => {
    if (!state.ok) return;

    // 5) Admin UI AKTİF
    const whoEl = $("who");
    if (whoEl && state.email) whoEl.textContent = "Giriş: " + state.email;

    // ---- Yetki tekrar kontrol ----
    const btnCheck = $("btnCheck");
    if (btnCheck) {
      btnCheck.addEventListener("click", async () => {
        const s = await adminAuth();
        const out = $("authState");
        if (out) out.textContent = s.ok ? "✅ Admin yetkisi OK" : "⛔ Admin yetkisi YOK";
      });
    }

    // ---- Kredi getir ----
    const btnGetCredits = $("btnGetCredits");
    if (btnGetCredits) {
      btnGetCredits.addEventListener("click", async () => {
        const s = await adminAuth();
        if (!s.ok) return;

        const email = String($("qEmail")?.value || "").trim().toLowerCase();
        const out = $("creditsOut");

        if (!isEmailLike(email)) {
          if (out) out.textContent = JSON.stringify({ ok: false, error: "email_invalid" }, null, 2);
          return;
        }

        try {
          const r = await fetch(
            "/api/admin/credits/get?admin=" + encodeURIComponent(s.email) + "&email=" + encodeURIComponent(email),
            { cache: "no-store" }
          );
          const j = await r.json();
          if (out) out.textContent = JSON.stringify(j, null, 2);
        } catch (e) {
          if (out) out.textContent = JSON.stringify({ ok: false, error: "fetch_failed" }, null, 2);
        }
      });
    }

    // ---- Kredi ayarla (delta) ----
    const btnAdjust = $("btnAdjust");
    if (btnAdjust) {
      btnAdjust.addEventListener("click", async () => {
        const s = await adminAuth();
        if (!s.ok) return;

        const email = String($("aEmail")?.value || "").trim().toLowerCase();
        const delta = Number(String($("aDelta")?.value || "").trim());
        const reason = String($("aReason")?.value || "").trim() || "manual_adjust";
        const out = $("adjustOut");

        if (!isEmailLike(email)) {
          if (out) out.textContent = JSON.stringify({ ok: false, error: "email_invalid" }, null, 2);
          return;
        }
        if (!Number.isFinite(delta) || delta === 0) {
          if (out) out.textContent = JSON.stringify({ ok: false, error: "delta_invalid" }, null, 2);
          return;
        }

        try {
          const r = await fetch("/api/admin/credits/set", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ admin: s.email, email, delta, reason }),
          });

          const j = await r.json();
          if (out) out.textContent = JSON.stringify(j, null, 2);
        } catch (e) {
          if (out) out.textContent = JSON.stringify({ ok: false, error: "fetch_failed" }, null, 2);
        }
      });
    }

    // ---- Satın alımlar ----
    const btnPurchases = $("btnPurchases");
    if (btnPurchases) {
      btnPurchases.addEventListener("click", async () => {
        const s = await adminAuth();
        if (!s.ok) return;

        const out = $("pOut");
        try {
          const r = await fetch("/api/admin/purchases", { cache: "no-store" });
          const j = await r.json();
          if (out) out.textContent = JSON.stringify(j, null, 2);
        } catch (e) {
          if (out) out.textContent = JSON.stringify({ ok: false, error: "fetch_failed" }, null, 2);
        }
      });
    }

    // ✅ yeni: Kayıtlar modülü
    initUsersModule(state);
  });
})();
