(() => {
  "use strict";

  const ROOT_SELECTOR = '[data-module-root][data-module="adfilm"]';
  const STYLE_ID = 'aivo-radio-inner-style-v2';
  const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
  const stages = [
    ['Seslendirme hazırlanıyor', 'Yazdığın reklam metni seçilen ses, hız ve anlatım akışıyla oluşturuluyor.'],
    ['Reklam müziği hazırlanıyor', 'Seçilen stile ve toplam reklam süresine uygun arka plan müziği hazırlanıyor.'],
    ['Final ses birleştiriliyor', 'Seslendirme ve reklam müziği birleştirilerek seçilen çıktı formatı hazırlanıyor.']
  ];
  let musicObjectUrl = '';

  const q = (root, selector) => root.querySelector(selector);
  const qa = (root, selector) => [...root.querySelectorAll(selector)];
  const notify = (message, type = 'info') => {
    const fn = window.toastSafe || window.showToast || window.toastMsg;
    if (typeof fn === 'function') fn(message, type);
  };
  const icon = (name) => ({
    play: '<svg viewBox="0 0 24 24"><path d="m9 6 9 6-9 6V6Z" fill="currentColor" stroke="none"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M8 6v12M16 6v12"/></svg>',
    volume: '<svg viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6L8 10H4Z"/><path d="M17 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 20h14"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
    music: '<svg viewBox="0 0 24 24"><path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="12" rx="4"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>'
  }[name] || '');

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .adfilm-radio-panel{gap:14px;font-size:14px}
      .adfilm-kind-switch{margin:18px 0;padding:12px;border-radius:20px}
      .adfilm-kind-switch>span{margin-bottom:8px;font-size:11px}
      .adfilm-kind-switch button{min-height:50px;border-radius:14px;font-size:15px}
      .adfilm-radio-card{padding:18px;border-radius:20px}
      .adfilm-radio-card__head{gap:11px;margin-bottom:14px}
      .adfilm-radio-card__head>b{flex-basis:38px;height:38px;border-radius:12px;font-size:11px}
      .adfilm-radio-card__head h3{font-size:18px}.adfilm-radio-card__head p{font-size:13px}
      .radio-voice-hero{display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:16px;align-items:center;margin-bottom:14px;padding:18px 20px;border:1px solid rgba(164,111,229,.44);border-radius:18px;background:radial-gradient(circle at 10% 20%,rgba(154,75,211,.3),transparent 36%),linear-gradient(120deg,rgba(54,34,88,.98),rgba(18,23,49,.98));box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 16px 34px rgba(10,7,29,.28)}
      .radio-voice-hero__icon{display:grid;place-items:center;width:54px;height:54px;border:1px solid rgba(255,255,255,.24);border-radius:17px;background:linear-gradient(145deg,#7c45f5,#d64cc8,#ef5a9d);box-shadow:0 12px 26px rgba(125,62,221,.28)}
      .radio-voice-hero svg,.radio-icon-btn svg,.radio-upload-icon svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      .radio-voice-hero__copy>span{display:block;margin-bottom:5px;color:#cdb8f4;font-size:10px;font-weight:900;letter-spacing:.2em;text-transform:uppercase}
      .radio-voice-hero__copy h4{margin:0;background:linear-gradient(90deg,#fff,#d5b8ff 58%,#f3a8d1);-webkit-background-clip:text;background-clip:text;color:transparent;font-size:20px}
      .radio-voice-hero__copy p{margin:6px 0 0;color:#aaa3b8;font-size:12px}
      .radio-voice-hero__status{display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid rgba(74,224,184,.2);border-radius:999px;background:rgba(11,70,66,.18);color:#c8c4d2;font-size:11px;font-weight:800;white-space:nowrap}
      .radio-voice-hero__status i{width:8px;height:8px;border-radius:50%;background:#42ddb3;box-shadow:0 0 14px rgba(66,221,179,.72)}
      .adfilm-radio-budget{padding:13px;border-radius:15px}.adfilm-radio-fields{gap:11px}.adfilm-radio-fields label{gap:6px}.adfilm-radio-fields label>span{font-size:12px}
      .adfilm-radio-fields input,.adfilm-radio-fields textarea,.adfilm-radio-fields select{padding:11px 13px;border-radius:12px;font-size:14px}
      .adfilm-radio-choice{grid-template-columns:82px 1fr;gap:10px;margin-top:9px}
      .adfilm-radio-choice button,.adfilm-radio-three button,.adfilm-radio-durations button{min-height:42px;border-radius:12px;font-size:13px}
      .adfilm-radio-durations{grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}
      .adfilm-radio-durations button{min-height:34px;padding:0 5px;border-radius:9px;font-size:11px}
      .radio-preview{margin-top:14px;padding:15px;border:1px solid rgba(132,98,199,.42);border-radius:17px;background:linear-gradient(145deg,rgba(17,21,49,.98),rgba(12,14,32,.98))}
      .radio-preview__head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px}.radio-preview__title{display:flex;align-items:center;gap:11px}
      .radio-preview__spark{display:grid;place-items:center;width:36px;height:36px;border:1px solid rgba(89,224,235,.3);border-radius:11px;background:rgba(26,122,142,.17);color:#6deaf0;font-size:18px}
      .radio-preview__title strong{display:block;font-size:16px}.radio-preview__title p{margin:3px 0 0;color:#9992a9;font-size:12px}
      .radio-preview__state{padding:7px 10px;border:1px solid rgba(80,218,177,.18);border-radius:999px;background:rgba(19,91,76,.18);color:#a5efd5;font-size:10px;font-style:normal;font-weight:800;white-space:nowrap}
      .radio-preview__player{display:grid;grid-template-columns:48px minmax(0,1fr) 38px 38px;gap:9px;align-items:center;padding:10px;border:1px solid rgba(116,84,190,.38);border-radius:14px;background:rgba(9,12,31,.72)}
      .radio-preview__player>.radio-icon-btn:nth-child(4):not(.is-danger){display:none}
      .radio-play{display:grid;place-items:center;width:48px;height:48px;border:1px solid rgba(255,255,255,.22);border-radius:13px;background:linear-gradient(145deg,#7648f5,#d44bc8,#ef579f);color:#fff}
      .radio-track{display:grid;gap:5px}.radio-track i{display:block;height:6px;border-radius:999px;background:rgba(104,105,143,.28)}.radio-track small{color:#aaa3b8;font-size:11px}
      .radio-icon-btn{display:grid;place-items:center;width:38px;height:38px;border:1px solid rgba(124,94,194,.42);border-radius:11px;background:rgba(37,34,75,.7);color:#e7e2f4}.radio-icon-btn svg{width:17px;height:17px}.radio-icon-btn.is-danger{border-color:rgba(230,62,112,.45);background:rgba(87,18,43,.35);color:#ff719b}
      .radio-preview button:disabled{cursor:not-allowed;opacity:.48}.radio-preview__actions{display:flex;gap:10px;margin-top:11px}.radio-preview__actions button{min-height:40px;padding:0 16px;border-radius:11px;font:inherit;font-size:12px;font-weight:900}
      .radio-preview__actions button:first-child{border:1px solid rgba(255,255,255,.22);background:linear-gradient(100deg,#7046f5,#ca4fd1,#ef5aa8);color:#fff}.radio-preview__actions button:last-child{border:1px solid rgba(77,190,159,.28);background:rgba(21,70,63,.22);color:#a5efd5}
      .adfilm-radio-two-col{gap:13px}.adfilm-radio-two-col>section{padding:15px;border-radius:17px}.adfilm-radio-two-col h4{margin-bottom:10px;font-size:16px}
      .radio-output-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-bottom:7px}.radio-output-options button{display:grid;gap:1px;min-height:48px;padding:6px 8px;border:1px solid rgba(111,85,171,.45);border-radius:10px;background:linear-gradient(145deg,rgba(34,30,67,.96),rgba(21,21,48,.96));color:#b9b2c8;text-align:left;font:inherit;cursor:pointer}
      .radio-output-options b{color:#f5f1fb;font-size:13px}.radio-output-options strong{font-size:10px}.radio-output-options small{color:#8f899e;font-size:8.5px}.radio-output-options button.is-active{border-color:rgba(255,255,255,.44);background:linear-gradient(120deg,#7447f5,#bf4ed5,#ef58a8);color:#fff;box-shadow:0 7px 15px rgba(129,64,220,.2)}.radio-output-options button.is-active b,.radio-output-options button.is-active small{color:#fff}
      .radio-music-shell{padding:15px;border:1px solid rgba(134,101,196,.32);border-radius:17px;background:rgba(17,18,39,.5)}.radio-music-shell h4{margin-bottom:10px;font-size:16px}
      .radio-music-panel[hidden]{display:none!important}.radio-music-panel{margin-top:12px;padding:13px;border:1px solid rgba(111,85,171,.34);border-radius:14px;background:rgba(12,14,31,.55)}
      .radio-engine-hint{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;padding:9px 11px;border:1px solid rgba(78,216,178,.2);border-radius:11px;background:rgba(21,89,76,.14);color:#9f98aa;font-size:10px}.radio-engine-hint b{color:#a5efd5}
      .radio-upload-picker{display:flex;align-items:center;gap:13px;padding:15px;border:1px dashed rgba(151,105,222,.58);border-radius:13px;background:rgba(25,20,48,.55);cursor:pointer}.radio-upload-picker input{display:none}.radio-upload-icon{display:grid;place-items:center;width:44px;height:44px;border:1px solid rgba(255,255,255,.18);border-radius:13px;background:linear-gradient(145deg,#7346e9,#d14ec3);color:#fff}.radio-upload-picker b{display:block;color:#f5f1fb;font-size:13px}.radio-upload-picker small{display:block;margin-top:3px;color:#8f899e;font-size:10px}
      .radio-file-card{display:grid;gap:10px}.radio-file-head{display:grid;grid-template-columns:42px 1fr 36px;gap:10px;align-items:center}.radio-file-head b{display:block;font-size:13px}.radio-file-head small{color:#918a9f;font-size:10px}.radio-file-head .radio-icon-btn{width:36px;height:36px}.radio-audio{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:9px;align-items:center}.radio-audio input{width:100%;accent-color:#c64fd0}.radio-audio span{color:#aaa3b8;font-size:10px}.radio-rights{margin:10px 0 0;color:#9f98aa;font-size:10px}
      .adfilm-radio-note{margin-top:13px;padding:11px 13px;border-radius:12px;font-size:11px}.adfilm-radio-final{grid-template-columns:48px 1fr auto;padding:13px;border-radius:15px}.adfilm-radio-final>button{min-height:42px;border-radius:11px;font-size:13px}
      .adfilm-radio-production[hidden]{display:none!important}.adfilm-radio-production{padding:18px;border:1px solid rgba(148,105,221,.42);border-radius:20px;background:linear-gradient(150deg,rgba(35,28,75,.96),rgba(13,16,35,.98))}.adfilm-radio-production__top{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}.adfilm-radio-production__top strong{font-size:18px;background:linear-gradient(90deg,#a27aff,#ee62b4);-webkit-background-clip:text;background-clip:text;color:transparent}.adfilm-radio-production__top span{padding:6px 10px;border-radius:999px;background:rgba(20,111,92,.14);color:#75e5c0;font-size:11px;font-weight:800}.adfilm-radio-production__body{display:grid;grid-template-columns:58px 1fr;gap:14px;align-items:center;padding:15px;border:1px solid rgba(129,102,196,.3);border-radius:16px;background:rgba(14,15,37,.72)}.adfilm-radio-production__spinner{width:34px;height:34px;margin:auto;border:6px solid rgba(139,100,227,.22);border-top-color:#b56af2;border-right-color:#ee62b4;border-radius:50%;animation:radioSpin 1s linear infinite}.adfilm-radio-production__stage{display:grid;gap:4px}.adfilm-radio-production__stage>span{width:max-content;padding:4px 9px;border-radius:999px;background:rgba(116,70,207,.2);color:#cfb5ff;font-size:10px;font-weight:900}.adfilm-radio-production__stage strong{font-size:17px}.adfilm-radio-production__stage p{font-size:12px!important}.adfilm-radio-production__stage small{color:#71dec0;font-size:11px;font-weight:700}.adfilm-radio-production__steps{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:12px}.adfilm-radio-production__steps span{padding:8px 6px;border:1px solid rgba(118,92,174,.24);border-radius:10px;background:rgba(24,24,50,.72);color:#8f879d;text-align:center;font-size:10px;font-weight:800}.adfilm-radio-production__steps span.is-active{background:linear-gradient(100deg,rgba(112,70,245,.34),rgba(226,83,169,.28));color:#fff}
      .adfilm-radio-buildbar{display:grid;gap:12px;padding:16px 18px;border:1px solid rgba(139,103,205,.34);border-radius:18px;background:linear-gradient(145deg,rgba(27,24,52,.96),rgba(13,15,31,.98))}.adfilm-radio-buildbar>div{display:flex;align-items:center;justify-content:space-between;gap:12px}.adfilm-radio-buildbar strong{font-size:15px}.adfilm-radio-buildbar span{color:#9f97aa;font-size:12px}.adfilm-radio-buildbar button{width:100%;min-height:54px;padding:0 22px;border:1px solid rgba(255,255,255,.28);border-radius:15px;background:linear-gradient(100deg,#7046f5,#ca4fd1,#ef5aa8);color:#fff;font:inherit;font-size:16px;font-weight:900;cursor:pointer}
      @keyframes radioSpin{to{transform:rotate(360deg)}}
      @media(max-width:900px){.radio-voice-hero{grid-template-columns:54px minmax(0,1fr)}.radio-voice-hero__status{grid-column:1/-1;width:max-content}.radio-preview__player{grid-template-columns:48px minmax(0,1fr) 36px 36px}.adfilm-radio-production__steps{grid-template-columns:1fr}.adfilm-radio-durations{grid-template-columns:repeat(3,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function markup() {
    return `
      <section class="adfilm-radio-panel" data-adfilm-radio-panel hidden aria-label="AI Radyo Reklamı Oluştur">
        <article class="adfilm-radio-card">
          <div class="adfilm-radio-card__head"><b>01</b><div><h3>Ses & Anlatım</h3><p>Reklam seslendirme metnini yaz; AIVO seçtiğin ses ve anlatım ayarlarıyla seslendirsin.</p></div></div>
          <div class="radio-voice-hero"><div class="radio-voice-hero__icon">${icon('mic')}</div><div class="radio-voice-hero__copy"><span>AIVO Ses Motoru</span><h4>Reklam Seslendirme Metni</h4><p>Metni yaz, sesi seç ve profesyonel reklam sesini aynı akışta hazırla.</p></div><div class="radio-voice-hero__status"><i></i>Ön izleme hazır olduğunda dinle</div></div>
          <div class="adfilm-radio-budget"><div><small>Ses süresi bütçesi</small><strong data-radio-word-range>42–59 kelime önerilir</strong></div><span data-radio-duration-badge>30 sn</span><i><u data-radio-budget-fill></u></i><p><span>Müzik girişi toplam süreye dahildir.</span><b><span data-radio-word-count>0</span> kelime · tahmini <span data-radio-estimate>0</span> sn</b></p></div>
          <div class="adfilm-radio-fields"><label><span>Dil</span><select><option>Türkçe</option><option>English</option><option>Deutsch</option><option>Français</option><option>Español</option></select></label><label><span>Ses Stili</span><select><option>Sıcak ve güven veren</option><option>Enerjik reklam sesi</option><option>Premium ve sakin</option><option>Doğal konuşma</option></select></label><label><span>Ses</span><select><option>Sıcak kadın sesi</option><option>Profesyonel erkek sesi</option><option>Enerjik erkek sesi</option><option>Net kadın sesi</option></select></label><label class="is-wide"><span>Reklam Seslendirme Metni</span><textarea rows="7" maxlength="1200" data-radio-copy placeholder="Reklam metnini buraya yaz..."></textarea></label></div>
          <div class="adfilm-radio-choice"><span>Hız</span><div data-radio-choice="speed"><button type="button" data-value="slow">Yavaş</button><button type="button" data-value="balanced">Dengeli</button><button type="button" class="is-active" data-value="fast">Hızlı</button></div></div>
          <div class="adfilm-radio-choice"><span>Ses Akışı</span><div data-radio-choice="flow"><button type="button" class="is-active" data-value="natural">Doğal</button><button type="button" data-value="balanced">Dengeli</button><button type="button" data-value="emphatic">Vurgulu</button></div></div>
          <section class="radio-preview"><div class="radio-preview__head"><div class="radio-preview__title"><span class="radio-preview__spark">✦</span><div><strong>Ses Ön İzleme</strong><p>Reklam sesini oluştur, dinle ve onayla.</p></div></div><em class="radio-preview__state" data-radio-preview-state>Henüz ses oluşturulmadı.</em></div><div class="radio-preview__player"><button type="button" class="radio-play" disabled>${icon('play')}</button><div class="radio-track"><i></i><small>0:00 / 0:00</small></div><button type="button" class="radio-icon-btn" disabled>${icon('volume')}</button><button type="button" class="radio-icon-btn" disabled>${icon('download')}</button><button type="button" class="radio-icon-btn is-danger" disabled>${icon('trash')}</button></div><div class="radio-preview__actions"><button type="button" data-radio-voice-create>Sesi oluştur</button><button type="button" data-radio-voice-approve disabled>Sesi onayla</button></div></section>
        </article>

        <article class="adfilm-radio-card"><div class="adfilm-radio-card__head"><b>02</b><div><h3>Ses Ayarları</h3><p>Müzik ve konuşma seçilen toplam reklam süresine yerleştirilir.</p></div></div><div class="adfilm-radio-two-col"><section><h4>Reklam Süresi</h4><div class="adfilm-radio-durations" data-radio-choice="duration"><button type="button" data-value="10">10 sn</button><button type="button" data-value="15">15 sn</button><button type="button" data-value="20">20 sn</button><button type="button" class="is-active" data-value="30">30 sn</button><button type="button" data-value="45">45 sn</button><button type="button" data-value="60">60 sn</button></div><p>10 saniye kısa marka mesajları, 15–30 saniye standart kampanyalar ve 45–60 saniye detaylı anlatımlar için uygundur.</p></section><section><h4>Çıkış Dosyası</h4><div class="radio-output-options" data-radio-choice="outputFormat"><button type="button" class="is-active" data-value="mp3"><b>MP3</b><strong>320 kbps</strong><small>Yayın ve dijital kullanım</small></button><button type="button" data-value="wav"><b>WAV</b><strong>Kayıpsız</strong><small>Stüdyo ve arşiv kalitesi</small></button></div><p>Final tamamlandığında seçtiğin format hazırlanır.</p></section></div></article>

        <article class="adfilm-radio-card"><div class="adfilm-radio-card__head"><b>03</b><div><h3>Reklam Müziği</h3><p>Arka plan müziğinin nasıl hazırlanacağını seç.</p></div><em>İsteğe bağlı</em></div><section class="radio-music-shell"><h4>♫ Reklam Müziği</h4><div class="adfilm-radio-three" data-radio-choice="music"><button type="button" class="is-active" data-value="ai">AIVO müziği hazırlasın</button><button type="button" data-value="upload">Kendi müziğimi yükle</button><button type="button" data-value="off">Müzik olmasın</button></div><div class="radio-music-panel" data-radio-music-panel="ai"><div class="adfilm-radio-fields"><label><span>Müzik Tarzı</span><select><option>AIVO otomatik seçsin</option><option>Sinematik</option><option>Kurumsal</option><option>Elektronik</option><option>Akustik</option></select></label><label><span>Enerji</span><select><option>Dengeli</option><option>Yumuşak</option><option>Güçlü</option><option>Yüksek</option></select></label></div><div class="radio-engine-hint"><span>Öneri: seçtiğin stile göre otomatik hazırlanır.</span><b>Stable Audio 3 Small</b></div></div><div class="radio-music-panel" data-radio-music-panel="upload" hidden><label class="radio-upload-picker"><input type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,.mp3,.wav,.m4a,.aac,.ogg" data-radio-music-file><span class="radio-upload-icon">${icon('music')}</span><span><b>Müzik yükle</b><small>MP3, WAV, M4A, AAC veya OGG · En fazla 20 MB</small></span></label><div class="radio-file-card" data-radio-music-file-card hidden><div class="radio-file-head"><span class="radio-upload-icon">${icon('music')}</span><div><b data-radio-music-name></b><small data-radio-music-size></small></div><button type="button" class="radio-icon-btn is-danger" data-radio-music-remove>${icon('trash')}</button></div><div class="radio-audio"><button type="button" class="radio-icon-btn" data-radio-music-play>${icon('play')}</button><input type="range" min="0" max="1000" value="0" step="1" data-radio-music-progress><span data-radio-music-time>0:00 / 0:00</span><audio preload="metadata" data-radio-music-audio></audio></div></div><p class="radio-rights">Yüklediğin müziğin kullanım ve telif hakkına sahip olmalısın.</p></div></section><div class="adfilm-radio-note">✦ AIVO müzik promptunu seçilen stile göre arka planda hazırlar.</div></article>

        <article class="adfilm-radio-card"><div class="adfilm-radio-card__head"><b>04</b><div><h3>Final Radyo Reklamı</h3><p>Seslendirme ve müzik birleştiğinde final reklamını burada dinle.</p></div></div><div class="adfilm-radio-final"><button type="button" disabled>▶</button><div><strong>Final reklam henüz hazırlanmadı</strong><span data-radio-summary>30 sn · MP3 320 kbps · Müzik + seslendirme</span><i></i></div><button type="button" data-radio-download-label disabled>MP3 indir</button></div></article>

        <section class="adfilm-radio-production" data-radio-production hidden><div class="adfilm-radio-production__top"><strong>Radyo reklamınız hazırlanıyor</strong><span>Üretim akışı</span></div><div class="adfilm-radio-production__body"><div class="adfilm-radio-production__spinner"></div><div class="adfilm-radio-production__stage"><span data-radio-stage-count>AŞAMA 1/3</span><strong data-radio-stage-title>Seslendirme hazırlanıyor</strong><p data-radio-stage-description>${stages[0][1]}</p><small data-radio-stage-time>Toplam geçen süre: 0 dk 00 sn</small></div></div><div class="adfilm-radio-production__steps" data-radio-stage-steps><span>Seslendirme</span><span>Müzik</span><span>Final ses</span></div></section>
        <div class="adfilm-radio-buildbar"><div><strong>Radyo reklamı projesi hazırlanacak</strong><span data-radio-build-summary>30 sn · Seslendirme · AIVO müziği · MP3 320 kbps</span></div><button type="button" data-radio-build>▶ Radyo Reklamını Oluştur</button></div>
      </section>`;
  }

  function selected(root, name, fallback) {
    return q(root, `[data-radio-choice="${name}"] .is-active`)?.dataset.value || fallback;
  }

  function setKind(root, kind) {
    const radioOn = kind === 'radio';
    qa(root, '[data-adfilm-kind]').forEach(button => {
      const active = button.dataset.adfilmKind === kind;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    const modebar = q(root, '.adfilm-modebar');
    const layout = q(root, '.adfilm-layout');
    const radio = q(root, '[data-adfilm-radio-panel]');
    if (modebar) modebar.hidden = radioOn;
    if (layout) layout.hidden = radioOn;
    if (radio) radio.hidden = !radioOn;
  }

  function updateSummary(root) {
    const duration = Number(selected(root, 'duration', '30'));
    const musicMode = selected(root, 'music', 'ai');
    const output = selected(root, 'outputFormat', 'mp3');
    const outputLabel = output === 'wav' ? 'WAV Kayıpsız' : 'MP3 320 kbps';
    const speed = selected(root, 'speed', 'fast');
    const rate = speed === 'slow' ? 1.55 : speed === 'balanced' ? 1.9 : 2.2;
    const words = (q(root, '[data-radio-copy]')?.value.trim() || '').split(/\s+/).filter(Boolean).length;
    const estimate = Math.ceil(words / rate);
    const maxWords = Math.floor(duration * rate);
    const minWords = Math.max(5, Math.floor(maxWords * .72));
    const set = (selector, value) => { const node = q(root, selector); if (node) node.textContent = value; };
    set('[data-radio-word-range]', `${minWords}–${maxWords} kelime önerilir`);
    set('[data-radio-duration-badge]', `${duration} sn`);
    set('[data-radio-word-count]', String(words));
    set('[data-radio-estimate]', String(estimate));
    set('[data-radio-summary]', `${duration} sn · ${outputLabel} · ${musicMode === 'off' ? 'Yalnız seslendirme' : 'Müzik + seslendirme'}`);
    set('[data-radio-build-summary]', `${duration} sn · Seslendirme · ${musicMode === 'ai' ? 'AIVO müziği' : musicMode === 'upload' ? 'Yüklenen müzik' : 'Müziksiz'} · ${outputLabel}`);
    set('[data-radio-download-label]', output === 'wav' ? 'WAV indir' : 'MP3 indir');
    const fill = q(root, '[data-radio-budget-fill]');
    if (fill) fill.style.width = `${Math.min(100, maxWords ? words / maxWords * 100 : 0)}%`;
  }

  function setMusicMode(root, mode) {
    qa(root, '[data-radio-music-panel]').forEach(panel => panel.hidden = panel.dataset.radioMusicPanel !== mode);
    if (mode !== 'upload') {
      const audio = q(root, '[data-radio-music-audio]');
      if (audio) audio.pause();
    }
  }

  function formatTime(value) {
    const seconds = Number.isFinite(value) ? value : 0;
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }

  function syncMusicFile(root) {
    const input = q(root, '[data-radio-music-file]');
    const file = input?.files?.[0];
    const picker = q(root, '.radio-upload-picker');
    const card = q(root, '[data-radio-music-file-card]');
    const audio = q(root, '[data-radio-music-audio]');
    if (!picker || !card || !audio) return;
    picker.hidden = !!file;
    card.hidden = !file;
    if (!file) {
      audio.pause();
      audio.removeAttribute('src');
      if (musicObjectUrl) URL.revokeObjectURL(musicObjectUrl);
      musicObjectUrl = '';
      return;
    }
    q(root, '[data-radio-music-name]').textContent = file.name;
    q(root, '[data-radio-music-size]').textContent = `${Math.max(.1, file.size / 1024 / 1024).toFixed(1)} MB`;
    if (musicObjectUrl) URL.revokeObjectURL(musicObjectUrl);
    musicObjectUrl = URL.createObjectURL(file);
    audio.src = musicObjectUrl;
    audio.load();
  }

  function bind(root) {
    qa(root, '[data-radio-choice]').forEach(group => group.addEventListener('click', event => {
      const button = event.target.closest('button[data-value]');
      if (!button) return;
      qa(group, 'button[data-value]').forEach(item => item.classList.toggle('is-active', item === button));
      if (group.dataset.radioChoice === 'music') setMusicMode(root, button.dataset.value);
      updateSummary(root);
    }));

    q(root, '[data-radio-copy]')?.addEventListener('input', () => updateSummary(root));
    q(root, '[data-radio-voice-create]')?.addEventListener('click', () => {
      if ((q(root, '[data-radio-copy]')?.value.trim() || '').length < 10) return notify('Önce reklam seslendirme metnini yaz.', 'warning');
      q(root, '[data-radio-preview-state]').textContent = 'Ses motoru bağlantısı bekleniyor.';
      notify('Ses ön izleme motoru sonraki aşamada bağlanacak.', 'info');
    });

    q(root, '[data-radio-music-file]')?.addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (!file) return syncMusicFile(root);
      if (!(/^(audio\/(mpeg|wav|x-wav|mp4|aac|ogg))$/i.test(file.type) || /\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name))) {
        event.target.value = '';
        notify('Desteklenen bir ses dosyası seç: MP3, WAV, M4A, AAC veya OGG.', 'warning');
      } else if (file.size > MAX_AUDIO_BYTES) {
        event.target.value = '';
        notify('Müzik dosyası en fazla 20 MB olabilir.', 'warning');
      }
      syncMusicFile(root);
    });

    q(root, '[data-radio-music-remove]')?.addEventListener('click', () => {
      const input = q(root, '[data-radio-music-file]');
      if (input) input.value = '';
      syncMusicFile(root);
      notify('Müzik dosyası kaldırıldı.', 'success');
    });

    const audio = q(root, '[data-radio-music-audio]');
    const play = q(root, '[data-radio-music-play]');
    const progress = q(root, '[data-radio-music-progress]');
    const time = q(root, '[data-radio-music-time]');
    const syncPlayer = () => {
      if (!audio || !play || !progress || !time) return;
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      progress.value = duration ? String(Math.round(current / duration * 1000)) : '0';
      time.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
      play.innerHTML = icon(!audio.paused && !audio.ended ? 'pause' : 'play');
    };
    play?.addEventListener('click', () => audio?.src && (audio.paused ? audio.play().catch(() => {}) : audio.pause()));
    progress?.addEventListener('input', () => { if (audio?.duration) audio.currentTime = Number(progress.value) / 1000 * audio.duration; });
    ['loadedmetadata','durationchange','timeupdate','play','pause','ended'].forEach(name => audio?.addEventListener(name, syncPlayer));

    q(root, '[data-radio-build]')?.addEventListener('click', event => {
      if ((q(root, '[data-radio-copy]')?.value.trim() || '').length < 10) return notify('Önce reklam seslendirme metnini yaz.', 'warning');
      const panel = q(root, '[data-radio-production]');
      panel.hidden = false;
      q(root, '[data-radio-stage-title]').textContent = stages[0][0];
      q(root, '[data-radio-stage-description]').textContent = stages[0][1];
      qa(root, '[data-radio-stage-steps] span').forEach((item, index) => item.classList.toggle('is-active', index === 0));
      event.currentTarget.disabled = true;
      event.currentTarget.textContent = 'Radyo Reklamı Oluşturuluyor...';
      panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        event.currentTarget.disabled = false;
        event.currentTarget.textContent = '▶ Radyo Reklamını Oluştur';
        notify('Radyo üretim motoru sonraki aşamada bağlanacak.', 'info');
      }, 700);
    });
  }

  function init(root) {
    if (!root || root.dataset.radioInnerReady === '1') return;
    root.dataset.radioInnerReady = '1';
    ensureStyle();
    const hero = q(root, '.adfilm-hero');
    if (!hero) return;
    const switcher = document.createElement('div');
    switcher.className = 'adfilm-kind-switch';
    switcher.innerHTML = '<span>Reklam Türünü Seç</span><div><button type="button" class="is-active" data-adfilm-kind="video">Reklam Videosu</button><button type="button" data-adfilm-kind="radio">Radyo Reklamı</button></div>';
    hero.insertAdjacentElement('afterend', switcher);
    root.insertAdjacentHTML('beforeend', markup());
    switcher.addEventListener('click', event => {
      const button = event.target.closest('[data-adfilm-kind]');
      if (button) setKind(root, button.dataset.adfilmKind);
    });
    bind(root);
    setMusicMode(root, 'ai');
    updateSummary(root);
    setKind(root, 'video');
  }

  document.addEventListener('aivo:module-mounted', event => {
    if (event?.detail?.key === 'adfilm') init(event.detail.root || document.querySelector(ROOT_SELECTOR));
  });
  const current = document.querySelector(ROOT_SELECTOR);
  if (current) init(current);
})();
