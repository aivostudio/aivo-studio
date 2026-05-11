/* =========================================================
   AIVO MOBILE — CONTACT
   File: /mobile/js/mobile.contact.js
   ========================================================= */

(function(){
  "use strict";

  if (window.__AIVO_MOBILE_CONTACT__) return;
  window.__AIVO_MOBILE_CONTACT__ = true;

  function toast(message){
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
        toast("Lütfen tüm alanları doldur.");
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Gönderiliyor...";
      }

      try {
        await new Promise(function(resolve){
          setTimeout(resolve, 700);
        });

        toast("Mesajın alındı. En kısa sürede dönüş yapacağız.");
        form.reset();
      } catch (err) {
        toast("Mesaj gönderilemedi. Lütfen tekrar dene.");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Mesaj Gönder";
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
