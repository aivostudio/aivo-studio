(function(){
  "use strict";

  function qs(sel, root){
    return (root || document).querySelector(sel);
  }

  function setText(sel, value, root){
    const el = qs(sel, root);
    if (el) el.textContent = value;
  }

  function setValue(sel, value, root){
    const el = qs(sel, root);
    if (el) el.value = value;
  }

  function getInitial(name, email){
    const base = String(name || email || "H").trim();
    return base.charAt(0).toUpperCase() || "H";
  }

  function normalizeUser(json){
    const user = json && json.user ? json.user : json || {};

    const email = String(user.email || "").trim();
    const name = String(user.name || user.first_name || "").trim();
    const surname = String(user.surname || user.last_name || "").trim();

    const fullName = [name, surname].filter(Boolean).join(" ").trim();

    return {
      email: email,
      name: name,
      surname: surname,
      fullName: fullName || "Kullanıcı"
    };
  }

  async function fetchMe(){
    const res = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "same-origin",
      headers: {
        "Accept": "application/json"
      }
    });

    const json = await res.json().catch(function(){
      return null;
    });

    if (!res.ok || !json || json.ok !== true) {
      throw new Error("auth_me_failed");
    }

    return normalizeUser(json);
  }

  function hydrateProfile(user){
    const root = document.getElementById("mobileAccountProfilePage");
    if (!root) return;

    setText("[data-mobile-profile-initial]", getInitial(user.fullName, user.email), root);
    setText("[data-mobile-profile-name]", user.fullName || "Kullanıcı", root);
    setText("[data-mobile-profile-email]", user.email || "—", root);

    setValue("[data-mobile-profile-name-input]", user.name || "", root);
    setValue("[data-mobile-profile-surname-input]", user.surname || "", root);
    setValue("[data-mobile-profile-email-input]", user.email || "", root);
  }
    async function savePassword(){
    const root = document.getElementById("mobileAccountProfilePage");
    if (!root) return;

    const modal = qs("[data-mobile-password-modal]", root);
    const currentInput = qs("[data-mobile-password-current]", root);
    const newInput = qs("[data-mobile-password-new]", root);
    const new2Input = qs("[data-mobile-password-new2]", root);
    const submitBtn = qs("[data-mobile-password-submit]", root);

    const currentPassword = String(currentInput && currentInput.value ? currentInput.value : "").trim();
    const newPassword = String(newInput && newInput.value ? newInput.value : "").trim();
    const newPassword2 = String(new2Input && new2Input.value ? new2Input.value : "").trim();

    if (!currentPassword || !newPassword || !newPassword2) {
      alert("Lütfen tüm şifre alanlarını doldurun.");
      return;
    }

    if (newPassword.length < 8) {
      alert("Yeni şifre en az 8 karakter olmalı.");
      return;
    }

    if (newPassword !== newPassword2) {
      alert("Yeni şifreler eşleşmiyor.");
      return;
    }

    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await fetch("/api/auth/password-update", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          currentPassword: currentPassword,
          newPassword: newPassword,
          newPassword2: newPassword2
        })
      });

      const json = await res.json().catch(function(){
        return null;
      });

      if (!res.ok || !json || json.ok !== true) {
        throw new Error((json && json.error) || "password_update_failed");
      }

      if (currentInput) currentInput.value = "";
      if (newInput) newInput.value = "";
      if (new2Input) new2Input.value = "";
      if (modal) modal.hidden = true;

      if (window.toast && typeof window.toast.success === "function") {
        window.toast.success("Şifre güncellendi.");
      } else {
        alert("Şifre güncellendi.");
      }
       } catch (err) {
      const code = String(err && err.message ? err.message : "");

      let message = "Şifre güncellenemedi.";

      if (code === "current_password_invalid") {
        message = "Mevcut şifre yanlış.";
      } else if (code === "password_too_short") {
        message = "Yeni şifre en az 8 karakter olmalı.";
      } else if (code === "password_mismatch") {
        message = "Yeni şifreler eşleşmiyor.";
      } else if (code === "password_same_as_old") {
        message = "Yeni şifre mevcut şifreyle aynı olamaz.";
      }

      if (window.toast && typeof window.toast.error === "function") {
        window.toast.error(message);
      } else {
        alert(message);
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }
  async function saveProfile(){
    const root = document.getElementById("mobileAccountProfilePage");
    if (!root) return;

    const nameInput = qs("[data-mobile-profile-name-input]", root);
    const surnameInput = qs("[data-mobile-profile-surname-input]", root);
    const saveBtn = qs("[data-mobile-profile-save]", root);

    const name = String(nameInput && nameInput.value ? nameInput.value : "").trim();
    const surname = String(surnameInput && surnameInput.value ? surnameInput.value : "").trim();

    if (!name) {
      alert("Ad alanı boş olamaz.");
      return;
    }

    if (saveBtn) saveBtn.disabled = true;

    try {
      const res = await fetch("/api/auth/profile-update", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          name: name,
          surname: surname
        })
      });

      const json = await res.json().catch(function(){
        return null;
      });

      if (!res.ok || !json || json.ok !== true) {
        throw new Error((json && json.error) || "profile_update_failed");
      }

      const nextUser = normalizeUser(json);

      hydrateProfile(nextUser);

      if (window.toast && typeof window.toast.success === "function") {
        window.toast.success("Profil güncellendi.");
      } else {
        alert("Profil güncellendi.");
      }
    } catch (err) {
      if (window.toast && typeof window.toast.error === "function") {
        window.toast.error("Profil güncellenemedi.");
      } else {
        alert("Profil güncellenemedi.");
      }
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }
  async function initMobileAccount(){
    const root = document.getElementById("mobileAccountProfilePage");
    if (!root) return;

     const saveBtn = qs("[data-mobile-profile-save]", root);
    if (saveBtn && !saveBtn.__mobileAccountSaveBound) {
      saveBtn.__mobileAccountSaveBound = true;
      saveBtn.addEventListener("click", saveProfile);
    }

      const passwordBtn = qs("[data-mobile-password-open]", root);
    const passwordModal = qs("[data-mobile-password-modal]", root);

    if (passwordBtn && passwordModal && !passwordBtn.__mobilePasswordBound) {
      passwordBtn.__mobilePasswordBound = true;
      passwordBtn.addEventListener("click", function(){
        passwordModal.hidden = false;
      });
    }
        if (passwordModal && !passwordModal.__mobilePasswordCloseBound) {
      passwordModal.__mobilePasswordCloseBound = true;
      passwordModal.addEventListener("click", function(e){
        const closeBtn = e.target.closest("[data-mobile-password-close]");
        if (!closeBtn) return;

        e.preventDefault();
        passwordModal.hidden = true;
      });
    }
        const passwordSubmitBtn = qs("[data-mobile-password-submit]", root);

    if (passwordSubmitBtn && !passwordSubmitBtn.__mobilePasswordSubmitBound) {
      passwordSubmitBtn.__mobilePasswordSubmitBound = true;
      passwordSubmitBtn.addEventListener("click", savePassword);
    }
    try {
      const user = await fetchMe();
      hydrateProfile(user);
    } catch (err) {
      hydrateProfile({
        email: "",
        name: "",
        surname: "",
        fullName: "Kullanıcı"
      });
    }
  }

  window.mobileAccountInit = initMobileAccount;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMobileAccount);
  } else {
    initMobileAccount();
  }
})();
/* =========================================================
   MOBILE ACCOUNT — INVOICES
   ========================================================= */

