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

  function isEnglish(){
    try {
      const lang = String(
        window.AIVO_LANG ||
        localStorage.getItem("aivo_mobile_language") ||
        document.documentElement.lang ||
        "tr"
      ).toLowerCase();

      return lang.indexOf("en") === 0;
    } catch (_) {
      return String(document.documentElement.lang || "tr").toLowerCase().indexOf("en") === 0;
    }
  }

  function accountText(trText, enText){
    return isEnglish() ? enText : trText;
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
      fullName: fullName || accountText("Kullanıcı", "User")
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

    const fallbackUser = accountText("Kullanıcı", "User");

    setText("[data-mobile-profile-initial]", getInitial(user.fullName, user.email), root);
    setText("[data-mobile-profile-name]", user.fullName || fallbackUser, root);
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
      alert(accountText(
        "Lütfen tüm şifre alanlarını doldurun.",
        "Please fill in all password fields."
      ));
      return;
    }

    if (newPassword.length < 8) {
      alert(accountText(
        "Yeni şifre en az 8 karakter olmalı.",
        "The new password must be at least 8 characters."
      ));
      return;
    }

    if (newPassword !== newPassword2) {
      alert(accountText(
        "Yeni şifreler eşleşmiyor.",
        "The new passwords do not match."
      ));
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

      const successMessage = accountText(
        "Şifre güncellendi.",
        "Password updated."
      );

      if (window.toast && typeof window.toast.success === "function") {
        window.toast.success(successMessage);
      } else {
        alert(successMessage);
      }
    } catch (err) {
      const code = String(err && err.message ? err.message : "");

      let message = accountText(
        "Şifre güncellenemedi.",
        "Password could not be updated."
      );

      if (code === "current_password_invalid") {
        message = accountText(
          "Mevcut şifre yanlış.",
          "The current password is incorrect."
        );
      } else if (code === "password_too_short") {
        message = accountText(
          "Yeni şifre en az 8 karakter olmalı.",
          "The new password must be at least 8 characters."
        );
      } else if (code === "password_mismatch") {
        message = accountText(
          "Yeni şifreler eşleşmiyor.",
          "The new passwords do not match."
        );
      } else if (code === "password_same_as_old") {
        message = accountText(
          "Yeni şifre mevcut şifreyle aynı olamaz.",
          "The new password cannot be the same as the current password."
        );
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
      alert(accountText(
        "Ad alanı boş olamaz.",
        "First name cannot be empty."
      ));
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

      const successMessage = accountText(
        "Profil güncellendi.",
        "Profile updated."
      );

      if (window.toast && typeof window.toast.success === "function") {
        window.toast.success(successMessage);
      } else {
        alert(successMessage);
      }
    } catch (err) {
      const errorMessage = accountText(
        "Profil güncellenemedi.",
        "Profile could not be updated."
      );

      if (window.toast && typeof window.toast.error === "function") {
        window.toast.error(errorMessage);
      } else {
        alert(errorMessage);
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
        fullName: accountText("Kullanıcı", "User")
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
