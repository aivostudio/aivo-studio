/* =========================================================
   AIVO — AI REKLAM FILMI
   Desktop preview interactions. No API, credit or generation.
   ========================================================= */
(function AIVO_AD_FILM(){
  "use strict";
  if(window.__AIVO_AD_FILM_SKELETON__) return;
  window.__AIVO_AD_FILM_SKELETON__=true;

  var COPY={
    tr:{
      nav:"AI Reklam Filmi Oluştur",newBadge:"YENİ",kicker:"AIVO Creative Engine",comingSoon:"YAKINDA",title:"AI Reklam Filmi Oluştur",subtitle:"Ürün görsellerini, seslendirmeyi, müziği ve sahneleri tek akışta birleştirerek kısa reklam filmleri oluştur.",
      engineLabel:"Creative Engine",engineStatus:"Arayüz geliştirme aşaması",modeBasic:"Basit Mod",modeVoice:"Sesli Reklam",modeAvatar:"Avatarlı Reklam",modeAdvanced:"Gelişmiş Mod",soonMini:"Yakında",
      productInfo:"Ürün Bilgileri",productInfoSub:"Marka ve kampanya briefini tanımla.",required:"Zorunlu",productName:"Ürün / Hizmet Adı",productNamePlaceholder:"Örn: AIVO Studio",brandName:"Marka Adı",brandNamePlaceholder:"Örn: AIVO",description:"Kısa Açıklama",descriptionPlaceholder:"Ürünün öne çıkan özelliklerini ve reklamda vurgulanmasını istediğin detayları yaz...",targetAudience:"Hedef Kitle",targetAudiencePlaceholder:"Örn: 18–35 yaş, içerik üreticileri",cta:"Kampanya / CTA",ctaPlaceholder:"Örn: Şimdi keşfet, %20 indirim",
      mediaUpload:"Medya Yükle",mediaUploadSub:"Ürün, logo ve referanslarını ekle.",productImages:"Ürün Görselleri",productImagesHint:"En fazla 6 görsel",logo:"Logo",logoHint:"PNG veya SVG",extraMedia:"Ek Görsel / Video",extraMediaHint:"İsteğe bağlı referans",mediaNote:"Ürün görselleri mümkünse temiz, net ve farklı açılardan olmalı.",tooManyFiles:"En fazla 6 ürün görseli yükleyebilirsin.",
      voiceNarration:"Ses & Anlatım",voiceNarrationSub:"Dil, ses ve anlatım ayarları.",voiceOn:"Açık",scriptAi:"Metni AI yazsın",scriptManual:"Metni ben yazacağım",language:"Dil",voiceStyle:"Ses Stili",voiceWarm:"Sıcak ve güven veren",voiceEnergetic:"Enerjik reklam sesi",voicePremium:"Premium ve sakin",voiceNatural:"Doğal konuşma",narrationText:"Seslendirme Metni",narrationPlaceholder:"Reklamda okunacak metni yaz...",
      sceneStyle:"Sahne Stili",sceneStyleSub:"Reklamın görsel dünyasını seç.",stylePremium:"Premium Ürün",styleMinimal:"Minimal",styleLuxury:"Lüks",styleSocial:"Sosyal Medya",styleStudio:"Stüdyo",styleCinematic:"Sinematik",
      videoSettings:"Video Ayarları",videoSettingsSub:"Süre, oran, kalite ve ses katmanları.",duration:"Süre",format:"Format",quality:"Kalite",premiumTag:"Premium",subtitles:"Altyazı",music:"Arka Plan Müziği",soundEffects:"Ses Efektleri",
      storyboard:"Sahne Akışı",storyboardSub:"Reklamın otomatik sahne planını ön izle.",refreshFlow:"Akışı Yenile",sceneIntro:"Güçlü Açılış",sceneIntroText:"Ürün ve marka ilk saniyede dikkat çeker.",sceneProduct:"Ürün Deneyimi",sceneProductText:"Ürün farklı açılar ve hareketlerle gösterilir.",sceneBenefit:"Fayda ve Mesaj",sceneBenefitText:"En güçlü özellik kısa ve net biçimde anlatılır.",sceneCta:"Logo ve CTA",sceneCtaText:"Marka, kampanya ve yönlendirme ile kapanır.",
      readyTitle:"Reklam projesi hazırlanacak",createButton:"Reklam Filmini Oluştur",creditLater:"Kredi daha sonra belirlenecek",summaryVoice:"Sesli",summarySilent:"Sessiz",
      developmentLabel:"EXCLUSIVE MODULE / IN DEVELOPMENT",developmentTitle:"Bu bölüm yapım aşamasındadır",developmentText:"AIVO’nun yeni reklam filmi motorunu hazırlıyoruz. Ürün görselleri, profesyonel seslendirme, müzik, sahneler ve isteğe bağlı konuşan karakter tek bir üretim akışında buluşacak.",featureProduct:"Ürün odaklı sahneler",featureVoice:"Doğal ses & dublaj",featureAvatar:"Konuşan karakter",feature2k:"1080p / 2K çıktı",soonButton:"Yakında Kullanıma Açılacak",
      panelTitle:"Reklam Videolarım",panelMeta:"Yapım aşamasında",panelMetaPreview:"Canlı taslak",panelPreviewTitle:"Canlı Önizleme",panelDraft:"TASLAK",panelAwaiting:"Ürününü eklediğinde reklam taslağın burada canlanacak.",panelBrand:"MARKA",panelProduct:"Ürün / Hizmet",panelCta:"ŞİMDİ KEŞFET",panelReadiness:"Proje Hazırlığı",panelBrief:"Ürün briefi",panelMedia:"Ürün görselleri",panelOutput:"Çıktı ayarları",panelReady:"Hazır",panelMissing:"Eksik",panelSpecs:"Çıktı Özeti",panelEngine:"Motor bağlantıları sonraki aşamada yapılacak.",panelEmptyTitle:"İlk reklam filmin burada görünecek",panelEmptyText:"Modül kullanıma açıldığında oluşturduğun reklam filmlerini bu alandan izleyip indirebileceksin.",modeLocked:"Bu mod sonraki geliştirme aşamasında açılacak.",
      missingTitle:"Ürün adını gir",missingDescription:"Kısa açıklamayı tamamla",missingImage:"En az bir ürün görseli yükle",interfaceReady:"Arayüz hazır. Şimdi motor bağlantılarına geçebiliriz.",buildPreview:"Bu önizlemede API ve kredi işlemleri kapalıdır."
    },
    en:{
      nav:"Create AI Ad Film",newBadge:"NEW",kicker:"AIVO Creative Engine",comingSoon:"COMING SOON",title:"Create AI Ad Film",subtitle:"Combine product images, narration, music and scenes in one flow to create short advertising films.",
      engineLabel:"Creative Engine",engineStatus:"Interface development stage",modeBasic:"Basic Mode",modeVoice:"Voice-over Ad",modeAvatar:"Avatar Ad",modeAdvanced:"Advanced Mode",soonMini:"Soon",
      productInfo:"Product Information",productInfoSub:"Define the brand and campaign brief.",required:"Required",productName:"Product / Service Name",productNamePlaceholder:"E.g. AIVO Studio",brandName:"Brand Name",brandNamePlaceholder:"E.g. AIVO",description:"Short Description",descriptionPlaceholder:"Describe the key product benefits and details you want highlighted in the ad...",targetAudience:"Target Audience",targetAudiencePlaceholder:"E.g. creators aged 18–35",cta:"Campaign / CTA",ctaPlaceholder:"E.g. Discover now, 20% off",
      mediaUpload:"Upload Media",mediaUploadSub:"Add product images, logo and references.",productImages:"Product Images",productImagesHint:"Up to 6 images",logo:"Logo",logoHint:"PNG or SVG",extraMedia:"Extra Image / Video",extraMediaHint:"Optional reference",mediaNote:"For best results, use clean, sharp product images from different angles.",tooManyFiles:"You can upload up to 6 product images.",
      voiceNarration:"Voice & Narration",voiceNarrationSub:"Language, voice and narration settings.",voiceOn:"On",scriptAi:"Let AI write the script",scriptManual:"I will write the script",language:"Language",voiceStyle:"Voice Style",voiceWarm:"Warm and trustworthy",voiceEnergetic:"Energetic commercial",voicePremium:"Premium and calm",voiceNatural:"Natural speech",narrationText:"Narration Script",narrationPlaceholder:"Enter the narration to be spoken in the ad...",
      sceneStyle:"Scene Style",sceneStyleSub:"Choose the visual world of your ad.",stylePremium:"Premium Product",styleMinimal:"Minimal",styleLuxury:"Luxury",styleSocial:"Social Media",styleStudio:"Studio",styleCinematic:"Cinematic",
      videoSettings:"Video Settings",videoSettingsSub:"Duration, ratio, quality and audio layers.",duration:"Duration",format:"Format",quality:"Quality",premiumTag:"Premium",subtitles:"Subtitles",music:"Background Music",soundEffects:"Sound Effects",
      storyboard:"Scene Flow",storyboardSub:"Preview the automatic advertising storyboard.",refreshFlow:"Refresh Flow",sceneIntro:"Strong Opening",sceneIntroText:"The product and brand capture attention immediately.",sceneProduct:"Product Experience",sceneProductText:"The product is shown through multiple angles and motion.",sceneBenefit:"Benefit and Message",sceneBenefitText:"The strongest value is delivered quickly and clearly.",sceneCta:"Logo and CTA",sceneCtaText:"The ad closes with the brand, offer and call to action.",
      readyTitle:"Advertising project will be prepared",createButton:"Create Advertising Film",creditLater:"Credit cost will be set later",summaryVoice:"Voice-over",summarySilent:"Silent",
      developmentLabel:"EXCLUSIVE MODULE / IN DEVELOPMENT",developmentTitle:"This feature is under development",developmentText:"We are building AIVO’s new advertising film engine. Product visuals, professional narration, music, scenes and an optional talking character will meet in one production flow.",featureProduct:"Product-focused scenes",featureVoice:"Natural voice & dubbing",featureAvatar:"Talking character",feature2k:"1080p / 2K export",soonButton:"Coming Soon",
      panelTitle:"My Ad Films",panelMeta:"In development",panelMetaPreview:"Live draft",panelPreviewTitle:"Live Preview",panelDraft:"DRAFT",panelAwaiting:"Your advertising draft will come alive here after you add the product.",panelBrand:"BRAND",panelProduct:"Product / Service",panelCta:"DISCOVER NOW",panelReadiness:"Project Readiness",panelBrief:"Product brief",panelMedia:"Product images",panelOutput:"Output settings",panelReady:"Ready",panelMissing:"Missing",panelSpecs:"Output Summary",panelEngine:"Engine integrations will be connected in the next phase.",panelEmptyTitle:"Your first ad film will appear here",panelEmptyText:"When the module launches, you will be able to watch and download your advertising films from this area.",modeLocked:"This mode will open in the next development phase.",
      missingTitle:"Enter a product name",missingDescription:"Complete the short description",missingImage:"Upload at least one product image",interfaceReady:"The interface is ready. We can now continue with engine integrations.",buildPreview:"API and credit operations are disabled in this preview."
    }
  };

  var state={
    scriptMode:"ai",sceneStyle:"premium",duration:"15",aspectRatio:"9:16",quality:"1080p",
    productName:"",brandName:"",description:"",targetAudience:"",cta:"",language:"tr",voiceStyle:"warm",
    voiceEnabled:true,subtitles:true,music:true,soundEffects:false,
    files:{productImages:[],logo:[],extraMedia:[]},urls:{productImages:[],logo:[],extraMedia:[]}
  };
  var activeRoot=null;
  var activePanelWrap=null;

  function lang(){var h=String(document.documentElement.lang||"").toLowerCase(),s="";try{s=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}return s==="en"||h.indexOf("en")===0?"en":"tr"}
  function t(k){return(COPY[lang()]&&COPY[lang()][k])||COPY.tr[k]||k}
  function icon(){return '<span class="adfilm-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 8.5h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-10Z" stroke="currentColor" stroke-width="1.7"/><path d="m4 8.5 2-5 14 4-2 1H4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m10 11.5 5 3-5 3v-6Z" fill="currentColor"/></svg></span>'}
  function isPreview(){return document.body.classList.contains("adfilm-preview-unlocked")}

  function injectNav(){
    var card=document.querySelector("#leftMenu .navCard");
    if(!card||card.querySelector("[data-adfilm-open]"))return;
    var anchor=card.querySelector('[data-route="lipsync"]');
    var btn=document.createElement("button");
    btn.type="button";btn.className="navBtn";btn.setAttribute("data-adfilm-open","");btn.setAttribute("aria-label",t("nav"));
    btn.innerHTML=icon()+'<span data-adfilm-nav-label>'+t("nav")+'</span><span class="adfilm-nav-badge" data-adfilm-nav-badge>'+t("newBadge")+'</span>';
    if(anchor)anchor.insertAdjacentElement("afterend",btn);else card.appendChild(btn);
  }

  function translate(root){
    (root||document).querySelectorAll("[data-adfilm-i18n]").forEach(function(el){var k=el.getAttribute("data-adfilm-i18n");if(k)el.textContent=t(k)});
    (root||document).querySelectorAll("[data-adfilm-placeholder]").forEach(function(el){var k=el.getAttribute("data-adfilm-placeholder");if(k)el.setAttribute("placeholder",t(k))});
    var n=document.querySelector("[data-adfilm-nav-label]");if(n)n.textContent=t("nav");
    var b=document.querySelector("[data-adfilm-nav-badge]");if(b)b.textContent=t("newBadge");
    updateAll();
  }

  function panelMarkup(){
    return ''+
      '<div class="adfilm-side-preview">'+
        '<section class="adfilm-live-card">'+
          '<div class="adfilm-live-card__head"><div><span>'+t("panelDraft")+'</span><h3>'+t("panelPreviewTitle")+'</h3></div><b data-panel-ratio>'+state.aspectRatio+'</b></div>'+
          '<div class="adfilm-preview-frame is-portrait" data-panel-frame>'+
            '<div class="adfilm-preview-media" data-panel-media><div class="adfilm-preview-fallback"><span></span><i></i><b></b></div></div>'+
            '<div class="adfilm-preview-shade"></div>'+
            '<div class="adfilm-preview-brandline"><span data-panel-brand>'+t("panelBrand")+'</span><em data-panel-quality>'+state.quality+'</em></div>'+
            '<div class="adfilm-preview-copy"><small data-panel-kicker>'+t("panelProduct")+'</small><h2 data-panel-title>'+t("panelProduct")+'</h2><p data-panel-description>'+t("panelAwaiting")+'</p><button type="button" tabindex="-1" data-panel-cta>'+t("panelCta")+'</button></div>'+
            '<div class="adfilm-preview-logo" data-panel-logo hidden></div>'+
            '<div class="adfilm-preview-timeline"><span></span><span></span><span></span><span></span></div>'+
            '<div class="adfilm-preview-play"><svg viewBox="0 0 24 24" fill="none"><path d="m9 6 9 6-9 6V6Z" fill="currentColor"/></svg></div>'+
          '</div>'+
        '</section>'+
        '<section class="adfilm-readiness-card">'+
          '<div class="adfilm-side-title"><h3>'+t("panelReadiness")+'</h3><span data-panel-progress>1 / 3</span></div>'+
          '<div class="adfilm-readiness-list">'+
            '<div data-ready-item="brief"><span class="adfilm-ready-icon"></span><b>'+t("panelBrief")+'</b><em></em></div>'+
            '<div data-ready-item="media"><span class="adfilm-ready-icon"></span><b>'+t("panelMedia")+'</b><em></em></div>'+
            '<div data-ready-item="output"><span class="adfilm-ready-icon"></span><b>'+t("panelOutput")+'</b><em></em></div>'+
          '</div>'+
        '</section>'+
        '<section class="adfilm-spec-card">'+
          '<div class="adfilm-side-title"><h3>'+t("panelSpecs")+'</h3></div>'+
          '<div class="adfilm-spec-grid"><span><b data-panel-duration>'+state.duration+' sn</b><small>'+t("duration")+'</small></span><span><b data-panel-format>'+state.aspectRatio+'</b><small>'+t("format")+'</small></span><span><b data-panel-quality2>'+state.quality+'</b><small>'+t("quality")+'</small></span><span><b data-panel-voice>'+t("summaryVoice")+'</b><small>'+t("voiceNarration")+'</small></span></div>'+
          '<p><span aria-hidden="true">✦</span>'+t("panelEngine")+'</p>'+
        '</section>'+
      '</div>';
  }

  function renderPanel(wrap){
    if(!wrap)return;
    activePanelWrap=wrap;
    wrap.innerHTML=panelMarkup();
    updatePanel();
  }

  function registerPanel(){
    if(!window.RightPanel||window.RightPanel._has("adfilm"))return;
    window.RightPanel.register("adfilm",{
      getHeader:function(){return{title:t("panelTitle"),meta:t(isPreview()?"panelMetaPreview":"panelMeta"),searchEnabled:false,resetSearch:true}},
      mount:function(w){renderPanel(w)},
      onShow:function(p,api){
        api&&api.setHeader&&api.setHeader({title:t("panelTitle"),meta:t(isPreview()?"panelMetaPreview":"panelMeta"),searchEnabled:false});
        var w=document.querySelector('.rpPanelWrap[data-panel-key="adfilm"]');if(w)renderPanel(w)
      }
    });
  }

  function setText(scope,selector,value){var el=scope&&scope.querySelector(selector);if(el)el.textContent=value}
  function clean(v){return String(v||"").trim()}
  function briefReady(){return clean(state.productName).length>0&&clean(state.description).length>=10}
  function mediaReady(){return state.files.productImages.length>0}
  function outputReady(){return !!state.duration&&!!state.aspectRatio&&!!state.quality}
  function allReady(){return briefReady()&&mediaReady()&&outputReady()}

  function setReadyItem(key,on){
    if(!activePanelWrap)return;
    var item=activePanelWrap.querySelector('[data-ready-item="'+key+'"]');if(!item)return;
    item.classList.toggle("is-ready",on);
    var em=item.querySelector("em");if(em)em.textContent=t(on?"panelReady":"panelMissing");
  }

  function ratioClass(){return state.aspectRatio==="1:1"?"is-square":state.aspectRatio==="16:9"?"is-wide":state.aspectRatio==="4:5"?"is-post":"is-portrait"}

  function updatePanel(){
    if(!activePanelWrap||!activePanelWrap.isConnected)return;
    var product=clean(state.productName)||t("panelProduct");
    var brand=clean(state.brandName)||t("panelBrand");
    var description=clean(state.description)||t("panelAwaiting");
    var cta=clean(state.cta)||t("panelCta");
    setText(activePanelWrap,"[data-panel-title]",product);
    setText(activePanelWrap,"[data-panel-brand]",brand.toUpperCase());
    setText(activePanelWrap,"[data-panel-kicker]",state.sceneStyle?String(state.sceneStyle).toUpperCase():t("panelProduct"));
    setText(activePanelWrap,"[data-panel-description]",description.length>105?description.slice(0,102)+"…":description);
    setText(activePanelWrap,"[data-panel-cta]",cta.toUpperCase());
    setText(activePanelWrap,"[data-panel-ratio]",state.aspectRatio);
    setText(activePanelWrap,"[data-panel-quality]",state.quality);
    setText(activePanelWrap,"[data-panel-duration]",state.duration+" sn");
    setText(activePanelWrap,"[data-panel-format]",state.aspectRatio);
    setText(activePanelWrap,"[data-panel-quality2]",state.quality);
    setText(activePanelWrap,"[data-panel-voice]",t(state.voiceEnabled?"summaryVoice":"summarySilent"));
    var frame=activePanelWrap.querySelector("[data-panel-frame]");if(frame){frame.classList.remove("is-portrait","is-square","is-wide","is-post");frame.classList.add(ratioClass())}
    var media=activePanelWrap.querySelector("[data-panel-media]");
    if(media){
      var url=state.urls.productImages[0]||"";
      media.classList.toggle("has-media",!!url);
      media.style.backgroundImage=url?'url("'+url.replace(/"/g,"%22")+'")':"";
    }
    var logo=activePanelWrap.querySelector("[data-panel-logo]");
    if(logo){var logoUrl=state.urls.logo[0]||"";logo.hidden=!logoUrl;logo.style.backgroundImage=logoUrl?'url("'+logoUrl.replace(/"/g,"%22")+'")':""}
    setReadyItem("brief",briefReady());setReadyItem("media",mediaReady());setReadyItem("output",outputReady());
    var readyCount=[briefReady(),mediaReady(),outputReady()].filter(Boolean).length;
    setText(activePanelWrap,"[data-panel-progress]",readyCount+" / 3");
    activePanelWrap.classList.toggle("is-project-ready",allReady());
  }

  function updateCount(root,key){var field=root.querySelector('[data-adfilm-input="'+key+'"]'),out=root.querySelector('[data-adfilm-count="'+key+'"]');if(field&&out)out.textContent=String(field.value||"").length}
  function updateSummary(root){
    root=root&&root.querySelector?root:activeRoot||document;
    var out=root.querySelector&&root.querySelector("[data-adfilm-summary]");if(out)out.textContent=state.duration+" sn · "+state.aspectRatio+" · "+state.quality+" · "+t(state.voiceEnabled?"summaryVoice":"summarySilent");
  }

  function updateTimeline(root){
    if(!root)return;
    var d=Number(state.duration)||15;
    var cuts=d===10?[0,2,5,8,10]:d===30?[0,5,15,24,30]:[0,3,8,12,15];
    root.querySelectorAll(".adfilm-scene__thumb span").forEach(function(el,i){var a=String(cuts[i]).padStart(2,"0"),b=String(cuts[i+1]).padStart(2,"0");el.textContent="00:"+a+"–00:"+b});
  }

  function updateValidation(root){
    if(!root)return;
    var build=root.querySelector("[data-adfilm-build]");if(build){build.disabled=!allReady();build.classList.toggle("is-ready",allReady())}
    root.querySelector(".adfilm-card--product")&&root.querySelector(".adfilm-card--product").classList.toggle("is-complete",briefReady());
    root.querySelector(".adfilm-card--media")&&root.querySelector(".adfilm-card--media").classList.toggle("is-complete",mediaReady());
  }

  function updateAll(){
    if(activeRoot){updateSummary(activeRoot);updateTimeline(activeRoot);updateValidation(activeRoot)}
    updatePanel();
    try{window.AIVOAdFilmPreviewState=JSON.parse(JSON.stringify({productName:state.productName,brandName:state.brandName,description:state.description,targetAudience:state.targetAudience,cta:state.cta,scriptMode:state.scriptMode,sceneStyle:state.sceneStyle,duration:state.duration,aspectRatio:state.aspectRatio,quality:state.quality,voiceEnabled:state.voiceEnabled,subtitles:state.subtitles,music:state.music,soundEffects:state.soundEffects,mediaCount:state.files.productImages.length}))}catch(_){}
  }

  function showInfo(message){
    try{if(window.toast&&typeof window.toast.info==="function"){window.toast.info(message);return}}catch(_){}
    console.info("[ADFILM]",message);
  }

  function revokeUrls(key){(state.urls[key]||[]).forEach(function(url){try{URL.revokeObjectURL(url)}catch(_){}});state.urls[key]=[]}
  function createUrls(key,files){revokeUrls(key);state.urls[key]=files.map(function(file){try{return URL.createObjectURL(file)}catch(_){return""}}).filter(Boolean)}

  function renderUploadThumbs(root,key){
    var input=root.querySelector('[data-adfilm-file="'+key+'"]');if(!input)return;
    var zone=input.closest(".adfilm-upload-zone");if(!zone)return;
    var old=zone.querySelector(".adfilm-upload-thumbs");if(old)old.remove();
    var urls=state.urls[key]||[];if(!urls.length)return;
    var tray=document.createElement("div");tray.className="adfilm-upload-thumbs";
    urls.slice(0,3).forEach(function(url){var thumb=document.createElement("span");thumb.style.backgroundImage='url("'+url.replace(/"/g,"%22")+'")';tray.appendChild(thumb)});
    if(urls.length>3){var more=document.createElement("b");more.textContent="+"+(urls.length-3);tray.appendChild(more)}
    zone.appendChild(tray);
  }

  function syncInputState(input){
    var key=input.getAttribute("data-adfilm-input");if(!key)return;
    if(input.type==="checkbox")state[key]=!!input.checked;else state[key]=input.value;
  }

  function bindModule(root){
    if(!root||root.__adfilmBound)return;root.__adfilmBound=true;activeRoot=root;
    translate(root);
    root.querySelectorAll("[data-adfilm-input]").forEach(function(input){syncInputState(input);input.addEventListener(input.tagName==="SELECT"||input.type==="checkbox"?"change":"input",function(){syncInputState(input);if(input.tagName==="TEXTAREA")updateCount(root,input.getAttribute("data-adfilm-input"));updateAll()})});
    ["description","narrationText"].forEach(function(k){updateCount(root,k)});

    root.querySelectorAll("[data-adfilm-choice]").forEach(function(group){
      group.addEventListener("click",function(e){
        var btn=e.target.closest("button[data-value]");if(!btn)return;e.preventDefault();
        group.querySelectorAll("button[data-value]").forEach(function(x){x.classList.toggle("is-selected",x===btn)});
        var key=group.getAttribute("data-adfilm-choice");state[key]=btn.getAttribute("data-value");
        if(key==="scriptMode"){var manual=root.querySelector("[data-adfilm-script-control]");if(manual)manual.hidden=state.scriptMode!=="manual"}
        updateAll();
      });
    });

    root.querySelectorAll("[data-adfilm-file]").forEach(function(input){
      input.addEventListener("change",function(){
        var key=input.getAttribute("data-adfilm-file"),files=Array.from(input.files||[]),max=key==="productImages"?6:1;
        if(files.length>max){input.value="";files=[];showInfo(t("tooManyFiles"))}
        state.files[key]=files;createUrls(key,files);
        var zone=input.closest(".adfilm-upload-zone");if(zone)zone.classList.toggle("has-file",files.length>0);
        var out=root.querySelector('[data-adfilm-file-count="'+key+'"]');if(out)out.textContent=files.length;
        renderUploadThumbs(root,key);
        var total=state.files.productImages.length+state.files.logo.length+state.files.extraMedia.length;
        var totalOut=root.querySelector("[data-adfilm-media-total]");if(totalOut)totalOut.textContent=total;
        updateAll();
      });
    });

    root.querySelectorAll("[data-adfilm-mode]").forEach(function(btn){btn.addEventListener("click",function(){var mode=btn.getAttribute("data-adfilm-mode");if(mode!=="basic"){showInfo(t("modeLocked"));return}root.querySelectorAll("[data-adfilm-mode]").forEach(function(x){var on=x===btn;x.classList.toggle("is-active",on);x.setAttribute("aria-selected",on?"true":"false")})})});
    root.querySelectorAll(".adfilm-scene").forEach(function(scene){scene.addEventListener("click",function(){root.querySelectorAll(".adfilm-scene").forEach(function(x){x.classList.toggle("is-active",x===scene)})})});
    var regenerate=root.querySelector("[data-adfilm-regenerate]");if(regenerate)regenerate.addEventListener("click",function(){var scenes=Array.from(root.querySelectorAll(".adfilm-scene"));scenes.forEach(function(x){x.classList.remove("is-active")});if(scenes.length)scenes[Math.floor(Math.random()*scenes.length)].classList.add("is-active")});
    var build=root.querySelector("[data-adfilm-build]");if(build)build.addEventListener("click",function(){if(build.disabled)return;showInfo(t("buildPreview"));root.classList.add("adfilm-build-flash");setTimeout(function(){root.classList.remove("adfilm-build-flash")},700)});
    updateAll();
  }

  async function openPreview(){
    var host=document.getElementById("moduleHost");if(!host)return;
    document.querySelectorAll("#leftMenu .navBtn").forEach(function(x){x.classList.remove("active","is-active")});
    var btn=document.querySelector("[data-adfilm-open]");if(btn)btn.classList.add("active","is-active");
    try{
      var r=await fetch("/modules/ad-film.html",{credentials:"same-origin",cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);
      var html=await r.text(),wrap=document.createElement("div");wrap.innerHTML=html;var root=wrap.querySelector("[data-module-root]")||wrap.firstElementChild;
      host.replaceChildren(root);host.setAttribute("data-active-module","adfilm");bindModule(root);registerPanel();window.RightPanel&&window.RightPanel.force&&window.RightPanel.force("adfilm",{});
      try{document.dispatchEvent(new CustomEvent("aivo:module-mounted",{detail:{key:"adfilm",host:host,root:root}}))}catch(_){}
    }catch(err){console.error("[ADFILM] preview load failed",err);host.innerHTML='<div class="placeholder"><div class="ph-title">'+t("developmentTitle")+'</div></div>'}
  }

  function refresh(){translate(document);if(window.RightPanel&&window.RightPanel.getCurrentKey&&window.RightPanel.getCurrentKey()==="adfilm")window.RightPanel.force("adfilm",{})}
  document.addEventListener("aivo:module-mounted",function(e){if(e&&e.detail&&e.detail.key==="adfilm")bindModule(e.detail.root)});
  document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("[data-adfilm-open]"):null;if(a){e.preventDefault();e.stopPropagation();openPreview();return}var l=e.target&&e.target.closest?e.target.closest("[data-aivo-language]"):null;if(l)setTimeout(refresh,0)},true);
  window.addEventListener("storage",function(e){if(e&&(e.key==="aivo_language"||e.key==="aivo_lang"))refresh()});

  function boot(){injectNav();registerPanel();translate(document)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
  var count=0,timer=setInterval(function(){count++;injectNav();registerPanel();if((document.querySelector("[data-adfilm-open]")&&window.RightPanel&&window.RightPanel._has("adfilm"))||count>80)clearInterval(timer)},100);
})();
