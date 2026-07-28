/* =========================================================
   AIVO — AI REKLAM FILMI / MUSIC PROFILE
   Compact direction controls for Stable Audio 3 Small Music.
   Includes a no-cost preview mock test for the server prompt layer.
   ========================================================= */
(function AIVO_AD_FILM_MUSIC_PROFILE(){
  "use strict";
  if(window.__AIVO_AD_FILM_MUSIC_PROFILE__)return;
  window.__AIVO_AD_FILM_MUSIC_PROFILE__=true;

  var STYLE_KEY="aivo_adfilm_music_style_v1";
  var ENERGY_KEY="aivo_adfilm_music_energy_v1";
  var activeRoot=null;

  var COPY={
    tr:{musicAuto:"AIVO müziği hazırlasın",style:"Müzik Tarzı",energy:"Enerji",recommendation:"AIVO Önerisi",pop:"Pop",cinematic:"Sinematik",electronic:"Elektronik",classical:"Klasik",rnb:"R&B",latin:"Latin",calm:"Sakin",balanced:"Dengeli",strong:"Güçlü",suggested:"Öneri",engine:"Müzik motoru",engineName:"Stable Audio 3 Small",test:"Müzik motorunu test et",testing:"Ayarlar kontrol ediliyor…",testReady:"Motor ayarları doğru gönderildi",testFailed:"Motor testi başarısız",testHint:"Ücretsiz bağlantı testi — ses üretmez"},
    en:{musicAuto:"Let AIVO create the music",style:"Music Style",energy:"Energy",recommendation:"AIVO Suggestion",pop:"Pop",cinematic:"Cinematic",electronic:"Electronic",classical:"Classical",rnb:"R&B",latin:"Latin",calm:"Calm",balanced:"Balanced",strong:"Strong",suggested:"Suggestion",engine:"Music engine",engineName:"Stable Audio 3 Small",test:"Test music engine",testing:"Checking settings…",testReady:"Engine settings were sent correctly",testFailed:"Engine test failed",testHint:"Free connection test — does not generate audio"}
  };

  function language(){var html=String(document.documentElement.lang||"").toLowerCase(),stored="";try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}return stored==="en"||html.indexOf("en")===0?"en":"tr"}
  function t(key){return(COPY[language()]&&COPY[language()][key])||COPY.tr[key]||key}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function read(key,fallback){try{return localStorage.getItem(key)||fallback}catch(_){return fallback}}
  function write(key,value){try{localStorage.setItem(key,value)}catch(_){} }
  function inputValue(scope,key){var el=scope.querySelector('[data-adfilm-input="'+key+'"]');return el?String(el.value||"").trim():""}
  function selected(scope,key){var el=scope.querySelector('[data-adfilm-choice="'+key+'"] .is-selected[data-value]');return el?String(el.getAttribute("data-value")||""):""}
  function normalize(text){return String(text||"").toLocaleLowerCase("tr-TR").replace(/[ıİ]/g,"i").replace(/[şŞ]/g,"s").replace(/[ğĞ]/g,"g").replace(/[üÜ]/g,"u").replace(/[öÖ]/g,"o").replace(/[çÇ]/g,"c")}
  function contains(text,words){return words.some(function(word){return text.indexOf(word)>=0})}
  function toast(message,type){try{var api=window.toast||{};if(api[type]&&typeof api[type]==="function"){api[type](message);return}}catch(_){}console[type==="error"?"error":"log"]("[ADFILM MUSIC]",message)}

  function automaticProfile(scope){
    var text=normalize([inputValue(scope,"productName"),inputValue(scope,"brandName"),inputValue(scope,"description"),inputValue(scope,"targetAudience"),inputValue(scope,"cta"),inputValue(scope,"voiceStyle"),selected(scope,"sceneStyle")].join(" "));
    var profile={style:"cinematic",energy:"balanced"};
    if(contains(text,["lastik","teker","otomobil","araba","motor","jant","servis","yedek parca","automotive","tire","car"]))profile={style:"electronic",energy:"strong"};
    else if(contains(text,["kahve","coffee","cafe","cay","tatli","pastane","bakery"]))profile={style:"classical",energy:"calm"};
    else if(contains(text,["parfum","kozmetik","makyaj","guzellik","beauty","fragrance","jewelry","mucevher"]))profile={style:"cinematic",energy:"balanced"};
    else if(contains(text,["cocuk","oyuncak","kids","toy","bebek","baby"]))profile={style:"pop",energy:"strong"};
    else if(contains(text,["teknoloji","yapay zeka","uygulama","app","telefon","kulaklik","bilgisayar","software","saas","tech","ai "]))profile={style:"electronic",energy:"balanced"};
    else if(contains(text,["restoran","yemek","pizza","burger","mutfak","restaurant","food","menu"]))profile={style:"latin",energy:"balanced"};
    else if(contains(text,["spor","fitness","gym","ayakkabi","sneaker","kosu","sport"]))profile={style:"electronic",energy:"strong"};
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

  function createProfile(){
    var box=document.createElement("div");
    box.className="adfilm-music-profile";
    box.setAttribute("data-adfilm-music-profile","");
    box.innerHTML=''+
      '<label class="adfilm-music-profile__field"><b data-music-copy="style">'+t("style")+'</b><span class="adfilm-music-profile__select-wrap"><select data-music-style-select aria-label="'+t("style")+'">'+
        '<option value="auto">'+t("recommendation")+'</option><option value="pop">'+t("pop")+'</option><option value="cinematic">'+t("cinematic")+'</option><option value="electronic">'+t("electronic")+'</option><option value="classical">'+t("classical")+'</option><option value="rnb">'+t("rnb")+'</option><option value="latin">'+t("latin")+'</option>'+
      '</select></span></label>'+
      '<label class="adfilm-music-profile__field"><b data-music-copy="energy">'+t("energy")+'</b><span class="adfilm-music-profile__select-wrap"><select data-music-energy-select aria-label="'+t("energy")+'">'+
        '<option value="calm">'+t("calm")+'</option><option value="balanced">'+t("balanced")+'</option><option value="strong">'+t("strong")+'</option>'+
      '</select></span></label>'+
      '<div class="adfilm-music-profile__status"><span data-music-resolved></span><b>'+t("engineName")+'</b></div>'+
      '<div class="adfilm-music-profile__test" data-music-test-wrap hidden><button type="button" data-music-test><span>↗</span><b>'+t("test")+'</b></button><small>'+t("testHint")+'</small><output data-music-test-result></output></div>';
    return box;
  }

  function musicMode(scope){return scope&&scope.dataset.adfilmMusicMode||read("aivo_adfilm_music_mode_v1","auto")}

  function sync(scope){
    if(!scope)return;
    var box=scope.querySelector("[data-adfilm-music-profile]");if(!box)return;
    box.hidden=musicMode(scope)!=="auto";
    var style=read(STYLE_KEY,"auto"),energy=read(ENERGY_KEY,"balanced"),auto=automaticProfile(scope);
    var resolvedStyle=style==="auto"?auto.style:style;
    var resolvedEnergy=style==="auto"&&energy==="balanced"?auto.energy:energy;
    var styleSelect=scope.querySelector("[data-music-style-select]"),energySelect=scope.querySelector("[data-music-energy-select]");
    if(styleSelect)styleSelect.value=style;
    if(energySelect)energySelect.value=energy;
    var resolved=scope.querySelector("[data-music-resolved]");if(resolved)resolved.textContent=t("suggested")+": "+t(resolvedStyle)+" · "+t(resolvedEnergy);
    var testWrap=scope.querySelector("[data-music-test-wrap]");if(testWrap)testWrap.hidden=!document.body.classList.contains("adfilm-preview-unlocked");
    scope.dataset.adfilmMusicStyle=style;scope.dataset.adfilmMusicEnergy=energy;scope.dataset.adfilmMusicResolvedStyle=resolvedStyle;scope.dataset.adfilmMusicResolvedEnergy=resolvedEnergy;
    window.AIVOAdFilmMusicProfile={mode:musicMode(scope),style:style,energy:energy,resolvedStyle:resolvedStyle,resolvedEnergy:resolvedEnergy,engine:"fal-ai/stable-audio-3/small/music/text-to-audio"};
    scope.dispatchEvent(new CustomEvent("aivo:adfilm-music-profile",{bubbles:true,detail:window.AIVOAdFilmMusicProfile}));
  }

  function testPayload(scope){
    var profile=window.AIVOAdFilmMusicProfile||{};
    return {
      mock:true,
      productName:inputValue(scope,"productName"),
      brandName:inputValue(scope,"brandName"),
      description:inputValue(scope,"description"),
      targetAudience:inputValue(scope,"targetAudience"),
      cta:inputValue(scope,"cta"),
      voiceStyle:inputValue(scope,"voiceStyle"),
      visualStyle:selected(scope,"sceneStyle")||"premium",
      duration:Number(selected(scope,"duration")||10),
      musicStyle:profile.style||"auto",
      musicEnergy:profile.energy||"balanced",
      voiceEnabled:(scope.querySelector('[data-adfilm-input="voiceEnabled"]')||{}).checked!==false
    };
  }

  async function runMockTest(scope,button){
    if(!scope||!button||button.disabled)return;
    var result=scope.querySelector("[data-music-test-result]");
    button.disabled=true;button.classList.add("is-loading");
    if(result){result.className="";result.textContent=t("testing")}
    try{
      var response=await fetch("/api/providers/fal/audio/create?mock=1",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json","X-AIVO-Mock":"1"},
        body:JSON.stringify(testPayload(scope))
      });
      var data=await response.json().catch(function(){return{}});
      if(!response.ok||!data.ok)throw new Error(data.message||data.error||("HTTP "+response.status));
      var meta=data.meta||{};
      var summary=t(meta.resolved_style||"cinematic")+" · "+t(meta.resolved_energy||"balanced")+" · "+String(meta.duration||10)+" sn";
      if(result){result.className="is-success";result.textContent=t("testReady")+": "+summary}
      toast(t("testReady"),"success");
      try{console.info("[ADFILM MUSIC MOCK]",{payload:testPayload(scope),response:data})}catch(_){}
    }catch(error){
      if(result){result.className="is-error";result.textContent=t("testFailed")+": "+String(error&&error.message||error)}
      toast(t("testFailed"),"error");
    }finally{button.disabled=false;button.classList.remove("is-loading")}
  }

  function translate(scope){
    var style=scope.querySelector("[data-music-style-select]"),energy=scope.querySelector("[data-music-energy-select]");
    scope.querySelectorAll("[data-music-copy]").forEach(function(node){node.textContent=t(node.getAttribute("data-music-copy"))});
    if(style){style.options[0].text=t("recommendation");style.options[1].text=t("pop");style.options[2].text=t("cinematic");style.options[3].text=t("electronic");style.options[4].text=t("classical");style.options[5].text=t("rnb");style.options[6].text=t("latin")}
    if(energy){energy.options[0].text=t("calm");energy.options[1].text=t("balanced");energy.options[2].text=t("strong")}
    var autoButton=scope.querySelector('[data-music-mode="auto"]');if(autoButton)autoButton.textContent=t("musicAuto");
    var test=scope.querySelector("[data-music-test]");if(test){var b=test.querySelector("b");if(b)b.textContent=t("test")}
    var hint=scope.querySelector("[data-music-test-wrap] small");if(hint)hint.textContent=t("testHint");
    sync(scope);
  }

  function setup(scope){
    if(!scope||scope.__adfilmMusicProfileBound)return;
    var section=scope.querySelector("[data-adfilm-music-source]"),options=section&&section.querySelector("[data-adfilm-music-options]");
    if(!section||!options)return;
    scope.__adfilmMusicProfileBound=true;activeRoot=scope;
    var autoButton=options.querySelector('[data-music-mode="auto"]');if(autoButton){autoButton.removeAttribute("data-simple-copy");autoButton.textContent=t("musicAuto")}
    var profile=createProfile();options.insertAdjacentElement("afterend",profile);
    profile.addEventListener("change",function(event){
      if(event.target.matches("[data-music-style-select]")){write(STYLE_KEY,event.target.value||"auto");sync(scope)}
      if(event.target.matches("[data-music-energy-select]")){write(ENERGY_KEY,event.target.value||"balanced");sync(scope)}
    });
    profile.addEventListener("click",function(event){var button=event.target.closest("[data-music-test]");if(button){event.preventDefault();runMockTest(scope,button)}});
    section.addEventListener("click",function(event){if(event.target.closest("[data-music-mode]"))setTimeout(function(){sync(scope)},0)});
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
