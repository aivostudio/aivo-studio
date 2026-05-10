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

  async function initMobileAccount(){
    const root = document.getElementById("mobileAccountProfilePage");
    if (!root) return;

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
