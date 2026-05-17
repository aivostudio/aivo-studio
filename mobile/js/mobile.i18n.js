(function(){
  "use strict";

  var STORAGE_KEY = "aivo_mobile_language";
  var DEFAULT_LANG = "tr";

  var DICTIONARY = {
    tr: {
      "common.appName": "AIVO Mobile Studio",
      "common.credit": "Kredi",
      "common.buyCredit": "Kredi Al",
      "common.loading": "Yükleniyor...",
      "common.save": "Kaydet",
      "common.cancel": "Vazgeç",
      "common.close": "Kapat",
      "common.back": "Geri",

      "nav.home": "Ana Sayfa",
      "nav.productions": "Üretimler",
      "nav.tools": "Araçlar",
      "nav.credits": "Krediler",
      "nav.account": "Hesabım",

      "top.creditEmpty": "Kredi --",
      "top.creditValue": "Kredi {count}",
      "top.creditAI": "Kredi Al",

      "home.eyebrow": "AIVO Mobile Studio",
      "home.title.before": "Cepte AI",
      "home.title.grad": "üretim.",
      "home.subtitle": "Şarkı fikrini yaz, AIVO mobilde üretimi başlatsın.",

      "tools.music": "AI Müzik Üret",
      "tools.cover": "AI Kapak Üret",
      "tools.atmo": "AI Atmosfer Video",
      "tools.cartoon": "AI Çocuk Çizgifilm",
      "tools.photofx": "AI Foto Efekt Video Clip",
      "tools.video": "AI Resimden Video Üret",
      "tools.lipsync": "AI Dudak Senkron Video",

      "account.panels": "Paneller",
      "account.profile": "Profil",
      "account.invoices": "Faturalarım",
      "account.settings": "Ayarlar",
      "account.contact": "Bize Ulaşın",
      "account.logout": "Çıkış Yap",

      "settings.title": "Ayarlar",
      "settings.subtitle": "Bildirim, müzik, gizlilik ve hesap tercihlerini mobilde yönet.",
      "settings.language": "Dil / Language",
      "settings.languageDesc": "Uygulama dilini seç.",
      "settings.privacy": "Gizlilik Politikası",
      "settings.privacyDesc": "KVKK, çerezler ve veri işleme bilgileri.",
      "settings.terms": "Kullanım Şartları",
      "settings.termsDesc": "AIVO Mobile kullanım kuralları ve sorumluluklar.",
      "settings.save": "Ayarları Kaydet",

      "language.title": "Dil Seçimi",
      "language.subtitle": "AIVO Mobile arayüz dilini seç.",
      "language.tr": "Türkçe",
      "language.en": "English",

      "toast.languageChanged": "Dil güncellendi.",
      "toast.settingsSaved": "Ayarlar kaydedildi.",
      "toast.title.success": "Başarılı",
       "toast.title.error": "Hata",
      "toast.title.warning": "Uyarı",
      "toast.title.loading": "İşleniyor",
      "toast.title.info": "Bilgi",

      "empty.homeLoading": "Ana sayfa yükleniyor...",
      "empty.musicLoading": "Müzik modülü yükleniyor...",
      "empty.coverLoading": "Kapak modülü yükleniyor...",
      "empty.atmoLoading": "Atmosfer modülü yükleniyor...",
      "empty.cartoonLoading": "Çizgifilm modülü yükleniyor...",
      "empty.photofxLoading": "PhotoFX modülü yükleniyor...",
      "empty.videoLoading": "Resimden Video modülü yükleniyor...",
      "empty.lipsyncLoading": "Dudak Senkron Video modülü yükleniyor...",
      "empty.creditsLoading": "Krediler bölümü yükleniyor...",
      "empty.policyLoading": "Yasal metin yükleniyor...",
      "empty.profileLoading": "Profil modülü yükleniyor...",
      "empty.invoicesLoading": "Faturalar modülü yükleniyor...",
      "empty.settingsLoading": "Ayarlar modülü yükleniyor...",
      "empty.contactLoading": "İletişim bölümü yükleniyor..."
    },

    en: {
      "common.appName": "AIVO Mobile Studio",
      "common.credit": "Credits",
      "common.buyCredit": "Buy Credits",
      "common.loading": "Loading...",
      "common.save": "Save",
      "common.cancel": "Cancel",
      "common.close": "Close",
      "common.back": "Back",

      "nav.home": "Home",
      "nav.productions": "Creations",
      "nav.tools": "Tools",
      "nav.credits": "Credits",
      "nav.account": "Account",

      "top.creditEmpty": "Credits --",
      "top.creditValue": "Credits {count}",
      "top.creditAI": "Buy Credits",

      "home.eyebrow": "AIVO Mobile Studio",
      "home.title.before": "AI creation",
      "home.title.grad": "on mobile.",
      "home.subtitle": "Write your song idea and let AIVO start creating on mobile.",

      "tools.music": "Create AI Music",
      "tools.cover": "Create AI Cover Art",
      "tools.atmo": "AI Atmosphere Video",
      "tools.cartoon": "AI Kids Cartoon",
      "tools.photofx": "AI Photo Effect Video Clip",
      "tools.video": "Create AI Image-to-Video",
      "tools.lipsync": "AI Lip Sync Video",

      "account.panels": "Panels",
      "account.profile": "Profile",
      "account.invoices": "Invoices",
      "account.settings": "Settings",
      "account.contact": "Contact Us",
      "account.logout": "Log Out",

      "settings.title": "Settings",
      "settings.subtitle": "Manage notifications, music, privacy and account preferences on mobile.",
      "settings.language": "Language",
      "settings.languageDesc": "Choose the app language.",
      "settings.privacy": "Privacy Policy",
      "settings.privacyDesc": "Data usage, cookies and privacy information.",
      "settings.terms": "Terms of Use",
      "settings.termsDesc": "AIVO Mobile rules and responsibilities.",
      "settings.save": "Save Settings",

      "language.title": "Choose Language",
      "language.subtitle": "Select the interface language for AIVO Mobile.",
      "language.tr": "Türkçe",
      "language.en": "English",

      "toast.languageChanged": "Language updated.",
      "toast.settingsSaved": "Settings saved.",
      "toast.title.success": "Success",
       "toast.title.error": "Error",
       "toast.title.warning": "Warning",
      "toast.title.loading": "Processing",
      "toast.title.info": "Info",

      "empty.homeLoading": "Loading home...",
      "empty.musicLoading": "Loading music module...",
      "empty.coverLoading": "Loading cover module...",
      "empty.atmoLoading": "Loading atmosphere module...",
      "empty.cartoonLoading": "Loading cartoon module...",
      "empty.photofxLoading": "Loading PhotoFX module...",
      "empty.videoLoading": "Loading image-to-video module...",
      "empty.lipsyncLoading": "Loading lip sync video module...",
      "empty.creditsLoading": "Loading credits section...",
      "empty.policyLoading": "Loading legal text...",
      "empty.profileLoading": "Loading profile module...",
      "empty.invoicesLoading": "Loading invoices module...",
      "empty.settingsLoading": "Loading settings module...",
      "empty.contactLoading": "Loading contact section..."
    }
  };

  function normalizeLang(lang){
    var value = String(lang || "").trim().toLowerCase();
    if (value.indexOf("en") === 0) return "en";
    if (value.indexOf("tr") === 0) return "tr";
    return DEFAULT_LANG;
  }

  function getSavedLang(){
    try {
      return normalizeLang(localStorage.getItem(STORAGE_KEY) || "");
    } catch (err) {
      return DEFAULT_LANG;
    }
  }

  function setSavedLang(lang){
    var nextLang = normalizeLang(lang);

    try {
      localStorage.setItem(STORAGE_KEY, nextLang);
    } catch (err) {}

    window.AIVO_LANG = nextLang;
    document.documentElement.setAttribute("lang", nextLang);

    applyI18n();

    try {
      document.dispatchEvent(new CustomEvent("aivo:language-change", {
        detail: { lang: nextLang }
      }));
    } catch (err) {}

    return nextLang;
  }

  function formatValue(value, params){
    var text = String(value == null ? "" : value);

    if (!params || typeof params !== "object") {
      return text;
    }

    Object.keys(params).forEach(function(key){
      text = text.replace(new RegExp("\\{" + key + "\\}", "g"), String(params[key]));
    });

    return text;
  }

  function translate(key, params){
    var lang = normalizeLang(window.AIVO_LANG || getSavedLang());
    var pack = DICTIONARY[lang] || DICTIONARY[DEFAULT_LANG] || {};
    var fallbackPack = DICTIONARY[DEFAULT_LANG] || {};
    var value = pack[key] || fallbackPack[key] || key;

    return formatValue(value, params);
  }

  function applyI18n(root){
    var scope = root && root.querySelectorAll ? root : document;

    scope.querySelectorAll("[data-i18n]").forEach(function(el){
      var key = el.getAttribute("data-i18n");
      if (!key) return;
      el.textContent = translate(key);
    });

    scope.querySelectorAll("[data-i18n-html]").forEach(function(el){
      var key = el.getAttribute("data-i18n-html");
      if (!key) return;
      el.innerHTML = translate(key);
    });

    scope.querySelectorAll("[data-i18n-placeholder]").forEach(function(el){
      var key = el.getAttribute("data-i18n-placeholder");
      if (!key) return;
      el.setAttribute("placeholder", translate(key));
    });

    scope.querySelectorAll("[data-i18n-label]").forEach(function(el){
      var key = el.getAttribute("data-i18n-label");
      if (!key) return;
      el.setAttribute("aria-label", translate(key));
    });
  }

  window.AIVO_I18N = DICTIONARY;
  window.AIVO_LANG = getSavedLang();
  window.t = translate;
  window.aivoSetLanguage = setSavedLang;
  window.aivoApplyI18n = applyI18n;

  document.documentElement.setAttribute("lang", window.AIVO_LANG);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function(){
      applyI18n();
    });
  } else {
    applyI18n();
  }
})();
