/* =========================================================
   AIVO — AI REKLAM FILMI / BASIC CONTROL POLICY
   Realistic duration choices, compact narration preferences and
   advanced-only music controls before provider integrations.
   ========================================================= */
(function AIVO_AD_FILM_BASIC_CONTROL_POLICY(){
  "use strict";
  if(window.__AIVO_AD_FILM_BASIC_CONTROL_POLICY__) return;
  window.__AIVO_AD_FILM_BASIC_CONTROL_POLICY__=true;

  var ALLOWED_DURATIONS=["5","10","15","20"];
  var DEFAULT_DURATION="10";
  var DRAFT_KEYS=["aivo_adfilm_basic_draft_v2","aivo_adfilm_basic_draft_v1"];
  var VOICE_SPEED_KEY="aivo_adfilm_voice_speed_v1";
  var VOICE_FLOW_KEY="aivo_adfilm_voice_flow_v1";

  var COPY={
    tr:{
      compatible:"Uyumlu motor",
      durationNote:"20 sn seçeneği yalnız destekleyen üretim motorlarında kullanılacak.",
      speed:"Hız",
      flow:"Ses Akışı",
      slow:"Yavaş",
      balanced:"Dengeli",
      fast:"Hızlı",
      natural:"Doğal",
      emphatic:"Vurgulu",
      voiceAuto:"AIVO, seçilen video süresine göre konuşma temposunu ve metin uyumunu otomatik dengeler.",
      advancedSub:"İsteğe bağlı: görsel stil, kalite, reklam müziği ve sahne planı."
    },
    en:{
      compatible:"Compatible engine",
      durationNote:"The 20 sec option will only use generation engines that support it.",
      speed:"Speed",
      flow:"Voice Flow",
      slow:"Slow",
      balanced:"Balanced",
      fast:"Fast",
      natural:"Natural",
      emphatic:"Emphatic",
      voiceAuto:"AIVO automatically balances narration pace and script fit for the selected video duration.",
      advancedSub:"Optional: visual style, quality, advertising music and scene plan."
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

  function normalizeDuration(value){
    value=String(value||"");
    if(value==="30")return"20";
    return ALLOWED_DURATIONS.indexOf(value)>=0?value:DEFAULT_DURATION;
  }

  function storedDuration(){
    for(var i=0;i<DRAFT_KEYS.length;i++){
      try{
        var raw=localStorage.getItem(DRAFT_KEYS[i])||sessionStorage.getItem(DRAFT_KEYS[i]);
        if(!raw)continue;
        var draft=JSON.parse(raw);
        if(draft&&draft.duration)return normalizeDuration(draft.duration);
      }catch(_){}
    }
    return"";
  }

  function durationButton(value,label,tag){
    return '<button type="button" data-value="'+value+'"><span>'+label+'</span>'+(tag?'<em class="adfilm-duration-tag">'+tag+'</em>':'')+'</button>';
  }

  function updateStoredDrafts(){
    DRAFT_KEYS.forEach(function(key){
      [localStorage,sessionStorage].forEach(function(storage){
        try{
          var raw=storage.getItem(key);if(!raw)return;
          var draft=JSON.parse(raw);if(!draft)return;
          if(draft.duration){var next=normalizeDuration(draft.duration);if(next!==String(draft.duration))draft.duration=next}
          if(!draft.voiceSpeed)draft.voiceSpeed=read(VOICE_SPEED_KEY,"balanced");
          if(!draft.voiceFlow)draft.voiceFlow=read(VOICE_FLOW_KEY,"natural");
          storage.setItem(key,JSON.stringify(draft));
        }catch(_){}
      });
    });
  }

  function updateStoryboard(scope,duration){
    var d=Number(duration)||10;
    var cuts=d===5?[0,1,2,4,5]:d===10?[0,2,5,8,10]:d===15?[0,3,8,12,15]:[0,3,9,15,20];
    scope.querySelectorAll(".adfilm-scene__thumb span").forEach(function(el,index){
      var start=String(cuts[index]||0).padStart(2,"0");
      var end=String(cuts[index+1]||d).padStart(2,"0");
      el.textContent="00:"+start+"–00:"+end;
    });
    var plan=window.AIVOAdFilmStoryboardState;
    if(plan&&Array.isArray(plan.scenes)){
      plan.settings=plan.settings||{};plan.settings.duration=String(duration);
      plan.scenes.forEach(function(scene,index){
        scene.start=cuts[index]||0;scene.end=cuts[index+1]||d;
        scene.time="00:"+String(scene.start).padStart(2,"0")+"–00:"+String(scene.end).padStart(2,"0");
      });
    }
  }

  function ensureDurationNote(group){
    var block=group.closest(".adfilm-setting-block");if(!block)return;
    var note=block.querySelector("[data-adfilm-duration-note]");
    if(!note){note=document.createElement("small");note.className="adfilm-duration-note";note.setAttribute("data-adfilm-duration-note","");block.appendChild(note)}
    note.textContent=t("durationNote");
  }

  function setupDurations(scope){
    var group=scope.querySelector('[data-adfilm-choice="duration"]');
    if(!group)return false;
    updateStoredDrafts();

    if(!group.hasAttribute("data-duration-policy-ready")){
      var saved=storedDuration();
      var current=group.querySelector(".is-selected[data-value]");
      var target=saved||normalizeDuration(current&&current.getAttribute("data-value"));
      if(!saved&&current&&current.getAttribute("data-value")==="15")target=DEFAULT_DURATION;

      group.innerHTML=durationButton("5","5 sn")+durationButton("10","10 sn")+durationButton("15","15 sn")+durationButton("20","20 sn",t("compatible"));
      group.classList.add("adfilm-options--duration-v2");
      group.setAttribute("data-duration-policy-ready","");
      var targetButton=group.querySelector('button[data-value="'+normalizeDuration(target)+'"]')||group.querySelector('button[data-value="'+DEFAULT_DURATION+'"]');
      if(targetButton)targetButton.click();
      updateStoryboard(scope,normalizeDuration(target));

      group.addEventListener("click",function(event){
        var selected=event.target.closest("button[data-value]");
        if(!selected)return;
        setTimeout(function(){updateStoryboard(scope,selected.getAttribute("data-value"))},0);
      });
    }

    var tag=group.querySelector('.adfilm-duration-tag');if(tag)tag.textContent=t("compatible");
    ensureDurationNote(group);
    return true;
  }

  function voiceOptions(kind){
    if(kind==="speed")return[["slow","slow"],["balanced","balanced"],["fast","fast"]];
    return[["natural","natural"],["balanced","balanced"],["emphatic","emphatic"]];
  }

  function controlRow(kind,title){
    var buttons=voiceOptions(kind).map(function(item){return '<button type="button" data-voice-control="'+kind+'" data-value="'+item[0]+'" data-control-copy="'+item[1]+'">'+t(item[1])+'</button>'}).join("");
    return '<div class="adfilm-voice-tuning__row"><b data-control-copy="'+title+'">'+t(title)+'</b><div class="adfilm-voice-tuning__options">'+buttons+'</div></div>';
  }

  function ensureHiddenInput(section,key,value){
    var input=section.querySelector('[data-adfilm-input="'+key+'"]');
    if(!input){input=document.createElement("input");input.type="hidden";input.setAttribute("data-adfilm-input",key);section.appendChild(input)}
    input.value=value;
    return input;
  }

  function applyVoiceChoice(scope,kind,value,silent){
    var allowed=kind==="speed"?["slow","balanced","fast"]:["natural","balanced","emphatic"];
    var fallback=kind==="speed"?"balanced":"natural";
    if(allowed.indexOf(value)<0)value=fallback;
    var key=kind==="speed"?VOICE_SPEED_KEY:VOICE_FLOW_KEY;
    var inputKey=kind==="speed"?"voiceSpeed":"voiceFlow";
    write(key,value);
    scope.querySelectorAll('[data-voice-control="'+kind+'"] button,[data-voice-control="'+kind+'"]').forEach(function(button){
      if(button.matches("button"))button.classList.toggle("is-selected",button.getAttribute("data-value")===value);
    });
    var section=scope.querySelector("[data-adfilm-voice-tuning]");
    var input=section&&ensureHiddenInput(section,inputKey,value);
    if(input&&!silent){input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}))}
  }

  function setupVoiceControls(scope){
    var voiceCard=scope.querySelector(".adfilm-card--voice");
    var fields=voiceCard&&voiceCard.querySelector(".adfilm-fields--compact");
    if(!voiceCard||!fields)return false;

    var section=voiceCard.querySelector("[data-adfilm-voice-tuning]");
    if(!section){
      section=document.createElement("section");
      section.className="adfilm-voice-tuning";
      section.setAttribute("data-adfilm-voice-tuning","");
      section.innerHTML=controlRow("speed","speed")+controlRow("flow","flow")+'<p class="adfilm-voice-tuning__note"><span>✦</span><span data-control-copy="voiceAuto">'+t("voiceAuto")+'</span></p>';
      fields.insertAdjacentElement("afterend",section);
      section.addEventListener("click",function(event){
        var button=event.target.closest("button[data-voice-control]");if(!button)return;
        event.preventDefault();applyVoiceChoice(scope,button.getAttribute("data-voice-control"),button.getAttribute("data-value"),false);
      });
    }

    applyVoiceChoice(scope,"speed",read(VOICE_SPEED_KEY,"balanced"),true);
    applyVoiceChoice(scope,"flow",read(VOICE_FLOW_KEY,"natural"),true);
    section.querySelectorAll("[data-control-copy]").forEach(function(node){node.textContent=t(node.getAttribute("data-control-copy"))});
    voiceCard.classList.add("adfilm-card--voice-tuned");
    return true;
  }

  function moveMusicToAdvanced(scope){
    var music=scope.querySelector("[data-adfilm-music-source]");
    var outputBody=scope.querySelector(".adfilm-card--advanced-output .adfilm-advanced-output__body");
    if(!music||!outputBody)return false;
    if(music.parentElement!==outputBody)outputBody.appendChild(music);
    music.classList.remove("adfilm-music-source--voice");
    music.classList.add("adfilm-music-source--advanced");
    var voiceCard=scope.querySelector(".adfilm-card--voice");
    if(voiceCard)voiceCard.classList.remove("adfilm-card--voice-has-music");
    return true;
  }

  function translate(scope){
    if(!scope)return;
    var summary=scope.querySelector('[data-simple-copy="advancedSub"]');if(summary)summary.textContent=t("advancedSub");
    var note=scope.querySelector("[data-adfilm-duration-note]");if(note)note.textContent=t("durationNote");
    var tag=scope.querySelector(".adfilm-duration-tag");if(tag)tag.textContent=t("compatible");
    scope.querySelectorAll("[data-control-copy]").forEach(function(node){node.textContent=t(node.getAttribute("data-control-copy"))});
  }

  function setup(scope){
    if(!scope)return;
    var durationsReady=setupDurations(scope);
    var voiceReady=setupVoiceControls(scope);
    var musicReady=moveMusicToAdvanced(scope);
    translate(scope);
    scope.__adfilmBasicControlPolicyReady=durationsReady&&voiceReady&&musicReady;
  }

  function schedule(scope){[80,220,520].forEach(function(delay){setTimeout(function(){setup(scope||root())},delay)})}
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(event.detail.root)});
  window.addEventListener("storage",function(event){
    if(event&&(event.key==="aivo_language"||event.key==="aivo_lang")){var scope=root();if(scope){translate(scope);schedule(scope)}}
  });
  var observer=new MutationObserver(function(){var scope=root();if(scope&&!scope.__adfilmBasicControlPolicyReady)schedule(scope)});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(root())},{once:true});else schedule(root());
})();
