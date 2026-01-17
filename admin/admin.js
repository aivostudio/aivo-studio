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

  function jsonPrint(el, obj) {
    if (!el) return;
    el.textContent = JSON.stringify(obj, null, 2);
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

  // ---------- USERS (Kayıtlar) ----------
  function fmtTs(ts) {
    const n = Number(ts);
    if (!Number.isFinite(n) || n <= 0) return "-";
    const d = new Date(n);
    const pad = (x) => String(x).padStart(2, "0");
    return (
      pad(d.getDate()) +
      "." +
      pad(d.getMonth() + 1) +
      "." +
      d.getFullYear() +
      " " +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes()) +
      ":" +
      pad(d.getSeconds())
    );
  }

  async function fetchUsers(adminEmail) {
    const r = await fetch("/api/admin/users/get?admin=" + encodeURIComponent(adminEmail), { cache: "no-store" });
    const text = await r.text();
    let j;
    try {
      j = JSON.parse(text);
    } catch (_) {
      j = { ok: false, error: "parse_failed", raw: text };
    }
    if (!r.ok) throw j;
    return j;
  }

  function filterUsers(list, q) {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return list;
    return list.filter((u) => String(u.email || "").toLowerCase().includes(s));
  }

  function renderUsers(list) {
    const statusEl = $("usersStatus");
    const table = $("usersTable");
    const tbody = table ? table.querySelector("tbody") : null;
    const totalEl = $("usersTotal");

    if (totalEl) totalEl.textContent = Array.isArray(list) ? String(list.length) : "0";
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!Array.isArray(list) || list.length === 0) {
      if (statusEl) statusEl.textContent = "Kayıt yok.";
      tbody.innerHTML = `<tr><td colspan="6" class="muted" style="padding:10px 6px;">Kayıt yok.</td></tr>`;
      return;
    }

    if (statusEl) statusEl.textContent = "Hazır.";

    for (const u of list) {
      const tr = document.createElement("tr");

      const email = String(u.email || "");
      const role = String(u.role || "user");
      const createdAt = fmtTs(u.createdAt || u.created || 0);
      const updatedAt = fmtTs(u.updatedAt || u.updated || 0);
      const disabled = Boolean(u.disabled);

      tr.innerHTML = `
        <td>${email}</td>
        <td>${role}</td>
        <td>${createdAt}</td>
        <td>${updatedAt}</td>
        <td>
          <span class="pill ${disabled ? "pill-bad" : "pill-ok"}">
            ${disabled ? "Pasif" : "Aktif"}
          </span>
        </td>
        <td style="display:flex; gap:6px; flex-wrap:wrap;">
          <!-- Pasifleştir / Aktifleştir -->
          <button
            class="btn btn-xs ${disabled ? "" : "btn-danger"}"
            data-act="toggle"
            data-email="${email}"
            data-disabled="${disabled ? "1" : "0"}">
            ${disabled ? "Aktifleştir" : "Pasifleştir"}
          </button>

          <!-- SİL (HARD DELETE) -->
          <button
            class="btn btn-xs btn-danger"
            data-act="delete"
            data-email="${email}">
            Sil
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    }
  }

  async function setDisabled(adminEmail, email, disabled) {
    const r = await fetch("/api/admin/users/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        admin: adminEmail,
        email,
        disabled,
        reason: disabled ? "manual_disable" : "manual_enable",
      }),
    });
    const j = await r.json();
    if (!r.ok) throw j;
    return j;
  }

  // ✅ SİL (HARD DELETE)
  async function deleteUser(adminEmail, email) {
    const r = await fetch("/api/admin/users/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin: adminEmail, email }),
    });
    const j = await r.json();
    if (!r.ok) throw j;
    return j;
  }

  // ---------- PRESENCE (Online sayısı) ----------
  async function fetchOnline(adminEmail) {
    const r = await fetch("/api/admin/presence/online?admin=" + encodeURIComponent(adminEmail), { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) throw j;
    return j;
  }

  function startOnlinePoll(adminEmail) {
    const el = $("onlineCount");
    if (!el) return;

    async function tick() {
      try {
        const j = await fetchOnline(adminEmail);
        el.textContent = String(j.count ?? 0);
      } catch (_) {
        el.textContent = "-";
      }
    }

    tick();
    setInterval(tick, 15000);
  }

  // 4) SAYFA AÇILIŞ GATE
  adminAuth().then(async (state) => {
    if (!state.ok) return;

    // Admin UI AKTİF
    const whoEl = $("who");
    if (whoEl && state.email) whoEl.textContent = "Giriş: " + state.email;

    // Yetki tekrar kontrol
    const btnCheck = $("btnCheck");
    if (btnCheck) {
      btnCheck.addEventListener("click", async () => {
        const s = await adminAuth();
        const out = $("authState");
        if (out) out.textContent = s.ok ? "✅ Admin yetkisi OK" : "⛔ Admin yetkisi YOK";
      });
    }

    // Kredi getir
    const btnGetCredits = $("btnGetCredits");
    if (btnGetCredits) {
      btnGetCredits.addEventListener("click", async () => {
        const s = await adminAuth();
        if (!s.ok) return;

        const email = String($("qEmail")?.value || "").trim().toLowerCase();
        const out = $("creditsOut");
        if (!isEmailLike(email)) return jsonPrint(out, { ok: false, error: "email_invalid" });

        try {
          const r = await fetch(
            "/api/admin/credits/get?admin=" + encodeURIComponent(s.email) + "&email=" + encodeURIComponent(email),
            { cache: "no-store" }
          );
          const j = await r.json();
          jsonPrint(out, j);
        } catch (_) {
          jsonPrint(out, { ok: false, error: "fetch_failed" });
        }
      });
    }

    // Kredi ayarla
    const btnAdjust = $("btnAdjust");
    if (btnAdjust) {
      btnAdjust.addEventListener("click", async () => {
        const s = await adminAuth();
        if (!s.ok) return;

        const email = String($("aEmail")?.value || "").trim().toLowerCase();
        const delta = Number(String($("aDelta")?.value || "").trim());
        const reason = String($("aReason")?.value || "").trim() || "manual_adjust";
        const out = $("adjustOut");

        if (!isEmailLike(email)) return jsonPrint(out, { ok: false, error: "email_invalid" });
        if (!Number.isFinite(delta) || delta === 0) return jsonPrint(out, { ok: false, error: "delta_invalid" });

        try {
          const r = await fetch("/api/admin/credits/set", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ admin: s.email, email, delta, reason }),
          });
          const j = await r.json();
          jsonPrint(out, j);
        } catch (_) {
          jsonPrint(out, { ok: false, error: "fetch_failed" });
        }
      });
    }

    // Satın alımlar
    const btnPurchases = $("btnPurchases");
    if (btnPurchases) {
      btnPurchases.addEventListener("click", async () => {
        const s = await adminAuth();
        if (!s.ok) return;

        const out = $("pOut");
        try {
          const r = await fetch("/api/admin/purchases", { cache: "no-store" });
          const j = await r.json();
          jsonPrint(out, j);
        } catch (_) {
          jsonPrint(out, { ok: false, error: "fetch_failed" });
        }
      });
    }

    // USERS: ilk yükle
    let usersRaw = [];
    const btnUsersRefresh = $("btnUsersRefresh");
    const usersSearch = $("usersSearch");
    const usersStatus = $("usersStatus");
    const usersTable = $("usersTable");

    async function loadUsers() {
      const s = await adminAuth();
      if (!s.ok) return;
      if (usersStatus) usersStatus.textContent = "Yükleniyor...";

      try {
        usersRaw = await fetchUsers(s.email);
        renderUsers(filterUsers(usersRaw, usersSearch?.value || ""));
      } catch (e) {
        if (usersStatus) usersStatus.textContent = "Hata: " + (e?.error || "load_failed");
      }
    }

    if (btnUsersRefresh) btnUsersRefresh.addEventListener("click", loadUsers);
    if (usersSearch) usersSearch.addEventListener("input", () => renderUsers(filterUsers(usersRaw, usersSearch.value)));

    // ✅ Tablo aksiyonları: toggle + delete
    if (usersTable) {
      usersTable.addEventListener("click", async (ev) => {
        const btn = ev.target && ev.target.closest && ev.target.closest("button[data-act]");
        if (!btn) return;

        const act = btn.getAttribute("data-act");
        const email = btn.getAttribute("data-email") || "";

        const s = await adminAuth();
        if (!s.ok) return;

        // PASIF / AKTIF
        if (act === "toggle") {
          const wasDisabled = btn.getAttribute("data-disabled") === "1";
          const nextDisabled = !wasDisabled;

          const ok = confirm(
            nextDisabled
              ? email + " pasifleştirilsin mi? (Giriş engellenir)"
              : email + " aktifleştirilsin mi? (Giriş açılır)"
          );
          if (!ok) return;

          try {
            btn.disabled = true;
            await setDisabled(s.email, email, nextDisabled);
            await loadUsers();
          } catch (e) {
            alert("İşlem başarısız: " + (e?.error || e?.message || "unknown"));
          } finally {
            btn.disabled = false;
          }
          return;
        }

        // SİL
        if (act === "delete") {
          const ok = confirm(
            "DİKKAT!\n\n" +
              email +
              " kullanıcısı KV’den tamamen silinecek.\n" +
              "Bu işlem geri alınamaz.\n\n" +
              "Silmek istiyor musun?"
          );
          if (!ok) return;

          try {
            btn.disabled = true;
            await deleteUser(s.email, email);
            await loadUsers();
          } catch (e) {
            alert("Silme başarısız: " + (e?.error || e?.message || "unknown"));
          } finally {
            btn.disabled = false;
          }
          return;
        }
      });
    }

    // ilk yükleme
    await loadUsers();

    // online sayacı
    startOnlinePoll(state.email);
  });
})();
