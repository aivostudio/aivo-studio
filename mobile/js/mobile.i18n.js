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
     "settings.notifications.title": "Bildirim Ayarları",
"settings.notifications.subtitle": "Hangi bildirimleri almak istediğini seç.",
"settings.notifications.musicDone": "Müzik üretimi tamamlandığında",
"settings.notifications.musicDoneDesc": "Şarkın hazır olduğunda e-posta al.",
"settings.notifications.lowCredit": "Kredi azaldığında",
"settings.notifications.lowCreditDesc": "Kredin azaldığında uyarı al.",
"settings.notifications.weekly": "Haftalık rapor",
"settings.notifications.weeklyDesc": "Haftalık aktivite özetini al.",
"settings.notifications.promos": "Kampanyalar",
"settings.notifications.promosDesc": "Özel tekliflerden haberdar ol.",
      "settings.music.title": "Müzik Ayarları",
"settings.music.subtitle": "Çalma ve üretim tercihlerini ayarla.",
"settings.music.qualityLow": "Düşük",
"settings.music.qualityLowDesc": "128 kbps — daha hızlı üretim.",
"settings.music.qualityHigh": "Yüksek",
"settings.music.qualityHighDesc": "256 kbps — dengeli kalite.",
"settings.music.qualityStudio": "Studio",
"settings.music.qualityStudioDesc": "320 kbps — en yüksek kalite.",
"settings.music.autoplay": "Otomatik çalma",
"settings.music.autoplayDesc": "Üretim tamamlanınca müzik otomatik oynatılsın.",
"settings.music.defaultVolume": "Varsayılan ses seviyesi",
"settings.music.silent": "Sessiz",
"settings.music.maximum": "Maksimum",
      "settings.privacyPane.title": "Gizlilik Ayarları",
"settings.privacyPane.subtitle": "Verilerinin nasıl kullanıldığını kontrol et.",
"settings.privacyPane.public": "Herkese açık",
"settings.privacyPane.publicDesc": "Profilin herkes tarafından görülebilir.",
"settings.privacyPane.private": "Özel",
"settings.privacyPane.privateDesc": "Profilini sadece sen görebilirsin.",
"settings.privacyPane.activityShare": "Aktivite paylaşımı",
"settings.privacyPane.activityShareDesc": "Üretim aktiviten profilinde görünebilir.",
"settings.privacyPane.analytics": "Anonim veri toplama",
"settings.privacyPane.analyticsDesc": "Uygulamayı geliştirmek için anonim kullanım verisi.",
      "settings.security.title": "Hesap & Güvenlik",
"settings.security.subtitle": "Oturum süresi ve güvenlik tercihlerini yönet.",
"settings.security.sessionTimeout": "Otomatik çıkış zamanı",
"settings.security.timeoutOff": "Kapalı",
"settings.security.timeout15m": "15 dakika",
"settings.security.timeout30m": "30 dakika",
"settings.security.timeout1h": "1 saat",
"settings.security.timeout6h": "6 saat",
"settings.security.timeout24h": "24 saat",
"settings.security.note": "Aktif cihazlar ve 2 adımlı doğrulama mobilde yakında açılacak.",
      "settings.data.title": "Veri Hakları",
"settings.data.subtitle": "Kişisel verilerine erişim ve talep işlemleri.",
"settings.data.exportFormat": "Export formatı",
"settings.data.zipSoon": "ZIP yakında",
"settings.data.download": "Verilerimi İndir",
"settings.data.rectification": "Düzeltme talebi",
"settings.data.rectificationPlaceholder": "Düzeltme talebini kısaca yaz...",
"settings.data.deleteAck": "Silme talebini anladım",
"settings.data.deleteAckDesc": "Bu işlem ileride hesabının kalıcı silinmesini başlatabilir.",
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
      "assistant.launcher": "AI Yardım",
      "assistant.title": "AIVO AI Yardım",
      "assistant.subtitle": "Hızlı yönlendirme, paket, kredi ve prompt desteği",
      "assistant.placeholder": "Sorunu ya da yapmak istediğini yaz...",
     "assistant.send": "Gönder",
     "assistant.wait": "Bekle...",
      "login.hero.before": "Studio’ya",
"login.hero.grad": "giriş.",
"login.hero.subtitle": "Mobil üretim alanına devam etmek için giriş yap veya ücretsiz hesabını oluştur.",

