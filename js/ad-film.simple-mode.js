/* =========================================================
   AIVO — AI REKLAM FILMI / SIMPLE MODE
   Keeps the main flow intentionally short and moves optional
   controls into a single collapsed Advanced Settings section.
   ========================================================= */
(function AIVO_AD_FILM_SIMPLE_MODE(){
  "use strict";
  if(window.__AIVO_AD_FILM_SIMPLE_MODE__) return;
  window.__AIVO_AD_FILM_SIMPLE_MODE__=true;

  var activeRoot=null;
  var musicObjectUrl="";
  var STORAGE_KEY="aivo_adfilm_advanced_open_v1";
  var MUSIC_MODE_KEY="aivo_adfilm_music_mode_v1";
  var MAX_AUDIO_BYTES=20*1024*1024;

  var COPY={
    tr:{
      advanced:"Gelişmiş Ayarlar",
      advancedSub:"İsteğe bağlı: görsel stil, kalite ve sahne planı.",
      optional:"İsteğe bağlı",
      automatic:"AIVO gerisini otomatik hazırlayacak",
      automaticSub:"Görsel stil, sahne planı, müzik dengesi ve geçişler ürün bilgilerine göre ayarlanır.",
      visualStyle:"Görsel Stil",
      visualStyleSub:"Varsayılan: Otomatik / Premium ürün görünümü.",
      outputDetails:"Ek Çıkış Ayarları",
      outputDetailsSub:"Kalite, altyazı ve ses efektlerini özelleştir.",
      scenePlan:"Sahne Planı",
      scenePlanSub:"Yalnız ayrıntılı kontrol gerektiğinde görüntüle veya yenile.",
      videoSettingsSub:"Yalnız süreyi ve yayın formatını seç.",
      optionalEyebrow:"İSTEĞE BAĞLI",
      mediaSimpleSub:"Ürün görsellerini ve logonu ekle.",
      musicTitle:"Reklam Müziği",
      musicSub:"Müziğin nasıl hazırlanacağını seç.",
      musicAuto:"AIVO müziği seçsin",
      musicUpload:"Kendi müziğim / jingle’ım",
      musicOff:"Müzik olmasın",
      chooseMusic:"Müzik veya jingle yükle",
      musicHint:"MP3, WAV, M4A, AAC veya OGG · En fazla 20 MB",
      musicRights:"Yüklediğin müziğin kullanım ve telif hakkına sahip olmalısın.",
      musicSelected:"Müzik dosyası seçildi.",
      musicRemoved:"Müzik dosyası kaldırıldı.",
      musicInvalid:"Desteklenen bir ses dosyası seç: MP3, WAV, M4A, AAC veya OGG.",
      musicTooLarge:"Müzik dosyası en fazla 20 MB olabilir.",
      noMusicFile:"Kendi müziğin seçili; dosyanı yüklemeyi unutma.",
      removeMusic:"Müzik dosyasını kaldır",
      playMusic:"Müziği oynat",
      pauseMusic:"Müziği duraklat"
    },
    en:{
      advanced:"Advanced Settings",
      advancedSub:"Optional: visual style, quality and scene plan.",
      optional:"Optional",
      automatic:"AIVO will prepare the rest automatically",
      automaticSub:"Visual style, scene plan, music balance and transitions are set from the product brief.",
      visualStyle:"Visual Style",
      visualStyleSub:"Default: Automatic / premium product look.",
      outputDetails:"Additional Output Settings",
      outputDetailsSub:"Customize quality, subtitles and sound effects.",
      scenePlan:"Scene Plan",
      scenePlanSub:"Open or refresh only when detailed control is needed.",
      videoSettingsSub:"Choose only the duration and publishing format.",
      optionalEyebrow:"OPTIONAL",
      mediaSimpleSub:"Add product images and your logo.",
      musicTitle:"Advertising Music",
      musicSub:"Choose how the music should be prepared.",
      musicAuto:"Let AIVO choose the music",
      musicUpload:"My own music / jingle",
      musicOff:"No music",
      chooseMusic:"Upload music or jingle",
      musicHint:"MP3, WAV, M4A, AAC or OGG · Up to 20 MB",
      musicRights:"You must own or have permission to use the uploaded music.",
      musicSelected:"Music file selected.",
      musicRemoved:"Music file removed.",
      musicInvalid:"Choose a supported audio file: MP3, WAV, M4A, AAC or OGG.",
      musicTooLarge:"The music file can be up to 20 MB.",
      noMusicFile:"Your own music is selected; remember to upload the file.",
      removeMusic:"Remove music file",
      playMusic:"Play music",
      pauseMusic:"Pause music"
    }
  };

  function lang(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }

  function t(key){return(COPY[lang()]&&COPY[lang()][key])||COPY.tr[key]||key}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}

  function toast(type,key){
    var message=t(key);
    try{
      var fn=window.toast&&window.toast[type];
      if(typeof fn==="function"){fn({message:message,duration:3000});return}
      if(typeof window.showToast==="function"){window.showToast(message,type,{duration:3000});return}
    }catch(_){}
    console.info("[ADFILM SIMPLE]",message);
  }

  function formatBytes(bytes){return Math.max(.1,(Number(bytes)||0)/1024/1024).toFixed(1)+" MB"}
  function formatTime(seconds){
    seconds=Number(seconds);
    if(!Number.isFinite(seconds)||seconds<0)seconds=0;
    var minutes=Math.floor(seconds/60);
    var rest=Math.floor(seconds%60);
    return minutes+":"+String(rest).padStart(2,"0");
  }

  function icon(name){
    if(name==="auto")return '<svg viewBox="0 0 24 24" fill="none"><path d="m12 3 1.8 4.8L19 9.5l-4.1 3.2 1.4 5.3-4.3-2.8L7.7 18l1.4-5.3L5 9.5l5.2-1.7L12 3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M18.5 3.5v4M16.5 5.5h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    if(name==="advanced")return '<svg viewBox="0 0 24 24" fill="none"><path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h8M16 18h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="16" cy="6" r="2" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="12" r="2" stroke="currentColor" stroke-width="1.8"/><circle cx="14" cy="18" r="2" stroke="currentColor" stroke-width="1.8"/></svg>';
    if(name==="output")return '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h8M16 17h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="16" cy="7" r="2" stroke="currentColor" stroke-width="1.7"/><circle cx="9" cy="12" r="2" stroke="currentColor" stroke-width="1.7"/><circle cx="14" cy="17" r="2" stroke="currentColor" stroke-width="1.7"/></svg>';
    if(name==="music")return '<svg viewBox="0 0 24 24" fill="none"><path d="M9 18V6l10-2v12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.8"/><circle cx="16" cy="16" r="3" stroke="currentColor" stroke-width="1.8"/></svg>';
    if(name==="trash")return '<svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V4h6v3M8 10v8M12 10v8M16 10v8M7 7l1 14h8l1-14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    if(name==="play")return '<svg viewBox="0 0 24 24" fill="none"><path d="m9 6 9 6-9 6V6Z" fill="currentColor"/></svg>';
    if(name==="pause")return '<svg viewBox="0 0 24 24" fill="none"><path d="M8 6v12M16 6v12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
    return '<svg viewBox="0 0 24 24" fill="none"><path d="m8 10 4 4 4-4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function heading(card,title,sub,eyebrow){
    if(!card)return;
    var head=card.querySelector(".adfilm-card__heading");
    if(!head)return;
    var eye=head.querySelector(".adfilm-card__eyebrow"),h2=head.querySelector("h2"),p=head.querySelector("p");
    if(eye){eye.removeAttribute("data-adfilm-i18n");eye.textContent=eyebrow||t("optionalEyebrow")}
    if(h2){h2.removeAttribute("data-adfilm-i18n");h2.textContent=title}
    if(p){p.removeAttribute("data-adfilm-i18n");p.textContent=sub}
  }

  function updateMediaCounter(scope){
    var products=scope.querySelector('[data-adfilm-file="productImages"]');
    var logo=scope.querySelector('[data-adfilm-file="logo"]');
    var total=(products?products.files.length:0)+(logo?logo.files.length:0);
    var counter=scope.querySelector(".adfilm-card--media .adfilm-card__counter");
    if(!counter)return;
    var number=counter.querySelector("[data-adfilm-media-total]");
    if(number)number.textContent=String(total);
    Array.from(counter.childNodes).forEach(function(node){if(node.nodeType===3)node.textContent=" / 7"});
  }

  function simplifyMedia(scope){
    var media=scope.querySelector(".adfilm-card--media");
    if(!media)return;
    var sub=media.querySelector(".adfilm-card__heading p");
    if(sub){sub.removeAttribute("data-adfilm-i18n");sub.setAttribute("data-simple-copy","mediaSimpleSub");sub.textContent=t("mediaSimpleSub")}
    var extra=media.querySelector('[data-adfilm-file="extraMedia"]');
    var zone=extra&&extra.closest(".adfilm-upload-zone");
    if(zone){zone.hidden=true;zone.classList.add("is-basic-hidden-extra")}
    updateMediaCounter(scope);
    scope.addEventListener("change",function(event){
      if(event.target&&event.target.closest('[data-adfilm-file="productImages"],[data-adfilm-file="logo"]')){
        setTimeout(function(){updateMediaCounter(scope)},0);
      }
    },true);
  }

  function musicMode(){try{return localStorage.getItem(MUSIC_MODE_KEY)||"auto"}catch(_){return"auto"}}
  function storeMusicMode(mode){try{localStorage.setItem(MUSIC_MODE_KEY,mode)}catch(_){} }
  function musicFile(scope){return scope.querySelector("[data-adfilm-music-file]")}
  function validAudio(file){return !!file&&(/^(audio\/(mpeg|wav|x-wav|mp4|aac|ogg))$/i.test(file.type)||/\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name||""))}

  function createMusicSource(){
    var section=document.createElement("section");
    section.className="adfilm-music-source adfilm-music-source--voice";
    section.setAttribute("data-adfilm-music-source","");
    section.innerHTML=''+
      '<div class="adfilm-music-source__head">'+
        '<span class="adfilm-music-source__icon" aria-hidden="true">'+icon("music")+'</span>'+
        '<div><b data-simple-copy="musicTitle">'+t("musicTitle")+'</b><small data-simple-copy="musicSub">'+t("musicSub")+'</small></div>'+
      '</div>'+
      '<div class="adfilm-music-options" data-adfilm-music-options>'+
        '<button type="button" data-music-mode="auto" data-simple-copy="musicAuto">'+t("musicAuto")+'</button>'+
        '<button type="button" data-music-mode="upload" data-simple-copy="musicUpload">'+t("musicUpload")+'</button>'+
        '<button type="button" data-music-mode="off" data-simple-copy="musicOff">'+t("musicOff")+'</button>'+
      '</div>'+
      '<div class="adfilm-custom-music" data-adfilm-custom-music hidden>'+
        '<label class="adfilm-custom-music__picker">'+
          '<input type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,.mp3,.wav,.m4a,.aac,.ogg" data-adfilm-music-file>'+
          '<span class="adfilm-custom-music__picker-icon" aria-hidden="true">'+icon("music")+'</span>'+
          '<span><b data-simple-copy="chooseMusic">'+t("chooseMusic")+'</b><small data-simple-copy="musicHint">'+t("musicHint")+'</small></span>'+
        '</label>'+
        '<div class="adfilm-custom-music__file" data-adfilm-music-file-view hidden>'+
          '<div class="adfilm-custom-music__file-head">'+
            '<span class="adfilm-custom-music__file-icon" aria-hidden="true">'+icon("music")+'</span>'+
            '<div><b data-adfilm-music-name></b><small data-adfilm-music-size></small></div>'+
            '<button type="button" data-adfilm-music-remove title="'+t("removeMusic")+'">'+icon("trash")+'</button>'+
          '</div>'+
          '<div class="adfilm-audio-preview" data-adfilm-audio-preview>'+
            '<button type="button" class="adfilm-audio-preview__play" data-adfilm-audio-play title="'+t("playMusic")+'">'+icon("play")+'</button>'+
            '<input type="range" min="0" max="1000" value="0" step="1" data-adfilm-audio-progress aria-label="Audio progress">'+
            '<span data-adfilm-audio-time>0:00 / 0:00</span>'+
            '<audio preload="metadata" data-adfilm-music-audio></audio>'+
          '</div>'+
        '</div>'+
        '<p class="adfilm-custom-music__rights"><span>!</span><span data-simple-copy="musicRights">'+t("musicRights")+'</span></p>'+
      '</div>';
    return section;
  }

  function clearMusicObjectUrl(){
    if(musicObjectUrl){try{URL.revokeObjectURL(musicObjectUrl)}catch(_){}musicObjectUrl=""}
  }

  function updateAudioPlayer(scope){
    var audio=scope.querySelector("[data-adfilm-music-audio]");
    var play=scope.querySelector("[data-adfilm-audio-play]");
    var progress=scope.querySelector("[data-adfilm-audio-progress]");
    var time=scope.querySelector("[data-adfilm-audio-time]");
    if(!audio||!play||!progress||!time)return;
    var duration=Number.isFinite(audio.duration)?audio.duration:0;
    var current=Number.isFinite(audio.currentTime)?audio.currentTime:0;
    progress.value=duration?String(Math.round(current/duration*1000)):"0";
    time.textContent=formatTime(current)+" / "+formatTime(duration);
    var playing=!audio.paused&&!audio.ended;
    play.innerHTML=icon(playing?"pause":"play");
    play.title=t(playing?"pauseMusic":"playMusic");
    play.classList.toggle("is-playing",playing);
  }

  function loadAudioPreview(scope,file){
    var audio=scope.querySelector("[data-adfilm-music-audio]");
    if(!audio)return;
    audio.pause();
    clearMusicObjectUrl();
    audio.removeAttribute("src");
    if(file){
      try{musicObjectUrl=URL.createObjectURL(file);audio.src=musicObjectUrl;audio.load()}catch(_){}
    }
    updateAudioPlayer(scope);
  }

  function syncMusicFile(scope){
    var input=musicFile(scope);
    var file=input&&input.files&&input.files[0];
    var picker=scope.querySelector(".adfilm-custom-music__picker");
    var view=scope.querySelector("[data-adfilm-music-file-view]");
    if(!picker||!view)return;
    picker.hidden=!!file;
    view.hidden=!file;
    var name=view.querySelector("[data-adfilm-music-name]");
    var size=view.querySelector("[data-adfilm-music-size]");
    if(name)name.textContent=file?file.name:"";
    if(size)size.textContent=file?formatBytes(file.size):"";
    var nextId=file?[file.name,file.size,file.lastModified].join("|"):"";
    if(view.dataset.audioFileId!==nextId){view.dataset.audioFileId=nextId;loadAudioPreview(scope,file||null)}
  }

  function setMusicMode(scope,mode,silent){
    mode=mode==="upload"||mode==="off"?mode:"auto";
    storeMusicMode(mode);
    scope.dataset.adfilmMusicMode=mode;
    scope.querySelectorAll("[data-music-mode]").forEach(function(button){
      button.classList.toggle("is-selected",button.getAttribute("data-music-mode")===mode);
    });
    var custom=scope.querySelector("[data-adfilm-custom-music]");
    if(custom)custom.hidden=mode!=="upload";
    var legacy=scope.querySelector('[data-adfilm-input="music"]');
    if(legacy){legacy.checked=mode!=="off";legacy.dispatchEvent(new Event("change",{bubbles:true}))}
    var audio=scope.querySelector("[data-adfilm-music-audio]");
    if(mode!=="upload"&&audio){audio.pause();updateAudioPlayer(scope)}
    if(mode==="upload")syncMusicFile(scope);
    if(!silent&&mode==="upload"&&!((musicFile(scope)||{}).files||[]).length)toast("info","noMusicFile");
  }

  function bindMusic(scope,section){
    if(!section||section.__musicBound)return;
    section.__musicBound=true;
    var audio=section.querySelector("[data-adfilm-music-audio]");
    var progress=section.querySelector("[data-adfilm-audio-progress]");

    section.addEventListener("click",function(event){
      var modeButton=event.target.closest("[data-music-mode]");
      if(modeButton){event.preventDefault();setMusicMode(scope,modeButton.getAttribute("data-music-mode"),false);return}

      var remove=event.target.closest("[data-adfilm-music-remove]");
      if(remove){
        event.preventDefault();
        var input=musicFile(scope);
        if(input){input.value="";input.dispatchEvent(new Event("change",{bubbles:true}))}
        syncMusicFile(scope);
        toast("success","musicRemoved");
        return;
      }

      var play=event.target.closest("[data-adfilm-audio-play]");
      if(play&&audio&&audio.src){
        event.preventDefault();
        if(audio.paused){var promise=audio.play();if(promise&&typeof promise.catch==="function")promise.catch(function(){})}
        else audio.pause();
      }
    });

    section.addEventListener("change",function(event){
      var input=event.target.closest("[data-adfilm-music-file]");
      if(!input)return;
      var file=input.files&&input.files[0];
      if(!file){syncMusicFile(scope);return}
      if(!validAudio(file)){input.value="";syncMusicFile(scope);toast("warning","musicInvalid");return}
      if(file.size>MAX_AUDIO_BYTES){input.value="";syncMusicFile(scope);toast("warning","musicTooLarge");return}
      syncMusicFile(scope);
      setMusicMode(scope,"upload",true);
      toast("success","musicSelected");
    },true);

    if(progress&&audio){
      progress.addEventListener("input",function(){
        if(Number.isFinite(audio.duration)&&audio.duration>0){audio.currentTime=Number(progress.value)/1000*audio.duration;updateAudioPlayer(scope)}
      });
      ["loadedmetadata","durationchange","timeupdate","play","pause","ended","emptied"].forEach(function(name){audio.addEventListener(name,function(){updateAudioPlayer(scope)})});
    }

    setMusicMode(scope,musicMode(),true);
    setTimeout(function(){syncMusicFile(scope)},320);
  }

  function makeAdvancedOutput(quality,toggles){
    var article=document.createElement("article");
    article.className="adfilm-card adfilm-card--advanced-output adfilm-card--optional";
    article.innerHTML='<div class="adfilm-card__head"><span class="adfilm-card__icon" aria-hidden="true">'+icon("output")+'</span><div class="adfilm-card__heading"><span class="adfilm-card__eyebrow">'+t("optionalEyebrow")+'</span><h2 data-simple-copy="outputDetails">'+t("outputDetails")+'</h2><p data-simple-copy="outputDetailsSub">'+t("outputDetailsSub")+'</p></div></div><div class="adfilm-advanced-output__body"></div>';
    var body=article.querySelector(".adfilm-advanced-output__body");
    if(quality)body.appendChild(quality);
    if(toggles)body.appendChild(toggles);
    return article;
  }

  function setup(scope){
    if(!scope||scope.__adfilmSimpleModeBound)return;
    var workspace=scope.querySelector(".adfilm-workspace");
    var voiceCard=scope.querySelector(".adfilm-card--voice");
    var styleCard=scope.querySelector(".adfilm-card--style");
    var settingsCard=scope.querySelector(".adfilm-card--settings");
    var storyboardCard=scope.querySelector(".adfilm-card--storyboard");
    var actionbar=scope.querySelector(".adfilm-actionbar");
    if(!workspace||!voiceCard||!styleCard||!settingsCard||!storyboardCard||!actionbar)return;

    scope.__adfilmSimpleModeBound=true;
    activeRoot=scope;
    scope.classList.add("is-simplified-basic");
    simplifyMedia(scope);

    var settingsEye=settingsCard.querySelector(".adfilm-card__eyebrow");
    if(settingsEye)settingsEye.textContent="04";
    var settingsSub=settingsCard.querySelector(".adfilm-card__heading p");
    if(settingsSub){settingsSub.removeAttribute("data-adfilm-i18n");settingsSub.setAttribute("data-simple-copy","videoSettingsSub");settingsSub.textContent=t("videoSettingsSub")}

    var quality=Array.from(settingsCard.querySelectorAll(".adfilm-setting-block")).find(function(block){return !!block.querySelector('[data-adfilm-i18n="quality"]')});
    var toggles=settingsCard.querySelector(".adfilm-toggle-grid");
    var legacyMusic=scope.querySelector('[data-adfilm-input="music"]');
    var legacyMusicLabel=legacyMusic&&legacyMusic.closest("label");
    if(legacyMusicLabel){legacyMusicLabel.hidden=true;legacyMusicLabel.classList.add("is-legacy-music-toggle")}

    var musicSource=createMusicSource();
    voiceCard.classList.add("adfilm-card--voice-has-music");
    voiceCard.appendChild(musicSource);

    styleCard.classList.add("adfilm-card--optional");
    heading(styleCard,t("visualStyle"),t("visualStyleSub"));
    storyboardCard.classList.add("adfilm-card--optional");
    heading(storyboardCard,t("scenePlan"),t("scenePlanSub"));

    var details=document.createElement("details");
    details.className="adfilm-simple-advanced";
    details.setAttribute("data-adfilm-advanced","");
    try{details.open=localStorage.getItem(STORAGE_KEY)==="1"}catch(_){}
    details.innerHTML='<summary><span class="adfilm-simple-advanced__icon" aria-hidden="true">'+icon("advanced")+'</span><span class="adfilm-simple-advanced__copy"><b data-simple-copy="advanced">'+t("advanced")+'</b><small data-simple-copy="advancedSub">'+t("advancedSub")+'</small></span><em data-simple-copy="optional">'+t("optional")+'</em><span class="adfilm-simple-advanced__chevron" aria-hidden="true">'+icon("chevron")+'</span></summary><div class="adfilm-simple-advanced__body"></div>';
    var advancedBody=details.querySelector(".adfilm-simple-advanced__body");
    advancedBody.appendChild(styleCard);
    advancedBody.appendChild(makeAdvancedOutput(quality,toggles));
    advancedBody.appendChild(storyboardCard);

    var auto=document.createElement("div");
    auto.className="adfilm-simple-auto";
    auto.setAttribute("data-adfilm-simple-auto","");
    auto.innerHTML='<span class="adfilm-simple-auto__icon" aria-hidden="true">'+icon("auto")+'</span><div><b data-simple-copy="automatic">'+t("automatic")+'</b><small data-simple-copy="automaticSub">'+t("automaticSub")+'</small></div><span class="adfilm-simple-auto__check">✓</span>';

    workspace.insertBefore(auto,actionbar);
    workspace.insertBefore(details,actionbar);
    details.addEventListener("toggle",function(){try{localStorage.setItem(STORAGE_KEY,details.open?"1":"0")}catch(_){} });
    bindMusic(scope,musicSource);
  }

  function refreshLanguage(){
    if(!activeRoot)return;
    activeRoot.querySelectorAll("[data-simple-copy]").forEach(function(node){var key=node.getAttribute("data-simple-copy");node.textContent=t(key)});
    heading(activeRoot.querySelector(".adfilm-card--style"),t("visualStyle"),t("visualStyleSub"));
    heading(activeRoot.querySelector(".adfilm-card--storyboard"),t("scenePlan"),t("scenePlanSub"));
    heading(activeRoot.querySelector(".adfilm-card--advanced-output"),t("outputDetails"),t("outputDetailsSub"));
    var remove=activeRoot.querySelector("[data-adfilm-music-remove]");if(remove)remove.title=t("removeMusic");
    updateAudioPlayer(activeRoot);
  }

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){setup(event.detail.root)},70)});
  window.addEventListener("storage",function(event){if(event&&(event.key==="aivo_language"||event.key==="aivo_lang"))setTimeout(refreshLanguage,60)});
  window.addEventListener("pagehide",clearMusicObjectUrl);
  var observer=new MutationObserver(function(){var scope=root();if(scope&&!scope.__adfilmSimpleModeBound)setTimeout(function(){setup(scope)},40)});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setup(root())},{once:true});else setup(root());
})();

