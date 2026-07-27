/* =========================================================
   AIVO — AI REKLAM FILMI / OUTPUT DETAIL CONTROLS
   Clean slider-based subtitle and advertising SFX controls.
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
  var PACES=["slow","balanced","fast"];

  var COPY={
    tr:{
      subtitleFlow:"Altyazı Hızı",
      slow:"Yavaş",
      balanced:"Dengeli",
      fast:"Hızlı",
      subtitleHint:"Konuşma senkronu otomatik korunur.",
      sfxType:"Efekt Türleri",
      transition:"Geçiş",
      product:"Ürün",
      emphasis:"Vurgu",
      intensity:"Efekt Yoğunluğu",
      low:"Az",
      medium:"Dengeli",
      high:"Güçlü",
      voiceAuto:"Ses temizleme, EQ ve kompresör AIVO tarafından otomatik uygulanır."
    },
    en:{
      subtitleFlow:"Subtitle Speed",
      slow:"Slow",
      balanced:"Balanced",
      fast:"Fast",
      subtitleHint:"Speech synchronization is preserved automatically.",
      sfxType:"Effect Types",
      transition:"Transitions",
      product:"Product",
      emphasis:"Emphasis",
      intensity:"Effect Intensity",
      low:"Low",
      medium:"Balanced",
      high:"Strong",
      voiceAuto:"Voice cleanup, EQ and compression are applied automatically by AIVO."
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
      '<div class="adfilm-output-range__head">'+
        '<b data-output-copy="subtitleFlow">'+t("subtitleFlow")+'</b>'+
        '<em data-subtitle-pace-label>'+t("balanced")+'</em>'+
      '</div>'+
      '<div class="adfilm-output-range">'+
        '<input type="range" min="0" max="2" step="1" value="1" data-subtitle-pace-range aria-label="Subtitle speed">'+
        '<div class="adfilm-output-range__marks">'+
          '<span data-output-copy="slow">'+t("slow")+'</span>'+
          '<span data-output-copy="balanced">'+t("balanced")+'</span>'+
          '<span data-output-copy="fast">'+t("fast")+'</span>'+
        '</div>'+
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
        '<div class="adfilm-output-range__head"><b data-output-copy="intensity">'+t("intensity")+'</b><em data-sfx-level-label>'+t("medium")+'</em></div>'+
        '<div class="adfilm-output-range">'+
          '<input type="range" min="0" max="100" step="1" value="50" data-sfx-level aria-label="Sound effect intensity">'+
          '<div class="adfilm-output-range__marks"><span data-output-copy="low">'+t("low")+'</span><span data-output-copy="medium">'+t("medium")+'</span><span data-output-copy="high">'+t("high")+'</span></div>'+
        '</div>'+
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

  function paceLabel(value){
    return t(PACES[Math.max(0,Math.min(2,Number(value)||0))]);
  }

  function paintRange(input){
    if(!input)return;
    var min=Number(input.min)||0,max=Number(input.max)||100,value=Number(input.value)||0;
    var percent=max===min?0:(value-min)/(max-min)*100;
    input.style.setProperty("--range-fill",percent+"%");
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
    var paceIndex=Math.max(0,PACES.indexOf(pace));
    var paceRange=scope.querySelector("[data-subtitle-pace-range]");
    if(paceRange){paceRange.value=String(paceIndex);paintRange(paceRange)}
    var paceValue=scope.querySelector("[data-subtitle-pace-label]");
    if(paceValue)paceValue.textContent=paceLabel(paceIndex);

    var types=selectedTypes();
    scope.querySelectorAll("[data-sfx-types] button").forEach(function(button){button.classList.toggle("is-selected",types.indexOf(button.dataset.value)>=0)});

    var level=scope.querySelector("[data-sfx-level]");
    var saved=Number(read(KEYS.sfxIntensity,"50"));
    if(level){level.value=String(Number.isFinite(saved)?saved:50);paintRange(level)}
    var label=scope.querySelector("[data-sfx-level-label]");
    if(label)label.textContent=levelLabel(saved);
    syncDisabled(scope);
  }

  function translate(scope){
    scope.querySelectorAll("[data-output-copy]").forEach(function(node){node.textContent=t(node.getAttribute("data-output-copy"))});
    var pace=scope.querySelector("[data-subtitle-pace-range]");
    var paceValue=scope.querySelector("[data-subtitle-pace-label]");
    if(paceValue)paceValue.textContent=paceLabel(pace?pace.value:1);
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
      var typeButton=event.target.closest("[data-sfx-types] button");
      if(!typeButton)return;
      event.preventDefault();
      var types=selectedTypes();
      var value=typeButton.dataset.value;
      var index=types.indexOf(value);
      if(index>=0)types.splice(index,1);else types.push(value);
      if(!types.length)types=[value];
      write(KEYS.sfxTypes,types.join(","));
      sync(scope);
    });

    var paceRange=scope.querySelector("[data-subtitle-pace-range]");
    if(paceRange){
      paceRange.addEventListener("input",function(){
        var value=Math.max(0,Math.min(2,Number(paceRange.value)||0));
        write(KEYS.subtitlePace,PACES[value]);
        paintRange(paceRange);
        var label=scope.querySelector("[data-subtitle-pace-label]");
        if(label)label.textContent=paceLabel(value);
      });
      paceRange.addEventListener("change",function(){toast(t("subtitleFlow")+": "+paceLabel(paceRange.value))});
    }

    var level=scope.querySelector("[data-sfx-level]");
    if(level){
      level.addEventListener("input",function(){
        write(KEYS.sfxIntensity,level.value);
        paintRange(level);
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
