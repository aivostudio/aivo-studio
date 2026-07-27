/* =========================================================
   AIVO — AI REKLAM FILMI / OUTPUT DETAIL CONTROLS
   User-friendly subtitle animation and advertising SFX options.
   Technical voice processing remains automatic in Basic Mode.
   ========================================================= */
(function AIVO_AD_FILM_OUTPUT_CONTROLS(){
  "use strict";
  if(window.__AIVO_AD_FILM_OUTPUT_CONTROLS__) return;
  window.__AIVO_AD_FILM_OUTPUT_CONTROLS__=true;

  var KEYS={
    subtitlePace:"aivo_adfilm_subtitle_pace_v1",
    sfxTypes:"aivo_adfilm_sfx_types_v1",
    sfxIntensity:"aivo_adfilm_sfx_intensity_v1"
  };

  var COPY={
    tr:{
      subtitleFlow:"Altyazı Akışı",
      slow:"Yavaş",
      balanced:"Dengeli",
      fast:"Hızlı",
      subtitleHint:"Yalnız animasyon hızını değiştirir; konuşma senkronu otomatik korunur.",
      sfxType:"Efekt Türleri",
      transition:"Geçiş",
      product:"Ürün",
      emphasis:"Vurgu",
      intensity:"Efekt Yoğunluğu",
      low:"Az",
      medium:"Dengeli",
      high:"Güçlü",
      voiceAuto:"Ses temizleme, EQ, kompresör ve ses yüksekliği AIVO tarafından otomatik ayarlanır."
    },
    en:{
      subtitleFlow:"Subtitle Motion",
      slow:"Slow",
      balanced:"Balanced",
      fast:"Fast",
      subtitleHint:"Only changes the animation pace; speech synchronization stays automatic.",
      sfxType:"Effect Types",
      transition:"Transitions",
      product:"Product",
      emphasis:"Emphasis",
      intensity:"Effect Intensity",
      low:"Low",
      medium:"Balanced",
      high:"Strong",
      voiceAuto:"Voice cleanup, EQ, compression and loudness are adjusted automatically by AIVO."
    }
  };

  function language(){
    var html=String(document.documentElement.lang||"").toLowerCase();
    var stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function t(key){return(COPY[language()]&&COPY[language()][key])||COPY.tr[key]||key}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function read(key,fallback){try{return localStorage.getItem(key)||fallback}catch(_){return fallback}}
  function write(key,value){try{localStorage.setItem(key,value)}catch(_){} }

  function toast(message){
    try{
      if(window.toast&&typeof window.toast.success==="function"){window.toast.success({message:message,duration:1800});return}
      if(typeof window.showToast==="function"){window.showToast(message,"success",{duration:1800});return}
    }catch(_){}
  }

  function createSubtitleDetails(){
    var box=document.createElement("div");
    box.className="adfilm-output-detail adfilm-output-detail--subtitle";
    box.setAttribute("data-output-detail","subtitle");
    box.innerHTML=''+
      '<div class="adfilm-output-detail__title"><b data-output-copy="subtitleFlow">'+t("subtitleFlow")+'</b></div>'+
      '<div class="adfilm-mini-options" data-subtitle-pace>'+
        '<button type="button" data-value="slow" data-output-copy="slow">'+t("slow")+'</button>'+
        '<button type="button" data-value="balanced" data-output-copy="balanced">'+t("balanced")+'</button>'+
        '<button type="button" data-value="fast" data-output-copy="fast">'+t("fast")+'</button>'+
      '</div>'+
      '<small data-output-copy="subtitleHint">'+t("subtitleHint")+'</small>';
    return box;
  }

  function createSfxDetails(){
    var box=document.createElement("div");
    box.className="adfilm-output-detail adfilm-output-detail--sfx";
    box.setAttribute("data-output-detail","sfx");
    box.innerHTML=''+
      '<div class="adfilm-output-detail__title"><b data-output-copy="sfxType">'+t("sfxType")+'</b></div>'+
      '<div class="adfilm-mini-options adfilm-mini-options--multi" data-sfx-types>'+
        '<button type="button" data-value="transition" data-output-copy="transition">'+t("transition")+'</button>'+
        '<button type="button" data-value="product" data-output-copy="product">'+t("product")+'</button>'+
        '<button type="button" data-value="emphasis" data-output-copy="emphasis">'+t("emphasis")+'</button>'+
      '</div>'+
      '<div class="adfilm-sfx-level">'+
        '<div class="adfilm-sfx-level__head"><b data-output-copy="intensity">'+t("intensity")+'</b><em data-sfx-level-label></em></div>'+
        '<input type="range" min="0" max="100" step="1" value="50" data-sfx-level aria-label="Sound effect intensity">'+
        '<div class="adfilm-sfx-level__marks"><span data-output-copy="low">'+t("low")+'</span><span data-output-copy="medium">'+t("medium")+'</span><span data-output-copy="high">'+t("high")+'</span></div>'+
      '</div>'+
      '<p class="adfilm-voice-auto-note"><span>✦</span><span data-output-copy="voiceAuto">'+t("voiceAuto")+'</span></p>';
    return box;
  }

  function selectedTypes(){
    var raw=read(KEYS.sfxTypes,"transition,product");
    return raw.split(",").filter(Boolean);
  }

  function levelLabel(value){
    value=Number(value)||0;
    return value<34?t("low"):value<67?t("medium"):t("high");
  }

  function syncDisabled(scope){
    var subtitles=scope.querySelector('[data-adfilm-input="subtitles"]');
    var sfx=scope.querySelector('[data-adfilm-input="soundEffects"]');
    var subtitleBox=scope.querySelector('[data-output-detail="subtitle"]');
    var sfxBox=scope.querySelector('[data-output-detail="sfx"]');
    if(subtitleBox)subtitleBox.classList.toggle("is-disabled",!!subtitles&&!subtitles.checked);
    if(sfxBox)sfxBox.classList.toggle("is-disabled",!!sfx&&!sfx.checked);
  }

  function sync(scope){
    var pace=read(KEYS.subtitlePace,"balanced");
    scope.querySelectorAll("[data-subtitle-pace] button").forEach(function(button){button.classList.toggle("is-selected",button.dataset.value===pace)});

    var types=selectedTypes();
    scope.querySelectorAll("[data-sfx-types] button").forEach(function(button){button.classList.toggle("is-selected",types.indexOf(button.dataset.value)>=0)});

    var level=scope.querySelector("[data-sfx-level]");
    var saved=Number(read(KEYS.sfxIntensity,"50"));
    if(level)level.value=String(Number.isFinite(saved)?saved:50);
    var label=scope.querySelector("[data-sfx-level-label]");
    if(label)label.textContent=levelLabel(saved);
    syncDisabled(scope);
  }

  function translate(scope){
    scope.querySelectorAll("[data-output-copy]").forEach(function(node){node.textContent=t(node.getAttribute("data-output-copy"))});
    var level=scope.querySelector("[data-sfx-level]");
    var label=scope.querySelector("[data-sfx-level-label]");
    if(label)label.textContent=levelLabel(level?level.value:50);
  }

  function setup(scope){
    if(!scope||scope.__adfilmOutputControlsBound)return;
    var output=scope.querySelector(".adfilm-card--advanced-output");
    var toggles=output&&output.querySelector(".adfilm-toggle-grid");
    if(!output||!toggles)return;

    var subtitleInput=toggles.querySelector('[data-adfilm-input="subtitles"]');
    var sfxInput=toggles.querySelector('[data-adfilm-input="soundEffects"]');
    var subtitleLabel=subtitleInput&&subtitleInput.closest("label");
    var sfxLabel=sfxInput&&sfxInput.closest("label");
    if(!subtitleLabel||!sfxLabel)return;

    scope.__adfilmOutputControlsBound=true;
    output.classList.add("adfilm-card--output-detailed");

    var subtitleGroup=document.createElement("section");
    subtitleGroup.className="adfilm-output-control-group";
    subtitleLabel.insertAdjacentElement("beforebegin",subtitleGroup);
    subtitleGroup.appendChild(subtitleLabel);
    subtitleGroup.appendChild(createSubtitleDetails());

    var sfxGroup=document.createElement("section");
    sfxGroup.className="adfilm-output-control-group";
    sfxLabel.insertAdjacentElement("beforebegin",sfxGroup);
    sfxGroup.appendChild(sfxLabel);
    sfxGroup.appendChild(createSfxDetails());

    subtitleInput.addEventListener("change",function(){syncDisabled(scope)});
    sfxInput.addEventListener("change",function(){syncDisabled(scope)});

    scope.addEventListener("click",function(event){
      var paceButton=event.target.closest("[data-subtitle-pace] button");
      if(paceButton){
        event.preventDefault();
        write(KEYS.subtitlePace,paceButton.dataset.value);
        sync(scope);
        return;
      }

      var typeButton=event.target.closest("[data-sfx-types] button");
      if(typeButton){
        event.preventDefault();
        var types=selectedTypes();
        var value=typeButton.dataset.value;
        var index=types.indexOf(value);
        if(index>=0)types.splice(index,1);else types.push(value);
        if(!types.length)types=[value];
        write(KEYS.sfxTypes,types.join(","));
        sync(scope);
      }
    });

    var level=scope.querySelector("[data-sfx-level]");
    if(level){
      level.addEventListener("input",function(){
        write(KEYS.sfxIntensity,level.value);
        var label=scope.querySelector("[data-sfx-level-label]");
        if(label)label.textContent=levelLabel(level.value);
      });
      level.addEventListener("change",function(){toast(t("intensity")+": "+levelLabel(level.value))});
    }

    sync(scope);
  }

  function schedule(scope){setTimeout(function(){setup(scope||root())},220)}
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(event.detail.root)});
  window.addEventListener("storage",function(event){if(event&&(event.key==="aivo_language"||event.key==="aivo_lang")){var scope=root();if(scope){translate(scope);sync(scope)}}});
  var observer=new MutationObserver(function(){var scope=root();if(scope&&!scope.__adfilmOutputControlsBound)schedule(scope)});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(root())},{once:true});else schedule(root());
})();
