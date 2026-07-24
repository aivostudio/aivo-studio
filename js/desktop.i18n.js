/* =========================================================
   AIVO DESKTOP I18N
   - Türkçe / English
   - Manuel seçim her zaman önceliklidir
   - Manuel seçim yoksa ülke tespiti kullanılır
   - Ülke bulunamazsa tarayıcı dili kullanılır
   ========================================================= */

(function () {
  "use strict";

  if (window.__AIVO_DESKTOP_I18N__) return;
  window.__AIVO_DESKTOP_I18N__ = true;

  var STORAGE_KEY = "aivo_language";
  var LEGACY_STORAGE_KEY = "aivo_mobile_language";

  var DEFAULT_LANG = "en";
  var SUPPORTED_LANGS = ["tr", "en"];

  var DICTIONARY = {
    tr: {
      /* =========================
         SEO
         ========================= */

      "seo.title": "AIVO – AI Müzik, Video ve Görsel Üretim Stüdyosu",
      "seo.description":
        "AIVO Studio ile yapay zekâ destekli müzik, video, kapak, fotoğraf ve çizgifilm içerikleri oluşturun.",

      /* =========================
         COMMON
         ========================= */

      "common.appName": "AIVO Studio",
      "common.loading": "Yükleniyor...",
      "common.save": "Kaydet",
      "common.cancel": "Vazgeç",
      "common.close": "Kapat",
      "common.back": "Geri",
      "common.continue": "Devam Et",
      "common.email": "E-posta",
      "common.password": "Şifre",
      "common.account": "Hesap",
      "common.credit": "Kredi",
      "common.credits": "Krediler",
      "common.buyCredit": "Kredi Al",
      "common.openMenu": "Menüyü aç",
      "common.closeMenu": "Menüyü kapat",

      /* =========================
         LANGUAGE
         ========================= */

      "language.label": "Dil",
      "language.menuLabel": "Dil seçimi",
      "language.tr": "Türkçe",
      "language.en": "English",
      "language.changed": "Dil Türkçe olarak güncellendi.",

      /* =========================
         TOPBAR
         ========================= */

      "topbar.navLabel": "Üst menü",

      "topbar.products": "Ürünler",
      "topbar.productsMenuLabel": "Ürünler menüsü",

      "topbar.product.musicTitle": "AI Müzik Üret",
      "topbar.product.musicSub": "Türkçe odaklı, hızlı üretim",

      "topbar.product.coverTitle": "AI Kapak Üret",
      "topbar.product.coverSub": "Kapak, afiş ve görsel içerik",

      "topbar.product.atmoTitle": "AI Atmosfer Video",
      "topbar.product.atmoSub": "Loop sahne ve atmosfer",

      "topbar.product.cartoonTitle": "AI Çocuk Çizgifilm",
      "topbar.product.cartoonSub": "Preset karakterlerle sahne üretimi",

      "topbar.product.photofxTitle": "AI Foto Efekt Video Clip",
      "topbar.product.photofxSub":
        "Tek fotoğraftan hareketli efekt klip üret",

      "topbar.product.videoTitle": "AI Resimden Video Üret",
      "topbar.product.videoSub": "Sosyal medya uyumlu çıktılar",

      "topbar.corporate": "Kurumsal",
      "topbar.corporateMenuLabel": "Kurumsal menüsü",

      "topbar.corporate.aboutTitle": "Hakkımızda",
      "topbar.corporate.aboutSub": "AIVO’nun hikayesi",

      "topbar.corporate.featuresTitle": "Özellikler",
      "topbar.corporate.featuresSub": "Neler sunuyoruz",

      "topbar.corporate.privacyTitle": "Gizlilik Politikası",
      "topbar.corporate.privacySub": "KVKK / GDPR",

      "topbar.corporate.distanceSalesTitle": "Mesafeli Satış",
      "topbar.corporate.distanceSalesSub": "Sözleşme metni",

      "topbar.corporate.safeUseTitle": "Güvenli Kullanım",
      "topbar.corporate.safeUseSub":
        "İçerik kuralları ve kullanım sınırları",

      "topbar.corporate.contactTitle": "İletişim",
      "topbar.corporate.contactSub": "info@aivo.tr",

      "topbar.education": "Eğitim İçerikleri",
      "topbar.coin": "AIVO COIN",
      "topbar.pricing": "Fiyatlandırma",

      "topbar.login": "Giriş Yap",
      "topbar.register": "Kayıt Ol",

      "topbar.creditBalanceTitle": "Kredi bakiyesi",
      "topbar.creditValue": "Kredi {count}",
      "topbar.buyCredit": "Kredi Al",

      "topbar.account": "Hesap",
      "topbar.profile": "Profil",
      "topbar.invoices": "Faturalarım",
      "topbar.settings": "Ayarlar",
      "topbar.logout": "Çıkış Yap",

      /* =========================
         INDEX / HERO
         ========================= */

      "index.heroBadge":
        "AIVO Studio • AI ile içerik üretiminin yeni standardı",

      "index.heroBrand": "AIVO Studio",
      "index.heroLine": "İlhamı üretime dönüştür.",

      "index.heroSwap.music": "Müzik",
      "index.heroSwap.video": "Video",
       "index.heroSwap.visual": "Görsel",

"index.heroSwap.musicSub":
  "Tarzını yaz. AIVO stüdyo kalitesinde üretim yapsın.",

"index.heroSwap.videoSub":
  "Senaryonu yaz. AIVO sahneleri otomatik kurgulasın.",

"index.heroSwap.visualSub":
  "Prompt ver. AIVO kapak ve görselleri saniyeler içinde üretsin.",
      "index.heroSwap.cover": "Kapak",
      "index.heroSwap.atmosphere": "Atmosfer",
      "index.heroSwap.cartoon": "Çizgifilm",

      "index.heroSubtitle":
        "Çok modüllü AI içerik üretim platformu: müzik, video ve görsel üretimini tek yerde birleştirir.",

      "index.enterStudio": "Studio’ya Gir",
      "index.googlePlay": "▶ Google Play",
      "index.appStore": " App Store",

      "index.benefit.quality": "Profesyonel kalite hedefi",
      "index.benefit.rights": "Telif ve kullanım hakları sende",
      "index.benefit.download": "Anında indir, paylaş",

      "index.demo.videoTitle": "Görselden Video Klip",
      "index.demo.videoSub":
        "Görselini hareketli klip sahnesine dönüştür",

      "index.demo.youtube": "🎬 YouTube’da Tüm Eğitimleri İzle",
      "index.demo.soundOpen": "🔊 Sesi Aç",
      "index.demo.soundOn": "🔊 Ses Açık",
      "index.demo.soundOff": "🔇 Sesi Aç",

      /* =========================
         INDEX / ATMOSPHERE
         ========================= */

      "index.atmo.sectionLabel": "AI Atmosfer Video",
      "index.atmo.title": "AI Atmosfer Video",

      "index.atmo.subtitleHtml":
        "Klip çekemeyenler için <strong>loop’lanabilir</strong> atmosfer videoları. Kar yağsın, yağmur aksın, ışıklar titresin.",

      "index.atmo.topStrong": "Klip alternatifi.",
      "index.atmo.topText":
        "5-10-15 saniyelik kusursuz loop • YouTube / Spotify arka planına hazır",

      "index.atmo.warm": "🔥 SICAK",
      "index.atmo.rain": "🌧️ YAĞMUR",
      "index.atmo.snow": "❄️ KAR",
      "index.atmo.leaf": "🍂 YAPRAK",
      "index.atmo.light": "✨ IŞIK",
      "index.atmo.wind": "🌬️ RÜZGAR",
      "index.atmo.fog": "🌫️ SİS",

      "index.atmo.create": "Atmosfer Video Oluştur →",
      "index.atmo.cardTitle": "Atmosfer Video Oluştur",

      "index.atmo.description":
        "Klip çekmeden de şarkını, teaser’ını ya da markanı daha büyük, daha estetik ve daha profesyonel gösterecek atmosfer videoları üret. AIVO; sahne hissi yüksek, premium görünen ve izleyicide “hazır proje” etkisi bırakan görsel vitrinler oluşturur.",

      "index.atmo.bullet1":
        "🎬 Klibin yoksa boşluğu ucuz değil, premium bir görüntüyle doldur",

      "index.atmo.bullet2":
        "✨ Tek sahnede daha zengin, daha derin ve daha dikkat çekici bir atmosfer kur",

      "index.atmo.bullet3":
        "🎵 Şarkı çıkışı, teaser paylaşımı, lyric video ve dijital vitrin için hazır görünüm al",

      "index.atmo.bottomStrong": "Hazır görünüm, hızlı başlangıç.",
      "index.atmo.bottomText":
        "İlk atmosfer videonu kısa sürede oluştur.",

      /* =========================
         INDEX / CHILD CARTOON
         ========================= */

      "index.cartoon.sectionLabel": "AI Çocuk Çizgifilm",
      "index.cartoon.title": "AI Çocuk Çizgifilm",

      "index.cartoon.slogan":
        "Karakterini yarat, hikâyeni kur, çizgifilmini üret.",

      "index.cartoon.barLead":
        "Karakterden sahnelere,",

      "index.cartoon.barStrong":
        "sahnelerden çizgifilme.",

      "index.cartoon.badgeCharacter":
        "Karakter Yarat",

      "index.cartoon.badgeScene":
        "Tek Sahne",

      "index.cartoon.badgeStory":
        "Hikâye Modu",

      "index.cartoon.badgeDuration":
        "3–6 Dakika Akış",

      "index.cartoon.cardTitle":
        "Aynı karakterlerle sahne sahne ilerleyen çizgifilm akışı oluştur.",

      "index.cartoon.description":
        "Preset ya da kendi karakterlerinle kısa sahneler üret, hikâyeni akışa dönüştür, aynı karakter bütünlüğünü koruyarak 3–6 dakikaya kadar çizgifilm kurgusu hazırla.",

      "index.cartoon.feature1":
        "Karakter oluştur veya preset karakterle başla",

      "index.cartoon.feature2":
        "Tek sahne ya da çok sahneli hikâye akışı kur",

      "index.cartoon.feature3":
        "Aynı karakterlerle tutarlı çizgifilm üretimi",

      "index.cartoon.cta":
        "Çizgifilmini Oluştur →",

      "index.cartoon.shot1Alt":
        "Nova yaklaşır",

      "index.cartoon.shot1Label":
        "Yaklaşır",

      "index.cartoon.shot2Alt":
        "Nova küreyi bulur",

      "index.cartoon.shot2Label":
        "Küreyi bulur",

      "index.cartoon.shot3Alt":
        "Nova gücünü salar",

      "index.cartoon.shot3Label":
        "Gücünü salar",

       "index.cartoon.bottomStrong":
        "Karakterden akışa tek üretim hattı.",

      "index.cartoon.bottomText":
        "İlk çizgifilm akışını kısa sürede başlat.",

      /* =========================
         INDEX / PHOTO EFFECT CLIP
         ========================= */

      "index.photofx.sectionLabel":
        "AI Foto Effect Clip",

      "index.photofx.title":
        "AI Foto Effect Clip",

      "index.photofx.subtitle":
        "Tek fotoğrafı al, efektle güçlendir, kısa video klibe dönüştür. Sosyal medyada daha canlı, daha premium, daha dikkat çekici görün.",

      "index.photofx.barStrong":
        "Tek kareden hareketli etki.",

      "index.photofx.barText":
        "Reels / Shorts / teaser paylaşımı için hızlı foto efekt klip üretimi",

      "index.photofx.original":
        "Orijinal",

      "index.photofx.glow":
        "Glow",

      "index.photofx.shake":
        "Shake",

      "index.photofx.cardTitle":
        "AI Foto Effect Clip Oluştur",

      "index.photofx.description":
        "Tek fotoğrafı premium görünen kısa video klibe dönüştür. Teaser, duyuru ve sosyal medya paylaşımlarında daha canlı, daha dikkat çekici görünüm al.",

      "index.photofx.bullet1":
        "🎬 Tek fotoğraftan kısa, dinamik ve paylaşılabilir effect clip üret",

      "index.photofx.bullet2":
        "✨ Glow, shake, flash ve stil katmanlarıyla görseli güçlendir",

      "index.photofx.bullet3":
        "🗣️ Tek fotoğrafı konuştur, dikkat çekici ve paylaşılabilir videoya dönüştür",

      "index.photofx.bullet4":
        "📱 Reels, Shorts, teaser ve duyuru postları için hazır görünüm al",

      "index.photofx.bullet5":
        "💬 Prompt komutuyla fotoğrafını konuştur, tek kareyi sahneye dönüştür",

      "index.photofx.cta":
        "Foto Effect Clip Oluştur →",

          "index.photofx.bottomStrong":
        "Tek kareden güçlü etki.",

      "index.photofx.bottomText":
        "İlk effect clip’ini kısa sürede oluştur.",

      /* =========================
         INDEX / LIP SYNC VIDEO
         ========================= */

      "index.lipsync.sectionLabel":
        "AI Dudak Senkron Video",

      "index.lipsync.title":
        "AI Dudak Senkron Video",

      "index.lipsync.subtitle":
        "Fotoğrafını yükle, metin yaz veya ses dosyası ekle. Karakterini konuştur, sosyal medya ve tanıtım için hazır video üret.",

      "index.lipsync.barStrong":
        "Fotoğraftan konuşan video.",

      "index.lipsync.barText":
        "Metin ya da ses dosyasıyla dudak senkron video üretimi",

      "index.lipsync.soundOff":
        "🔇 Sesi Aç",

      "index.lipsync.soundOn":
        "🔊 Ses Açık",

      "index.lipsync.badgePhoto":
        "🗣️ Konuşan Fotoğraf",

      "index.lipsync.badgeVoice":
        "🎙️ Ses / Metin",

      "index.lipsync.badgeSocial":
        "📱 Sosyal Medya",

      "index.lipsync.cta":
        "Dudak Senkron Video Oluştur →",

      "index.lipsync.cardTitle":
        "AI Dudak Senkron Video Oluştur",

      "index.lipsync.description":
        "Fotoğrafını konuştur, metin ya da sesle dudak senkron video üret. Tanıtım, sosyal medya, karakter sunumu ve hızlı içerik akışları için hazır görünüm al.",

      "index.lipsync.bullet1":
        "🗣️ Fotoğrafını konuşan videoya dönüştür",

      "index.lipsync.bullet2":
        "🎤 Şarkını AI vocalist’e okut, görselini konuştur ve dudak senkron video üret",

      "index.lipsync.bullet3":
        "📱 Reels, Shorts, tanıtım ve sosyal medya içerikleri için hazır çıktı al",

      "index.lipsync.bullet4":
        "✨ Markan, karakterin veya içerik fikrin için dikkat çekici video oluştur",

      "index.lipsync.bullet5":
        "⚡ Kredi ve süre hesabıyla kontrollü üretim akışı kullan",

          "index.lipsync.bottomStrong":
        "Fotoğraftan konuşan videoya.",

      "index.lipsync.bottomText":
        "İlk dudak senkron videonu kısa sürede oluştur.",

      /* =========================
         INDEX / MODULES
         ========================= */

      "index.modules.sectionLabel":
        "AI Yaratıcılık Platformu",

      "index.modules.pill":
        "AI Yaratıcılık Platformu",

      "index.modules.title":
        "Yaratıcılık Yolculuğunuza Başlayın",

      "index.modules.subtitle":
        "Yapay zekâ ile müzik, kapak ve video üretmenin sınırsız dünyasını keşfedin. Fikrinizi saniyeler içinde üretime dönüştürün.",

      "index.modules.musicTitle":
        "Müzik Üret",

      "index.modules.musicDescription":
        "Tarzı seç, prompt yaz, üret ve varyasyonlarla zenginleştir.",

      "index.modules.musicFeature1":
        "Anında üretim",

      "index.modules.musicFeature2":
        "Profesyonel kalite hedefi",

      "index.modules.musicFeature3":
        "Türkçe odak",

      "index.modules.musicCta":
        "Müzik Üret →",

      "index.modules.coverTitle":
        "Kapak Üret",

      "index.modules.coverDescription":
        "Albüm kapağı, afiş ve görsel içerikler için tek tıkla üretim.",

      "index.modules.coverFeature1":
        "Yüksek çözünürlük",

      "index.modules.coverFeature2":
        "Stil kontrolü",

      "index.modules.coverFeature3":
        "Ticari kullanım hedefi",

      "index.modules.coverCta":
        "Kapak Üret →",

      "index.modules.videoTitle":
        "Video Üret",

      "index.modules.videoDescription":
        "Metinden veya görselden, sosyal medyaya uygun video çıktıları.",

      "index.modules.videoFeature1":
        "HD çıktı hedefi",

      "index.modules.videoFeature2":
        "Hızlı render akışı",

      "index.modules.videoFeature3":
        "Kolay paylaşım",

      "index.modules.videoCta":
        "Video Üret →",

        "index.modules.ctaNote":
        "Müzik, kapak ve video üretimine hemen başla",

      "index.modules.ctaButton":
        "Hemen Başla – Tamamen Ücretsiz ✨",

      /* =========================
         INDEX / CORPORATE SHOWCASE
         ========================= */

      "index.corporate.sectionLabel":
        "AIVO Studio Kurumsal Bilgiler",

      "index.corporate.eyebrow":
        "KURUMSAL",

      "index.corporate.title":
        "AIVO Studio",

      "index.corporate.lead":
        "Yapay zekâ destekli müzik, video ve kapak üretimini herkes için erişilebilir hâle getiren yaratıcı üretim platformu.",

      "index.corporate.aboutTitle":
        "Hakkımızda",

      "index.corporate.aboutText1":
        "AIVO Studio; müzik üretimi, ses kaydı, video üretimi ve kapak tasarımını tek bir yapay zekâ destekli platformda sunar.",

      "index.corporate.aboutText2":
        "Hem yeni başlayanlar hem de profesyoneller için hızlı, esnek ve ölçeklenebilir bir üretim deneyimi sağlar.",

      "index.corporate.aboutLinkTitle":
        "AIVO Studio Hakkımızda",

      "index.corporate.aboutLinkLabel":
        "Hakkımızda sayfasını aç",

      "index.corporate.featuresTitle":
        "Özellikler",

      "index.corporate.featuresText":
        "AI müzik, ses, video ve kapak üretimi için geliştirilmiş güçlü ve esnek üretim araçları.",

      "index.corporate.featuresMore":
        "Tüm özellikleri görmek için →",

      "index.corporate.featuresLinkTitle":
        "AIVO Studio Özellikler",

      "index.corporate.featuresLinkLabel":
        "Özellikler sayfasını aç",

      "index.corporate.privacyTitle":
        "Gizlilik & Güven",

      "index.corporate.privacyFeature1":
        "KVKK / GDPR uyumlu",

      "index.corporate.privacyFeature2":
        "Kredi kartı bilgileri saklanmaz",

      "index.corporate.privacyFeature3":
        "Üretilen içerikler size aittir",

      "index.corporate.privacyFeature4":
        "256-bit SSL güvenliği",

      "index.corporate.lastUpdated":
        "Son güncelleme: 17 Aralık 2025",

      "index.corporate.privacyLinkTitle":
        "Gizlilik Politikası ve KVKK",

      "index.corporate.privacyLinkLabel":
        "Gizlilik ve KVKK sayfasını aç",

      "index.corporate.salesTitle":
        "Mesafeli Satış",

      "index.corporate.salesText1":
        "AIVO Studio üzerinden sunulan tüm hizmetler dijital niteliktedir. Krediler platform içi hizmetlerde kullanılır.",

      "index.corporate.salesText2":
        "Dijital hizmetlerin anında ifa edilmesi nedeniyle, kullanım durumuna göre cayma hakkı sınırlandırılabilir.",

         "index.corporate.salesLinkTitle":
        "Mesafeli Satış Sözleşmesi",

      "index.corporate.salesLinkLabel":
        "Mesafeli Satış Sözleşmesi sayfasını aç",

      /* =========================
         INDEX / FOOTER
         ========================= */

      "index.footer.sectionLabel":
        "AIVO alt bilgi alanı",

      "index.footer.tagline":
        "Türkçe odaklı AI müzik üretiminde yeni bir standart.",

      "index.footer.appStoreLabel":
        "AIVO’yu App Store’dan indir",

      "index.footer.appStoreAlt":
        "App Store’dan indirin",

      "index.footer.googlePlayLabel":
        "AIVO’yu Google Play’den indir",

      "index.footer.googlePlayAlt":
        "Google Play’den alın",

      "index.footer.googlePlayBadgeSrc":
        "https://play.google.com/intl/en_us/badges/static/images/badges/tr_badge_web_generic.png",

      "index.footer.webAppLabel":
        "AIVO Web uygulamasını aç",

      "index.footer.webOpen":
        "Web’de aç",

      "index.footer.quickLinks":
        "Hızlı Linkler",

      "index.footer.home":
        "Ana Sayfa",

      "index.footer.dashboard":
        "Dashboard",

      "index.footer.company":
        "Kurumsal",

      "index.footer.about":
        "Hakkımızda",

      "index.footer.features":
        "Özellikler",

      "index.footer.privacy":
        "Gizlilik Politikası",

      "index.footer.distanceSales":
        "Mesafeli Satış Sözleşmesi",

      "index.footer.contact":
        "İletişim",

      "index.footer.securePayment":
        "Güvenli ödeme",

      "index.footer.etbisRegistered":
        "T.C. Ticaret Bakanlığı’na Kayıtlıdır",

      "index.footer.emailTitle":
        "E-posta gönder",

      "index.footer.whatsappTitle":
        "WhatsApp Destek Hattı",

      "index.footer.whatsappText":
        "WhatsApp Destek Hattı: +90 533 610 89 00",

      "index.footer.locationTitle":
        "Konum",

      "index.footer.address":
        "Turhan Güneş Bulvarı No: 59/2, Ankara / Türkiye",

      "index.footer.contactPageTitle":
        "İletişim sayfasına git",

      "index.footer.form":
        "Form",

      "index.footer.contactHint":
        "Sorularınız için e-posta, WhatsApp destek hattı veya iletişim formunu kullanabilirsiniz.",

      "index.footer.rights":
        "© 2025 AIVO. Tüm hakları saklıdır.",

      "index.footer.statusLabel":
        "Durum:",

      "index.footer.statusActive":
        "Aktif",

      /* =========================
         COOKIE BANNER
         ========================= */

      "cookie.title": "Çerez Tercihleri",

      "cookie.message":
        "Deneyiminizi geliştirmek, hizmeti güvenli tutmak ve performansı ölçmek için çerezler kullanıyoruz. Tercihlerinizi dilediğiniz zaman değiştirebilirsiniz.",

      "cookie.policy": "Çerez Politikası",
      "cookie.customize": "Özelleştir",
      "cookie.deny": "Reddet",
      "cookie.acceptAll": "Tümünü Kabul Et",

      "cookie.modalTitle": "Çerez Tercihleri",

      "cookie.modalSubtitle":
        "Hangi çerezlere izin vereceğini seçebilirsin. Zorunlu çerezler kapatılamaz.",

      "cookie.necessary": "Zorunlu",
      "cookie.necessaryDesc":
        "Sitenin çalışması ve güvenlik için gereklidir.",
      "cookie.necessaryLabel": "Zorunlu çerezler",

      "cookie.analytics": "Analitik",
      "cookie.analyticsDesc":
        "Performans ve kullanım istatistikleri (anonim/toplulaştırılmış).",
      "cookie.analyticsLabel": "Analitik çerezler",

      "cookie.marketing": "Pazarlama",
      "cookie.marketingDesc":
        "Kampanya ve yeniden hedefleme (varsa).",
      "cookie.marketingLabel": "Pazarlama çerezleri",

      "cookie.save": "Kaydet",
      "cookie.cancel": "Vazgeç",
      "cookie.closeLabel": "Çerez penceresini kapat",

      /* =========================
         AUTH MODAL
         ========================= */

      "auth.access": "AIVO Studio Erişimi",

      "auth.loginTitle": "Tekrar hoş geldin 👋",
      "auth.loginDescription":
        "AIVO Studio’ya erişmek için giriş yap veya ücretsiz hesap oluştur.",

      "auth.registerTitle": "E-posta ile Kayıt",
      "auth.registerDescription":
        "AIVO Studio’ya erişmek için ücretsiz hesabını oluştur.",

      "auth.googleLogin": "Google ile Giriş Yap",
      "auth.appleLogin": "Apple ile Giriş Yap",
      "auth.orEmail": "veya e-posta ile devam et",

      "auth.loginCardTitle": "E-posta ile Giriş",
      "auth.loginCardDescription":
        "Hesabına e-posta adresinle giriş yap.",

      "auth.registerCardTitle": "Ücretsiz hesap oluştur",
      "auth.registerCardDescription":
        "AIVO Studio’ya erişmek için ücretsiz hesabını oluştur.",

      "auth.email": "E-posta",
      "auth.emailPlaceholder": "ornek@email.com",

      "auth.password": "Şifre",
      "auth.passwordPlaceholder": "Şifreniz",

      "auth.firstName": "Ad",
      "auth.firstNamePlaceholder": "Adınız",

      "auth.lastName": "Soyad",
      "auth.lastNamePlaceholder": "Soyadınız",

      "auth.repeatPassword": "Şifre Tekrar",
      "auth.repeatPasswordPlaceholder": "Şifrenizi tekrar girin",

      "auth.acceptTerms":
        "Kullanım Şartları ve Gizlilik Politikası’nı kabul ediyorum",

      "auth.rememberMe": "Beni hatırla",
      "auth.forgotPassword": "Şifreni mi unuttun?",

      "auth.loginButton": "Giriş Yap",
      "auth.registerButton": "Hesap Oluştur",

      "auth.newUser": "AIVO’da yeni misin?",
      "auth.haveAccount": "Zaten hesabın var mı?",

      "auth.createFreeAccount": "Ücretsiz hesap oluştur →",
      "auth.loginLink": "Giriş yap →",

      "auth.showPassword": "Şifreyi göster",
      "auth.showRepeatPassword": "Şifre tekrar alanını göster",
      "auth.closeLabel": "Giriş penceresini kapat",

      "auth.processing.login": "Giriş yapılıyor...",
      "auth.processing.register": "Hesap oluşturuluyor...",
      "auth.processing.sending": "Gönderiliyor...",

      "auth.error.validEmail": "Lütfen geçerli bir e-posta gir.",
      "auth.error.firstName": "Lütfen ad gir.",
      "auth.error.lastName": "Lütfen soyad gir.",
      "auth.error.passwordLength": "Şifre en az 6 karakter olmalı.",
      "auth.error.passwordMismatch": "Şifreler uyuşmuyor.",
      "auth.error.acceptTerms":
        "KVKK ve kullanım şartlarını kabul etmelisin.",
      "auth.error.emailPassword": "E-posta ve şifre gir.",
      "auth.error.invalidCredentials":
        "E-posta adresin ya da şifren hatalı.",
      "auth.error.emailNotVerified":
        "E-posta adresini doğrulamadan giriş yapamazsın.",
      "auth.error.userNotFound":
        "Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.",
      "auth.error.registerFailed": "Kayıt başarısız.",
      "auth.error.connection": "Bağlantı hatası. Tekrar dene.",

      "auth.success.register":
        "Kayıt başarılı! Şimdi giriş yapabilirsin.",
      "auth.success.login": "Girişiniz başarılı",

      /* =========================
         TOAST
         ========================= */

      "toast.title.success": "Başarılı",
      "toast.title.error": "Hata",
      "toast.title.warning": "Uyarı",
      "toast.title.info": "Bilgi",
      "toast.title.loading": "İşleniyor",

      "toast.languageChanged": "Dil güncellendi.",
      "toast.connectionError": "Bağlantı hatası. Tekrar dene."
    },

    en: {
      /* =========================
         SEO
         ========================= */

      "seo.title": "AIVO – AI Music, Video & Image Studio",
      "seo.description":
        "Create AI-powered music, videos, cover art, photos and cartoons with AIVO Studio.",

      /* =========================
         COMMON
         ========================= */

      "common.appName": "AIVO Studio",
      "common.loading": "Loading...",
      "common.save": "Save",
      "common.cancel": "Cancel",
      "common.close": "Close",
      "common.back": "Back",
      "common.continue": "Continue",
      "common.email": "Email",
      "common.password": "Password",
      "common.account": "Account",
      "common.credit": "Credit",
      "common.credits": "Credits",
      "common.buyCredit": "Buy Credits",
      "common.openMenu": "Open menu",
      "common.closeMenu": "Close menu",

      /* =========================
         LANGUAGE
         ========================= */

      "language.label": "Language",
      "language.menuLabel": "Language selection",
      "language.tr": "Türkçe",
      "language.en": "English",
      "language.changed": "Language updated to English.",

      /* =========================
         TOPBAR
         ========================= */

      "topbar.navLabel": "Main navigation",

      "topbar.products": "Products",
      "topbar.productsMenuLabel": "Products menu",

      "topbar.product.musicTitle": "Create AI Music",
      "topbar.product.musicSub": "Fast, prompt-based music creation",

      "topbar.product.coverTitle": "Create AI Cover Art",
      "topbar.product.coverSub":
        "Cover art, posters and visual content",

      "topbar.product.atmoTitle": "AI Atmosphere Video",
      "topbar.product.atmoSub": "Loop scenes and atmosphere",

      "topbar.product.cartoonTitle": "AI Kids Cartoon",
      "topbar.product.cartoonSub":
        "Create scenes with preset characters",

      "topbar.product.photofxTitle": "AI Photo Effect Video Clip",
      "topbar.product.photofxSub":
        "Turn one photo into an animated effects clip",

      "topbar.product.videoTitle": "Create AI Image-to-Video",
      "topbar.product.videoSub": "Social-media-ready video output",

      "topbar.corporate": "Company",
      "topbar.corporateMenuLabel": "Company menu",

      "topbar.corporate.aboutTitle": "About Us",
      "topbar.corporate.aboutSub": "The AIVO story",

      "topbar.corporate.featuresTitle": "Features",
      "topbar.corporate.featuresSub": "What we offer",

      "topbar.corporate.privacyTitle": "Privacy Policy",
      "topbar.corporate.privacySub": "KVKK / GDPR",

      "topbar.corporate.distanceSalesTitle": "Distance Sales",
      "topbar.corporate.distanceSalesSub": "Contract terms",

      "topbar.corporate.safeUseTitle": "Safe Use",
      "topbar.corporate.safeUseSub":
        "Content rules and usage limits",

      "topbar.corporate.contactTitle": "Contact",
      "topbar.corporate.contactSub": "info@aivo.tr",

      "topbar.education": "Tutorials",
      "topbar.coin": "AIVO COIN",
      "topbar.pricing": "Pricing",

      "topbar.login": "Sign In",
      "topbar.register": "Create Account",

      "topbar.creditBalanceTitle": "Credit balance",
      "topbar.creditValue": "Credits {count}",
      "topbar.buyCredit": "Buy Credits",

      "topbar.account": "Account",
      "topbar.profile": "Profile",
      "topbar.invoices": "My Invoices",
      "topbar.settings": "Settings",
      "topbar.logout": "Sign Out",

      /* =========================
         INDEX / HERO
         ========================= */

      "index.heroBadge":
        "AIVO Studio • The new standard for AI content creation",

      "index.heroBrand": "AIVO Studio",
      "index.heroLine": "Turn inspiration into creation.",

      "index.heroSwap.music": "Music",
      "index.heroSwap.video": "Video",
       "index.heroSwap.visual": "Visuals",

"index.heroSwap.musicSub":
  "Describe your style and let AIVO create studio-quality music.",

"index.heroSwap.videoSub":
  "Write your scene idea and let AIVO assemble the video automatically.",

"index.heroSwap.visualSub":
  "Enter a prompt and let AIVO create cover art and visuals in seconds.",
      "index.heroSwap.cover": "Cover Art",
      "index.heroSwap.atmosphere": "Atmosphere",
      "index.heroSwap.cartoon": "Cartoons",

      "index.heroSubtitle":
        "A multi-tool AI content creation platform that brings music, video and visual generation together in one place.",

      "index.enterStudio": "Enter Studio",
      "index.googlePlay": "▶ Google Play",
      "index.appStore": " App Store",

      "index.benefit.quality": "Built for professional-quality results",
      "index.benefit.rights": "You retain usage rights to your content",
      "index.benefit.download": "Download and share instantly",

      "index.demo.videoTitle": "Image-to-Video Clip",
      "index.demo.videoSub":
        "Turn your image into an animated video scene",

      "index.demo.youtube": "🎬 Watch All Tutorials on YouTube",
      "index.demo.soundOpen": "🔊 Turn On Sound",
      "index.demo.soundOn": "🔊 Sound On",
      "index.demo.soundOff": "🔇 Turn On Sound",

      /* =========================
         INDEX / ATMOSPHERE
         ========================= */

      "index.atmo.sectionLabel": "AI Atmosphere Video",
      "index.atmo.title": "AI Atmosphere Video",

      "index.atmo.subtitleHtml":
        "<strong>Loopable</strong> atmosphere videos for creators without a full music video. Add snow, rain, flickering lights and cinematic motion.",

      "index.atmo.topStrong": "A music video alternative.",
      "index.atmo.topText":
        "Perfect 5, 10 or 15-second loops • Ready for YouTube and Spotify backgrounds",

      "index.atmo.warm": "🔥 WARM",
      "index.atmo.rain": "🌧️ RAIN",
      "index.atmo.snow": "❄️ SNOW",
      "index.atmo.leaf": "🍂 LEAVES",
      "index.atmo.light": "✨ LIGHT",
      "index.atmo.wind": "🌬️ WIND",
      "index.atmo.fog": "🌫️ FOG",

      "index.atmo.create": "Create Atmosphere Video →",
      "index.atmo.cardTitle": "Create an Atmosphere Video",

      "index.atmo.description":
        "Create atmosphere videos that make your song, teaser or brand look more polished, cinematic and professional without filming a full music video. AIVO creates premium visual showcases with strong scene depth and a finished-project feel.",

      "index.atmo.bullet1":
        "🎬 Fill the gap with a premium visual when you do not have a full music video",

      "index.atmo.bullet2":
        "✨ Build a richer, deeper and more engaging atmosphere within a single scene",

      "index.atmo.bullet3":
        "🎵 Get a ready-made visual for song releases, teasers, lyric videos and digital showcases",

       "index.atmo.bottomStrong": "A polished look, without the wait.",
      "index.atmo.bottomText":
        "Create your first atmosphere video in minutes.",

      /* =========================
         INDEX / CHILD CARTOON
         ========================= */

      "index.cartoon.sectionLabel": "AI Kids Cartoon",
      "index.cartoon.title": "AI Kids Cartoon",

      "index.cartoon.slogan":
        "Create your character, build your story and produce your cartoon.",

      "index.cartoon.barLead":
        "From characters to scenes,",

      "index.cartoon.barStrong":
        "from scenes to cartoons.",

      "index.cartoon.badgeCharacter":
        "Create Character",

      "index.cartoon.badgeScene":
        "Single Scene",

      "index.cartoon.badgeStory":
        "Story Mode",

      "index.cartoon.badgeDuration":
        "3–6 Minute Flow",

      "index.cartoon.cardTitle":
        "Build a scene-by-scene cartoon flow with consistent characters.",

      "index.cartoon.description":
        "Create short scenes with preset or custom characters, turn your story into a sequence and build a cartoon up to 3–6 minutes while preserving character consistency.",

      "index.cartoon.feature1":
        "Create a character or start with a preset character",

      "index.cartoon.feature2":
        "Build a single scene or a multi-scene story flow",

      "index.cartoon.feature3":
        "Produce a consistent cartoon with the same characters",

      "index.cartoon.cta":
        "Create Your Cartoon →",

      "index.cartoon.shot1Alt":
        "Nova approaches",

      "index.cartoon.shot1Label":
        "Approaches",

      "index.cartoon.shot2Alt":
        "Nova finds the orb",

      "index.cartoon.shot2Label":
        "Finds the orb",

      "index.cartoon.shot3Alt":
        "Nova releases her power",

      "index.cartoon.shot3Label":
        "Releases her power",

         "index.cartoon.bottomStrong":
        "One production pipeline from character to story flow.",

      "index.cartoon.bottomText":
        "Start your first cartoon sequence in minutes.",

      /* =========================
         INDEX / PHOTO EFFECT CLIP
         ========================= */

      "index.photofx.sectionLabel":
        "AI Photo Effect Clip",

      "index.photofx.title":
        "AI Photo Effect Clip",

      "index.photofx.subtitle":
        "Take a single photo, enhance it with effects and turn it into a short video clip. Make your social content more dynamic, premium and eye-catching.",

      "index.photofx.barStrong":
        "Motion from a single frame.",

      "index.photofx.barText":
        "Create fast photo effect clips for Reels, Shorts and teaser posts",

      "index.photofx.original":
        "Original",

      "index.photofx.glow":
        "Glow",

      "index.photofx.shake":
        "Shake",

      "index.photofx.cardTitle":
        "Create an AI Photo Effect Clip",

      "index.photofx.description":
        "Turn a single photo into a premium-looking short video clip. Create a more dynamic and eye-catching visual for teasers, announcements and social media posts.",

      "index.photofx.bullet1":
        "🎬 Create a short, dynamic and shareable effect clip from one photo",

      "index.photofx.bullet2":
        "✨ Enhance your image with glow, shake, flash and style layers",

      "index.photofx.bullet3":
        "🗣️ Make a single photo speak and turn it into an engaging, shareable video",

      "index.photofx.bullet4":
        "📱 Get a ready-to-share visual for Reels, Shorts, teasers and announcements",

      "index.photofx.bullet5":
        "💬 Use a prompt to make your photo speak and turn one frame into a scene",

      "index.photofx.cta":
        "Create Photo Effect Clip →",

         "index.photofx.bottomStrong":
        "Powerful impact from a single frame.",

      "index.photofx.bottomText":
        "Create your first effect clip in minutes.",

      /* =========================
         INDEX / LIP SYNC VIDEO
         ========================= */

      "index.lipsync.sectionLabel":
        "AI Lip-Sync Video",

      "index.lipsync.title":
        "AI Lip-Sync Video",

      "index.lipsync.subtitle":
        "Upload a photo, enter text or add an audio file. Make your character speak and create a ready-to-share video for social media and promotions.",

      "index.lipsync.barStrong":
        "A talking video from a photo.",

      "index.lipsync.barText":
        "Create lip-sync videos using text or an audio file",

      "index.lipsync.soundOff":
        "🔇 Turn On Sound",

      "index.lipsync.soundOn":
        "🔊 Sound On",

      "index.lipsync.badgePhoto":
        "🗣️ Talking Photo",

      "index.lipsync.badgeVoice":
        "🎙️ Audio / Text",

      "index.lipsync.badgeSocial":
        "📱 Social Media",

      "index.lipsync.cta":
        "Create Lip-Sync Video →",

      "index.lipsync.cardTitle":
        "Create an AI Lip-Sync Video",

      "index.lipsync.description":
        "Make your photo speak and create a lip-sync video using text or audio. Get a polished result for promotions, social media, character presentations and fast content workflows.",

      "index.lipsync.bullet1":
        "🗣️ Turn your photo into a talking video",

      "index.lipsync.bullet2":
        "🎤 Let an AI vocalist perform your song, animate your visual and create a lip-sync video",

      "index.lipsync.bullet3":
        "📱 Get ready-to-share output for Reels, Shorts, promotions and social media",

      "index.lipsync.bullet4":
        "✨ Create an engaging video for your brand, character or content idea",

      "index.lipsync.bullet5":
        "⚡ Use a controlled production flow with clear credit and duration calculations",

          "index.lipsync.bottomStrong":
        "From a photo to a talking video.",

      "index.lipsync.bottomText":
        "Create your first lip-sync video in minutes.",

      /* =========================
         INDEX / MODULES
         ========================= */

      "index.modules.sectionLabel":
        "AI Creativity Platform",

      "index.modules.pill":
        "AI Creativity Platform",

      "index.modules.title":
        "Start Your Creative Journey",

      "index.modules.subtitle":
        "Explore the limitless world of AI-powered music, cover art and video creation. Turn your idea into content in seconds.",

      "index.modules.musicTitle":
        "Create Music",

      "index.modules.musicDescription":
        "Choose your style, enter a prompt, create and enrich it with variations.",

      "index.modules.musicFeature1":
        "Instant creation",

      "index.modules.musicFeature2":
        "Professional-quality results",

      "index.modules.musicFeature3":
        "Turkish-language focus",

      "index.modules.musicCta":
        "Create Music →",

      "index.modules.coverTitle":
        "Create Cover Art",

      "index.modules.coverDescription":
        "Create album covers, posters and visual content with one click.",

      "index.modules.coverFeature1":
        "High resolution",

      "index.modules.coverFeature2":
        "Style control",

      "index.modules.coverFeature3":
        "Built for commercial use",

      "index.modules.coverCta":
        "Create Cover Art →",

      "index.modules.videoTitle":
        "Create Video",

      "index.modules.videoDescription":
        "Create social-media-ready videos from text or images.",

      "index.modules.videoFeature1":
        "HD output",

      "index.modules.videoFeature2":
        "Fast rendering workflow",

      "index.modules.videoFeature3":
        "Easy sharing",

      "index.modules.videoCta":
        "Create Video →",

       "index.modules.ctaNote":
        "Start creating music, cover art and videos now",

      "index.modules.ctaButton":
        "Start Now – Completely Free ✨",

      /* =========================
         INDEX / CORPORATE SHOWCASE
         ========================= */

      "index.corporate.sectionLabel":
        "AIVO Studio Company Information",

      "index.corporate.eyebrow":
        "COMPANY",

      "index.corporate.title":
        "AIVO Studio",

      "index.corporate.lead":
        "A creative platform that makes AI-powered music, video and cover art production accessible to everyone.",

      "index.corporate.aboutTitle":
        "About Us",

      "index.corporate.aboutText1":
        "AIVO Studio brings music creation, audio recording, video production and cover design together in one AI-powered platform.",

      "index.corporate.aboutText2":
        "It provides a fast, flexible and scalable creation experience for both beginners and professionals.",

      "index.corporate.aboutLinkTitle":
        "About AIVO Studio",

      "index.corporate.aboutLinkLabel":
        "Open the About Us page",

      "index.corporate.featuresTitle":
        "Features",

      "index.corporate.featuresText":
        "Powerful and flexible creation tools developed for AI music, audio, video and cover art production.",

      "index.corporate.featuresMore":
        "View all features →",

      "index.corporate.featuresLinkTitle":
        "AIVO Studio Features",

      "index.corporate.featuresLinkLabel":
        "Open the Features page",

      "index.corporate.privacyTitle":
        "Privacy & Trust",

      "index.corporate.privacyFeature1":
        "KVKK / GDPR compliant",

      "index.corporate.privacyFeature2":
        "Credit card details are not stored",

      "index.corporate.privacyFeature3":
        "Your generated content belongs to you",

      "index.corporate.privacyFeature4":
        "256-bit SSL security",

      "index.corporate.lastUpdated":
        "Last updated: December 17, 2025",

      "index.corporate.privacyLinkTitle":
        "Privacy Policy and KVKK",

      "index.corporate.privacyLinkLabel":
        "Open the Privacy and KVKK page",

      "index.corporate.salesTitle":
        "Distance Sales",

      "index.corporate.salesText1":
        "All services offered through AIVO Studio are digital. Credits are used for services within the platform.",

      "index.corporate.salesText2":
        "Because digital services are delivered immediately, the right of withdrawal may be limited depending on usage.",

          "index.corporate.salesLinkTitle":
        "Distance Sales Agreement",

      "index.corporate.salesLinkLabel":
        "Open the Distance Sales Agreement page",

      /* =========================
         INDEX / FOOTER
         ========================= */

      "index.footer.sectionLabel":
        "AIVO website footer",

      "index.footer.tagline":
        "A new standard in AI-powered music creation.",

      "index.footer.appStoreLabel":
        "Download AIVO on the App Store",

      "index.footer.appStoreAlt":
        "Download on the App Store",

      "index.footer.googlePlayLabel":
        "Download AIVO on Google Play",

      "index.footer.googlePlayAlt":
        "Get it on Google Play",

      "index.footer.googlePlayBadgeSrc":
        "https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png",

      "index.footer.webAppLabel":
        "Open the AIVO Web App",

      "index.footer.webOpen":
        "Open in",

      "index.footer.quickLinks":
        "Quick Links",

      "index.footer.home":
        "Home",

      "index.footer.dashboard":
        "Dashboard",

      "index.footer.company":
        "Company",

      "index.footer.about":
        "About Us",

      "index.footer.features":
        "Features",

      "index.footer.privacy":
        "Privacy Policy",

      "index.footer.distanceSales":
        "Distance Sales Agreement",

      "index.footer.contact":
        "Contact",

      "index.footer.securePayment":
        "Secure payment",

      "index.footer.etbisRegistered":
        "Registered with the Republic of Türkiye Ministry of Trade",

      "index.footer.emailTitle":
        "Send an email",

      "index.footer.whatsappTitle":
        "WhatsApp Support Line",

      "index.footer.whatsappText":
        "WhatsApp Support Line: +90 533 610 89 00",

      "index.footer.locationTitle":
        "Location",

      "index.footer.address":
        "Turhan Güneş Boulevard No: 59/2, Ankara / Türkiye",

      "index.footer.contactPageTitle":
        "Open the Contact page",

      "index.footer.form":
        "Contact Form",

      "index.footer.contactHint":
        "Contact us by email, WhatsApp support or the contact form if you have any questions.",

      "index.footer.rights":
        "© 2025 AIVO. All rights reserved.",

      "index.footer.statusLabel":
        "Status:",

      "index.footer.statusActive":
        "Active",

      /* =========================
         COOKIE BANNER
         ========================= */

      "cookie.title": "Cookie Preferences",

      "cookie.message":
        "We use cookies to improve your experience, keep the service secure and measure performance. You can change your preferences at any time.",

      "cookie.policy": "Cookie Policy",
      "cookie.customize": "Customize",
      "cookie.deny": "Reject",
      "cookie.acceptAll": "Accept All",

      "cookie.modalTitle": "Cookie Preferences",

      "cookie.modalSubtitle":
        "Choose which cookies you allow. Required cookies cannot be disabled.",

      "cookie.necessary": "Required",
      "cookie.necessaryDesc":
        "Required for the website to function securely.",
      "cookie.necessaryLabel": "Required cookies",

      "cookie.analytics": "Analytics",
      "cookie.analyticsDesc":
        "Anonymous and aggregated performance and usage statistics.",
      "cookie.analyticsLabel": "Analytics cookies",

      "cookie.marketing": "Marketing",
      "cookie.marketingDesc":
        "Campaign and retargeting cookies, where applicable.",
      "cookie.marketingLabel": "Marketing cookies",

      "cookie.save": "Save",
      "cookie.cancel": "Cancel",
      "cookie.closeLabel": "Close cookie preferences",

      /* =========================
         AUTH MODAL
         ========================= */

      "auth.access": "AIVO Studio Access",

      "auth.loginTitle": "Welcome back 👋",
      "auth.loginDescription":
        "Sign in or create a free account to access AIVO Studio.",

      "auth.registerTitle": "Create an Account with Email",
      "auth.registerDescription":
        "Create your free account to access AIVO Studio.",

      "auth.googleLogin": "Continue with Google",
      "auth.appleLogin": "Continue with Apple",
      "auth.orEmail": "or continue with email",

      "auth.loginCardTitle": "Sign In with Email",
      "auth.loginCardDescription":
        "Sign in to your account using your email address.",

      "auth.registerCardTitle": "Create a Free Account",
      "auth.registerCardDescription":
        "Create your free account to access AIVO Studio.",

      "auth.email": "Email",
      "auth.emailPlaceholder": "name@example.com",

      "auth.password": "Password",
      "auth.passwordPlaceholder": "Your password",

      "auth.firstName": "First Name",
      "auth.firstNamePlaceholder": "Your first name",

      "auth.lastName": "Last Name",
      "auth.lastNamePlaceholder": "Your last name",

      "auth.repeatPassword": "Repeat Password",
      "auth.repeatPasswordPlaceholder": "Enter your password again",

      "auth.acceptTerms":
        "I accept the Terms of Use and Privacy Policy",

      "auth.rememberMe": "Remember me",
      "auth.forgotPassword": "Forgot your password?",

      "auth.loginButton": "Sign In",
      "auth.registerButton": "Create Account",

      "auth.newUser": "New to AIVO?",
      "auth.haveAccount": "Already have an account?",

      "auth.createFreeAccount": "Create a free account →",
      "auth.loginLink": "Sign in →",

      "auth.showPassword": "Show password",
      "auth.showRepeatPassword": "Show repeated password",
      "auth.closeLabel": "Close sign-in window",

      "auth.processing.login": "Signing in...",
      "auth.processing.register": "Creating account...",
      "auth.processing.sending": "Sending...",

      "auth.error.validEmail": "Enter a valid email address.",
      "auth.error.firstName": "Enter your first name.",
      "auth.error.lastName": "Enter your last name.",
      "auth.error.passwordLength":
        "Password must contain at least 6 characters.",
      "auth.error.passwordMismatch": "Passwords do not match.",
      "auth.error.acceptTerms":
        "You must accept the privacy notice and terms.",
      "auth.error.emailPassword": "Enter your email and password.",
      "auth.error.invalidCredentials":
        "Your email address or password is incorrect.",
      "auth.error.emailNotVerified":
        "Verify your email address before signing in.",
      "auth.error.userNotFound":
        "No account was found with this email address.",
      "auth.error.registerFailed": "Account registration failed.",
      "auth.error.connection":
        "Connection error. Please try again.",

      "auth.success.register":
        "Registration successful! You can now sign in.",
      "auth.success.login": "Signed in successfully",

      /* =========================
         TOAST
         ========================= */

      "toast.title.success": "Success",
      "toast.title.error": "Error",
      "toast.title.warning": "Warning",
      "toast.title.info": "Information",
      "toast.title.loading": "Processing",

      "toast.languageChanged": "Language updated.",
      "toast.connectionError":
        "Connection error. Please try again."
    }
  };

  /* =========================================================
     HELPERS
     ========================================================= */

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function normalizeLang(lang) {
    var value = String(lang || "").trim().toLowerCase();

    if (value.indexOf("tr") === 0) return "tr";
    if (value.indexOf("en") === 0) return "en";

    return "";
  }

  function normalizeCountry(country) {
    return String(country || "").trim().toUpperCase();
  }

  function safeStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }

  function getBrowserLanguage() {
    try {
      var browserLang =
        navigator.language ||
        navigator.userLanguage ||
        "";

      browserLang = String(browserLang).toLowerCase();

      if (browserLang.indexOf("tr") === 0) {
        return "tr";
      }
    } catch (_) {}

    return "en";
  }

  function readManualPreference() {
    var primary = normalizeLang(
      safeStorageGet(STORAGE_KEY)
    );

    if (primary) {
      return {
        lang: primary,
        source: "manual"
      };
    }

    var legacy = normalizeLang(
      safeStorageGet(LEGACY_STORAGE_KEY)
    );

    if (legacy) {
      safeStorageSet(STORAGE_KEY, legacy);

      return {
        lang: legacy,
        source: "legacy"
      };
    }

    return null;
  }

  function hasManualPreference() {
    return !!normalizeLang(
      safeStorageGet(STORAGE_KEY)
    );
  }

  function formatValue(value, params) {
    var text = String(
      value == null ? "" : value
    );

    if (!params || typeof params !== "object") {
      return text;
    }

    Object.keys(params).forEach(function (key) {
      var safeKey = String(key).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      text = text.replace(
        new RegExp("\\{" + safeKey + "\\}", "g"),
        String(params[key])
      );
    });

    return text;
  }

  function translate(key, params) {
    var lang =
      normalizeLang(window.AIVO_LANG) ||
      DEFAULT_LANG;

    var pack = DICTIONARY[lang] || {};
    var trPack = DICTIONARY.tr || {};
    var enPack = DICTIONARY.en || {};

    var value;

    if (hasOwn(pack, key)) {
      value = pack[key];
    } else if (hasOwn(trPack, key)) {
      value = trPack[key];
    } else if (hasOwn(enPack, key)) {
      value = enPack[key];
    } else {
      value = key;
    }

    return formatValue(value, params);
  }

  function collectTargets(root, selector) {
    var targets = [];

    if (
      root &&
      root.nodeType === 1 &&
      typeof root.matches === "function" &&
      root.matches(selector)
    ) {
      targets.push(root);
    }

    var scope =
      root &&
      typeof root.querySelectorAll === "function"
        ? root
        : document;

    Array.prototype.forEach.call(
      scope.querySelectorAll(selector),
      function (element) {
        targets.push(element);
      }
    );

    return targets;
  }

  /* =========================================================
     SEO / META
     ========================================================= */

  function setMetaContent(selector, value) {
    var element = document.querySelector(selector);

    if (element) {
      element.setAttribute("content", value);
    }
  }

  function applyDocumentMeta() {
    document.title = translate("seo.title");

    setMetaContent(
      'meta[name="description"]',
      translate("seo.description")
    );

    setMetaContent(
      'meta[property="og:title"]',
      translate("seo.title")
    );

    setMetaContent(
      'meta[property="og:description"]',
      translate("seo.description")
    );

    setMetaContent(
      'meta[name="twitter:title"]',
      translate("seo.title")
    );

    setMetaContent(
      'meta[name="twitter:description"]',
      translate("seo.description")
    );
  }

  /* =========================================================
     LANGUAGE CONTROL SYNC
     ========================================================= */

  function syncLanguageControls(root) {
    var lang =
      normalizeLang(window.AIVO_LANG) ||
      DEFAULT_LANG;

    collectTargets(
      root,
      "[data-aivo-language]"
    ).forEach(function (element) {
      var buttonLang = normalizeLang(
        element.getAttribute("data-aivo-language")
      );

      var isActive = buttonLang === lang;

      element.classList.toggle(
        "is-active",
        isActive
      );

      element.setAttribute(
        "aria-pressed",
        isActive ? "true" : "false"
      );

      if (buttonLang) {
        element.setAttribute("lang", buttonLang);
      }
    });

    collectTargets(
      root,
      "[data-aivo-language-select]"
    ).forEach(function (element) {
      if (element.value !== lang) {
        element.value = lang;
      }
    });
  }

  /* =========================================================
     APPLY TRANSLATIONS
     ========================================================= */

  function applyI18n(root) {
    collectTargets(root, "[data-i18n]").forEach(
      function (element) {
        var key = element.getAttribute("data-i18n");

        if (!key) return;

        element.textContent = translate(key);
      }
    );

    collectTargets(
      root,
      "[data-i18n-html]"
    ).forEach(function (element) {
      var key = element.getAttribute(
        "data-i18n-html"
      );

      if (!key) return;

      element.innerHTML = translate(key);
    });

    collectTargets(
      root,
      "[data-i18n-placeholder]"
    ).forEach(function (element) {
      var key = element.getAttribute(
        "data-i18n-placeholder"
      );

      if (!key) return;

      element.setAttribute(
        "placeholder",
        translate(key)
      );
    });

    collectTargets(
      root,
      "[data-i18n-label]"
    ).forEach(function (element) {
      var key = element.getAttribute(
        "data-i18n-label"
      );

      if (!key) return;

      element.setAttribute(
        "aria-label",
        translate(key)
      );
    });

    collectTargets(
      root,
      "[data-i18n-title]"
    ).forEach(function (element) {
      var key = element.getAttribute(
        "data-i18n-title"
      );

      if (!key) return;

      element.setAttribute(
        "title",
        translate(key)
      );
    });

    collectTargets(
      root,
      "[data-i18n-alt]"
    ).forEach(function (element) {
      var key = element.getAttribute(
        "data-i18n-alt"
      );

      if (!key) return;

      element.setAttribute(
        "alt",
        translate(key)
      );
    });

    collectTargets(
      root,
      "[data-i18n-attr]"
    ).forEach(function (element) {
      var raw = element.getAttribute(
        "data-i18n-attr"
      );

      if (!raw) return;

      raw.split(";").forEach(function (pair) {
        var parts = pair.split(":");

        var attribute = String(
          parts[0] || ""
        ).trim();

        var key = String(
          parts.slice(1).join(":") || ""
        ).trim();

        if (!attribute || !key) return;

        element.setAttribute(
          attribute,
          translate(key)
        );
      });
    });

    applyDocumentMeta();
    syncLanguageControls(root);
  }

  /* =========================================================
     SET LANGUAGE
     ========================================================= */

  function applyLanguageState(lang, source) {
    var nextLang =
      normalizeLang(lang) ||
      DEFAULT_LANG;

    window.AIVO_LANG = nextLang;
    window.AIVO_LANGUAGE_SOURCE =
      source || "unknown";

    document.documentElement.setAttribute(
      "lang",
      nextLang
    );

    document.documentElement.setAttribute(
      "data-aivo-language",
      nextLang
    );

    document.documentElement.setAttribute(
      "dir",
      "ltr"
    );

    applyI18n();

    return nextLang;
  }

  function setSavedLanguage(lang) {
    var nextLang = normalizeLang(lang);

    if (!nextLang) {
      return window.AIVO_LANG || DEFAULT_LANG;
    }

    safeStorageSet(STORAGE_KEY, nextLang);

    applyLanguageState(nextLang, "manual");

    try {
      document.dispatchEvent(
        new CustomEvent(
          "aivo:language-change",
          {
            detail: {
              lang: nextLang,
              source: "manual"
            }
          }
        )
      );
    } catch (_) {}

    return nextLang;
  }

  /* =========================================================
     COUNTRY DETECTION
     ========================================================= */

  function parseCloudflareTrace(text) {
    var result = {};

    String(text || "")
      .split(/\r?\n/)
      .forEach(function (line) {
        var index = line.indexOf("=");

        if (index <= 0) return;

        var key = line
          .slice(0, index)
          .trim();

        var value = line
          .slice(index + 1)
          .trim();

        if (key) result[key] = value;
      });

    return result;
  }

  async function detectCountryCode() {
    try {
      var injectedCountry = normalizeCountry(
        window.__AIVO_COUNTRY__
      );

      if (injectedCountry) {
        return injectedCountry;
      }
    } catch (_) {}

    var controller =
      typeof AbortController !== "undefined"
        ? new AbortController()
        : null;

    var timeoutId = null;

    if (controller) {
      timeoutId = setTimeout(function () {
        try {
          controller.abort();
        } catch (_) {}
      }, 1600);
    }

    try {
      var response = await fetch(
        "/cdn-cgi/trace?ts=" + Date.now(),
        {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          signal: controller
            ? controller.signal
            : undefined
        }
      );

      if (!response.ok) {
        return "";
      }

      var text = await response.text();
      var trace = parseCloudflareTrace(text);

      return normalizeCountry(trace.loc);
    } catch (_) {
      return "";
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  async function resolveAutomaticLanguage() {
    var country = await detectCountryCode();

    if (country === "TR") {
      return {
        lang: "tr",
        source: "country",
        country: country
      };
    }

    if (country) {
      return {
        lang: "en",
        source: "country",
        country: country
      };
    }

    return {
      lang: getBrowserLanguage(),
      source: "browser",
      country: ""
    };
  }

  /* =========================================================
     EVENTS
     ========================================================= */

  function bindLanguageControls() {
    document.addEventListener(
      "click",
      function (event) {
        var target =
          event.target &&
          event.target.closest
            ? event.target.closest(
                "[data-aivo-language]"
              )
            : null;

        if (!target) return;

        var lang = normalizeLang(
          target.getAttribute(
            "data-aivo-language"
          )
        );

        if (!lang) return;

        if (
          target.tagName === "A" ||
          target.getAttribute("href") === "#"
        ) {
          event.preventDefault();
        }

        setSavedLanguage(lang);
      },
      true
    );

    document.addEventListener(
      "change",
      function (event) {
        var target = event.target;

        if (
          !target ||
          !target.matches ||
          !target.matches(
            "[data-aivo-language-select]"
          )
        ) {
          return;
        }

        setSavedLanguage(target.value);
      }
    );

    document.addEventListener(
      "aivo:topbar:ready",
      function () {
        var topbar =
          document.getElementById("top") ||
          document.querySelector(
            ".aivo-topbar"
          );

        applyI18n(topbar || document);
      }
    );
  }

  /* =========================================================
     BOOT
     ========================================================= */

  var savedPreference =
    readManualPreference();

  var initialLanguage = savedPreference
    ? savedPreference.lang
    : getBrowserLanguage();

  var initialSource = savedPreference
    ? savedPreference.source
    : "browser-pending-country";

  window.AIVO_I18N = DICTIONARY;
  window.AIVO_LANG = initialLanguage;
  window.AIVO_LANGUAGE_SOURCE =
    initialSource;

  window.t = translate;
  window.aivoSetLanguage =
    setSavedLanguage;
  window.aivoApplyI18n = applyI18n;

  document.documentElement.setAttribute(
    "lang",
    initialLanguage
  );

  document.documentElement.setAttribute(
    "data-aivo-language",
    initialLanguage
  );

  bindLanguageControls();

  function boot() {
    applyLanguageState(
      initialLanguage,
      initialSource
    );

    if (savedPreference) {
      return;
    }

    resolveAutomaticLanguage().then(
      function (result) {
        /*
          Ülke sorgusu devam ederken kullanıcı
          manuel dil seçmiş olabilir.

          Böyle bir durumda otomatik sonuç,
          manuel seçimi değiştiremez.
        */
        if (hasManualPreference()) {
          return;
        }

        applyLanguageState(
          result.lang,
          result.source
        );

        try {
          document.dispatchEvent(
            new CustomEvent(
              "aivo:language-change",
              {
                detail: {
                  lang: result.lang,
                  source: result.source,
                  country:
                    result.country || ""
                }
              }
            )
          );
        } catch (_) {}
      }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      boot,
      { once: true }
    );
  } else {
    boot();
  }
})();
