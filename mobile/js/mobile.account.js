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
