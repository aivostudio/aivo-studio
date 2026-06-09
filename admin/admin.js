// /admin/admin.js
(function () {
  const $ = (id) => document.getElementById(id);

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

  async function adminAuth() {
    try {
      const r = await fetch("/api/auth/me", {
        credentials: "include",
        cache: "no-store",
      });

      if (r.status !== 200) {
        showLocked("Giriş bulunamadı. Lütfen tekrar giriş yap.");
        return { ok: false, reason: "no_session" };
      }

      const user = await r.json();
      const email = String(user.email || "").trim().toLowerCase();

      if (!email) {
        showLocked("Session bulundu ama email okunamadı.");
        return { ok: false, reason: "no_email" };
      }

      const ar = await fetch(
        "/api/admin/auth?email=" + encodeURIComponent(email),
        { cache: "no-store" }
      );
      const j = await ar.json();

      if (!j || !j.ok) {
        showLocked("Bu hesap admin yetkisine sahip değil.");
        return { ok: false, reason: "not_allowed", email };
      }

      showUnlocked();
      return { ok: true, email };
    } catch (err) {
      showLocked("Admin auth kontrolü başarısız.");
      return { ok: false, reason: "exception" };
    }
  }

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
    const r = await fetch("/api/admin/users/get?admin=" + encodeURIComponent(adminEmail), {
      cache: "no-store",
      credentials: "include",
    });
    const text = await r.text();
    let j;
    try {
      j = JSON.parse(text);
    } catch (_) {
      j = { ok: false, error: "parse_failed", raw: text };
    }
    if (!r.ok) throw j;

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

  let onlineSet = new Set();

  function renderUsers(list) {
    const statusEl = $("usersStatus");
    const table = $("usersTable");
    const tbody = table ? table.querySelector("tbody") : null;
    const totalEl = $("usersTotal");

 if (totalEl && Array.isArray(list)) {
  totalEl.textContent = String(list.length);
  totalEl.classList.remove("loading-count");
}
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

          const rawEmail = String(u.email || "");
      const mailMatch = rawEmail.match(/mailto:([^)\s]+)/i);
      const bracketMatch = rawEmail.match(/\[([^\]]+@[^\\]]+)\]/i);
      const email = String(
        mailMatch ? mailMatch[1] : bracketMatch ? bracketMatch[1] : rawEmail
      ).trim();

      const role = String(u.role || "user");
      const createdAt = fmtTs(u.createdAt || u.created || 0);
      const updatedAt = fmtTs(u.updatedAt || u.updated || 0);
      const disabled = Boolean(u.disabled);

      const isOnline = onlineSet.has(norm(email));

      const pillClass = disabled ? "pill-bad" : isOnline ? "pill-online" : "pill-ok";
      const pillText = disabled ? "Pasif" : isOnline ? "Online" : "Aktif";

      tr.innerHTML = `
        <td>
          <span data-act="pick" data-email="${email}" style="cursor:pointer; text-decoration:none;">
            ${email}
          </span>
        </td>
        <td>${role}</td>
        <td>${createdAt}</td>
        <td>${updatedAt}</td>
        <td><span class="pill ${pillClass}">${pillText}</span></td>
        <td style="display:flex; gap:6px; flex-wrap:wrap;">
          <button
            class="btn btn-xs ${disabled ? "" : "btn-danger"}"
            data-act="toggle"
            data-email="${email}"
            data-disabled="${disabled ? "1" : "0"}">
            ${disabled ? "Aktifleştir" : "Pasifleştir"}
          </button>

          <button
            class="btn btn-xs"
            data-act="delete_soft"
            data-email="${email}">
            Sadece Sil
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

    try {
      if (!document.getElementById("__aivo_admin_pick_style__")) {
        const st = document.createElement("style");
        st.id = "__aivo_admin_pick_style__";
        st.textContent = `#usersTable [data-act="pick"]:hover { text-decoration: underline; }`;
        document.head.appendChild(st);
      }
    } catch (_) {}
  }

  async function setDisabled(adminEmail, email, disabled) {
    const r = await fetch("/api/admin/users/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      cache: "no-store",
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

  async function deleteUser(adminEmail, email, shouldBan = true) {
    const r = await fetch("/api/admin/users/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({
        admin: adminEmail,
        email,
        mode: "hard",
        ban: shouldBan
      }),
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

  async function fetchOnline(adminEmail) {
    const r = await fetch("/api/admin/presence/online?admin=" + encodeURIComponent(adminEmail), {
      cache: "no-store",
      credentials: "include",
    });
    const j = await r.json();
    if (!r.ok) throw j;
    return j;
  }

  function startOnlinePoll(adminEmail, onTick) {
    const el = $("onlineCount");
    let timer = null;

    async function tick() {
      try {
        const j = await fetchOnline(adminEmail);

        if (el) el.textContent = String(j.count ?? 0);

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

  async function fetchBans(adminEmail) {
    const r = await fetch("/api/admin/users/bans-list?admin=" + encodeURIComponent(adminEmail), {
      cache: "no-store",
      credentials: "include",
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

  async function unbanEmail(adminEmail, email) {
    const r = await fetch("/api/admin/users/unban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ admin: adminEmail, email }),
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

  function renderBansOut(obj) {
    const out = $("bansOut");
    if (!out) return;
    jsonPrint(out, obj);
  }

  function setBansStatus(msg) {
    const el = $("bansStatus");
    if (el) el.textContent = msg || "Hazır.";
  }

  adminAuth().then(async (state) => {
    if (!state.ok) return;

    const whoEl = $("who");
    if (whoEl && state.email) whoEl.textContent = "Giriş: " + state.email;

      const btnPushSend = $("btnPushSend");
    const pushTitleTr = $("pushTitleTr");
    const pushMessageTr = $("pushMessageTr");
    const pushTitleEn = $("pushTitleEn");
    const pushMessageEn = $("pushMessageEn");
    const pushImageUrl = $("pushImageUrl");
    const pushCampaignStatus = $("pushCampaignStatus");
    const pushCampaignOut = $("pushCampaignOut");

    if (btnPushSend) {
      btnPushSend.addEventListener("click", async () => {
        const s = await adminAuth();
        if (!s.ok) return;

             const titleTr = String(pushTitleTr?.value || "").trim();
        const messageTr = String(pushMessageTr?.value || "").trim();
        const titleEn = String(pushTitleEn?.value || "").trim();
        const messageEn = String(pushMessageEn?.value || "").trim();
        const imageUrl = String(pushImageUrl?.value || "").trim();

           const hasTrPush = !!(titleTr && messageTr);
        const hasEnPush = !!(titleEn && messageEn);

        if (!hasTrPush && !hasEnPush) {
          jsonPrint(pushCampaignOut, {
            ok: false,
            error: "at_least_one_language_required"
          });
          if (pushCampaignStatus) {
            pushCampaignStatus.textContent = "En az bir dil için başlık ve mesaj gerekli.";
          }
          return;
        }

        if ((titleTr && !messageTr) || (!titleTr && messageTr)) {
          jsonPrint(pushCampaignOut, {
            ok: false,
            error: "tr_title_and_message_required_together"
          });
          if (pushCampaignStatus) {
            pushCampaignStatus.textContent = "Türkçe göndermek için başlık ve mesaj birlikte dolu olmalı.";
          }
          return;
        }

        if ((titleEn && !messageEn) || (!titleEn && messageEn)) {
          jsonPrint(pushCampaignOut, {
            ok: false,
            error: "en_title_and_message_required_together"
          });
          if (pushCampaignStatus) {
            pushCampaignStatus.textContent = "İngilizce göndermek için başlık ve mesaj birlikte dolu olmalı.";
          }
          return;
        }

        try {
          btnPushSend.disabled = true;
          if (pushCampaignStatus) pushCampaignStatus.textContent = "Gönderiliyor...";

          const r = await fetch("/api/admin/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            cache: "no-store",
             body: JSON.stringify({
              email: s.email,
              titleTr,
              messageTr,
              titleEn,
              messageEn,
              imageUrl
            })
          });

          const j = await r.json().catch(() => null);

          jsonPrint(pushCampaignOut, j || {
            ok: false,
            error: "empty_response"
          });

          if (!r.ok || !j || !j.ok) {
            if (pushCampaignStatus) pushCampaignStatus.textContent = "Gönderim başarısız.";
            return;
          }

          if (pushCampaignStatus) {
            pushCampaignStatus.textContent =
              "Gönderildi: " + String(j.sent || 0) + " / " + String(j.active_tokens || j.total_tokens || 0);
          }
        } catch (_) {
          jsonPrint(pushCampaignOut, {
            ok: false,
            error: "fetch_failed"
          });
          if (pushCampaignStatus) pushCampaignStatus.textContent = "Gönderim hatası.";
        } finally {
          btnPushSend.disabled = false;
        }
      });
    }
        const btnMailTestSend = $("btnMailTestSend");
    const btnMailCampaignSend = $("btnMailCampaignSend");
    const mailSubjectTr = $("mailSubjectTr");
    const mailMessageTr = $("mailMessageTr");
    const mailSubjectEn = $("mailSubjectEn");
    const mailMessageEn = $("mailMessageEn");
    const mailTestEmail = $("mailTestEmail");
    const mailBatchOffset = $("mailBatchOffset");
    const mailBatchLimit = $("mailBatchLimit");
    const mailCampaignStatus = $("mailCampaignStatus");
    const mailCampaignOut = $("mailCampaignOut");

    async function sendMailCampaign(testOnly) {
      const s = await adminAuth();
      if (!s.ok) return;

      const subjectTr = String(mailSubjectTr?.value || "").trim();
      const messageTr = String(mailMessageTr?.value || "").trim();
      const subjectEn = String(mailSubjectEn?.value || "").trim();
      const messageEn = String(mailMessageEn?.value || "").trim();
      const testEmail = String(mailTestEmail?.value || "").trim();
      const offset = Number(String(mailBatchOffset?.value || "0").trim()) || 0;
      const limit = Number(String(mailBatchLimit?.value || "80").trim()) || 80;

      const hasTrMail = !!(subjectTr && messageTr);
      const hasEnMail = !!(subjectEn && messageEn);

      if (!hasTrMail && !hasEnMail) {
        jsonPrint(mailCampaignOut, {
          ok: false,
          error: "at_least_one_language_required"
        });
        if (mailCampaignStatus) {
          mailCampaignStatus.textContent = "En az bir dil için konu ve mesaj gerekli.";
        }
        return;
      }

      if ((subjectTr && !messageTr) || (!subjectTr && messageTr)) {
        jsonPrint(mailCampaignOut, {
          ok: false,
          error: "tr_subject_and_message_required_together"
        });
        if (mailCampaignStatus) {
          mailCampaignStatus.textContent = "Türkçe mail için konu ve mesaj birlikte dolu olmalı.";
        }
        return;
      }

      if ((subjectEn && !messageEn) || (!subjectEn && messageEn)) {
        jsonPrint(mailCampaignOut, {
          ok: false,
          error: "en_subject_and_message_required_together"
        });
        if (mailCampaignStatus) {
          mailCampaignStatus.textContent = "İngilizce mail için konu ve mesaj birlikte dolu olmalı.";
        }
        return;
      }

      if (testOnly && !isEmailLike(testEmail)) {
        jsonPrint(mailCampaignOut, {
          ok: false,
          error: "test_email_invalid"
        });
        if (mailCampaignStatus) {
          mailCampaignStatus.textContent = "Test mail adresi geçersiz.";
        }
        return;
      }

      const activeButton = testOnly ? btnMailTestSend : btnMailCampaignSend;

      try {
        if (activeButton) activeButton.disabled = true;
        if (mailCampaignStatus) {
          mailCampaignStatus.textContent = testOnly ? "Test mail gönderiliyor..." : "Toplu mail gönderiliyor...";
        }

        const r = await fetch("/api/admin/mail/send-campaign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            admin: s.email,
            subjectTr,
            messageTr,
            subjectEn,
            messageEn,
            testOnly,
            testEmail,
            offset,
            limit
          })
        });

        const j = await r.json().catch(() => null);

        jsonPrint(mailCampaignOut, j || {
          ok: false,
          error: "empty_response"
        });

        if (!r.ok || !j || !j.ok) {
          if (mailCampaignStatus) mailCampaignStatus.textContent = "Mail gönderimi başarısız.";
          return;
        }

        if (mailCampaignStatus) {
          mailCampaignStatus.textContent =
            "Gönderildi: " +
            String(j.sent || 0) +
            " / İşlenen: " +
            String(j.processed || 0) +
            " / Hata: " +
            String(j.failed || 0);
        }

        if (!testOnly && j.has_more && mailBatchOffset) {
          mailBatchOffset.value = String(j.next_offset || offset + limit);
        }
      } catch (_) {
        jsonPrint(mailCampaignOut, {
          ok: false,
          error: "fetch_failed"
        });
        if (mailCampaignStatus) mailCampaignStatus.textContent = "Mail gönderim hatası.";
      } finally {
        if (activeButton) activeButton.disabled = false;
      }
    }

    if (btnMailTestSend) {
      btnMailTestSend.addEventListener("click", async () => {
        await sendMailCampaign(true);
      });
    }

    if (btnMailCampaignSend) {
      btnMailCampaignSend.addEventListener("click", async () => {
        const ok = confirm(
          "Toplu mail gönderimi başlatılsın mı?\n\n" +
          "Önce test maili gönderip kontrol ettiğinden emin ol."
        );
        if (!ok) return;

        await sendMailCampaign(false);
      });
    }
    const btnCheck = $("btnCheck");
    if (btnCheck) {
      btnCheck.addEventListener("click", async () => {
        const s = await adminAuth();
        const out = $("authState");
        if (out) out.textContent = s.ok ? "✅ Admin yetkisi OK" : "⛔ Admin yetkisi YOK";
      });
    }

    const btnGetCredits = $("btnGetCredits");
    if (btnGetCredits) {
      btnGetCredits.addEventListener("click", async () => {
        const s = await adminAuth();
        if (!s.ok) return;

        const email = norm($("qEmail")?.value || "");
        const out = $("creditsOut");
        if (!isEmailLike(email)) return jsonPrint(out, { ok: false, error: "email_invalid" });

        setQuickView(email, "…");

        try {
          const r = await fetch(
            "/api/credits/get?email=" + encodeURIComponent(email),
            { cache: "no-store", credentials: "include" }
          );
          const j = await r.json();
          jsonPrint(out, j);
          setQuickView(email, extractCredits(j));
        } catch (_) {
          jsonPrint(out, { ok: false, error: "fetch_failed" });
          setQuickView(email, "—");
        }
      });
    }

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
            credentials: "include",
            cache: "no-store",
            body: JSON.stringify({ admin: s.email, email, delta, reason }),
          });
          const j = await r.json();

          jsonPrint(out, j);
          await auditCreditAdjust(s, email, delta, reason, j);
        } catch (_) {
          jsonPrint(out, { ok: false, error: "fetch_failed" });
        }
      });
    }

    const btnBansRefresh = $("btnBansRefresh");
    const btnUnban = $("btnUnban");
    const bansEmail = $("bansEmail");

    async function loadBans() {
      const s = await adminAuth();
      if (!s.ok) return;
      setBansStatus("Yükleniyor...");

      try {
        const j = await fetchBans(s.email);
        setBansStatus("Hazır.");
        renderBansOut(j);

        if (bansEmail && j && Array.isArray(j.items) && j.items[0]) {
          if (!String(bansEmail.value || "").trim()) bansEmail.value = String(j.items[0]);
        }
      } catch (e) {
        setBansStatus("Hata: " + (e?.error || "bans_failed"));
        renderBansOut(e);
      }
    }

    if (btnBansRefresh) btnBansRefresh.addEventListener("click", loadBans);

    if (btnUnban) {
      btnUnban.addEventListener("click", async () => {
        const s = await adminAuth();
        if (!s.ok) return;

        const email = norm(bansEmail?.value || "");
        if (!isEmailLike(email)) {
          setBansStatus("Geçersiz email.");
          return renderBansOut({ ok: false, error: "email_invalid" });
        }

        const ok = confirm(email + " banı kaldırılsın mı?");
        if (!ok) return;

        try {
          btnUnban.disabled = true;
          setBansStatus("İşleniyor...");

          const j = await unbanEmail(s.email, email);
          renderBansOut(j);
          await auditUnban(s, email, j);
          setBansStatus("Hazır.");

          await loadBans();
        } catch (e) {
          setBansStatus("Hata: " + (e?.error || "unban_failed"));
          renderBansOut(e);
        } finally {
          btnUnban.disabled = false;
        }
      });
    }

    let usersRaw = [];
    const btnUsersRefresh = $("btnUsersRefresh");
    const usersSearch = $("usersSearch");
    const usersStatus = $("usersStatus");
    const usersTable = $("usersTable");

    const btnProductionStats = $("btnProductionStats");
    const prodStatsStatus = $("prodStatsStatus");
    const prodStatsTbody = $("prodStatsTbody");
    const prodStatsOut = $("prodStatsOut");

    function renderProductionStats(rows) {
      if (!prodStatsTbody) return;

      const list = Array.isArray(rows) ? rows : [];
      prodStatsTbody.innerHTML = "";

      if (!list.length) {
        prodStatsTbody.innerHTML = `
          <tr>
            <td colspan="3" class="muted" style="padding:10px 6px;">
              Veri bulunamadı.
            </td>
          </tr>
        `;
        return;
      }

      for (const item of list) {
        const tr = document.createElement("tr");

        tr.innerHTML = `
          <td style="padding:10px 6px; font-weight:700;">${String(item.label || item.key || "-")}</td>
          <td style="padding:10px 6px;">${Number(item.daily || 0)}</td>
          <td style="padding:10px 6px;">${Number(item.total || 0)}</td>
        `;

        prodStatsTbody.appendChild(tr);
      }
    }

    async function loadProductionStats() {
      const s = await adminAuth();
      if (!s.ok) return;

      if (prodStatsStatus) prodStatsStatus.textContent = "Yükleniyor...";

      try {
        const r = await fetch("/api/admin/production-stats", {
          cache: "no-store",
          credentials: "include"
        });

        const j = await r.json().catch(() => null);

        if (!r.ok || !j || !j.ok) {
          throw new Error((j && (j.error || j.message)) || "production_stats_failed");
        }

        renderProductionStats(j.stats || []);

        if (prodStatsOut) {
          prodStatsOut.style.display = "none";
          prodStatsOut.textContent = JSON.stringify(j, null, 2);
        }

        if (prodStatsStatus) {
          prodStatsStatus.textContent = `Gün: ${String(j.day || "-")}`;
        }
      } catch (err) {
        if (prodStatsTbody) {
          prodStatsTbody.innerHTML = `
            <tr>
              <td colspan="3" class="muted" style="padding:10px 6px;">
                Veri alınamadı.
              </td>
            </tr>
          `;
        }

        if (prodStatsOut) {
          prodStatsOut.style.display = "block";
          prodStatsOut.textContent = String(err && err.message ? err.message : err);
        }

        if (prodStatsStatus) prodStatsStatus.textContent = "Hata oluştu.";
      }
    }

    if (btnProductionStats) {
      btnProductionStats.addEventListener("click", loadProductionStats);
    }

    const btnDailyCreditStats = $("btnDailyCreditStats");
    const btnDailyCreditStatsPdf = $("btnDailyCreditStatsPdf");
    const dailyCreditStatsDate = $("dailyCreditStatsDate");
    const dailyCreditStatsStatus = $("dailyCreditStatsStatus");
    const dailyCreditStatsTbody = $("dailyCreditStatsTbody");
    const dailyCreditStatsOut = $("dailyCreditStatsOut");
    const dailyCreditTotalSpent = $("dailyCreditTotalSpent");
    const dailyCreditTotalRefund = $("dailyCreditTotalRefund");
    const dailyCreditTotalNet = $("dailyCreditTotalNet");
    const dailyCreditTotalCount = $("dailyCreditTotalCount");

    function todayDateInputValue() {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }

    function escapeHtml(v) {
      return String(v == null ? "" : v)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function setDailyCreditTotals(totals) {
      const t = totals || {};
      if (dailyCreditTotalSpent) dailyCreditTotalSpent.textContent = String(Number(t.spent_credits || 0));
      if (dailyCreditTotalRefund) dailyCreditTotalRefund.textContent = String(Number(t.refund_credits || 0));
      if (dailyCreditTotalNet) dailyCreditTotalNet.textContent = String(Number(t.net_credits || 0));
      if (dailyCreditTotalCount) dailyCreditTotalCount.textContent = String(Number(t.transaction_count || 0));
    }

    function renderDailyCreditStats(rows, totals) {
      if (!dailyCreditStatsTbody) return;

      const list = Array.isArray(rows) ? rows : [];
      dailyCreditStatsTbody.innerHTML = "";

      if (!list.length) {
        dailyCreditStatsTbody.innerHTML = `
          <tr>
            <td colspan="5" class="muted" style="padding:10px 6px;">
              Veri bulunamadı.
            </td>
          </tr>
        `;
        setDailyCreditTotals({
          spent_credits: 0,
          refund_credits: 0,
          net_credits: 0,
          transaction_count: 0
        });
        return;
      }

      for (const item of list) {
        const tr = document.createElement("tr");

        tr.innerHTML = `
          <td style="padding:10px 6px; font-weight:700;">${escapeHtml(item.label || item.key || "-")}</td>
          <td style="padding:10px 6px;">${Number(item.spent_credits || 0)}</td>
          <td style="padding:10px 6px;">${Number(item.refund_credits || 0)}</td>
          <td style="padding:10px 6px;">${Number(item.net_credits || 0)}</td>
          <td style="padding:10px 6px;">${Number(item.transaction_count || 0)}</td>
        `;

        dailyCreditStatsTbody.appendChild(tr);
      }

      setDailyCreditTotals(totals || {});
    }

    async function loadDailyCreditStats() {
      const s = await adminAuth();
      if (!s.ok) return;

      const selectedDate =
        String(dailyCreditStatsDate && dailyCreditStatsDate.value
          ? dailyCreditStatsDate.value
          : todayDateInputValue()).trim();

      if (dailyCreditStatsStatus) dailyCreditStatsStatus.textContent = "Yükleniyor...";

      try {
        const r = await fetch(
          "/api/admin/daily-credit-stats?date=" + encodeURIComponent(selectedDate),
          {
            cache: "no-store",
            credentials: "include"
          }
        );

        const j = await r.json().catch(() => null);

        if (!r.ok || !j || !j.ok) {
          throw new Error((j && (j.error || j.message)) || "daily_credit_stats_failed");
        }

        renderDailyCreditStats(j.modules || [], j.totals || {});

        if (dailyCreditStatsOut) {
          dailyCreditStatsOut.style.display = "none";
          dailyCreditStatsOut.textContent = JSON.stringify(j, null, 2);
        }

        if (dailyCreditStatsStatus) {
          dailyCreditStatsStatus.textContent = `Gün: ${String(j.date || selectedDate || "-")}`;
        }
      } catch (err) {
        if (dailyCreditStatsTbody) {
          dailyCreditStatsTbody.innerHTML = `
            <tr>
              <td colspan="5" class="muted" style="padding:10px 6px;">
                Veri alınamadı.
              </td>
            </tr>
          `;
        }

        setDailyCreditTotals({
          spent_credits: 0,
          refund_credits: 0,
          net_credits: 0,
          transaction_count: 0
        });

        if (dailyCreditStatsOut) {
          dailyCreditStatsOut.style.display = "block";
          dailyCreditStatsOut.textContent = String(err && err.message ? err.message : err);
        }

        if (dailyCreditStatsStatus) dailyCreditStatsStatus.textContent = "Hata oluştu.";
      }
    }

    if (dailyCreditStatsDate && !dailyCreditStatsDate.value) {
      dailyCreditStatsDate.value = todayDateInputValue();
    }

    if (btnDailyCreditStats) {
      btnDailyCreditStats.addEventListener("click", loadDailyCreditStats);
    }

    if (dailyCreditStatsDate) {
      dailyCreditStatsDate.addEventListener("change", loadDailyCreditStats);
    }

    if (btnDailyCreditStatsPdf) {
      btnDailyCreditStatsPdf.addEventListener("click", async () => {
        const s = await adminAuth();
        if (!s.ok) return;

        const selectedDate =
          String(
            dailyCreditStatsDate && dailyCreditStatsDate.value
              ? dailyCreditStatsDate.value
              : todayDateInputValue()
          ).trim();

        const url =
          "/api/admin/daily-credit-stats-pdf?date=" +
          encodeURIComponent(selectedDate);

        try {
          window.open(url, "_blank", "noopener,noreferrer");
        } catch (_) {
          location.href = url;
        }
      });
    }

    const btnSoldCredits = $("btnSoldCredits");
    const soldCreditsDate = $("soldCreditsDate");
    const soldCreditsStatus = $("soldCreditsStatus");
    const soldCreditsTotalValue = $("soldCreditsTotalValue");
    const soldCreditsOrdersValue = $("soldCreditsOrdersValue");
    const soldCreditsPackages = $("soldCreditsPackages");
    const soldCreditsOut = $("soldCreditsOut");

    function setSoldCreditsValues(totalCredits, totalOrders) {
      if (soldCreditsTotalValue) soldCreditsTotalValue.textContent = String(Number(totalCredits || 0));
      if (soldCreditsOrdersValue) soldCreditsOrdersValue.textContent = String(Number(totalOrders || 0));
    }

    function renderSoldCreditsPackages(items) {
      if (!soldCreditsPackages) return;

      const list = Array.isArray(items) ? items : [];

      const buckets = {
        baslangic: { title: "Yeni Kullanıcı", price: "199₺", credits: "25 kredi", orders: 0, sold: 0 },
        standart: { title: "Standart Paket", price: "699₺", credits: "100 kredi", orders: 0, sold: 0 },
        pro: { title: "Yaratıcı Üretici", price: "1.299₺", credits: "200 kredi", orders: 0, sold: 0 },
        studyo: { title: "Stüdyo / Ajans", price: "2.999₺", credits: "500 kredi", orders: 0, sold: 0 }
      };

      for (const item of list) {
        const plan = String(item && item.pack ? item.pack : item && item.plan ? item.plan : "").trim().toLowerCase();
        const credits = Number(item && item.credits ? item.credits : 0) || 0;

        if (!buckets[plan]) continue;

        buckets[plan].orders += 1;
        buckets[plan].sold += credits;
      }

      const html = Object.keys(buckets).map((key) => {
        const x = buckets[key];
        return `
          <div style="padding:18px; border:1px solid rgba(255,255,255,.08); border-radius:20px; background:rgba(255,255,255,.02);">
            <div class="muted" style="margin-bottom:8px; font-size:13px;">${escapeHtml(x.title)}</div>
            <div style="font-size:44px; font-weight:800; line-height:1; margin-bottom:8px;">${escapeHtml(x.price)}</div>
            <div class="muted" style="margin-bottom:18px;">/ ${escapeHtml(x.credits)}</div>

            <div style="display:grid; gap:10px;">
              <div style="padding:12px 14px; border:1px solid rgba(255,255,255,.06); border-radius:14px;">
                <div class="muted" style="margin-bottom:4px;">Satış Adedi</div>
                <div style="font-size:28px; font-weight:800;">${x.orders}</div>
              </div>

              <div style="padding:12px 14px; border:1px solid rgba(255,255,255,.06); border-radius:14px;">
                <div class="muted" style="margin-bottom:4px;">Satılan Kredi</div>
                <div style="font-size:28px; font-weight:800;">${x.sold}</div>
              </div>
            </div>
          </div>
        `;
      }).join("");

      soldCreditsPackages.innerHTML = html;
    }
let aivoLastPurchaseKey = "";

function playAivoPurchaseSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.38);
  } catch (_) {}
}

