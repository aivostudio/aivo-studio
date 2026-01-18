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

  const norm = (v) => String(v || "").trim().toLowerCase();

  // 2) LocalStorage’dan email bul
  function getEmailFromStorage() {
    const keys = ["aivo_user_email", "user_email", "email", "aivo_email", "auth_email"];
    for (let i = 0; i < keys.length; i++) {
      const v = norm(localStorage.getItem(keys[i]) || "");
      if (v && v.includes("@")) return v;
    }
    return "";
  }

  function isEmailLike(v) {
    const s = norm(v);
    return s.includes("@") && s.includes(".");
  }

  // ✅ Quick view (opsiyonel: HTML’de varsa doldur)
  function setQuickView(email, credits) {
    try {
      const e = $("selEmail");
      const c = $("selCredits");
      if (e) e.textContent = email || "—";
      if (c) c.textContent = credits == null ? "—" : String(credits);
    } catch (_) {}
  }

  function extractCredits(obj) {
    if (!obj) return null;
    if (typeof obj.credits === "number") return obj.credits;
    if (typeof obj.credit === "number") return obj.credit;
    if (typeof obj.balance === "number") return obj.balance;
    if (obj.data && typeof obj.data.credits === "number") return obj.data.credits;
    if (obj.data && typeof obj.data.credit === "number") return obj.data.credit;
    if (obj.data && typeof obj.data.balance === "number") return obj.data.balance;
    return null;
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

    // endpoint bazen array, bazen {ok:true, items:[...]} döner
    if (Array.isArray(j)) return j;
    if (j && Array.isArray(j.items)) return j.items;
    if (j && Array.isArray(j.users)) return j.users;
    return [];
  }

  function filterUsers(list, q) {
    const s = norm(q || "");
    if (!s) return list;
    return list.filter((u) => norm(u && u.email).includes(s));
  }

  // ✅ Online set (presence’den gelecek)
  let onlineSet = new Set();

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

      // ✅ online mi?
      const isOnline = onlineSet.has(norm(email));

      // ✅ Öncelik: disabled > online > aktif
      const pillClass = disabled ? "pill-bad" : isOnline ? "pill-online" : "pill-ok";
      const pillText = disabled ? "Pasif" : isOnline ? "Online" : "Aktif";

      // Email tıklanabilir (data-act="pick")
      tr.innerHTML = `
        <td>
          <span
            data-act="pick"
            data-email="${email}"
            style="cursor:pointer; text-decoration:none;">
            ${email}
          </span>
        </td>
        <td>${role}</td>
        <td>${createdAt}</td>
        <td>${updatedAt}</td>
        <td>
          <span class="pill ${pillClass}">${pillText}</span>
        </td>
        <td style="display:flex; gap:6px; flex-wrap:wrap;">
          <button
            class="btn btn-xs ${disabled ? "" : "btn-danger"}"
            data-act="toggle"
            data-email="${email}"
            data-disabled="${disabled ? "1" : "0"}">
            ${disabled ? "Aktifleştir" : "Pasifleştir"}
          </button>

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

    // küçük hover underline (CSS'e girmeden)
    try {
      if (!document.getElementById("__aivo_admin_pick_style__")) {
        const st = document.createElement("style");
        st.id = "__aivo_admin_pick_style__";
        st.textContent = `
          #usersTable [data-act="pick"]:hover { text-decoration: underline; }
        `;
        document.head.appendChild(st);
      }
    } catch (_) {}
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

  // ✅ SİL: hard delete + ban yazma senin backend’te yapılıyor (mode:"hard")
  async function deleteUser(adminEmail, email) {
    const r = await fetch("/api/admin/users/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin: adminEmail, email, mode: "hard" }),
    });
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

  // ---------- PRESENCE (Online sayısı + online listesi) ----------
  async function fetchOnline(adminEmail) {
    const r = await fetch("/api/admin/presence/online?admin=" + encodeURIComponent(adminEmail), { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) throw j;
    return j;
  }

  // ✅ hem üst sayaç hem tabloyu güncelle
  function startOnlinePoll(adminEmail, onTick) {
    const el = $("onlineCount");
    let timer = null;

    async function tick() {
      try {
        const j = await fetchOnline(adminEmail);

        // üst sayı
        if (el) el.textContent = String(j.count ?? 0);

        // online list -> set
        const arr = Array.isArray(j.online)
          ? j.online
          : Array.isArray(j.items)
          ? j.items
          : Array.isArray(j.emails)
          ? j.emails
          : [];
        onlineSet = new Set(arr.map((x) => norm(x)));

        if (typeof onTick === "function") onTick();
      } catch (_) {
        if (el) el.textContent = "-";
        onlineSet = new Set();
        if (typeof onTick === "function") onTick();
      }
    }

    tick();
    timer = setInterval(tick, 15000);

    return () => {
      if (timer) clearInterval(timer);
    };
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

        const email = norm($("qEmail")?.value || "");
        const out = $("creditsOut");
        if (!isEmailLike(email)) return jsonPrint(out, { ok: false, error: "email_invalid" });

        // quick view mail bas
        setQuickView(email, "…");

        try {
          const r = await fetch(
            "/api/admin/credits/get?admin=" + encodeURIComponent(s.email) + "&email=" + encodeURIComponent(email),
            { cache: "no-store" }
          );
          const j = await r.json();
          jsonPrint(out, j);

          // quick view kredi bas (bulabilirsek)
          setQuickView(email, extractCredits(j));
        } catch (_) {
          jsonPrint(out, { ok: false, error: "fetch_failed" });
          setQuickView(email, "—");
        }
      });
    }

    // Kredi ayarla
    const btnAdjust = $("btnAdjust");
    if (btnAdjust) {
      btnAdjust.addEventListener("click", async () => {
        const s = await adminAuth();
        if (!s.ok) return;

        const email = norm($("aEmail")?.value || "");
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

        // ✅ admin email listede yoksa ekle
        const hasAdmin = usersRaw.some((u) => norm(u && u.email) === norm(state.email));
        if (!hasAdmin) {
          usersRaw.unshift({
            email: state.email,
            role: "admin",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            disabled: false,
          });
        }

        renderUsers(filterUsers(usersRaw, usersSearch?.value || ""));
      } catch (e) {
        if (usersStatus) usersStatus.textContent = "Hata: " + (e?.error || "load_failed");
      }
    }

    if (btnUsersRefresh) btnUsersRefresh.addEventListener("click", loadUsers);
    if (usersSearch)
      usersSearch.addEventListener("input", () => renderUsers(filterUsers(usersRaw, usersSearch.value)));

    // ✅ Tablo aksiyonları: pick + toggle + delete
    if (usersTable) {
      usersTable.addEventListener("click", async (ev) => {
        const any = ev.target && ev.target.closest && ev.target.closest("[data-act]");
        if (!any) return;

        const act = any.getAttribute("data-act");
        const email = any.getAttribute("data-email") || "";

        // ✅ EMAIL PICK: tıklayınca üstte doldur + kredi getir
        if (act === "pick") {
          const e1 = $("qEmail");
          const e2 = $("aEmail");
          if (e1) e1.value = norm(email);
          if (e2) e2.value = norm(email);

          setQuickView(norm(email), "…");

          const btnGet = $("btnGetCredits");
          if (btnGet && typeof btnGet.click === "function") btnGet.click();
          return;
        }

        const s = await adminAuth();
        if (!s.ok) return;

        if (act === "toggle") {
          const wasDisabled = any.getAttribute("data-disabled") === "1";
          const nextDisabled = !wasDisabled;

          const ok = confirm(
            nextDisabled
              ? email + " pasifleştirilsin mi? (Giriş engellenir)"
              : email + " aktifleştirilsin mi? (Giriş açılır)"
          );
          if (!ok) return;

          try {
            any.disabled = true;
            await setDisabled(s.email, email, nextDisabled);
            await loadUsers();
          } catch (e) {
            alert("İşlem başarısız: " + (e?.error || e?.message || "unknown"));
          } finally {
            any.disabled = false;
          }
          return;
        }

        if (act === "delete") {
          const ok = confirm(
            "DİKKAT!\n\n" +
              email +
              " kullanıcısı KV’den tamamen silinecek ve BAN yazılacak.\n" +
              "Bu işlem geri alınamaz.\n\n" +
              "Silmek istiyor musun?"
          );
          if (!ok) return;

          try {
            any.disabled = true;
            await deleteUser(s.email, email);
            await loadUsers();
          } catch (e) {
            alert("Silme başarısız: " + (e?.error || e?.message || "unknown"));
          } finally {
            any.disabled = false;
          }
          return;
        }
      });
    }

    // ilk yükleme
    await loadUsers();

    // presence poll: üst sayacı + tabloda online pill
    startOnlinePoll(state.email, () => {
      renderUsers(filterUsers(usersRaw, usersSearch?.value || ""));
    });
  });
})();