"login.tab.login": "Giriş Yap",
"login.tab.register": "Kayıt Ol",

"login.email": "E-posta",
"login.emailPlaceholder": "ornek@email.com",

"login.password": "Şifre",
"login.passwordPlaceholder": "Şifreniz",

"login.submit.login": "Giriş Yap",
"login.submit.register": "Hesap Oluştur",

"login.footer.new": "AIVO’da yeni misin?",
"login.footer.haveAccount": "Zaten hesabın var mı?",
"login.footer.create": "Ücretsiz hesap oluştur →",
"login.footer.login": "Giriş yap →",
      "login.error.emailPasswordRequired": "E-posta ve şifre gerekli.",
"login.error.invalidCredentials": "E-posta veya şifre hatalı.",
"login.success.login": "Giriş başarılı.",
      "profile.heroSub": "Profil bilgilerini ve hesap güvenliğini mobilde hızlıca yönet.",
"profile.infoTitle": "Profil Bilgileri",
"profile.infoSub": "Kişisel hesap bilgilerin",
"profile.firstName": "Ad",
"profile.firstNamePlaceholder": "Adın",
"profile.lastName": "Soyad",
"profile.lastNamePlaceholder": "Soyadın",
"profile.email": "E-posta",
"profile.emailLocked": "Güvenlik nedeniyle e-posta adresi değiştirilemez.",
"profile.update": "Profili Güncelle",
"profile.securityTitle": "Güvenlik",
"profile.securitySub": "Şifre ve hesap güvenliği",
"profile.securityText": "Hesabını güvende tutmak için şifreni düzenli aralıklarla güncelle.",
"profile.changePassword": "Şifre Değiştir",
"profile.passwordSub": "Hesabını güvende tutmak için güçlü bir şifre kullan.",
"profile.currentPassword": "Mevcut Şifre",
"profile.currentPasswordPlaceholder": "Mevcut şifren",
"profile.newPassword": "Yeni Şifre",
"profile.newPasswordPlaceholder": "Yeni şifre",
"profile.repeatPassword": "Yeni Şifre Tekrar",
"profile.repeatPasswordPlaceholder": "Yeni şifre tekrar",
"profile.updatePassword": "Şifreyi Güncelle",
      "invoices.title": "Faturalarım",
"invoices.subtitle": "Satın alımlarına ait fatura ve ödeme belgelerini mobilde hızlıca görüntüle.",
"invoices.filtersLabel": "Fatura filtreleri",
"invoices.filterAll": "Tümü",
"invoices.filterPurchase": "Satın Alım",
"invoices.filterRefund": "İade",
"invoices.loading": "Faturalar yükleniyor...",
      "invoices.statusPaid": "Ödendi",
"invoices.statusRefunded": "İade Edildi",
"invoices.statusPending": "Beklemede",
"invoices.statusFailed": "Başarısız",
"invoices.statusCancelled": "İptal",
      "invoices.creditPackage": "Kredilik Paket",
"invoices.defaultPackage": "Kredi Paketi",
"invoices.totalCredits": "Toplam",
"invoices.creditDefined": "kredi tanımı",
"invoices.purchaseDetail": "Satın alım detayı",
      "invoices.openRefund": "İade Belgesini Aç",
"invoices.openInvoice": "Faturayı Görüntüle",
"invoices.typeRefund": "İade",
"invoices.typePurchase": "Satın Alım",
      "invoices.date": "Tarih",
"invoices.status": "Durum",
"invoices.amount": "Tutar",
      "invoices.emptyFilter": "Bu filtre için fatura bulunamadı.",
"invoices.sessionMissing": "Faturaları göstermek için oturum bilgisi bulunamadı.",
"invoices.empty": "Henüz fatura kaydın yok. Kredi satın aldığında burada görünecek.",
"invoices.loadFailed": "Faturalar şu an yüklenemedi.",
      "contact.title": "Bize Ulaşın",