/* Additive product-image picker: selecting again appends instead of replacing. */
(function AIVO_AD_FILM_APPEND_PRODUCT_IMAGES(){
  "use strict";
  if(window.__AIVO_AD_FILM_APPEND_PRODUCT_IMAGES__) return;
  window.__AIVO_AD_FILM_APPEND_PRODUCT_IMAGES__=true;

  var MAX=6;
  var previousByInput=new WeakMap();
  var redispatching=new WeakSet();

  function imageInput(target){return target&&target.closest?target.closest('[data-adfilm-file="productImages"]'):null}
  function list(input){return input?Array.from(input.files||[]):[]}
  function id(file){return[file.name||"",file.size||0,file.type||"",file.lastModified||0].join("|")}
  function toastMessage(message,type){
    try{
      var fn=window.toast&&window.toast[type||"info"];
      if(typeof fn==="function"){fn({message:message,duration:2600});return}
      if(typeof window.showToast==="function"){window.showToast(message,type||"info");return}
    }catch(_){}
  }
  function setFiles(input,files){
    var dt=new DataTransfer();
    files.forEach(function(file){dt.items.add(file)});
    redispatching.add(input);
    input.files=dt.files;
    input.dispatchEvent(new Event("change",{bubbles:true}));
  }
  function isEnglish(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}

  document.addEventListener("click",function(event){var input=imageInput(event.target);if(input)previousByInput.set(input,list(input))},true);
  document.addEventListener("change",function(event){
    var input=imageInput(event.target);
    if(!input)return;
    if(redispatching.has(input)){redispatching.delete(input);return}
    var previous=previousByInput.get(input);
    if(!previous)return;
    previousByInput.delete(input);
    var selected=list(input),known=new Set(previous.map(id)),added=[],duplicates=0;
    selected.forEach(function(file){var key=id(file);if(known.has(key)){duplicates++;return}known.add(key);added.push(file)});
    var room=Math.max(0,MAX-previous.length),accepted=added.slice(0,room),merged=previous.concat(accepted).slice(0,MAX);
    event.stopImmediatePropagation();
    setFiles(input,merged);
    if(accepted.length)toastMessage(isEnglish()?(accepted.length+" new image"+(accepted.length>1?"s were":" was")+" added."):(accepted.length+" yeni görsel eklendi."),"success");
    if(duplicates)toastMessage(isEnglish()?"Duplicate images were not added again.":"Aynı görsel tekrar eklenmedi.","info");
    if(added.length>accepted.length||(!accepted.length&&!duplicates&&previous.length>=MAX))toastMessage(isEnglish()?"You can add up to 6 product images.":"En fazla 6 ürün görseli ekleyebilirsin.","warning");
  },true);
})();
