/* =========================================================
   AIVO — AI REKLAM FILMI / NARRATION GUIDE
   Duration-aware word budgets, safe AI-draft contract and mandatory
   review for suggested narration. No text model is called here yet.
   ========================================================= */
(function AIVO_AD_FILM_NARRATION_GUIDE(){
  "use strict";
  if(window.__AIVO_AD_FILM_NARRATION_GUIDE__)return;
  window.__AIVO_AD_FILM_NARRATION_GUIDE__=true;

  var STORAGE_KEY="aivo_adfilm_narration_review_v1";
  var SPEED_KEY="aivo_adfilm_voice_speed_v1";
  var RATE={
    slow:{min:1.25,target:1.45,max:1.60},
    balanced:{min:1.60,target:1.80,max:2.00},
    fast:{min:1.90,target:2.15,max:2.40}
  };

  var COPY={
    tr:{
      aiTab:"AIVO metin önerisi",
      manualTab:"Metni kendim yazacağım",
      budgetTitle:"Ses süresi bütçesi",
      duration:"{duration} sn",
      speedSlow:"Yavaş",
      speedBalanced:"Dengeli",
      speedFast:"Hızlı",
      recommended:"{min}–{max} kelime önerilir",
      empty:"Metnini yazdıkça süre hesabı burada görünecek.",
      estimate:"{words} kelime · tahmini {seconds} sn",
      short:"Metin kısa; reklamda nefes, müzik veya sessiz vurgu alanı kalır.",
      fits:"Metin seçilen süreye uygun.",
      near:"Sınıra yakın. Doğal duraklar için birkaç kelime kısaltmak daha güvenli.",
      tooLong:"Bu metin {duration} saniyeye sığmıyor. En fazla {max} kelime kullan.",
      aiHelp:"AIVO yalnız verdiğin ürün bilgileri ve reklam planına dayanarak süreye uygun bir taslak hazırlar. Fiyat, garanti veya doğrulanmamış iddia eklemez.",
      generate:"AIVO önerisi hazırla",
      regenerate:"Yeniden hazırla",
      approve:"Metni onayla",
      approved:"Metin onaylandı",
      approvalNeeded:"Taslağı kontrol et, gerekiyorsa düzenle ve onayla.",
      pending:"Metin önerisi motoru bağlandığında bu güvenli kurallarla çalışacak.",
      promptReady:"Süreye uygun güvenli metin promptu hazırlandı.",
      missingBrief:"Önce ürün adı ve kısa açıklamayı tamamla.",
      manualPlaceholder:"Reklamda okunacak metni yaz...",
      aiPlaceholder:"AIVO metin önerisi burada görünecek. Taslağı düzenleyip onaylayacaksın.",
      overLimitBuild:"Seslendirme metni seçilen video süresinden uzun.",
      approvalBuild:"AIVO metin önerisini kontrol edip onayla.",
      missingNarrationBuild:"Seslendirme için önce bir metin oluştur veya yaz.",
      invalidBriefBuild:"Önce zorunlu ürün bilgilerini ve ana görseli tamamla.",
      durationChanged:"Süre veya konuşma hızı değişti. Metni tekrar kontrol et.",
      engineBadge:"Güvenli taslak",
      reviewBadge:"Kullanıcı onayı zorunlu"
    },
    en:{
      aiTab:"AIVO script suggestion",
      manualTab:"I will write the script",
      budgetTitle:"Narration time budget",
      duration:"{duration} sec",
      speedSlow:"Slow",
      speedBalanced:"Balanced",
      speedFast:"Fast",
      recommended:"Recommended: {min}–{max} words",
      empty:"The timing estimate will appear as you write.",
      estimate:"{words} words · estimated {seconds} sec",
      short:"The script is short, leaving room for music, pauses or visual emphasis.",
      fits:"The script fits the selected duration.",
      near:"Close to the limit. Shortening a few words is safer for natural pauses.",
      tooLong:"This script will not fit in {duration} seconds. Use no more than {max} words.",
      aiHelp:"AIVO uses only your verified product brief and advertising plan to prepare a duration-safe draft. It will not invent prices, warranties or unsupported claims.",
      generate:"Prepare AIVO suggestion",
      regenerate:"Prepare again",
      approve:"Approve script",
      approved:"Script approved",
      approvalNeeded:"Review the draft, edit it if needed, then approve it.",
      pending:"The script suggestion engine will use these safety rules when connected.",
      promptReady:"A safe duration-aware script prompt is ready.",
      missingBrief:"Complete the product name and short description first.",
      manualPlaceholder:"Write the spoken advertising script...",
      aiPlaceholder:"The AIVO script suggestion will appear here for your review and approval.",
      overLimitBuild:"The narration is longer than the selected video duration.",
      approvalBuild:"Review and approve the AIVO script suggestion.",
      missingNarrationBuild:"Create or write a narration script first.",
      invalidBriefBuild:"Complete the required product brief and hero image first.",
      durationChanged:"Duration or narration speed changed. Review the script again.",
      engineBadge:"Safe draft",
      reviewBadge:"User approval required"
    }
  };

  function language(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function t(key,vars){
    var text=(COPY[language()]&&COPY[language()][key])||COPY.tr[key]||key;
    Object.keys(vars||{}).forEach(function(name){text=text.replace(new RegExp("\\{"+name+"\\}","g"),String(vars[name]))});
    return text;
  }
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function clean(value){return String(value==null?"":value).trim()}
  function field(scope,key){return scope&&scope.querySelector('[data-adfilm-input="'+key+'"]')}
  function value(scope,key,fallback){var input=field(scope,key);return input?(input.type==="checkbox"?!!input.checked:input.value):fallback}
  function selected(scope,key,fallback){var button=scope&&scope.querySelector('[data-adfilm-choice="'+key+'"] .is-selected[data-value]');return button?button.getAttribute("data-value"):fallback}
  function mode(scope){return selected(scope,"scriptMode","ai")}
  function duration(scope){var number=Number(selected(scope,"duration","10"));return Math.max(4,Math.min(15,isFinite(number)?number:10))}
  function speed(scope){
    var button=scope&&scope.querySelector('button[data-voice-control="speed"].is-selected');
    var current=button&&button.getAttribute("data-value");
    if(!current){var hidden=field(scope,"voiceSpeed");current=hidden&&hidden.value}
    if(!current)try{current=localStorage.getItem(SPEED_KEY)}catch(_){}
    return RATE[current]?current:"balanced";
  }
  function speedLabel(current){return t(current==="slow"?"speedSlow":current==="fast"?"speedFast":"speedBalanced")}
  function budget(scope){
    var seconds=duration(scope),current=speed(scope),rate=RATE[current];
    return{duration:seconds,speed:current,rate:rate,minWords:Math.max(3,Math.floor(seconds*rate.min)),targetWords:Math.max(4,Math.round(seconds*rate.target*.93)),maxWords:Math.max(5,Math.floor(seconds*rate.max))};
  }
  function words(text){
    text=clean(text);if(!text)return[];
    try{return text.match(/[\p{L}\p{N}]+(?:[’'\-.][\p{L}\p{N}]+)*/gu)||[]}
    catch(_){return text.split(/\s+/).filter(Boolean)}
  }
  function estimate(text,rate){
    var count=words(text).length;
    if(!count)return 0;
    var commas=(text.match(/[,;:]/g)||[]).length;
    var stops=(text.match(/[.!?…]/g)||[]).length;
    return count/rate.target+commas*.12+stops*.28;
  }
  function hash(text,settings){
    var input=clean(text)+"|"+settings.duration+"|"+settings.speed,hashValue=2166136261;
    for(var index=0;index<input.length;index++){hashValue^=input.charCodeAt(index);hashValue+=(hashValue<<1)+(hashValue<<4)+(hashValue<<7)+(hashValue<<8)+(hashValue<<24)}
    return(hashValue>>>0).toString(36);
  }
  function readReview(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"null")||{}}catch(_){return{}}}
  function saveReview(scope){
    var guide=guideState(scope);
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify({approvedHash:guide.approvedHash||"",source:guide.source||mode(scope),updatedAt:new Date().toISOString()}))}catch(_){}
  }
  function guideState(scope){
    var text=clean(value(scope,"narrationText","")),settings=budget(scope),count=words(text).length,seconds=estimate(text,settings.rate),review=scope.__adfilmNarrationReview||readReview();
    var currentHash=hash(text,settings),approved=mode(scope)!=="ai"||!!(text&&review.approvedHash===currentHash);
    return{text:text,wordCount:count,estimatedSeconds:seconds,settings:settings,currentHash:currentHash,approvedHash:review.approvedHash||"",approved:approved,source:mode(scope),overLimit:count>settings.maxWords||seconds>settings.duration+.25,nearLimit:count>=Math.max(settings.minWords,Math.floor(settings.maxWords*.86))||seconds>=settings.duration*.88,underTarget:count>0&&count<settings.minWords};
  }
  function notify(message,type){
    try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function"){fn({message:message,duration:3200});return}if(typeof window.showToast==="function")window.showToast(message,type||"info")}catch(_){}
  }

  function guideMarkup(){
    return '<section class="adfilm-narration-guide" data-adfilm-narration-guide>'+
      '<div class="adfilm-narration-budget"><div><span data-narration-copy="budgetTitle">'+t("budgetTitle")+'</span><b data-narration-recommendation></b></div><div class="adfilm-narration-budget__pills"><em data-narration-duration></em><em data-narration-speed></em></div></div>'+
      '<div class="adfilm-narration-meter"><i data-narration-meter></i></div>'+
      '<div class="adfilm-narration-status" data-narration-status><span></span><p></p><b data-narration-estimate></b></div>'+
      '<div class="adfilm-narration-ai" data-narration-ai hidden><div><span class="adfilm-narration-ai__badge" data-narration-copy="engineBadge">'+t("engineBadge")+'</span><p data-narration-copy="aiHelp">'+t("aiHelp")+'</p><small data-narration-copy="reviewBadge">'+t("reviewBadge")+'</small></div><div class="adfilm-narration-ai__actions"><button type="button" data-narration-generate>'+t("generate")+'</button><button type="button" data-narration-approve>'+t("approve")+'</button></div></div>'+
    '</section>';
  }

  function install(scope){
    var card=scope.querySelector(".adfilm-card--voice"),segmented=card&&card.querySelector('[data-adfilm-choice="scriptMode"]');
    if(!card||!segmented)return false;
    var aiButton=segmented.querySelector('button[data-value="ai"]'),manualButton=segmented.querySelector('button[data-value="manual"]');
    if(aiButton){aiButton.removeAttribute("data-adfilm-i18n");aiButton.setAttribute("data-narration-copy","aiTab");aiButton.textContent=t("aiTab")}
    if(manualButton){manualButton.removeAttribute("data-adfilm-i18n");manualButton.setAttribute("data-narration-copy","manualTab");manualButton.textContent=t("manualTab")}
    var guide=card.querySelector("[data-adfilm-narration-guide]");
    if(!guide){segmented.insertAdjacentHTML("afterend",guideMarkup());guide=card.querySelector("[data-adfilm-narration-guide]")}
    var control=card.querySelector("[data-adfilm-script-control]");
    if(control){control.hidden=false;control.classList.add("is-narration-guide-visible")}
    if(!card.__narrationGuideBound){
      card.__narrationGuideBound=true;
      card.addEventListener("input",function(event){
        if(event.target===field(scope,"narrationText")){
          if(mode(scope)==="ai"){scope.__adfilmNarrationReview=scope.__adfilmNarrationReview||readReview();scope.__adfilmNarrationReview.approvedHash="";saveReview(scope)}
          sync(scope);
        }
      },true);
      card.addEventListener("click",function(event){
        if(event.target.closest('[data-adfilm-choice="scriptMode"] button[data-value]'))setTimeout(function(){ensureTextVisible(scope);sync(scope)},0);
        var generate=event.target.closest("[data-narration-generate]");if(generate){event.preventDefault();requestSuggestion(scope);return}
        var approve=event.target.closest("[data-narration-approve]");if(approve){event.preventDefault();approveSuggestion(scope)}
      },true);
    }
    return true;
  }
  function ensureTextVisible(scope){
    var control=scope.querySelector("[data-adfilm-script-control]");
    if(control){control.hidden=false;control.classList.add("is-narration-guide-visible")}
  }
  function updatePlaceholder(scope){
    var textarea=field(scope,"narrationText");if(!textarea)return;
    textarea.removeAttribute("data-adfilm-placeholder");
    textarea.setAttribute("placeholder",t(mode(scope)==="ai"?"aiPlaceholder":"manualPlaceholder"));
  }
  function format(number){return(Math.round(number*10)/10).toFixed(number<10?1:0)}

  function sync(scope){
    if(!scope||!scope.isConnected)return;
    ensureTextVisible(scope);updatePlaceholder(scope);
    var state=guideState(scope),guide=scope.querySelector("[data-adfilm-narration-guide]");if(!guide)return;
    var settings=state.settings,percent=state.text?Math.min(100,Math.round(state.estimatedSeconds/settings.duration*100)):0;
    var recommendation=guide.querySelector("[data-narration-recommendation]");if(recommendation)recommendation.textContent=t("recommended",{min:settings.minWords,max:settings.maxWords});
    var durationEl=guide.querySelector("[data-narration-duration]");if(durationEl)durationEl.textContent=t("duration",{duration:settings.duration});
    var speedEl=guide.querySelector("[data-narration-speed]");if(speedEl)speedEl.textContent=speedLabel(settings.speed);
    var meter=guide.querySelector("[data-narration-meter]");if(meter)meter.style.width=percent+"%";
    var status=guide.querySelector("[data-narration-status]"),message="",statusMode="empty";
    if(!state.text){message=t("empty")}
    else if(state.overLimit){message=t("tooLong",{duration:settings.duration,max:settings.maxWords});statusMode="error"}
    else if(state.nearLimit){message=t("near");statusMode="warning"}
    else if(state.underTarget){message=t("short");statusMode="short"}
    else{message=t("fits");statusMode="success"}
    if(status){status.className="adfilm-narration-status is-"+statusMode;var p=status.querySelector("p");if(p)p.textContent=message}
    var estimateEl=guide.querySelector("[data-narration-estimate]");if(estimateEl)estimateEl.textContent=state.text?t("estimate",{words:state.wordCount,seconds:format(state.estimatedSeconds)}):"";
    var aiPanel=guide.querySelector("[data-narration-ai]");if(aiPanel)aiPanel.hidden=mode(scope)!=="ai";
    var generate=guide.querySelector("[data-narration-generate]");if(generate)generate.textContent=state.text?t("regenerate"):t("generate");
    var approve=guide.querySelector("[data-narration-approve]");
    if(approve){approve.textContent=state.approved?t("approved"):t("approve");approve.classList.toggle("is-approved",state.approved);approve.disabled=!state.text||state.overLimit||state.approved}
    guide.classList.toggle("is-ai",mode(scope)==="ai");guide.classList.toggle("is-over",state.overLimit);guide.classList.toggle("is-approved",state.approved&&mode(scope)==="ai");
    scope.dataset.adfilmNarrationFit=state.overLimit?"over":state.text?"fit":"empty";
    guardBuild(scope,state);
    window.AIVOAdFilmNarrationGuideState=publicState(scope,state);
  }

  function baseReady(scope,state){
    var product=clean(value(scope,"productName","")),description=clean(value(scope,"description",""));
    var hero=scope.querySelector('[data-adfilm-role-file="hero"]'),legacy=scope.querySelector('[data-adfilm-file="productImages"]');
    var hasImage=!!((hero&&hero.files&&hero.files.length)||(legacy&&legacy.files&&legacy.files.length));
    var voice=!!value(scope,"voiceEnabled",true);
    if(!product||description.length<10||!hasImage)return false;
    if(voice&&(!state.text||state.text.length<10))return false;
    return true;
  }
  function blockReason(scope,state){
    if(!value(scope,"voiceEnabled",true))return"";
    if(!state.text||state.text.length<10)return t("missingNarrationBuild");
    if(state.overLimit)return t("overLimitBuild");
    if(mode(scope)==="ai"&&!state.approved)return t("approvalBuild");
    if(!baseReady(scope,state))return t("invalidBriefBuild");
    return"";
  }
  function guardBuild(scope,state){
    var button=scope.querySelector("[data-adfilm-build]"),reason=blockReason(scope,state),base=baseReady(scope,state);
    if(button){button.disabled=!!reason||!base;button.classList.toggle("is-ready",!reason&&base);button.dataset.narrationGuard=reason?"blocked":"ready"}
    var actionbar=scope.querySelector(".adfilm-actionbar"),hint=actionbar&&actionbar.querySelector("[data-adfilm-build-reason]");
    if(hint&&reason){hint.classList.remove("is-ready");var label=hint.querySelector("b");if(label)label.textContent=reason}
  }
  function approveSuggestion(scope){
    var state=guideState(scope);if(!state.text||state.overLimit)return;
    scope.__adfilmNarrationReview={approvedHash:state.currentHash,source:"ai",updatedAt:new Date().toISOString()};saveReview(scope);sync(scope);
  }

  function safePrompt(scope){
    var settings=budget(scope),scenes=[1,2,3,4,5].map(function(index){return clean(value(scope,"scene"+index,""))}).filter(Boolean);
    var payload={
      task:"write_advertising_voiceover",
      output:"Return JSON only: {\"text\":\"...\",\"word_count\":0}",
      language:clean(value(scope,"language","tr"))||"tr",
      duration_seconds:settings.duration,
      narration_speed:settings.speed,
      target_word_range:{min:settings.minWords,ideal:settings.targetWords,max:settings.maxWords},
      voice_style:clean(value(scope,"voiceStyle","warm")),
      voice_flow:clean(value(scope,"voiceFlow","natural")),
      verified_input:{
        product_name:clean(value(scope,"productName","")),
        brand_name:clean(value(scope,"brandName","")),
        product_description:clean(value(scope,"description","")),
        advertising_direction:clean(value(scope,"creativeDirection","")),
        advertising_concept:clean(value(scope,"planConcept","auto")),
        scenes:scenes,
        call_to_action:clean(value(scope,"cta",""))
      },
      rules:[
        "Write spoken narration only. Do not include headings, quotation marks, timestamps, camera directions or scene labels.",
        "Stay inside the target word range and never exceed the hard maximum.",
        "Use only facts explicitly present in verified_input.",
        "Do not invent a price, discount, warranty, statistic, medical claim, safety claim, performance figure, superiority claim or certification.",
        "If a detail is missing, omit it instead of guessing.",
        "Use one or two short natural sentences with room for pauses.",
        "Mention the product or brand naturally and avoid repetition.",
        "Do not add a call to action unless one is supplied or a neutral discover/learn-more ending is appropriate.",
        "The final text must be reviewed and approved by the user before narration generation."
      ]
    };
    return payload;
  }
  function requestSuggestion(scope){
    var product=clean(value(scope,"productName","")),description=clean(value(scope,"description",""));
    if(!product||description.length<10){notify(t("missingBrief"),"warning");return}
    var prompt=safePrompt(scope);window.AIVOAdFilmNarrationPrompt=prompt;
    document.dispatchEvent(new CustomEvent("aivo:adfilm-narration-request",{detail:{scope:scope,prompt:prompt}}));
    var provider=window.AIVOAdFilmNarration&&window.AIVOAdFilmNarration.generateSuggestion;
    if(typeof provider!=="function"){notify(t("pending"),"info");return}
    var button=scope.querySelector("[data-narration-generate]");if(button)button.disabled=true;
    Promise.resolve(provider(prompt)).then(function(result){
      var text=clean(result&&result.text||result);if(!text)throw new Error("empty_narration");
      var textarea=field(scope,"narrationText");if(textarea){textarea.value=text;textarea.dispatchEvent(new Event("input",{bubbles:true}))}
      notify(t("promptReady"),"success");
    }).catch(function(error){console.error("[ADFILM] narration suggestion",error);notify(t("pending"),"warning")}).finally(function(){if(button)button.disabled=false;sync(scope)});
  }

  function publicState(scope,state){
    state=state||guideState(scope);
    return{mode:mode(scope),text:state.text,wordCount:state.wordCount,estimatedSeconds:Number(state.estimatedSeconds.toFixed(2)),duration:state.settings.duration,speed:state.settings.speed,minWords:state.settings.minWords,targetWords:state.settings.targetWords,maxWords:state.settings.maxWords,approved:state.approved,overLimit:state.overLimit,prompt:safePrompt(scope)};
  }
  function augmentPayload(project){
    var scope=root();if(!scope)return project;
    var state=guideState(scope),next=Object.assign({},project||{}),narration=Object.assign({},next.narration||{});
    narration.text=state.text;narration.scriptMode=mode(scope);next.narration=narration;
    next.narrationGuide={wordCount:state.wordCount,estimatedSeconds:Number(state.estimatedSeconds.toFixed(2)),duration:state.settings.duration,speed:state.settings.speed,minWords:state.settings.minWords,targetWords:state.settings.targetWords,maxWords:state.settings.maxWords,approved:state.approved,approvedHash:state.approvedHash||"",source:mode(scope)};
    return next;
  }
  function patchCloudApi(){
    var api=window.AIVOAdFilmProjects;if(!api||api.__narrationGuidePatched)return;
    api.__narrationGuidePatched=true;
    var create=api.createProject.bind(api),update=api.updateProject.bind(api);
    api.createProject=function(project){return create(augmentPayload(project))};
    api.updateProject=function(id,project){return update(id,augmentPayload(project))};
  }
  function applyProjectReview(scope,project){
    var guide=project&&project.narrationGuide;if(!guide)return;
    scope.__adfilmNarrationReview={approvedHash:guide.approvedHash||"",source:guide.source||"ai",updatedAt:new Date().toISOString()};saveReview(scope);sync(scope);
  }
  function translate(scope){
    if(!scope)return;
    scope.querySelectorAll("[data-narration-copy]").forEach(function(node){node.textContent=t(node.getAttribute("data-narration-copy"))});
    var ai=scope.querySelector('[data-adfilm-choice="scriptMode"] button[data-value="ai"]'),manual=scope.querySelector('[data-adfilm-choice="scriptMode"] button[data-value="manual"]');
    if(ai)ai.textContent=t("aiTab");if(manual)manual.textContent=t("manualTab");sync(scope);
  }

  function bind(scope){
    if(!scope||!scope.isConnected)return;
    patchCloudApi();install(scope);ensureTextVisible(scope);
    if(scope.__narrationGuideRootBound){sync(scope);return}
    scope.__narrationGuideRootBound=true;scope.__adfilmNarrationReview=readReview();
    scope.addEventListener("click",function(event){
      if(event.target.closest('[data-adfilm-choice="duration"] button[data-value],button[data-voice-control="speed"],button[data-adfilm-build]')){
        if(event.target.closest("button[data-adfilm-build]")){
          var state=guideState(scope),reason=blockReason(scope,state);if(reason){event.preventDefault();event.stopImmediatePropagation();notify(reason,"warning");return}
        }
        setTimeout(function(){
          var previous=window.AIVOAdFilmNarrationGuideState||{},next=guideState(scope);
          if(mode(scope)==="ai"&&next.text&&(previous.duration!==next.settings.duration||previous.speed!==next.settings.speed)){
            scope.__adfilmNarrationReview.approvedHash="";saveReview(scope);notify(t("durationChanged"),"info");
          }
          sync(scope);
        },20);
      }
    },true);
    scope.addEventListener("change",function(event){if(event.target.closest('[data-adfilm-input="voiceEnabled"],[data-adfilm-input="language"],[data-adfilm-input="voiceStyle"]'))setTimeout(function(){sync(scope)},0)},true);
    [60,220,650,1200].forEach(function(delay){setTimeout(function(){install(scope);sync(scope)},delay)});
  }
  function schedule(scope){[80,260,700].forEach(function(delay){setTimeout(function(){bind(scope||root())},delay)})}

  window.AIVOAdFilmNarrationGuide={
    budget:function(){var scope=root();return scope?budget(scope):null},
    analyze:function(text){var scope=root();if(!scope)return null;var settings=budget(scope);return{words:words(text).length,estimatedSeconds:estimate(text,settings.rate),settings:settings}},
    buildPrompt:function(){var scope=root();return scope?safePrompt(scope):null},
    approve:function(){var scope=root();if(scope)approveSuggestion(scope)}
  };

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(event.detail.root)});
  document.addEventListener("aivo:adfilm-project-sync",function(event){var scope=root();if(scope){applyProjectReview(scope,event&&event.detail&&event.detail.project);setTimeout(function(){sync(scope)},120)}});
  window.addEventListener("storage",function(event){if(event&&(event.key==="aivo_language"||event.key==="aivo_lang"))translate(root())});
  patchCloudApi();
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(root())},{once:true});else schedule(root());
})();