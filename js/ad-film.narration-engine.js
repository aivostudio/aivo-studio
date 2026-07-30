/* =========================================================
   AIVO — AI REKLAM FILMI / NARRATION ENGINE
   TTS generation and mastering complete before preview.
   ========================================================= */
(function AIVO_AD_FILM_NARRATION_ENGINE(){
  "use strict";
  if(window.__AIVO_AD_FILM_NARRATION_ENGINE_V3__)return;
  window.__AIVO_AD_FILM_NARRATION_ENGINE_V3__=true;

  var controllers=new WeakMap();
  var VOICES=[
    ["warm_female","Sıcak kadın sesi","Warm female voice"],
    ["professional_male","Profesyonel erkek sesi","Professional male voice"],
    ["energetic_male","Enerjik erkek sesi","Energetic male voice"],
    ["clear_female","Net kadın sesi","Clear female voice"]
  ];
  var COPY={
    tr:{
      voice:"Ses",title:"Ses Ön İzleme",hint:"Metni onayladıktan sonra reklam sesini oluştur, dinle ve onayla.",
      idle:"Henüz ses oluşturulmadı.",creating:"Reklam sesi üretiliyor…",queued:"Reklam sesi üretiliyor…",
      running:"Reklam sesi üretiliyor…",mastering:"Ses profesyonel olarak işleniyor…",
      ready:"Reklam sesi hazır. Dinleyip onaylayabilirsin.",approved:"Ses onaylandı.",
      failed:"Ses hazırlanamadı. Tekrar deneyebilirsin.",create:"Sesi oluştur",regenerate:"Yeniden üret",
      generating:"Üretiliyor…",approve:"Sesi onayla",approvedButton:"Onaylandı",
      readyToast:"Ses hazır. Dinleyip onaylayabilirsin.",missingProject:"Bulut proje bağlantısı henüz hazır değil.",
      missingText:"Önce seslendirme metnini tamamla.",reviewText:"AIVO metnini önce kontrol edip onayla.",
      tooLong:"Metin seçilen video süresinden uzun.",requestFailed:"Ses üretimi başlatılamadı.",
      statusFailed:"Ses üretim durumu alınamadı.",masterFailed:"Ses profesyonel olarak hazırlanamadı. Tekrar deneyebilirsin.",
      fallback:"Ana ses servisi geçici sorun yaşadı; AIVO yedek motorla devam ediyor."
    },
    en:{
      voice:"Voice",title:"Voice Preview",hint:"After approving the script, generate, preview and approve the advertising voice.",
      idle:"No voice has been generated yet.",creating:"Generating the advertising voice…",queued:"Generating the advertising voice…",
      running:"Generating the advertising voice…",mastering:"Professionally processing the voice…",
      ready:"The advertising voice is ready. Preview and approve it.",approved:"Voice approved.",
      failed:"The voice could not be prepared. Try again.",create:"Generate voice",regenerate:"Generate again",
      generating:"Generating…",approve:"Approve voice",approvedButton:"Approved",
      readyToast:"Voice is ready. Preview and approve it.",missingProject:"The cloud project connection is not ready yet.",
      missingText:"Complete the narration script first.",reviewText:"Review and approve the AIVO script first.",
      tooLong:"The script is longer than the selected video duration.",requestFailed:"Voice generation could not be started.",
      statusFailed:"Voice generation status could not be loaded.",masterFailed:"The voice could not be professionally prepared. Try again.",
      fallback:"The primary voice service had a temporary issue; AIVO is continuing with its backup engine."
    }
  };

  function lang(){var html=String(document.documentElement.lang||"").toLowerCase(),stored="";try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}return stored==="en"||html.indexOf("en")===0?"en":"tr"}
  function t(key){return(COPY[lang()]&&COPY[lang()][key])||COPY.tr[key]||key}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function field(scope,key){return scope&&scope.querySelector('[data-adfilm-input="'+key+'"]')}
  function value(scope,key,fallback){var input=field(scope,key);return input?(input.type==="checkbox"?!!input.checked:input.value):fallback}
  function selected(scope,key,fallback){var button=scope&&scope.querySelector('[data-adfilm-choice="'+key+'"] .is-selected[data-value]');return button?button.getAttribute("data-value"):fallback}
  function clean(input){return String(input==null?"":input).trim()}
  function projectId(scope){return clean(scope&&scope.dataset.adfilmProjectId||window.AIVOAdFilmActiveProject&&window.AIVOAdFilmActiveProject.id)}
  function notify(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function"){fn({message:message,duration:3600});return}if(typeof window.showToast==="function")window.showToast(message,type||"info")}catch(_){}}
  function escapeHtml(value){return String(value||"").replace(/[&<>"']/g,function(ch){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]})}

  async function request(path,options){
    var response=await fetch(path,Object.assign({credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"}},options||{}));
    var data={};try{data=await response.json()}catch(_){data={ok:false,error:"invalid_json"}}
    if(!response.ok){var error=new Error(data&&data.message||data&&data.error||("HTTP "+response.status));error.status=response.status;error.data=data;throw error}
    return data;
  }

  function controller(scope){
    var current=controllers.get(scope);
    if(!current){current={timer:null,busy:false,mastering:false};controllers.set(scope,current)}
    return current;
  }
  function stopPolling(scope){var current=controller(scope);if(current.timer){clearTimeout(current.timer);current.timer=null}}

  function ensureVoiceSelect(scope){
    var card=scope.querySelector(".adfilm-card--voice"),fields=card&&card.querySelector(".adfilm-fields--compact");
    if(!fields)return null;
    var existing=field(scope,"voice");if(existing)return existing;
    var label=document.createElement("label");label.className="adfilm-control adfilm-narration-voice-control";label.setAttribute("data-adfilm-narration-voice-control","");
    var options=VOICES.map(function(item){return '<option value="'+item[0]+'">'+escapeHtml(lang()==="en"?item[2]:item[1])+'</option>'}).join("");
    label.innerHTML='<span data-narration-engine-copy="voice">'+t("voice")+'</span><select data-adfilm-input="voice">'+options+'</select>';
    var style=field(scope,"voiceStyle"),styleLabel=style&&style.closest("label");
    if(styleLabel)styleLabel.insertAdjacentElement("afterend",label);else fields.appendChild(label);
    return label.querySelector("select");
  }

  function panelMarkup(){
    return '<section class="adfilm-narration-engine" data-adfilm-narration-engine data-state="idle">'+
      '<div class="adfilm-narration-engine__head"><div><span class="adfilm-narration-engine__spark">✦</span><div><b data-narration-engine-copy="title">'+t("title")+'</b><p data-narration-engine-copy="hint">'+t("hint")+'</p></div></div><em data-narration-engine-state>'+t("idle")+'</em></div>'+
      '<div class="adfilm-narration-engine__player" data-narration-engine-player hidden><audio preload="metadata" controls data-narration-audio></audio></div>'+
      '<div class="adfilm-narration-engine__actions"><button type="button" data-narration-create>'+t("create")+'</button><button type="button" data-narration-audio-approve disabled>'+t("approve")+'</button></div>'+
    '</section>';
  }
  function ensurePanel(scope){
    var card=scope.querySelector(".adfilm-card--voice");if(!card)return null;
    var panel=card.querySelector("[data-adfilm-narration-engine]");
    if(!panel){card.insertAdjacentHTML("beforeend",panelMarkup());panel=card.querySelector("[data-adfilm-narration-engine]")}
    return panel;
  }

  function setCreateButton(scope,busy){
    var panel=ensurePanel(scope),button=panel&&panel.querySelector("[data-narration-create]");if(!button)return;
    button.disabled=!!busy;
    button.classList.toggle("is-processing",!!busy);
    button.setAttribute("aria-busy",busy?"true":"false");
    if(busy)button.innerHTML='<span class="adfilm-approve-spinner" aria-hidden="true"></span><span>'+t("generating")+'</span>';
    else{
      var audio=panel.querySelector("[data-narration-audio]");
      button.textContent=audio&&audio.src?t("regenerate"):t("create");
    }
  }
  function setState(scope,state,message){
    var panel=ensurePanel(scope);if(!panel)return;
    panel.dataset.state=state;
    var label=panel.querySelector("[data-narration-engine-state]");if(label)label.textContent=message||t(state);
  }
  function hidePreview(scope){
    var panel=ensurePanel(scope);if(!panel)return;
    var player=panel.querySelector("[data-narration-engine-player]"),audio=panel.querySelector("[data-narration-audio]"),approve=panel.querySelector("[data-narration-audio-approve]");
    if(audio){try{audio.pause()}catch(_){} }
    if(player)player.hidden=true;
    if(approve){approve.disabled=true;approve.classList.remove("is-approved","is-processing","is-approving");approve.textContent=t("approve")}
  }
  function setGenerating(scope,state){
    var current=controller(scope);current.busy=true;
    window.__AIVO_AD_FILM_NARRATION_GENERATION_BUSY__=true;
    hidePreview(scope);setCreateButton(scope,true);setState(scope,state||"running",t(state||"running"));
  }
  function stopGenerating(scope){
    var current=controller(scope);current.busy=false;current.mastering=false;
    window.__AIVO_AD_FILM_NARRATION_GENERATION_BUSY__=false;
    setCreateButton(scope,false);
  }

  function showAudio(scope,audio){
    var panel=ensurePanel(scope),player=panel&&panel.querySelector("[data-narration-engine-player]"),element=panel&&panel.querySelector("[data-narration-audio]"),approve=panel&&panel.querySelector("[data-narration-audio-approve]");
    if(!panel||!player||!element)return false;
    var ready=!!(audio&&audio.url&&(audio.mastered===true||audio.approved===true));
    if(!ready){player.hidden=true;if(approve)approve.disabled=true;return false}
    var url=clean(audio.url);
    if(url&&element.src!==url)element.src=url;
    player.hidden=false;
    if(approve){approve.disabled=!!audio.approved;approve.classList.toggle("is-approved",!!audio.approved);approve.textContent=audio.approved?t("approvedButton"):t("approve")}
    setState(scope,audio.approved?"approved":"ready",audio.approved?t("approved"):t("ready"));
    setCreateButton(scope,false);
    return true;
  }

  function payload(scope){return{
    projectId:projectId(scope),text:clean(value(scope,"narrationText","")),language:clean(value(scope,"language","tr")),
    voice:clean(value(scope,"voice","warm_female")),voiceStyle:clean(value(scope,"voiceStyle","warm")),
    speed:clean(value(scope,"voiceSpeed","balanced")),flow:clean(value(scope,"voiceFlow","natural")),
    duration:Number(selected(scope,"duration","10"))||10
  }}
  function validate(scope,data){
    if(!data.projectId){notify(t("missingProject"),"warning");return false}
    if(data.text.length<3){notify(t("missingText"),"warning");return false}
    var guide=window.AIVOAdFilmNarrationGuideState||{};
    if(guide.overLimit){notify(t("tooLong"),"warning");return false}
    if(guide.mode==="ai"&&!guide.approved){notify(t("reviewText"),"warning");return false}
    return true;
  }

  async function masterAndPresent(scope){
    var current=controller(scope);if(current.mastering)return;
    current.mastering=true;setGenerating(scope,"mastering");
    try{
      var id=projectId(scope);
      var data=await request("/api/ad-film/narration/master",{method:"POST",body:JSON.stringify({projectId:id})});
      if(!data.project||!data.audio||data.audio.mastered!==true)throw new Error("narration_master_incomplete");
      window.AIVOAdFilmActiveProject=data.project;
      stopPolling(scope);stopGenerating(scope);
      showAudio(scope,data.audio);
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:data.project,projectId:data.project.id||"",media:data.project.media||{}}}));
      notify(t("readyToast"),"success");
    }catch(error){
      console.error("[ADFILM] narration mastering",error);
      stopPolling(scope);stopGenerating(scope);hidePreview(scope);setState(scope,"failed",t("failed"));notify(t("masterFailed"),"warning");
    }
  }

  function schedulePoll(scope,attempt){var current=controller(scope);stopPolling(scope);current.timer=setTimeout(function(){poll(scope,attempt||0)},1800)}
  async function poll(scope,attempt){
    var id=projectId(scope);if(!id||!scope.isConnected)return;
    try{
      var data=await request("/api/ad-film/narration/status?projectId="+encodeURIComponent(id),{method:"GET"});
      if(data.fallback_used)notify(t("fallback"),"info");
      if(data.status==="COMPLETED"){
        stopPolling(scope);
        if(data.audio&&data.audio.mastered===true){
          stopGenerating(scope);showAudio(scope,data.audio);notify(t("readyToast"),"success");
        }else await masterAndPresent(scope);
        return;
      }
      if(data.status==="FAILED"){
        stopPolling(scope);stopGenerating(scope);hidePreview(scope);setState(scope,"failed",t("failed"));return;
      }
      setGenerating(scope,data.status==="IN_QUEUE"?"queued":"running");
      if((attempt||0)<180)schedulePoll(scope,(attempt||0)+1);
      else{stopPolling(scope);stopGenerating(scope);setState(scope,"failed",t("statusFailed"));notify(t("statusFailed"),"warning")}
    }catch(error){
      console.error("[ADFILM] narration status",error);
      if((attempt||0)<3)schedulePoll(scope,(attempt||0)+1);
      else{stopPolling(scope);stopGenerating(scope);setState(scope,"failed",t("statusFailed"));notify(t("statusFailed"),"warning")}
    }
  }

  async function create(scope){
    var data=payload(scope);if(!validate(scope,data))return;
    stopPolling(scope);setGenerating(scope,"creating");
    try{
      var result=await request("/api/ad-film/narration/create",{method:"POST",body:JSON.stringify(data)});
      var current=window.AIVOAdFilmActiveProject||{};
      window.AIVOAdFilmActiveProject=Object.assign({},current,{narration:result.narration||current.narration,narrationGeneration:Object.assign({},current.narrationGeneration||{},{status:"queued"})});
      setGenerating(scope,"queued");schedulePoll(scope,0);
    }catch(error){
      console.error("[ADFILM] narration create",error);
      stopGenerating(scope);setState(scope,"failed",t("failed"));
      notify(error&&error.data&&error.data.error==="narration_too_long"?t("tooLong"):t("requestFailed"),"warning");
    }
  }

  function augmentProject(scope,project){var next=Object.assign({},project||{}),narration=Object.assign({},next.narration||{});narration.voice=clean(value(scope,"voice","warm_female"))||"warm_female";next.narration=narration;return next}
  function patchProjectApi(scope){var api=window.AIVOAdFilmProjects;if(!api||api.__narrationVoicePatched)return;api.__narrationVoicePatched=true;var createProject=api.createProject.bind(api),updateProject=api.updateProject.bind(api);api.createProject=function(project){return createProject(augmentProject(root()||scope,project))};api.updateProject=function(id,project){return updateProject(id,augmentProject(root()||scope,project))}}

  function applyProject(scope,project){
    if(!scope||!project)return;
    var voice=ensureVoiceSelect(scope),saved=clean(project.narration&&project.narration.voice)||"warm_female";
    if(voice&&Array.from(voice.options).some(function(option){return option.value===saved}))voice.value=saved;
    var current=controller(scope),status=clean(project.narrationGeneration&&project.narrationGeneration.status),audio=project.narration&&project.narration.audio||null;
    if(current.busy){setGenerating(scope,current.mastering?"mastering":status==="queued"?"queued":"running");return}
    if(status==="queued"||status==="processing"){
      setGenerating(scope,status==="queued"?"queued":"running");schedulePoll(scope,0);return;
    }
    if(audio&&audio.url&&!audio.mastered&&!audio.approved){
      setGenerating(scope,"mastering");masterAndPresent(scope);return;
    }
    if(!showAudio(scope,audio)){stopGenerating(scope);setState(scope,"idle",t("idle"))}
  }

  function translate(scope){
    if(!scope)return;
    scope.querySelectorAll("[data-narration-engine-copy]").forEach(function(node){node.textContent=t(node.getAttribute("data-narration-engine-copy"))});
    var voice=field(scope,"voice");if(voice)Array.from(voice.options).forEach(function(option){var item=VOICES.find(function(v){return v[0]===option.value});if(item)option.textContent=lang()==="en"?item[2]:item[1]});
    var current=controller(scope);if(current.busy){setGenerating(scope,current.mastering?"mastering":"running");return}
    applyProject(scope,window.AIVOAdFilmActiveProject||{});
  }
  function bind(scope){
    if(!scope||!scope.isConnected)return;
    ensureVoiceSelect(scope);ensurePanel(scope);patchProjectApi(scope);
    if(controllers.has(scope)){translate(scope);return}
    controller(scope);
    var panel=ensurePanel(scope);
    panel.addEventListener("click",function(event){var createButton=event.target.closest("[data-narration-create]");if(createButton){event.preventDefault();create(scope)}});
    scope.addEventListener("change",function(event){if(event.target===field(scope,"voice")){var current=window.AIVOAdFilmActiveProject;if(current)current.narration=Object.assign({},current.narration||{},{voice:event.target.value})}},true);
    applyProject(scope,window.AIVOAdFilmActiveProject||null);translate(scope);
  }

  var publicApi=window.AIVOAdFilmNarration||{};
  publicApi.createAudio=function(){var scope=root();return scope?create(scope):Promise.resolve(null)};
  publicApi.status=function(){var scope=root();return scope?poll(scope,0):Promise.resolve(null)};
  window.AIVOAdFilmNarration=publicApi;

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){bind(event.detail.root||root())},80)});
  document.addEventListener("aivo:adfilm-project-sync",function(event){var scope=root();if(!scope)return;var project=event&&event.detail&&event.detail.project||null;if(project)window.AIVOAdFilmActiveProject=project;bind(scope);applyProject(scope,project)});
  window.addEventListener("storage",function(event){if(event&&(event.key==="aivo_language"||event.key==="aivo_lang"))translate(root())});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){var scope=root();if(scope)bind(scope)},{once:true});else{var scope=root();if(scope)bind(scope)}
})();