"contact.subtitle": "Soru, öneri, ödeme, hesap veya üretim sorunları için bize yaz.",
"contact.messageTitle": "Mesaj Gönder",
"contact.messageSub": "Destek ekibimize doğrudan mesaj bırak.",
"contact.name": "Ad Soyad",
"contact.namePlaceholder": "Adını ve soyadını yaz",
"contact.email": "E-posta",
"contact.emailPlaceholder": "ornek@mail.com",
"contact.subject": "Konu",
"contact.subjectPlaceholder": "Kısaca konu başlığı",
"contact.message": "Mesaj",
"contact.messagePlaceholder": "Bize nasıl yardımcı olabileceğimizi yaz",
"contact.submit": "Mesaj Gönder",
"contact.infoTitle": "İletişim Bilgileri",
"contact.infoSub": "Genellikle 24 saat içinde dönüş yapıyoruz.",
"contact.emailLabel": "E-posta",
"contact.whatsapp": "WhatsApp Destek Hattı",
"contact.status": "Durum",
"contact.statusText": "Aktif destek kanalı açık.",
      "contact.errorRequired": "Lütfen tüm alanları doldur.",
"contact.sending": "Gönderiliyor...",
"contact.mailSubjectPrefix": "Konu:",
"contact.success": "Mesajın alındı. En kısa sürede dönüş yapacağız.",
"contact.errorSubmit": "Mesaj gönderilemedi. Lütfen tekrar dene.",

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
      "settings.notifications.title": "Notification Settings",
"settings.notifications.subtitle": "Choose which notifications you want to receive.",
"settings.notifications.musicDone": "When music generation is complete",
"settings.notifications.musicDoneDesc": "Get an email when your song is ready.",
"settings.notifications.lowCredit": "When credits are low",
"settings.notifications.lowCreditDesc": "Get notified when your credits are low.",
"settings.notifications.weekly": "Weekly report",
"settings.notifications.weeklyDesc": "Receive your weekly activity summary.",
"settings.notifications.promos": "Campaigns",
"settings.notifications.promosDesc": "Stay informed about special offers.",
      "settings.music.title": "Music Settings",
"settings.music.subtitle": "Adjust playback and generation preferences.",
"settings.music.qualityLow": "Low",
"settings.music.qualityLowDesc": "128 kbps — faster generation.",
"settings.music.qualityHigh": "High",
"settings.music.qualityHighDesc": "256 kbps — balanced quality.",
"settings.music.qualityStudio": "Studio",
"settings.music.qualityStudioDesc": "320 kbps — highest quality.",
"settings.music.autoplay": "Autoplay",
"settings.music.autoplayDesc": "Automatically play music when generation is complete.",
"settings.music.defaultVolume": "Default volume",
"settings.music.silent": "Silent",
"settings.music.maximum": "Maximum",
      "settings.privacyPane.title": "Privacy Settings",
"settings.privacyPane.subtitle": "Control how your data is used.",
"settings.privacyPane.public": "Public",
"settings.privacyPane.publicDesc": "Your profile can be viewed by everyone.",
"settings.privacyPane.private": "Private",
"settings.privacyPane.privateDesc": "Only you can view your profile.",
"settings.privacyPane.activityShare": "Activity sharing",
"settings.privacyPane.activityShareDesc": "Your generation activity may appear on your profile.",
"settings.privacyPane.analytics": "Anonymous analytics",
"settings.privacyPane.analyticsDesc": "Anonymous usage data to improve the app.",
      "settings.security.title": "Account & Security",
"settings.security.subtitle": "Manage session duration and security preferences.",
"settings.security.sessionTimeout": "Automatic logout time",
"settings.security.timeoutOff": "Off",
"settings.security.timeout15m": "15 minutes",
"settings.security.timeout30m": "30 minutes",
"settings.security.timeout1h": "1 hour",
"settings.security.timeout6h": "6 hours",
"settings.security.timeout24h": "24 hours",
"settings.security.note": "Active devices and 2-step verification will be available on mobile soon.",
      "settings.data.title": "Data Rights",
"settings.data.subtitle": "Access and request operations for your personal data.",
"settings.data.exportFormat": "Export format",
"settings.data.zipSoon": "ZIP coming soon",
"settings.data.download": "Download My Data",
"settings.data.rectification": "Rectification request",
"settings.data.rectificationPlaceholder": "Briefly write your rectification request...",
"settings.data.deleteAck": "I understand the deletion request",
"settings.data.deleteAckDesc": "This action may initiate permanent deletion of your account in the future.",

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
      "assistant.launcher": "AI Help",
       "assistant.title": "AIVO AI Assistant",
      "assistant.subtitle": "Quick guidance, package, credit and prompt support",
      "assistant.placeholder": "Write your issue or what you want to do...",
      "assistant.send": "Send",
      "assistant.wait": "Please wait...",
      "login.hero.before": "Sign into",