(function(){
  "use strict";

  if (window.__AIVO_MOBILE_ACCOUNT_INVOICES__) return;
  window.__AIVO_MOBILE_ACCOUNT_INVOICES__ = true;

  let activeFilter = "all";

  function qs(sel, root){
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  }

  function escapeHtml(value){
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeEmail(value){
    return String(value || "").trim().toLowerCase();
  }

  async function resolveEmail(){
    try {
      const res = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store"
      });

      const json = await res.json().catch(function(){ return null; });

      if (res.ok && json && json.email) {
        return normalizeEmail(json.email);
      }
    } catch (_) {}

    return "";
  }

  function toTime(value){
    const date = new Date(value || 0);
    const time = date.getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function formatDate(value){
    const time = toTime(value);
    if (!time) return "-";

    return new Date(time).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
  }

  function formatMoney(value){
    const n = Number(value || 0);

    return n.toLocaleString("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0
    });
  }

  function inferType(invoice){
    const raw = String(
      invoice.type ||
      invoice.kind ||
      invoice.event ||
      invoice.action ||
      invoice.status ||
      ""
    ).toLowerCase();

    if (
      raw.includes("refund") ||
      raw.includes("refunded") ||
      raw.includes("partial_refund") ||
      raw.includes("partially_refunded") ||
      raw.includes("iade")
    ) {
      return "refund";
    }

    return "purchase";
  }

  function getAmount(invoice){
    if (invoice.amountTRY != null) return invoice.amountTRY;
    if (invoice.amount_try != null) return invoice.amount_try;
    if (invoice.price != null) return invoice.price;
    if (invoice.amount != null) return invoice.amount;
    if (invoice.total_amount != null) return invoice.total_amount;
    if (invoice.total != null) return invoice.total;
    return 0;
  }

  function getCredits(invoice){
    if (invoice.credit_count != null) return Number(invoice.credit_count);
    if (invoice.credits != null) return Number(invoice.credits);
    if (invoice.credit_amount != null) return Number(invoice.credit_amount);
    if (invoice.quantity != null) return Number(invoice.quantity);
    return 0;
  }

  function getCreatedAt(invoice){
    return (
      invoice.created_at ||
      invoice.createdAt ||
      invoice.created ||
      invoice.date ||
      invoice.ts ||
      invoice.time ||
      ""
    );
  }

  function statusLabel(invoice){
    const status = String(invoice.status || "").toLowerCase();

    if (status === "paid" || status === "succeeded" || status === "success") return "Ödendi";
    if (status === "refunded" || status === "partial_refund" || status === "partially_refunded") return "İade Edildi";
    if (status === "pending" || status === "open" || status === "processing") return "Beklemede";
    if (status === "failed" || status === "error") return "Başarısız";

    return invoice.status || "-";
  }

  function invoiceCard(invoice, email){
    const type = inferType(invoice);
    const id = String(invoice.id || invoice.order_id || invoice.orderId || "").trim();
    const credits = getCredits(invoice);
    const title = credits > 0 ? credits + " Kredilik Paket" : (invoice.pack || invoice.plan || invoice.title || "Kredi Paketi");
    const sub = credits > 0 ? "Toplam " + credits + " kredi tanımı" : "Satın alım detayı";
    const amount = formatMoney(getAmount(invoice));
    const date = formatDate(getCreatedAt(invoice));
    const status = statusLabel(invoice);

    const openBase = type === "refund" ? "/api/invoices/refund-view" : "/api/invoices/view";
    const openUrl = id && email
      ? openBase + "?email=" + encodeURIComponent(email) + "&id=" + encodeURIComponent(id)
      : "";

    const actionText = type === "refund" ? "İade Belgesini Aç" : "Faturayı Görüntüle";
    const typeText = type === "refund" ? "İade" : "Satın Alım";

    return `
      <article class="mobile-invoice-card" data-mobile-invoice-type="${escapeHtml(type)}">
        <div class="mobile-invoice-top">
          <div>
            <small>AIVO FATURA KAYDI</small>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(sub)}</p>
          </div>
          <span>${escapeHtml(typeText)}</span>
        </div>

        <div class="mobile-invoice-meta">
          <div>
            <small>Tarih</small>
            <strong>${escapeHtml(date)}</strong>
          </div>
          <div>
            <small>Durum</small>
            <strong>${escapeHtml(status)}</strong>
          </div>
          <div>
            <small>Tutar</small>
            <strong>${escapeHtml(amount)}</strong>
          </div>
        </div>

        ${
          openUrl
            ? `<a class="mobile-invoice-btn" href="${escapeHtml(openUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(actionText)}</a>`
            : `<button class="mobile-invoice-btn" type="button" disabled>Belge Hazır Değil</button>`
        }
      </article>
    `;
  }

  function applyFilter(root){
    const cards = qsa("[data-mobile-invoice-type]", root);
    const empty = qs("[data-mobile-invoices-empty]", root);

    let visibleCount = 0;

    cards.forEach(function(card){
      const type = card.getAttribute("data-mobile-invoice-type");
      const show = activeFilter === "all" || type === activeFilter;
      card.hidden = !show;
      if (show) visibleCount += 1;
    });

    if (empty && cards.length > 0) {
      empty.hidden = visibleCount > 0;
      if (visibleCount === 0) {
        empty.textContent = "Bu filtre için fatura bulunamadı.";
      }
    }
  }

  function bindFilters(root){
    qsa("[data-mobile-invoices-filter]", root).forEach(function(btn){
      if (btn.__aivoMobileInvoiceFilterBound) return;
      btn.__aivoMobileInvoiceFilterBound = true;

      btn.addEventListener("click", function(){
        activeFilter = btn.getAttribute("data-mobile-invoices-filter") || "all";

        qsa("[data-mobile-invoices-filter]", root).forEach(function(item){
          item.classList.toggle("is-active", item === btn);
        });

        applyFilter(root);
      });
    });
  }

  async function mobileInvoicesInit(){
    const root = qs("#mobileAccountInvoicesSection");
    if (!root) return;

    const list = qs("[data-mobile-invoices-list]", root);
    const empty = qs("[data-mobile-invoices-empty]", root);

    if (!list || !empty) return;

    bindFilters(root);

    const email = await resolveEmail();

    if (!email) {
      empty.hidden = false;
      empty.textContent = "Faturaları göstermek için oturum bilgisi bulunamadı.";
      return;
    }

    try {
      const res = await fetch("/api/invoices/get?email=" + encodeURIComponent(email), {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store"
      });

      const json = await res.json().catch(function(){ return null; });

      if (!res.ok || !json || json.ok !== true) {
        throw new Error("mobile_invoices_fetch_failed");
      }

      const invoices = Array.isArray(json.invoices) ? json.invoices : [];

      if (!invoices.length) {
        empty.hidden = false;
        empty.textContent = "Henüz fatura kaydın yok. Kredi satın aldığında burada görünecek.";
        return;
      }

      const sorted = invoices.slice().sort(function(a, b){
        return toTime(getCreatedAt(b)) - toTime(getCreatedAt(a));
      });

      list.innerHTML = sorted.map(function(invoice){
        return invoiceCard(invoice, email);
      }).join("");

      applyFilter(root);
    } catch (err) {
      empty.hidden = false;
      empty.textContent = "Faturalar şu an yüklenemedi.";
    }
  }

  window.mobileInvoicesInit = mobileInvoicesInit;
})();