function getPurchaseKey(items) {
  if (!Array.isArray(items) || !items.length) return "";
  const latest = items[0] || {};
  return String(
    latest.order_id ||
    latest.oid ||
    latest.created_at ||
    latest.email ||
    ""
  );
}
async function loadSoldCredits(options) {
  const silent = !!(options && options.silent);

  const selectedDate =
    String(
      soldCreditsDate && soldCreditsDate.value
        ? soldCreditsDate.value
        : todayDateInputValue()
    ).trim();

  if (soldCreditsStatus) soldCreditsStatus.textContent = "Yükleniyor...";

  const r2 = await fetch(
    "/api/admin/purchases?date=" + encodeURIComponent(selectedDate),
    {
      cache: "no-store",
      credentials: "include"
    }
  );

  const purchasesData = await r2.json().catch(() => null);

  console.log("PURCHASES DEBUG:", purchasesData);

  if (purchasesData?.ok && Array.isArray(purchasesData.items)) {
    const purchasedItems = purchasesData.items.filter(function (item) {
      return String(item && item.provider ? item.provider : "").trim().toLowerCase() !== "google_play";
    });

    const latestPurchaseKey = getPurchaseKey(purchasedItems);

    if (aivoLastPurchaseKey && latestPurchaseKey && latestPurchaseKey !== aivoLastPurchaseKey && !silent) {
      playAivoPurchaseSound();
      try {
        if (window.toast) toast.success("Yeni kredi satışı", "Yeni bir kredi satın alımı geldi.");
      } catch (_) {}
    }

    if (latestPurchaseKey) {
      aivoLastPurchaseKey = latestPurchaseKey;
    }
    const purchasedCredits = purchasedItems.reduce((sum, item) => {
      return sum + Number(item && item.credits ? item.credits : 0);
    }, 0);

           setSoldCreditsValues(
          purchasedCredits,
          purchasedItems.length || 0
        );
        renderSoldCreditsPackages(purchasedItems);

        const tbody = document.getElementById("soldCreditsListTbody");

        if (tbody) {
          tbody.innerHTML = purchasedItems.map(item => {
            return `
              <tr>
                <td style="padding:8px 10px; width:260px; max-width:260px; min-width:260px;">
                  <div style="display:block; width:260px; max-width:260px; overflow-x:auto; overflow-y:hidden; white-space:nowrap;">
                    ${item.email || "-"}
                  </div>
                </td>
                <td style="padding:8px 10px;">${item.pack || "-"}</td>
                <td style="padding:8px 10px;">${item.credits || 0}</td>
                <td style="padding:8px 10px;">${item.amount || 0}</td>
                <td style="padding:8px 10px;">${item.currency || "-"}</td>
                <td style="padding:8px 10px;">${item.order_id || "-"}</td>
                <td style="padding:8px 10px;">${item.created_at || "-"}</td>
              </tr>
            `;
          }).join("");
        }

        if (soldCreditsOut) {
          soldCreditsOut.style.display = "none";
          soldCreditsOut.textContent = JSON.stringify(purchasesData, null, 2);
        }

        if (soldCreditsStatus) {
          const selectedDate =
            String(
              soldCreditsDate && soldCreditsDate.value
                ? soldCreditsDate.value
                : todayDateInputValue()
            ).trim();

          soldCreditsStatus.textContent = `Gün: ${selectedDate || "-"}`;
        }

        return;
      }

      setSoldCreditsValues(0, 0);
      renderSoldCreditsPackages([]);

      const tbody = document.getElementById("soldCreditsListTbody");
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="muted" style="padding:12px;">
              Veri bulunamadı.
            </td>
          </tr>
        `;
      }

      if (soldCreditsOut) {
        soldCreditsOut.style.display = "block";
        soldCreditsOut.textContent = JSON.stringify(purchasesData, null, 2);
      }

      if (soldCreditsStatus) soldCreditsStatus.textContent = "Hata oluştu.";
    }

    if (soldCreditsDate && !soldCreditsDate.value) {
      soldCreditsDate.value = todayDateInputValue();
    }

    if (btnSoldCredits) {
      btnSoldCredits.addEventListener("click", loadSoldCredits);
    }

      if (soldCreditsDate) {
      soldCreditsDate.addEventListener("change", loadSoldCredits);
    }

     const btnIosSales = $("btnIosSales");
    const iosSalesDate = $("iosSalesDate");
    const iosSalesStatus = $("iosSalesStatus");
    const iosSalesUnits = $("iosSalesUnits");
    const iosSalesCustomerTotal = $("iosSalesCustomerTotal");
    const iosSalesProceedsTotal = $("iosSalesProceedsTotal");
    const iosSalesTbody = $("iosSalesTbody");
    const iosSalesOut = $("iosSalesOut");

    const btnPlaySales = $("btnPlaySales");
    const playSalesDate = $("playSalesDate");
    const playSalesStatus = $("playSalesStatus");
    const playSalesUnits = $("playSalesUnits");
    const playSalesCustomerTotal = $("playSalesCustomerTotal");
    const playSalesRevenueTotal = $("playSalesRevenueTotal");
    const playSalesTbody = $("playSalesTbody");
    const playSalesOut = $("playSalesOut");

    function yesterdayDateInputValue() {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }

    function formatIosMoney(value, currency) {
      const n = Number(value || 0);
      return n.toLocaleString("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }) + " " + String(currency || "TRY");
    }

    function formatPlayMoney(value, currency) {
      const n = Number(value || 0);
      return n.toLocaleString("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }) + " " + String(currency || "TRY");
    }

    function isGooglePlayOrderId(value) {
      return /^GPA\./i.test(String(value || "").trim());
    }

    function renderIosSales(rows) {
      const list = (Array.isArray(rows) ? rows : []).filter(function (row) {
        const customerPrice = Number(row["Customer Price"] || 0);
        const developerProceeds = Number(row["Developer Proceeds"] || 0);

        return customerPrice > 0 || developerProceeds > 0;
      });

      let totalUnits = 0;
      let customerTotal = 0;
      let proceedsTotal = 0;
      let currency = "TRY";

      list.forEach(function (row) {
        totalUnits += Number(row.Units || 0);
        customerTotal += Number(row["Customer Price"] || 0) * Number(row.Units || 0);
        proceedsTotal += Number(row["Developer Proceeds"] || 0) * Number(row.Units || 0);
        currency = row["Customer Currency"] || row["Currency of Proceeds"] || currency;
      });

      if (iosSalesUnits) iosSalesUnits.textContent = String(totalUnits);
      if (iosSalesCustomerTotal) iosSalesCustomerTotal.textContent = formatIosMoney(customerTotal, currency);
      if (iosSalesProceedsTotal) iosSalesProceedsTotal.textContent = formatIosMoney(proceedsTotal, currency);

      if (!iosSalesTbody) return;

      if (!list.length) {
        iosSalesTbody.innerHTML = `
          <tr>
            <td colspan="7" class="muted" style="padding:12px;">
              Seçilen gün için iOS satış verisi yok.
            </td>
          </tr>
        `;
        return;
      }

      iosSalesTbody.innerHTML = list.map(function (row) {
        return `
          <tr>
            <td style="padding:8px 10px;">${escapeHtml(row.SKU || row.Title || "-")}</td>
            <td style="padding:8px 10px;">${Number(row.Units || 0)}</td>
            <td style="padding:8px 10px;">${escapeHtml(formatIosMoney(row["Customer Price"], row["Customer Currency"]))}</td>
            <td style="padding:8px 10px;">${escapeHtml(formatIosMoney(row["Developer Proceeds"], row["Currency of Proceeds"]))}</td>
            <td style="padding:8px 10px;">${escapeHtml(row["Customer Currency"] || row["Currency of Proceeds"] || "-")}</td>
            <td style="padding:8px 10px;">${escapeHtml(row["Country Code"] || "-")}</td>
            <td style="padding:8px 10px;">${escapeHtml(row.Device || "-")}</td>
          </tr>
        `;
      }).join("");
    }

    function renderPlaySales(rows) {
      const list = Array.isArray(rows) ? rows : [];

      let totalUnits = 0;
      let customerTotal = 0;
      let revenueTotal = 0;
      let currency = "TRY";

      list.forEach(function (row) {
        totalUnits += Number(row.quantity || 1);
        customerTotal += Number(row.customerTotal || 0);
        revenueTotal += Number(row.developerRevenue || 0);
        currency = row.currency || currency;
      });

      if (playSalesUnits) playSalesUnits.textContent = String(totalUnits);
      if (playSalesCustomerTotal) playSalesCustomerTotal.textContent = formatPlayMoney(customerTotal, currency);
      if (playSalesRevenueTotal) playSalesRevenueTotal.textContent = formatPlayMoney(revenueTotal, currency);

      if (!playSalesTbody) return;

      if (!list.length) {
        playSalesTbody.innerHTML = `
          <tr>
            <td colspan="8" class="muted" style="padding:12px;">
              Seçilen gün için Google Play satış verisi yok.
            </td>
          </tr>
        `;
        return;
      }

      playSalesTbody.innerHTML = list.map(function (row) {
        return `
          <tr>
            <td style="padding:8px 10px;">${escapeHtml(row.productTitle || row.productId || "-")}</td>
            <td style="padding:8px 10px;">${Number(row.quantity || 1)}</td>
            <td style="padding:8px 10px;">${escapeHtml(formatPlayMoney(row.customerTotal, row.currency))}</td>
            <td style="padding:8px 10px;">${escapeHtml(formatPlayMoney(row.developerRevenue, row.currency))}</td>
            <td style="padding:8px 10px;">${escapeHtml(row.currency || "-")}</td>
            <td style="padding:8px 10px;">${escapeHtml(row.buyerCountry || "-")}</td>
            <td style="padding:8px 10px;">${escapeHtml(row.state || "-")}</td>
            <td style="padding:8px 10px; max-width:260px; overflow-x:auto; white-space:nowrap;">${escapeHtml(row.orderId || "-")}</td>
          </tr>
        `;
      }).join("");
    }

    async function loadIosSales() {
      const selectedDate =
        String(
          iosSalesDate && iosSalesDate.value
            ? iosSalesDate.value
            : yesterdayDateInputValue()
        ).trim();

      if (iosSalesStatus) iosSalesStatus.textContent = "Yükleniyor...";

      try {
        const r = await fetch("/api/admin/ios-sales?date=" + encodeURIComponent(selectedDate), {
          cache: "no-store",
          credentials: "include"
        });

        const j = await r.json().catch(() => null);

        if (!r.ok || !j || !j.ok) {
          throw new Error((j && (j.error || j.message)) || "ios_sales_failed");
        }

        const selectedPaidRows = (Array.isArray(j.rows) ? j.rows : []).filter(function (row) {
          const customerPrice = Number(row["Customer Price"] || 0);
          const developerProceeds = Number(row["Developer Proceeds"] || 0);

          return customerPrice > 0 || developerProceeds > 0;
        });

        const fallbackPaidRows = (Array.isArray(j.total_rows) ? j.total_rows : []).filter(function (row) {
          const customerPrice = Number(row["Customer Price"] || 0);
          const developerProceeds = Number(row["Developer Proceeds"] || 0);

          return customerPrice > 0 || developerProceeds > 0;
        });

        const rowsToRender = selectedPaidRows.length
          ? selectedPaidRows
          : fallbackPaidRows.slice(0, 20);

        renderIosSales(rowsToRender);

        if (iosSalesOut) {
          iosSalesOut.style.display = "none";
          iosSalesOut.textContent = JSON.stringify(j, null, 2);
        }

        if (iosSalesStatus) {
          iosSalesStatus.textContent = selectedPaidRows.length
            ? `Gün: ${String(j.date || selectedDate)}`
            : `Gün: ${String(j.date || selectedDate)} / Son iOS satışları`;
        }
      } catch (err) {
        renderIosSales([]);

        if (iosSalesOut) {
          iosSalesOut.style.display = "block";
          iosSalesOut.textContent = String(err && err.message ? err.message : err);
        }

        if (iosSalesStatus) iosSalesStatus.textContent = "Hata oluştu.";
      }
    }

    async function loadPlaySales() {
      const selectedDate =
        String(
          playSalesDate && playSalesDate.value
            ? playSalesDate.value
            : todayDateInputValue()
        ).trim();

      if (playSalesStatus) playSalesStatus.textContent = "Yükleniyor...";

      try {
        const purchasesResponse = await fetch(
          "/api/admin/purchases?date=" + encodeURIComponent(selectedDate),
          {
            cache: "no-store",
            credentials: "include"
          }
        );

        const purchasesData = await purchasesResponse.json().catch(() => null);

        if (!purchasesResponse.ok || !purchasesData || !purchasesData.ok) {
          throw new Error((purchasesData && (purchasesData.error || purchasesData.message)) || "play_purchases_failed");
        }

        const orderIds = Array.isArray(purchasesData.items)
          ? purchasesData.items
              .map(function (item) {
                return String(item && (item.order_id || item.orderId || item.oid || "")).trim();
              })
              .filter(isGooglePlayOrderId)
          : [];

        const uniqueOrderIds = Array.from(new Set(orderIds));

        if (!uniqueOrderIds.length) {
          renderPlaySales([]);

          if (playSalesOut) {
            playSalesOut.style.display = "none";
            playSalesOut.textContent = JSON.stringify({
              ok: true,
              date: selectedDate,
              message: "Seçilen gün için Google Play order id bulunamadı.",
              purchases: purchasesData
            }, null, 2);
          }

          if (playSalesStatus) playSalesStatus.textContent = `Gün: ${selectedDate}`;
          return;
        }

        const ordersResponse = await fetch(
          "/api/admin/play-orders?orderIds=" + encodeURIComponent(uniqueOrderIds.join(",")),
          {
            cache: "no-store",
            credentials: "include"
          }
        );

        const ordersData = await ordersResponse.json().catch(() => null);

        if (!ordersResponse.ok || !ordersData || !ordersData.ok) {
          throw new Error((ordersData && (ordersData.error || ordersData.message)) || "play_orders_failed");
        }

        renderPlaySales(ordersData.rows || []);

        if (playSalesOut) {
          playSalesOut.style.display = "none";
          playSalesOut.textContent = JSON.stringify({
            ok: true,
            date: selectedDate,
            orderIds: uniqueOrderIds,
            purchases: purchasesData,
            orders: ordersData
          }, null, 2);
        }

        if (playSalesStatus) {
          playSalesStatus.textContent = `Gün: ${selectedDate} / Sipariş: ${String((ordersData.rows || []).length)}`;
        }
      } catch (err) {
        renderPlaySales([]);

        if (playSalesOut) {
          playSalesOut.style.display = "block";
          playSalesOut.textContent = String(err && err.message ? err.message : err);
        }

        if (playSalesStatus) playSalesStatus.textContent = "Hata oluştu.";
      }
    }

    if (iosSalesDate && !iosSalesDate.value) {
      iosSalesDate.value = yesterdayDateInputValue();
    }

    if (btnIosSales) {
      btnIosSales.addEventListener("click", loadIosSales);
    }

    if (iosSalesDate) {
      iosSalesDate.addEventListener("change", loadIosSales);
    }

    if (playSalesDate && !playSalesDate.value) {
      playSalesDate.value = todayDateInputValue();
    }

    if (btnPlaySales) {
      btnPlaySales.addEventListener("click", loadPlaySales);
    }

    if (playSalesDate) {
      playSalesDate.addEventListener("change", loadPlaySales);
    }

    await loadIosSales();
    await loadPlaySales();

    async function loadUsers() {
      const s = await adminAuth();
      if (!s.ok) return;
      if (usersStatus) usersStatus.textContent = "Yükleniyor...";

      try {
        usersRaw = await fetchUsers(s.email);

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
    const btnUsersTopRefresh = $("btnUsersTopRefresh");

if (btnUsersTopRefresh) {
  btnUsersTopRefresh.addEventListener("click", async function () {
    btnUsersTopRefresh.disabled = true;
    btnUsersTopRefresh.textContent = "Güncelleniyor...";

    await loadUsers();

    btnUsersTopRefresh.disabled = false;
    btnUsersTopRefresh.textContent = "Üye Güncelle";
  });
}
    if (usersSearch) usersSearch.addEventListener("input", () => renderUsers(filterUsers(usersRaw, usersSearch.value)));

    if (usersTable) {
      usersTable.addEventListener("click", async (ev) => {
        const any = ev.target && ev.target.closest && ev.target.closest("[data-act]");
        if (!any) return;

        const act = any.getAttribute("data-act");
        const email = any.getAttribute("data-email") || "";

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
            try { if (window.toast) toast.error("İşlem başarısız", String(e?.error || e?.message || "unknown")); } catch (_) {}
          } finally {
            any.disabled = false;
          }
          return;
        }

          if (act === "delete_soft") {
          const ok = confirm(
            "DİKKAT!\n\n" +
              email +
              " kullanıcısı AIVO kayıtlarından silinecek.\n" +
              "BAN yazılmayacak.\n" +
              "İsterse daha sonra tekrar kayıt olabilir.\n\n" +
              "Devam etmek istiyor musun?"
          );
          if (!ok) return;

          try {
            any.disabled = true;
            const result = await deleteUser(s.email, email, false);
            await auditUserDeleteSoft(s, email, result);
            await loadUsers();

            if ($("btnBansRefresh")) {
              try { await loadBans(); } catch (_) {}
            }
          } catch (e) {
            try { if (window.toast) toast.error("Silme başarısız", String(e?.error || e?.message || "unknown")); } catch (_) {}
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
            const result = await deleteUser(s.email, email, true);
            await auditUserDeleteHard(s, email, result);
            await loadUsers();

            if ($("btnBansRefresh")) {
              try { await loadBans(); } catch (_) {}
            }
          } catch (e) {
            try { if (window.toast) toast.error("Silme başarısız", String(e?.error || e?.message || "unknown")); } catch (_) {}
          } finally {
            any.disabled = false;
          }
          return;
        }
      });
    }

    await loadUsers();
    await loadProductionStats();
    await loadDailyCreditStats();
  await loadSoldCredits({ silent: true });
    setInterval(function () {
  loadSoldCredits({ silent: false });
}, 30000);
 

    // TRAFFIC STATS
const btnTrafficStats = $("btnTrafficStats");
const trafficStatus = $("trafficStatus");
const trafficTodayHits = $("trafficTodayHits");
const trafficTodayUnique = $("trafficTodayUnique");
const trafficTotal = $("trafficTotal");
const trafficLast7 = $("trafficLast7");
const trafficTopPages = $("trafficTopPages");

async function loadTrafficStats() {
  const s = await adminAuth();
  if (!s.ok) return;

  if (trafficStatus) trafficStatus.textContent = "Yükleniyor...";

  try {
    const r = await fetch("/api/admin/traffic-stats", {
      cache: "no-store",
      credentials: "include"
    });

    const j = await r.json().catch(() => null);

    if (!r.ok || !j || !j.ok) {
      throw new Error((j && (j.error || j.message)) || "traffic_stats_failed");
    }

    if (trafficTodayHits) trafficTodayHits.textContent = String(j.today?.hits || 0);
    if (trafficTodayUnique) trafficTodayUnique.textContent = String(j.today?.unique || 0);
    if (trafficTotal) trafficTotal.textContent = String(j.total || 0);

  if (trafficLast7) {
  const days = Array.isArray(j.last7Days) ? j.last7Days : [];

  trafficLast7.textContent = days.length
    ? days.map(function(item) {
        return String(item.day || "-") +
          "  |  Ziyaret: " + String(item.hits || 0) +
          "  |  Tekil: " + String(item.unique || 0);
      }).join("\n")
    : "Henüz veri yok.";
}

if (trafficTopPages) {
  const pages = Array.isArray(j.topPages) ? j.topPages : [];
  const grouped = {};

  pages.forEach(function(item) {
    var rawPage = String(item.page || "-");
    var cleanPage = rawPage.split("?")[0] || "/";
    var label = cleanPage === "/" ? "Ana sayfa" : cleanPage;
    var hits = Number(item.hits || 0);

    grouped[label] = (grouped[label] || 0) + hits;
  });

  const list = Object.keys(grouped)
    .map(function(label) {
      return {
        label: label,
        hits: grouped[label]
      };
    })
    .sort(function(a, b) {
      return b.hits - a.hits;
    });

  trafficTopPages.textContent = list.length
    ? list.map(function(item, index) {
        return String(index + 1) + ". " +
          item.label +
          "  |  Ziyaret: " + String(item.hits);
      }).join("\n")
    : "Henüz veri yok.";
}
    if (trafficStatus) {
      trafficStatus.textContent = "Gün: " + String(j.today?.day || "-");
    }

  } catch (err) {
    if (trafficStatus) trafficStatus.textContent = "Hata oluştu.";

    if (trafficLast7) {
      trafficLast7.textContent = String(err && err.message ? err.message : err);
    }
  }
}

if (btnTrafficStats) {
  btnTrafficStats.addEventListener("click", loadTrafficStats);
}
    await loadTrafficStats();
    startOnlinePoll(state.email, () => {
      renderUsers(filterUsers(usersRaw, usersSearch?.value || ""));
    });

    const btnBanList = $("btnBanList");
    const banOut = $("banOut");

    if (btnBanList) {
      btnBanList.addEventListener("click", async () => {
        const s = await adminAuth();
        if (!s.ok) return;

        try {
          const r = await fetch(
            "/api/admin/users/bans-list?admin=" + encodeURIComponent(s.email),
            { cache: "no-store", credentials: "include" }
          );

          const j = await r.json();
          if (banOut) banOut.textContent = JSON.stringify(j, null, 2);
        } catch (e) {
          try { if (window.toast) toast.error("Listeleme hatası", "Ban listesi alınamadı."); } catch (_) {}
          if (banOut) banOut.textContent = "Listeleme hatası";
        }
      });
    }

    const btnAuditList = $("btnAuditList");
    const auditOut = $("auditOut");

    async function auditWrite(s, action, target, meta) {
      try {
        const r = await fetch("/api/admin/audit/write", {
          method: "POST",
          cache: "no-store",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            admin: s.email,
            action,
            target: target || null,
            meta: meta || null,
          }),
        });
        return await r.json().catch(() => null);
      } catch (_) {
        return null;
      }
    }

    async function auditList(s) {
      const r = await fetch(
        "/api/admin/audit/list?limit=80&admin=" + encodeURIComponent(s.email),
        { cache: "no-store", credentials: "include" }
      );
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || "audit_list_failed");
      return j;
    }

    if (btnAuditList) {
      btnAuditList.addEventListener("click", async () => {
        const s = await adminAuth();
        if (!s.ok) return;

        if (auditOut) auditOut.textContent = "Yükleniyor...";

        try {
          const j = await auditList(s);

          if (!j.items || !j.items.length) {
            auditOut.textContent = "Kayıt yok.";
            return;
          }

          auditOut.textContent = j.items
            .map((ev) => {
              let line = `${ev.ts} | ${ev.admin} | ${ev.action}`;
              if (ev.target) line += " | " + ev.target;
              if (ev.meta) line += "\n" + JSON.stringify(ev.meta, null, 2);
              return line;
            })
            .join("\n\n");
        } catch (_) {
          try { if (window.toast) toast.error("Audit hatası", "Log listesi alınamadı."); } catch (_) {}
          if (auditOut) auditOut.textContent = "Audit hatası";
        }
      });
    }

    async function auditCreditAdjust(s, email, delta, reason, result) {
      await auditWrite(s, "CREDIT_ADJUST", email, {
        delta,
        reason,
        ok: !!(result && result.ok),
      });
    }

    async function auditUnban(s, email, result) {
      await auditWrite(s, "UNBAN", email, { ok: !!(result && result.ok) });
    }

    async function auditUserDeleteHard(s, email, result) {
      await auditWrite(s, "USER_DELETE_HARD", email, { ok: !!(result && result.ok) });
    }

    async function auditUserDeleteSoft(s, email, result) {
      await auditWrite(s, "USER_DELETE_SOFT", email, { ok: !!(result && result.ok) });
    }
  });
})();