"login.hero.grad": "Studio.",
"login.hero.subtitle": "Sign in or create your free account to continue to the mobile creation studio.",

"login.tab.login": "Sign In",
"login.tab.register": "Register",

"login.email": "Email",
"login.emailPlaceholder": "example@email.com",

"login.password": "Password",
"login.passwordPlaceholder": "Your password",

"login.submit.login": "Sign In",
"login.submit.register": "Create Account",

"login.footer.new": "New to AIVO?",
"login.footer.haveAccount": "Already have an account?",
"login.footer.create": "Create free account →",
"login.footer.login": "Sign in →",
      "login.error.emailPasswordRequired": "Email and password are required.",
"login.error.invalidCredentials": "Incorrect email or password.",
"login.success.login": "Login successful.",
      "profile.heroSub": "Manage your profile details and account security quickly on mobile.",
"profile.infoTitle": "Profile Details",
"profile.infoSub": "Your personal account information",
"profile.firstName": "First Name",
"profile.firstNamePlaceholder": "Your first name",
"profile.lastName": "Last Name",
"profile.lastNamePlaceholder": "Your last name",
"profile.email": "Email",
"profile.emailLocked": "For security reasons, the email address cannot be changed.",
"profile.update": "Update Profile",
"profile.securityTitle": "Security",
"profile.securitySub": "Password and account security",
"profile.securityText": "Keep your account safe by updating your password regularly.",
"profile.changePassword": "Change Password",
"profile.passwordSub": "Use a strong password to keep your account secure.",
"profile.currentPassword": "Current Password",
"profile.currentPasswordPlaceholder": "Current password",
"profile.newPassword": "New Password",
"profile.newPasswordPlaceholder": "New password",
"profile.repeatPassword": "Repeat New Password",
"profile.repeatPasswordPlaceholder": "Repeat new password",
"profile.updatePassword": "Update Password",
      "invoices.title": "Invoices",
"invoices.subtitle": "Quickly view your invoices and payment documents on mobile.",
"invoices.filtersLabel": "Invoice filters",
"invoices.filterAll": "All",
"invoices.filterPurchase": "Purchase",
"invoices.filterRefund": "Refund",
"invoices.loading": "Loading invoices...",
      "invoices.statusPaid": "Paid",
"invoices.statusRefunded": "Refunded",
"invoices.statusPending": "Pending",
"invoices.statusFailed": "Failed",
"invoices.statusCancelled": "Cancelled",
      "invoices.creditPackage": "Credit Package",
"invoices.defaultPackage": "Credit Pack",
"invoices.totalCredits": "Total",
"invoices.creditDefined": "credits assigned",
"invoices.purchaseDetail": "Purchase detail",
      "invoices.openRefund": "Open Refund Document",
"invoices.openInvoice": "View Invoice",
"invoices.typeRefund": "Refund",
"invoices.typePurchase": "Purchase",
      "invoices.date": "Date",
"invoices.status": "Status",
"invoices.amount": "Amount",
      "invoices.emptyFilter": "No invoices found for this filter.",
"invoices.sessionMissing": "Session information was not found to display invoices.",
"invoices.empty": "You do not have any invoice records yet. They will appear here after you buy credits.",
"invoices.loadFailed": "Invoices could not be loaded right now.",
      "contact.title": "Contact Us",
"contact.subtitle": "Write to us for questions, suggestions, payments, account or production issues.",
"contact.messageTitle": "Send Message",
"contact.messageSub": "Leave a direct message to our support team.",
"contact.name": "Full Name",
"contact.namePlaceholder": "Write your full name",
"contact.email": "Email",
"contact.emailPlaceholder": "example@mail.com",
"contact.subject": "Subject",
"contact.subjectPlaceholder": "Short subject title",
"contact.message": "Message",
"contact.messagePlaceholder": "Write how we can help you",
"contact.submit": "Send Message",
"contact.infoTitle": "Contact Information",
"contact.infoSub": "We usually respond within 24 hours.",
"contact.emailLabel": "Email",
"contact.whatsapp": "WhatsApp Support Line",
"contact.status": "Status",
"contact.statusText": "Active support channel available.",
      "contact.errorRequired": "Please fill in all fields.",
"contact.sending": "Sending...",
"contact.mailSubjectPrefix": "Subject:",
"contact.success": "Your message has been received. We will get back to you as soon as possible.",
"contact.errorSubmit": "Message could not be sent. Please try again.",

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
