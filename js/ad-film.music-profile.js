/* =========================================================
   AIVO — AI REKLAM FILMI / MUSIC PROFILE
   Compact controls for Stable Audio 3 Small Music.
   ========================================================= */
(function AIVO_AD_FILM_MUSIC_PROFILE(){
  "use strict";
  if(window.__AIVO_AD_FILM_MUSIC_PROFILE__)return;
  window.__AIVO_AD_FILM_MUSIC_PROFILE__=true;

  var STYLE_KEY="aivo_adfilm_music_style_v1";
  var ENERGY_KEY="aivo_adfilm_music_energy_v1";
  var activeRoot=null;
  var activePoll=false;

  var COPY={
    tr:{musicAuto:"AIVO müziği hazırlasın",style:"Müzik Tarzı",energy:"Enerji",recommendation:"AIVO Önerisi",pop:"Pop",cinematic:"Sinematik",electronic:"Elektronik",classical:"Klasik",rnb:"R&B",latin:"Latin",calm:"Sakin",balanced:"Dengeli",strong:"Güçlü",suggested:"Öneri",engineName:"Stable Audio 3 Small",test:"Bağlantıyı test et",testing:"Ayarlar kontrol ediliyor…",testReady:"Motor ayarları doğru gönderildi",testFailed:"Motor testi başarısız",testHint:"Ücretsiz — ses üretmez",generate:"Gerçek müzik üret",generating:"Müzik hazırlanıyor…",queued:"Üretim sırasına alındı",running:"Müzik oluşturuluyor",ready:"Reklam müziği hazır",generateFailed:"Müzik üretilemedi",realHint:"Gerçek Fal üretimi — seçilen süre kadar üretir",playLabel:"Üretilen reklam müziği"},
    en:{musicAuto:"Let AIVO create the music",style:"Music Style",energy:"Energy",recommendation:"AIVO Suggestion",pop:"Pop",cinematic:"Cinematic",electronic:"Electronic",classical:"Classical",rnb:"R&B",latin:"Latin",calm:"Calm",balanced:"Balanced",strong:"Strong",suggested:"Suggestion",engineName:"Stable Audio 3 Small",test:"Test connection",testing:"Checking settings…",testReady:"Engine settings were sent correctly",testFailed:"Engine test failed",testHint:"Free — does not generate audio",generate:"Generate real music",generating:"Preparing music…",queued:"Added to generation queue",running:"Creating music",ready:"Advertising music is ready",generateFailed:"Music generation failed",realHint:"Real Fal generation — uses selected duration",playLabel:"Generated advertising music"}
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
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
  function duration(scope){var value=Number(selected(scope,"duration")||10);return[5,10,15,20].indexOf(value)>=0?value:10}

  function automaticProfile(scope){
    var text=normalize([inputValue(scope,"productName"),inputValue(scope,"brandName"),inputValue(scope,"description"),inputValue(scope,"targetAudience"),inputValue(scope,"cta"),inputValue(scope,"voiceStyle"),selected(scope,"sceneStyle")].join(" "));
    var profile={style:"cinematic",energy:"balanced"};
    if(contains(text,["lastik","teker","otomobil","araba","motor","jant","servis","automotive","tire","car"]))profile={style:"electronic",energy:"strong"};
    else if(contains(text,["kahve","coffee","cafe","cay","tatli","pastane","bakery"]))profile={style:"classical",energy:"calm"};
    else if(contains(text,["parfum","kozmetik","makyaj","guzellik","beauty","fragrance","jewelry","mucevher"]))profile={style:"cinematic",energy:"balanced"};
    else if(contains(text,["cocuk","oyuncak","kids","toy","bebek","baby"]))profile={style:"pop",energy:"strong"};
    else if(contains(text,["teknoloji","yapay zeka","uygulama","app","telefon","kulaklik","bilgisayar","software","saas","tech"]))profile={style:"electronic",energy:"balanced"};
    else if(contains(text,["restoran","yemek","pizza","burger","mutfak","restaurant","food","menu"]))profile={style:"latin",energy:"balanced"};
    else if(contains(text,["spor","fitness","gym","ayakkabi","sneaker","kosu","sport"]))profile={style:"electronic",energy:"strong"};
    else if(contains(text,["otel","tatil","seyahat","turizm","hotel","travel","resort"]))profile={style:"cinematic",energy:"balanced"};
    else if(contains(text,["banka","sigorta","finans","emlak","hukuk","bank","insurance","finance","real estate"]))profile={style:"classical",energy:"balanced"};
    var scene=selected(scope,"sceneStyle");if(scene==="luxury")profile.style="classical";if(scene==="cinematic")profile.style="cinematic";if(scene==="social")profile.style="pop";if(scene==="minimal"&&profile.energy==="strong")profile.energy="balanced";
    var voice=normalize(inputValue(scope,"voiceStyle"));if(contains(voice,["enerjik","energetic"]))profile.energy="strong";if(contains(voice,["sakin","soft","calm","warm","sicak"]))profile.energy="calm";
    return profile;
  }

  function createProfile(){
    var box=document.createElement("div");box.className="adfilm-music-profile";box.setAttribute("data-adfilm-music-profile","");
    box.innerHTML=''+
      '<label class="adfilm-music-profile__field"><b>'+t("style")+'</b><span class="adfilm-music-profile__select-wrap"><select data-music-style-select><option value="auto">'+t("recommendation")+'</option><option value="pop">Pop</option><option value="cinematic">'+t("cinematic")+'</option><option value="electronic">'+t("electronic")+'</option><option value="classical">'+t("classical")+'</option><option value="rnb">R&B</option><option value="latin">Latin</option></select></span></label>'+
      '<label class="adfilm-music-profile__field"><b>'+t("energy")+'</b><span class="adfilm-music-profile__select-wrap"><select data-music-energy-select><option value="calm">'+t("calm")+'</option><option value="balanced">'+t("balanced")+'</option><option value="strong">'+t("strong")+'</option></select></span></label>'+
      '<div class="adfilm-music-profile__status"><span data-music-resolved></span><b>'+t("engineName")+'</b></div>'+
      '<div class="adfilm-music-profile__test" data-music-test-wrap hidden><div class="adfilm-music-profile__actions"><button type="button" data-music-test class="is-secondary"><span>✓</span><b>'+t("test")+'</b></button><button type="button" data-music-generate><span>▶</span><b data-music-generate-label></b></button></div><div class="adfilm-music-profile__hints"><small>'+t("testHint")+'</small><small>'+t("realHint")+'</small></div><output data-music-test-result></output><div class="adfilm-music-profile__audio" data-music-audio-wrap hidden><div><b>'+t("playLabel")+'</b><span data-music-audio-meta></span></div><audio controls preload="metadata" data-music-audio></audio></div></div>';
    return box;
  }

  function musicMode(scope){return scope&&scope.dataset.adfilmMusicMode||read("aivo_adfilm_music_mode_v1","auto")}
  function sync(scope){
    if(!scope)return;var box=scope.querySelector("[data-adfilm-music-profile]");if(!box)return;box.hidden=musicMode(scope)!=="auto";
    var style=read(STYLE_KEY,"auto"),energy=read(ENERGY_KEY,"balanced"),auto=automaticProfile(scope),resolvedStyle=style==="auto"?auto.style:style,resolvedEnergy=style==="auto"&&energy==="balanced"?auto.energy:energy;
    var styleSelect=scope.querySelector("[data-music-style-select]"),energySelect=scope.querySelector("[data-music-energy-select]");if(styleSelect)styleSelect.value=style;if(energySelect)energySelect.value=energy;
    var resolved=scope.querySelector("[data-music-resolved]");if(resolved)resolved.textContent=t("suggested")+": "+t(resolvedStyle)+" · "+t(resolvedEnergy);
    var label=scope.querySelector("[data-music-generate-label]");if(label)label.textContent=duration(scope)+" sn "+t("generate");
    var wrap=scope.querySelector("[data-music-test-wrap]");if(wrap)wrap.hidden=!document.body.classList.contains("adfilm-preview-unlocked");
    scope.dataset.adfilmMusicStyle=style;scope.dataset.adfilmMusicEnergy=energy;window.AIVOAdFilmMusicProfile={mode:musicMode(scope),style:style,energy:energy,resolvedStyle:resolvedStyle,resolvedEnergy:resolvedEnergy,engine:"fal-ai/stable-audio-3/small/music/text-to-audio"};
  }

  function basePayload(scope){var profile=window.AIVOAdFilmMusicProfile||{};return{productName:inputValue(scope,"productName"),brandName:inputValue(scope,"brandName"),description:inputValue(scope,"description"),targetAudience:inputValue(scope,"targetAudience"),cta:inputValue(scope,"cta"),voiceStyle:inputValue(scope,"voiceStyle"),visualStyle:selected(scope,"sceneStyle")||"premium",duration:duration(scope),musicStyle:profile.style||"auto",musicEnergy:profile.energy||"balanced",voiceEnabled:(scope.querySelector('[data-adfilm-input="voiceEnabled"]')||{}).checked!==false}}
  function setResult(scope,message,state){var result=scope.querySelector("[data-music-test-result]");if(result){result.className=state?"is-"+state:"";result.textContent=message||""}}
  function setBusy(scope,busy){scope.querySelectorAll("[data-music-test],[data-music-generate]").forEach(function(button){button.disabled=busy;button.classList.toggle("is-loading",busy)})}

  async function runMockTest(scope){setBusy(scope,true);setResult(scope,t("testing"),"");try{var payload=basePayload(scope);payload.mock=true;var response=await fetch("/api/providers/fal/audio/create?mock=1",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json","X-AIVO-Mock":"1"},body:JSON.stringify(payload)});var data=await response.json().catch(function(){return{}});if(!response.ok||!data.ok)throw new Error(data.message||data.error||("HTTP "+response.status));var meta=data.meta||{};setResult(scope,t("testReady")+": "+t(meta.resolved_style||"cinematic")+" · "+t(meta.resolved_energy||"balanced")+" · "+String(meta.duration||10)+" sn","success");toast(t("testReady"),"success")}catch(error){setResult(scope,t("testFailed")+": "+String(error&&error.message||error),"error")}finally{setBusy(scope,false)}}

  async function pollRealResult(scope,ticket){var started=Date.now();while(Date.now()-started<180000){await sleep(1800);var response=await fetch("/api/providers/fal/audio/status",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({preview_ticket:ticket})});var data=await response.json().catch(function(){return{}});if(!response.ok||!data.ok)throw new Error(data.message||data.error||("HTTP "+response.status));if(data.status==="COMPLETED"&&data.audio_url)return data;if(data.status==="FAILED")throw new Error(data.error||"fal_generation_failed");setResult(scope,data.status==="RUNNING"?t("running")+"…":t("queued")+"…","")}throw new Error("generation_timeout")}

  async function runRealTest(scope){
    if(!scope||activePoll)return;var chosenDuration=duration(scope),audioWrap=scope.querySelector("[data-music-audio-wrap]"),audio=scope.querySelector("[data-music-audio]"),metaNode=scope.querySelector("[data-music-audio-meta]");if(audio){audio.pause();audio.removeAttribute("src");audio.load()}if(audioWrap)audioWrap.hidden=true;setBusy(scope,true);setResult(scope,t("generating"),"");activePoll=true;
    try{var payload=basePayload(scope);payload.previewRealTest=true;var response=await fetch("/api/providers/fal/audio/create?preview_real_test=1",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json","X-AIVO-Preview-Real-Test":"1"},body:JSON.stringify(payload)});var data=await response.json().catch(function(){return{}});if(!response.ok||!data.ok)throw new Error(data.message||data.error||("HTTP "+response.status));if(!data.preview_ticket)throw new Error("missing_preview_ticket");setResult(scope,t("queued")+"…","");var completed=await pollRealResult(scope,data.preview_ticket);if(!completed.audio_url)throw new Error("missing_audio_url");if(audio){audio.src=completed.audio_url;audio.load()}if(metaNode){var profile=window.AIVOAdFilmMusicProfile||{};metaNode.textContent=t(profile.resolvedStyle||"cinematic")+" · "+t(profile.resolvedEnergy||"balanced")+" · "+chosenDuration+" sn"}if(audioWrap)audioWrap.hidden=false;setResult(scope,t("ready")+": "+chosenDuration+" sn","success");toast(t("ready"),"success")}
    catch(error){setResult(scope,t("generateFailed")+": "+String(error&&error.message||error),"error");toast(t("generateFailed"),"error")}
    finally{activePoll=false;setBusy(scope,false)}
  }

  function setup(scope){if(!scope||scope.__adfilmMusicProfileBound)return;var section=scope.querySelector("[data-adfilm-music-source]"),options=section&&section.querySelector("[data-adfilm-music-options]");if(!section||!options)return;scope.__adfilmMusicProfileBound=true;activeRoot=scope;var autoButton=options.querySelector('[data-music-mode="auto"]');if(autoButton){autoButton.removeAttribute("data-simple-copy");autoButton.textContent=t("musicAuto")}var profile=createProfile();options.insertAdjacentElement("afterend",profile);profile.addEventListener("change",function(event){if(event.target.matches("[data-music-style-select]"))write(STYLE_KEY,event.target.value||"auto");if(event.target.matches("[data-music-energy-select]"))write(ENERGY_KEY,event.target.value||"balanced");sync(scope)});profile.addEventListener("click",function(event){if(event.target.closest("[data-music-test]")){event.preventDefault();runMockTest(scope);return}if(event.target.closest("[data-music-generate]")){event.preventDefault();runRealTest(scope)}});scope.addEventListener("input",function(){setTimeout(function(){sync(scope)},50)},true);scope.addEventListener("change",function(){setTimeout(function(){sync(scope)},50)},true);scope.addEventListener("click",function(event){if(event.target.closest('[data-adfilm-choice] button[data-value]'))setTimeout(function(){sync(scope)},30)},true);sync(scope)}
  function schedule(scope){setTimeout(function(){setup(scope||root())},180)}
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(event.detail.root)});
  var observer=new MutationObserver(function(){var scope=root();if(scope&&!scope.__adfilmMusicProfileBound)schedule(scope)});observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(root())});else schedule(root());
})();
