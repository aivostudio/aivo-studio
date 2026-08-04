(() => {
  "use strict";

  const ROOT_SELECTOR = '[data-module-root][data-module="adfilm"]';
  const COMPACT_STYLE_ID = 'aivo-radio-compact-style';

  function ensureCompactStyle() {
    if (document.getElementById(COMPACT_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = COMPACT_STYLE_ID;
    style.textContent = `
      .adfilm-radio-panel{gap:14px;font-size:14px}
      .adfilm-kind-switch{margin:18px 0;padding:12px;border-radius:20px}
      .adfilm-kind-switch>span{margin-bottom:8px;font-size:11px}
      .adfilm-kind-switch button{min-height:50px;border-radius:14px;font-size:15px}
      .adfilm-radio-hero{gap:14px;padding:18px 22px;border-radius:20px}
      .adfilm-radio-hero__icon{flex-basis:58px;height:58px;border-radius:17px;font-size:27px}
      .adfilm-radio-hero h2{font-size:28px}
      .adfilm-radio-hero p{font-size:14px}
      .adfilm-radio-card{padding:18px;border-radius:20px}
      .adfilm-radio-card__head{gap:11px;margin-bottom:14px}
      .adfilm-radio-card__head>b{flex-basis:38px;height:38px;border-radius:12px;font-size:11px}
      .adfilm-radio-card__head h3{font-size:18px}
      .adfilm-radio-card__head p{font-size:13px}
      .adfilm-radio-gradient-title{min-height:58px;margin-bottom:14px;border-radius:14px;font-size:18px}
      .adfilm-radio-budget{padding:13px;border-radius:15px}
      .adfilm-radio-fields{gap:11px}
      .adfilm-radio-fields label{gap:6px}
      .adfilm-radio-fields label>span,.adfilm-radio-copy-action>span{font-size:12px}
      .adfilm-radio-fields input,.adfilm-radio-fields textarea,.adfilm-radio-fields select{padding:11px 13px;border-radius:12px;font-size:14px}
      .adfilm-radio-copy-action{padding:12px;border-radius:12px}
      .adfilm-radio-copy-action button{padding:8px 11px;font-size:11px}
      .adfilm-radio-choice{grid-template-columns:82px 1fr;gap:10px;margin-top:9px}
      .adfilm-radio-choice button,.adfilm-radio-three button,.adfilm-radio-durations button{min-height:42px;border-radius:12px;font-size:13px}
      .adfilm-radio-preview{margin-top:14px;padding:15px;border-radius:17px}
      .adfilm-radio-preview>strong{font-size:16px}
      .adfilm-radio-preview>span{font-size:13px}
      .adfilm-radio-preview>div{grid-template-columns:48px 1fr auto;margin-top:12px}
      .adfilm-radio-preview button{height:46px;border-radius:13px}
      .adfilm-radio-two-col{gap:13px}
      .adfilm-radio-two-col>section{padding:15px;border-radius:17px}
      .adfilm-radio-two-col h4{margin-bottom:10px;font-size:16px}
      .adfilm-radio-outputs>div{padding:12px;border-radius:13px}
      .adfilm-radio-jingle-limit{margin-top:11px;padding:10px 12px;border-radius:12px}
      .adfilm-radio-note{margin-top:13px;padding:11px 13px;border-radius:12px;font-size:11px}
      .adfilm-radio-timeline>section{min-height:46px;margin:8px 0;border-radius:12px}
      .adfilm-radio-final{grid-template-columns:48px 1fr auto auto;padding:13px;border-radius:15px}
      .adfilm-radio-final>button{min-height:42px;border-radius:11px;font-size:13px}
      .adfilm-radio-buildbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;border:1px solid rgba(139,103,205,.34);border-radius:18px;background:linear-gradient(145deg,rgba(27,24,52,.96),rgba(13,15,31,.98))}
      .adfilm-radio-buildbar>div{display:grid;gap:3px}
      .adfilm-radio-buildbar strong{font-size:16px}
      .adfilm-radio-buildbar span{color:#9f97aa;font-size:12px}
      .adfilm-radio-buildbar button{min-width:240px;min-height:48px;padding:0 22px;border:1px solid rgba(255,255,255,.28);border-radius:14px;background:linear-gradient(100deg,#7046f5,#ca4fd1,#ef5aa8);color:#fff;font:inherit;font-size:15px;font-weight:900;cursor:pointer;box-shadow:0 12px 28px rgba(126,64,223,.26)}
      .adfilm-radio-buildbar button:hover{transform:translateY(-1px)}
      @media(max-width:900px){.adfilm-radio-buildbar{align-items:stretch;flex-direction:column}.adfilm-radio-buildbar button{width:100%;min-width:0}}
    `;
    document.head.appendChild(style);
  }

  function radioMarkup() {
    return `
      <section class="adfilm-radio-panel" data-adfilm-radio-panel hidden aria-labelledby="adfilmRadioTitle">
        <div class="adfilm-radio-hero">
          <div class="adfilm-radio-hero__icon" aria-hidden="true">🎙</div>
          <div>
            <span>AIVO Creative Engine · YENİ</span>
            <h2 id="adfilmRadioTitle">AI Radyo Reklamı Oluştur</h2>
            <p>Ürün bilgilerini, profesyonel seslendirmeyi, reklam müziğini ve marka jingle’ını tek akışta birleştir.</p>
          </div>
        </div>

        <article class="adfilm-radio-card">
          <div class="adfilm-radio-card__head"><b>01</b><div><h3>Ürün Bilgileri</h3><p>AIVO reklam metnini ve ses tasarımını bu brief üzerinden hazırlayacak.</p></div><em>Zorunlu</em></div>
          <div class="adfilm-radio-fields">
            <label><span>Ürün / Hizmet Adı</span><input type="text" maxlength="80" placeholder="Örn: AIVO Studio"></label>
            <label><span>Marka Adı</span><input type="text" maxlength="60" placeholder="Örn: AIVO"></label>
            <label class="is-wide"><span>Kısa Açıklama</span><textarea maxlength="520" rows="4" placeholder="Ürünün öne çıkan özelliklerini ve reklamda vurgulanmasını istediğin noktaları yaz..."></textarea></label>
            <label><span>Hedef Kitle</span><input type="text" maxlength="120" placeholder="Örn: İçerik üreticileri ve küçük işletmeler"></label>
            <label><span>Kampanya / Çağrı</span><input type="text" maxlength="120" placeholder="Örn: Şimdi keşfet"></label>
          </div>
        </article>

        <article class="adfilm-radio-card">
          <div class="adfilm-radio-card__head"><b>02</b><div><h3>Ses & Anlatım</h3><p>AIVO briefi kullanarak reklam metnini hazırlar; sen düzenler ve onaylarsın.</p></div></div>
          <div class="adfilm-radio-gradient-title">Reklam Seslendirme Metni</div>
          <div class="adfilm-radio-budget"><div><small>Ses süresi bütçesi</small><strong data-radio-word-range>33–46 kelime önerilir</strong></div><span data-radio-duration-badge>30 sn</span><i><u data-radio-budget-fill></u></i><p><span data-radio-budget-message>Jingle ve müzik girişi toplam süreye dahildir.</span><b><span data-radio-word-count>0</span> kelime · tahmini <span data-radio-estimate>0</span> sn</b></p></div>
          <div class="adfilm-radio-fields">
            <label><span>Dil</span><select><option>Türkçe</option><option>English</option><option>Deutsch</option><option>Français</option><option>Español</option></select></label>
            <label><span>Ses Stili</span><select><option>Sıcak ve güven veren</option><option>Enerjik reklam sesi</option><option>Premium ve sakin</option><option>Doğal konuşma</option></select></label>
            <label><span>Ses</span><select><option>Sıcak kadın sesi</option><option>Profesyonel erkek sesi</option><option>Enerjik erkek sesi</option><option>Net kadın sesi</option></select></label>
            <div class="adfilm-radio-copy-action"><span>Metin üretimi</span><strong>Brief tamamlandığında AIVO metni otomatik hazırlar.</strong><button type="button" data-radio-prepare-copy>AIVO Metnini Hazırla</button></div>
            <label class="is-wide"><span>Reklam Seslendirme Metni</span><textarea rows="7" maxlength="1200" data-radio-copy placeholder="Ürün bilgilerini tamamladığında AIVO reklam metnini burada hazırlayacak."></textarea></label>
          </div>
          <div class="adfilm-radio-choice"><span>Hız</span><div data-radio-choice="speed"><button type="button" data-value="slow">Yavaş</button><button type="button" data-value="balanced">Dengeli</button><button type="button" class="is-active" data-value="fast">Hızlı</button></div></div>
          <div class="adfilm-radio-choice"><span>Ses Akışı</span><div data-radio-choice="flow"><button type="button" class="is-active" data-value="natural">Doğal</button><button type="button" data-value="balanced">Dengeli</button><button type="button" data-value="emphatic">Vurgulu</button></div></div>
          <div class="adfilm-radio-preview"><strong>Ses Ön İzleme</strong><span>Metni onayladıktan sonra reklam sesini oluşturup burada dinleyeceksin.</span><div><button type="button" disabled>▶</button><i></i><small>0:00 / 0:00</small></div></div>
        </article>

        <article class="adfilm-radio-card">
          <div class="adfilm-radio-card__head"><b>03</b><div><h3>Ses Ayarları</h3><p>Müzik, konuşma ve jingle seçilen toplam reklam süresine yerleştirilir.</p></div></div>
          <div class="adfilm-radio-two-col">
            <section><h4>Reklam Süresi</h4><div class="adfilm-radio-durations" data-radio-choice="duration"><button type="button" data-value="15">15 sn</button><button type="button" class="is-active" data-value="30">30 sn</button><button type="button" data-value="45">45 sn</button><button type="button" data-value="60">60 sn</button></div><p>Stable Audio 3 Small Music motoru 120 saniyeye kadar üretimi destekler. AIVO standart radyo sürelerini kullanır.</p></section>
            <section><h4>Çıkış Dosyaları</h4><div class="adfilm-radio-outputs"><div><b>MP3</b><strong>320 kbps</strong><small>Yayın ve dijital kullanım</small></div><div><b>WAV</b><strong>Kayıpsız</strong><small>Stüdyo ve arşiv kalitesi</small></div></div><p>Final tamamlandığında iki format birlikte hazırlanır.</p></section>
          </div>
        </article>

        <article class="adfilm-radio-card">
          <div class="adfilm-radio-card__head"><b>04</b><div><h3>Reklam Müziği & Marka Jingle’ı</h3><p>Arka plan müziğini ve kapanıştaki marka ses imzasını yönet.</p></div><em>İsteğe bağlı</em></div>
          <div class="adfilm-radio-two-col">
            <section class="adfilm-radio-subcard"><h4>♫ Reklam Müziği</h4><div class="adfilm-radio-three" data-radio-choice="music"><button type="button" class="is-active" data-value="ai">AIVO müziği hazırlasın</button><button type="button" data-value="upload">Kendi müziğimi yükle</button><button type="button" data-value="off">Müzik olmasın</button></div><div class="adfilm-radio-fields"><label><span>Müzik Tarzı</span><select><option>AIVO otomatik seçsin</option><option>Sinematik</option><option>Kurumsal</option><option>Elektronik</option><option>Akustik</option></select></label><label><span>Enerji</span><select><option>Dengeli</option><option>Yumuşak</option><option>Güçlü</option><option>Yüksek</option></select></label></div></section>
            <section class="adfilm-radio-subcard"><h4>✦ Kapanış Jingle’ı</h4><div class="adfilm-radio-three" data-radio-choice="jingle"><button type="button" class="is-active" data-value="ai">AIVO sonic logo hazırlasın</button><button type="button" data-value="upload">Kendi jingle’ımı yükle</button><button type="button" data-value="off">Jingle olmasın</button></div><div class="adfilm-radio-fields"><label class="is-wide"><span>Kapanış Sözü / Slogan</span><input type="text" maxlength="120" placeholder="Örn: AIVO Studio — fikrini reklama dönüştür."></label><label><span>Sonic Logo Tarzı</span><select><option>Modern ve teknolojik</option><option>Sıcak ve samimi</option><option>Premium ve sinematik</option><option>Enerjik</option></select></label><label><span>Yerleşim</span><select><option>Reklam sonunda — önerilen</option><option>Reklam başında</option><option>Başta ve sonda</option></select></label></div><div class="adfilm-radio-jingle-limit"><span>Otomatik jingle süresi</span><strong data-radio-jingle-duration>6 sn</strong></div></section>
          </div>
          <div class="adfilm-radio-note">✦ Kullanıcıdan müzik veya jingle promptu istenmez. AIVO motor promptlarını brief ve seçilen stile göre arka planda hazırlar.</div>
        </article>

        <article class="adfilm-radio-card">
          <div class="adfilm-radio-card__head"><b>05</b><div><h3>Ses Zaman Akışı</h3><p>Konuşma, müzik ve jingle’ın toplam süreye yerleşimini gör.</p></div></div>
          <div class="adfilm-radio-timeline"><div><span>00:00</span><span data-radio-total>00:30</span></div><section data-radio-main><i class="intro" style="width:3.33%">Müzik</i><i class="voice" style="width:76.67%">Seslendirme</i><i class="jingle" style="width:20%">Jingle</i></section><small data-radio-timeline-text>1 sn müzik girişi · 23 sn seslendirme · 6 sn jingle</small></div>
        </article>

        <article class="adfilm-radio-card">
          <div class="adfilm-radio-card__head"><b>06</b><div><h3>Final Radyo Reklamı</h3><p>Seslendirme, müzik ve jingle birleştiğinde final reklamını burada dinle.</p></div></div>
          <div class="adfilm-radio-final"><button type="button" disabled>▶</button><div><strong>Final reklam henüz hazırlanmadı</strong><span data-radio-summary>30 sn · MP3 320 kbps + WAV · Müzik + kapanış jingle’ı</span><i></i></div><button type="button" disabled>MP3 indir</button><button type="button" disabled>WAV indir</button></div>
        </article>

        <div class="adfilm-radio-buildbar">
          <div><strong>Radyo reklamını oluşturmaya hazır mısın?</strong><span>Seslendirme, müzik ve jingle tek final dosyada birleştirilecek.</span></div>
          <button type="button" data-radio-build>Radyo Reklamını Oluştur</button>
        </div>
      </section>`;
  }

  function setKind(root, kind) {
    const isRadio = kind === "radio";
    root.querySelectorAll('[data-adfilm-kind]').forEach((button) => {
      const active = button.dataset.adfilmKind === kind;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    const modebar = root.querySelector('.adfilm-modebar');
    const layout = root.querySelector('.adfilm-layout');
    const radio = root.querySelector('[data-adfilm-radio-panel]');
    if (modebar) modebar.hidden = isRadio;
    if (layout) layout.hidden = isRadio;
    if (radio) radio.hidden = !isRadio;
  }

  function wireChoices(root) {
    root.querySelectorAll('[data-radio-choice]').forEach((group) => {
      group.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-value]');
        if (!button) return;
        group.querySelectorAll('button[data-value]').forEach((item) => item.classList.toggle('is-active', item === button));
        updateTiming(root);
      });
    });
    const copy = root.querySelector('[data-radio-copy]');
    if (copy) copy.addEventListener('input', () => updateTiming(root));
    const prepare = root.querySelector('[data-radio-prepare-copy]');
    if (prepare) prepare.addEventListener('click', () => {
      const brand = root.querySelector('[data-adfilm-radio-panel] input[placeholder="Örn: AIVO"]')?.value.trim() || 'Markanız';
      if (copy && !copy.value.trim()) copy.value = `${brand} ile ihtiyacınız olan çözüme hızlı, kolay ve güvenle ulaşın. Size özel avantajları şimdi keşfedin. ${brand} — doğru seçim, güçlü sonuç.`;
      updateTiming(root);
    });
    const build = root.querySelector('[data-radio-build]');
    if (build) build.addEventListener('click', () => {
      const notify = window.toastSafe || window.showToast || window.toastMsg;
      if (typeof notify === 'function') notify('Radyo reklamı üretim motoru bir sonraki adımda bağlanacak.', 'info');
    });
  }

  function selected(root, name, fallback) {
    return root.querySelector(`[data-radio-choice="${name}"] .is-active`)?.dataset.value || fallback;
  }

  function updateTiming(root) {
    const duration = Number(selected(root, 'duration', '30'));
    const jingleOn = selected(root, 'jingle', 'ai') !== 'off';
    const musicOn = selected(root, 'music', 'ai') !== 'off';
    const jingle = jingleOn ? ({15:4,30:6,45:7,60:8}[duration] || 6) : 0;
    const intro = musicOn ? 1 : 0;
    const voice = Math.max(1, duration - jingle - intro);
    const speed = selected(root, 'speed', 'fast');
    const rate = speed === 'slow' ? 1.55 : speed === 'balanced' ? 1.9 : 2.2;
    const maxWords = Math.floor(voice * rate);
    const minWords = Math.max(5, Math.floor(maxWords * .72));
    const copy = root.querySelector('[data-radio-copy]')?.value.trim() || '';
    const words = copy ? copy.split(/\s+/).filter(Boolean).length : 0;
    const estimate = Math.ceil(words / rate);
    const fill = Math.min(100, maxWords ? words / maxWords * 100 : 0);

    const set = (selector, value) => { const el = root.querySelector(selector); if (el) el.textContent = value; };
    set('[data-radio-word-range]', `${minWords}–${maxWords} kelime önerilir`);
    set('[data-radio-duration-badge]', `${duration} sn`);
    set('[data-radio-word-count]', String(words));
    set('[data-radio-estimate]', String(estimate));
    set('[data-radio-jingle-duration]', `${jingle} sn`);
    set('[data-radio-total]', `00:${String(duration).padStart(2,'0')}`);
    set('[data-radio-timeline-text]', `${intro} sn müzik girişi · ${voice} sn seslendirme · ${jingle} sn jingle`);
    set('[data-radio-summary]', `${duration} sn · MP3 320 kbps + WAV · ${musicOn ? 'Müzik' : 'Müziksiz'}${jingleOn ? ' + kapanış jingle’ı' : ''}`);
    const fillEl = root.querySelector('[data-radio-budget-fill]');
    if (fillEl) fillEl.style.width = `${fill}%`;
    const main = root.querySelector('[data-radio-main]');
    if (main) main.innerHTML = `${intro ? `<i class="intro" style="width:${intro/duration*100}%">Müzik</i>` : ''}<i class="voice" style="width:${voice/duration*100}%">Seslendirme</i>${jingle ? `<i class="jingle" style="width:${jingle/duration*100}%">Jingle</i>` : ''}`;
  }

  function init(root) {
    if (!root || root.dataset.radioInnerReady === '1') return;
    root.dataset.radioInnerReady = '1';
    ensureCompactStyle();

    const hero = root.querySelector('.adfilm-hero');
    if (!hero) return;

    const switcher = document.createElement('div');
    switcher.className = 'adfilm-kind-switch';
    switcher.setAttribute('role', 'tablist');
    switcher.setAttribute('aria-label', 'Reklam türünü seç');
    switcher.innerHTML = `<span>Reklam Türünü Seç</span><div><button type="button" class="is-active" data-adfilm-kind="video" role="tab" aria-selected="true">Reklam Videosu</button><button type="button" data-adfilm-kind="radio" role="tab" aria-selected="false">Radyo Reklamı</button></div>`;
    hero.insertAdjacentElement('afterend', switcher);

    root.insertAdjacentHTML('beforeend', radioMarkup());
    switcher.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-adfilm-kind]');
      if (!button) return;
      setKind(root, button.dataset.adfilmKind);
    });
    wireChoices(root);
    updateTiming(root);
    setKind(root, 'video');
  }

  document.addEventListener('aivo:module-mounted', (event) => {
    if (event?.detail?.key === 'adfilm') init(event.detail.root || document.querySelector(ROOT_SELECTOR));
  });

  const current = document.querySelector(ROOT_SELECTOR);
  if (current) init(current);
})();
