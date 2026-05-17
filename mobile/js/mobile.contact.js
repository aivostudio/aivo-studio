/* =========================================================
   AIVO MOBILE — CONTACT
   File: /mobile/js/mobile.contact.js
   ========================================================= */

(function(){
  "use strict";

  if (window.__AIVO_MOBILE_CONTACT__) return;
  window.__AIVO_MOBILE_CONTACT__ = true;

  function tr(key){
    if (typeof window.t === "function") {
      return window.t(key);
    }

    return key;
  }

  function toast(message){
    if (window.mobileToast && typeof window.mobileToast.success === "function") {
      window.mobileToast.success(message);
      return;
    }

    if (window.toast && typeof window.toast.success === "function") {
      window.toast.success(message);
      return;
    }

    if (typeof window.toast === "function") {
      window.toast(message);
      return;
    }

    alert(message);
  }

  function bindContactForm(){
    const form = document.querySelector("[data-mobile-contact-form]");
    if (!form || form.__aivoMobileContactBound) return;

    form.__aivoMobileContactBound = true;

    form.addEventListener("submit", async function(e){
      e.preventDefault();

      const submitBtn = form.querySelector(".mobile-contact-submit");
      const name = String(form.elements.name?.value || "").trim();
      const email = String(form.elements.email?.value || "").trim();
      const subject = String(form.elements.subject?.value || "").trim();
      const message = String(form.elements.message?.value || "").trim();

if (!name || !email || !subject || !message) {
  toast(tr("contact.errorRequired"));
  return;
}

if (submitBtn) {
  submitBtn.disabled = true;
  submitBtn.textContent = tr("contact.sending");
}

      try {
        const res = await fetch("/api/send-mail", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name,
            email,
            message: tr("contact.mailSubjectPrefix") + " " + subject + "\n\n" + message,
            source: "studio/contact"
          })
        });

        const data = await res.json().catch(function(){
          return {};
        });

        if (!res.ok || !data.ok) {
          throw new Error(data.message || "contact_submit_failed");
        }

        toast(tr("contact.success"));
        form.reset();
      } catch (err) {
        toast(tr("contact.errorSubmit"));
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = tr("contact.submit");
        }
      }
    });
  }

  window.mobileContactInit = bindContactForm;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindContactForm);
  } else {
    bindContactForm();
  }
})();
