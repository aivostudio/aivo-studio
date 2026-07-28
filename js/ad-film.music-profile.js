/* =========================================================
   AIVO — AI REKLAM FILMI / MUSIC PROFILE
   Compact direction controls for Stable Audio 3 Small Music.
   UI and prompt profile only; generation API is connected later.
   ========================================================= */
(function AIVO_AD_FILM_MUSIC_PROFILE(){
  "use strict";
  if(window.__AIVO_AD_FILM_MUSIC_PROFILE__)return;
  window.__AIVO_AD_FILM_MUSIC_PROFILE__=true;

  var STYLE_KEY="aivo_adfilm_music_style_v1";
  var ENERGY_KEY="aivo_adfilm_music_energy_v1";
  var activeRoot=null;

  var COPY={
    tr:{
      musicAuto:"AIVO müziği hazırlasın",
      style:"Müzik Tarzı",
      energy:"Enerji",
      recommendation:"AIVO Önerisi",
      pop:"Pop",
      cinematic:"Sinematik",
      electronic:"Elektronik",
      classical:"Klasik",
      rnb:"R&B",
      latin:"Latin",
      calm:"Sakin",
      balanced:"Dengeli",
      strong:"Güçlü",
      suggested:"Öneri",
      note:"AIVO yalnız seçtiğin yönü kullanır; enstrüman, tempo, miks, giriş ve kapanışı reklam süresine göre otomatik hazırlar.",
      engine:"Müzik motoru",
      engineName:"Stable Audio 3 Small",
      automaticProfile:"Otomatik profil"
    },
    en:{
      musicAuto:"Let AIVO create the music",
      style:"Music Style",
      energy:"Energy",
      recommendation:"AIVO Suggestion",
      pop:"Pop",
      cinematic:"Cinematic",
      electronic:"Electronic",
      classical:"Classical",
      rnb:"R&B",
      latin:"Latin",
      calm:"Calm",
      balanced:"Balanced",
      strong:"Strong",
      suggested:"Suggestion",
      note:"AIVO follows only the direction you choose; instruments, tempo, mix, opening and ending are prepared automatically for the ad duration.",
      engine:"Music engine",
      engineName:"Stable Audio 3 Small",
      automaticProfile:"Automatic profile"
    }
  };

  function language(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function t(key){return(COPY[language()]&&COPY[language()][key])||COPY.tr[key]||key}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function read(key,fallback){try{return localStorage.getItem(key)||fallback}catch(_){return fallback}}
  function write(key,value){try{localStorage.setItem(key,value)}catch(_){} }
  function inputValue(scope,key){var el=scope.querySelector('[data-adfilm-input="'+key+'"]');return el?String(el.value||"").trim():""}
  function selected(scope,key){var el=scope.querySelector('[data-adfilm-choice="'+key+'"] .is-selected[data-value]');return el?String(el.getAttribute("data-value")||""):""}

  function normalize(text){
    return String(text||"").toLocaleLowerCase("tr-TR").replace(/[ıİ]/g,"i").replace(/[şŞ]/g,"s").replace(/[ğĞ]/g,"g").replace(/[üÜ]/g,"u").replace(/[öÖ]/g,"o").replace(/[çÇ]/g,"c");
  }

  function contains(text,words){return words.some(function(word){return text.indexOf(word)>=0})}

  function automaticProfile(scope){
    var text=normalize([
      inputValue(scope,"productName"),inputValue(scope,"brandName"),inputValue(scope,"description"),
      inputValue(scope,"targetAudience"),inputValue(scope,"cta"),inputValue(scope,"voiceStyle"),
      selected(scope,"sceneStyle")
    ].join(" "));

    var profile={style:"cinematic",energy:"balanced"};

    if(contains(text,["lastik","teker","otomobil","araba","motor","jant","servis","yedek parca","automotive","tire","car"]))profile={style:"electronic",energy:"strong"};
    else if(contains(text,["kahve","coffee","cafe","cay","çay","tatli","pastane","bakery"]))profile={style:"classical",energy:"calm"};
    else if(contains(text,["parfum","parfüm","kozmetik","makyaj","guzellik","beauty","fragrance","jewelry","mucevher"]))profile={style:"cinematic",energy:"balanced"};
    else if(contains(text,["cocuk","çocuk","oyuncak","kids","toy","bebek","baby"]))profile={style:"pop",energy:"strong"};
    else if(contains(text,["teknoloji","yapay zeka","uygulama","app","telefon","kulaklik","bilgisayar","software","saas","tech","ai "]))profile={style:"electronic",energy:"balanced"};
    else if(contains(text,["restoran","yemek","pizza","burger","mutfak","restaurant","food","menu"]))profile={style:"latin",energy:"balanced"};
    else if(contains(text,["spor","fitness","gym","ayakkabi","sneaker","koşu","kosu","sport"]))profile={style:"electronic",energy:"strong"};
    else if(contains(text,["otel","tatil","seyahat","turizm","hotel","travel","resort"]))profile={style:"cinematic",energy:"balanced"};
    else if(contains(text,["banka","sigorta","finans","emlak","hukuk","bank","insurance","finance","real estate"]))profile={style:"classical",energy:"balanced"};

    var scene=selected(scope,"sceneStyle");
    if(scene==="luxury")profile.style="classical";
    if(scene==="cinematic")profile.style="cinematic";
    if(scene==="social")profile.style="pop";
    if(scene==="minimal"&&profile.energy==="strong")profile.energy="balanced";

    var voice=normalize(inputValue(scope,"voiceStyle"));
    if(contains(voice,["enerjik","energetic"]))profile.energy="strong";
    if(contains(voice,["sakin","soft","calm","warm","sicak"]))profile.energy="calm";

    return profile;
  }

  function styleLabel(value){return t(value)||value}
  function energyLabel(value){return t(value)||value}

  function createProfile(){
    var box=document.createElement("div");
    box.className="adfilm-music-profile";
    box.setAttribute("data-adfilm-music-profile","");
    box.innerHTML=''+
      '<div class="adfilm-music-profile__group">'+
        '<div class="adfilm-music-profile__head"><b data-music-copy="style">'+t("style")+'</b><span class="adfilm-music-profile__resolved" data-music-resolved></span></div>'+
        '<div class="adfilm-music-profile__options" data-music-style-options>'+ 
          '<button type="button" data-music-style="auto" data-music-copy="recommendation">'+t("recommendation")+'</button>'+
          '<button type="button" data-music-style="pop" data-music-copy="pop">'+t("pop")+'</button>'+
          '<button type="button" data-music-style="cinematic" data-music-copy="cinematic">'+t("cinematic")+'</button>'+
          '<button type="button" data-music-style="electronic" data-music-copy="electronic">'+t("electronic")+'</button>'+
          '<button type="button" data-music-style="classical" data-music-copy="classical">'+t("classical")+'</button>'+
          '<button type="button" data-music-style="rnb" data-music-copy="rnb">'+t("rnb")+'</button>'+
          '<button type="button" data-music-style="latin" data-music-copy="latin">'+t("latin")+'</button>'+
        '</div>'+
      '</div>'+
      '<div class="adfilm-music-profile__group">'+
        '<div class="adfilm-music-profile__head"><b data-music-copy="energy">'+t("energy")+'</b></div>'+
        '<div class="adfilm-music-profile__options" data-music-energy-options>'+ 
          '<button type="button" data-music-energy="calm" data-music-copy="calm">'+t("calm")+'</button>'+
          '<button type="button" data-music-energy="balanced" data-music-copy="balanced">'+t("balanced")+'</button>'+
          '<button type="button" data-music-energy="strong" data-music-copy="strong">'+t("strong")+'</button>'+
        '</div>'+
      '</div>'+
      '<p class="adfilm-music-profile__note" data-music-copy="note">'+t("note")+'</p>'+
      '<div class="adfilm-music-profile__engine"><span data-music-copy="engine">'+t("engine")+'</span><b data-music-copy="engineName">'+t("engineName")+'</b></div>';
    return box;
  }

  function musicMode(scope){return scope&&scope.dataset.adfilmMusicMode||read("aivo_adfilm_music_mode_v1","auto")}

  function sync(scope){
    if(!scope)return;
    var box=scope.querySelector("[data-adfilm-music-profile]");
    if(!box)return;
    box.hidden=musicMode(scope)!=="auto";

    var style=read(STYLE_KEY,"auto");
    var energy=read(ENERGY_KEY,"balanced");
    var auto=automaticProfile(scope);
    var resolvedStyle=style==="auto"?auto.style:style;
    var resolvedEnergy=style==="auto"&&energy==="balanced"?auto.energy:energy;

    scope.querySelectorAll("[data-music-style]").forEach(function(button){button.classList.toggle("is-selected",button.getAttribute("data-music-style")===style)});
    scope.querySelectorAll("[data-music-energy]").forEach(function(button){button.classList.toggle("is-selected",button.getAttribute("data-music-energy")===energy)});

    var resolved=scope.querySelector("[data-music-resolved]");
    if(resolved)resolved.textContent=t("suggested")+": "+styleLabel(resolvedStyle)+" · "+energyLabel(resolvedEnergy);

    scope.dataset.adfilmMusicStyle=style;
    scope.dataset.adfilmMusicEnergy=energy;
    scope.dataset.adfilmMusicResolvedStyle=resolvedStyle;
    scope.dataset.adfilmMusicResolvedEnergy=resolvedEnergy;

    window.AIVOAdFilmMusicProfile={
      mode:musicMode(scope),style:style,energy:energy,resolvedStyle:resolvedStyle,resolvedEnergy:resolvedEnergy,
      engine:"fal-ai/stable-audio-3/small/music/text-to-audio"
    };
    scope.dispatchEvent(new CustomEvent("aivo:adfilm-music-profile",{bubbles:true,detail:window.AIVOAdFilmMusicProfile}));
  }

  function translate(scope){
    scope.querySelectorAll("[data-music-copy]").forEach(function(node){node.textContent=t(node.getAttribute("data-music-copy"))});
    var autoButton=scope.querySelector('[data-music-mode="auto"]');
    if(autoButton)autoButton.textContent=t("musicAuto");
    sync(scope);
  }

  function setup(scope){
    if(!scope||scope.__adfilmMusicProfileBound)return;
    var section=scope.querySelector("[data-adfilm-music-source]");
    var options=section&&section.querySelector("[data-adfilm-music-options]");
    if(!section||!options)return;
    scope.__adfilmMusicProfileBound=true;
    activeRoot=scope;

    var autoButton=options.querySelector('[data-music-mode="auto"]');
    if(autoButton){autoButton.removeAttribute("data-simple-copy");autoButton.textContent=t("musicAuto")}
    var profile=createProfile();
    options.insertAdjacentElement("afterend",profile);

    section.addEventListener("click",function(event){
      var styleButton=event.target.closest("[data-music-style]");
      if(styleButton){event.preventDefault();write(STYLE_KEY,styleButton.getAttribute("data-music-style")||"auto");sync(scope);return}
      var energyButton=event.target.closest("[data-music-energy]");
      if(energyButton){event.preventDefault();write(ENERGY_KEY,energyButton.getAttribute("data-music-energy")||"balanced");sync(scope);return}
      if(event.target.closest("[data-music-mode]"))setTimeout(function(){sync(scope)},0);
    });

    scope.addEventListener("input",function(event){if(event.target.closest("[data-adfilm-input]"))setTimeout(function(){sync(scope)},80)},true);
    scope.addEventListener("change",function(event){if(event.target.closest("[data-adfilm-input]"))setTimeout(function(){sync(scope)},80)},true);
    scope.addEventListener("click",function(event){if(event.target.closest("[data-adfilm-choice] button[data-value]"))setTimeout(function(){sync(scope)},30)},true);
    sync(scope);
  }

  function schedule(scope){setTimeout(function(){setup(scope||root())},180)}
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(event.detail.root)});
  window.addEventListener("storage",function(event){if(event&&(event.key==="aivo_language"||event.key==="aivo_lang")){if(activeRoot)translate(activeRoot)}});
  var observer=new MutationObserver(function(){var scope=root();if(scope&&!scope.__adfilmMusicProfileBound)schedule(scope)});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(root())},{once:true});else schedule(root());
})();
