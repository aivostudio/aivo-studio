/* =========================================================
   AIVO — AI REKLAM FILMI / BASIC MODE POLISH
   Media management, validation and desktop UX safeguards.
   No API, credit or generation.
   ========================================================= */
(function AIVO_AD_FILM_BASIC_POLISH(){
  "use strict";
  if(window.__AIVO_AD_FILM_BASIC_POLISH__) return;
  window.__AIVO_AD_FILM_BASIC_POLISH__=true;

  var COPY={
    tr:{
      mediaManager:"Ürün Görsellerini Düzenle",mediaManagerHint:"İlk görsel reklamın ana ürün görselidir.",mainImage:"Ana Görsel",makeMain:"Ana görsel yap",moveLeft:"Sola taşı",moveRight:"Sağa taşı",remove:"Görseli kaldır",clearFile:"Dosyayı kaldır",imageCount:"görsel",
      missingTitle:"Ürün / hizmet adını gir.",missingDescription:"Kısa açıklamayı en az 10 karakterle tamamla.",missingImage:"En az bir ürün görseli yükle.",missingNarration:"Manuel seslendirme metnini en az 10 karakterle tamamla.",ready:"Basit Mod arayüzü üretime hazır.",
      fileLimit:"En fazla 6 ürün görseli kullanabilirsin.",invalidImage:"Yalnızca JPG, PNG veya WEBP görsel yükleyebilirsin.",invalidLogo:"Logo için PNG, JPG, WEBP veya SVG kullan.",invalidExtra:"Ek medya için desteklenen bir görsel veya MP4/MOV video kullan.",imageTooLarge:"Görseller en fazla 12 MB olabilir.",logoTooLarge:"Logo en fazla 5 MB olabilir.",videoTooLarge:"Video en fazla 120 MB olabilir.",filesAdjusted:"Desteklenmeyen veya büyük dosyalar listeden çıkarıldı.",
      voiceDisabled:"Seslendirme kapalı",voiceDisabledHint:"Bu reklam müzik ve görsel metinlerle hazırlanacak.",voiceEnabled:"Seslendirme açık",manualRequired:"Manuel metin zorunlu",formIncomplete:"Önce zorunlu alanları tamamla.",interfaceOnly:"Bu aşamada yalnızca arayüz test ediliyor; motorlar ve kredi sistemi bağlı değil.",
      stylePremium:"PREMIUM",styleMinimal:"MINIMAL",styleLuxury:"LÜKS",styleSocial:"SOSYAL",styleStudio:"STÜDYO",styleCinematic:"SİNEMATİK"
    },
    en:{
      mediaManager:"Arrange Product Images",mediaManagerHint:"The first image is used as the main product visual.",mainImage:"Main Image",makeMain:"Set as main image",moveLeft:"Move left",moveRight:"Move right",remove:"Remove image",clearFile:"Remove file",imageCount:"images",
      missingTitle:"Enter the product or service name.",missingDescription:"Complete the short description with at least 10 characters.",missingImage:"Upload at least one product image.",missingNarration:"Complete the manual narration with at least 10 characters.",ready:"The Basic Mode interface is ready for production integration.",
      fileLimit:"You can use up to 6 product images.",invalidImage:"Upload JPG, PNG or WEBP images only.",invalidLogo:"Use PNG, JPG, WEBP or SVG for the logo.",invalidExtra:"Use a supported image or MP4/MOV video for extra media.",imageTooLarge:"Images can be up to 12 MB.",logoTooLarge:"The logo can be up to 5 MB.",videoTooLarge:"Video can be up to 120 MB.",filesAdjusted:"Unsupported or oversized files were removed from the list.",
      voiceDisabled:"Narration off",voiceDisabledHint:"This ad will use music and on-screen copy.",voiceEnabled:"Narration on",manualRequired:"Manual script required",formIncomplete:"Complete the required fields first.",interfaceOnly:"Only the interface is being tested at this stage; engines and credits are not connected.",
      stylePremium:"PREMIUM",styleMinimal:"MINIMAL",styleLuxury:"LUXURY",styleSocial:"SOCIAL",styleStudio:"STUDIO",styleCinematic:"CINEMATIC"
    }
  };

  var redispatching=new WeakSet();
  var touched=new WeakSet();
  var managerUrls=[];
  var activeRoot=null;

  function lang(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function t(key){return COPY[lang()][key]||COPY.tr[key]||key}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function clean(value){return String(value||"").trim()}
  function toast(message,type){
    try{
      if(window.toast&&typeof window.toast[type||"info"]==="function"){window.toast[type||"info"](message);return}
      if(typeof window.showToast==="function"){window.showToast(message,type||"info");return}
    }catch(_){}
    console.info("[ADFILM]",message);
  }

  function currentValue(scope,key){var input=scope&&scope.querySelector('[data-adfilm-input="'+key+'"]');return input?(input.type==="checkbox"?!!input.checked:input.value):""}
  function productInput(scope){return scope&&scope.querySelector('[data-adfilm-file="productImages"]')}
  function files(input){return input?Array.from(input.files||[]):[]}

  function setFiles(input,nextFiles){
    if(!input)return;
    var dt=new DataTransfer();
    nextFiles.forEach(function(file){dt.items.add(file)});
    redispatching.add(input);
    input.files=dt.files;
    input.dispatchEvent(new Event("change",{bubbles:true}));
  }

  function isImage(file){return /^image\/(jpeg|png|webp)$/i.test(file.type)||/\.(jpe?g|png|webp)$/i.test(file.name||"")}
  function isLogo(file){return isImage(file)||/^image\/svg\+xml$/i.test(file.type)||/\.svg$/i.test(file.name||"")}
  function isVideo(file){return /^video\/(mp4|quicktime)$/i.test(file.type)||/\.(mp4|mov)$/i.test(file.name||"")}

  function validateFiles(input){
    var key=input.getAttribute("data-adfilm-file"),list=files(input),valid=[],reasons=[];
    list.forEach(function(file){
      var ok=false,max=12*1024*1024,message="";
      if(key==="productImages"){ok=isImage(file);message=t("invalidImage")}
      else if(key==="logo"){ok=isLogo(file);max=5*1024*1024;message=t("invalidLogo")}
      else {ok=isImage(file)||isVideo(file);max=isVideo(file)?120*1024*1024:12*1024*1024;message=t("invalidExtra")}
      if(!ok){reasons.push(message);return}
      if(file.size>max){reasons.push(isVideo(file)?t("videoTooLarge"):(key==="logo"?t("logoTooLarge"):t("imageTooLarge")));return}
      valid.push(file);
    });
    if(key==="productImages"&&valid.length>6){valid=valid.slice(0,6);reasons.push(t("fileLimit"))}
    return{files:valid,changed:valid.length!==list.length,reasons:Array.from(new Set(reasons))};
  }

  function clearManagerUrls(){managerUrls.forEach(function(url){try{URL.revokeObjectURL(url)}catch(_){}});managerUrls=[]}
  function escapeHtml(value){return String(value||"").replace(/[&<>"']/g,function(ch){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]})}
  function actionIcon(action){
    if(action==="main")return '<svg viewBox="0 0 24 24" fill="none"><path d="m12 3 2.5 5.2L20 9l-4 4 1 6-5-2.8L7 19l1-6-4-4 5.5-.8L12 3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
    if(action==="left")return '<svg viewBox="0 0 24 24" fill="none"><path d="m14 6-6 6 6 6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    if(action==="right")return '<svg viewBox="0 0 24 24" fill="none"><path d="m10 6 6 6-6 6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V4h6v3M8 10v7M12 10v7M16 10v7M7 7l1 14h8l1-14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function renderMediaManager(scope){
    var input=productInput(scope),list=files(input),mediaCard=scope.querySelector(".adfilm-card--media");
    if(!mediaCard)return;
    var manager=mediaCard.querySelector("[data-adfilm-media-manager]");
    if(!list.length){if(manager)manager.remove();clearManagerUrls();renderSingleClear(scope,"logo");renderSingleClear(scope,"extraMedia");return}
    if(!manager){
      manager=document.createElement("section");manager.className="adfilm-media-manager";manager.setAttribute("data-adfilm-media-manager","");
      var note=mediaCard.querySelector(".adfilm-media-note");if(note)note.insertAdjacentElement("afterend",manager);else mediaCard.appendChild(manager);
    }
    clearManagerUrls();
    var cards=list.map(function(file,index){
      var url=URL.createObjectURL(file);managerUrls.push(url);
      return '<article class="adfilm-media-item'+(index===0?' is-main':'')+'" data-media-index="'+index+'">'+
        '<div class="adfilm-media-item__visual" style="background-image:url(&quot;'+url.replace(/&/g,"&amp;").replace(/"/g,"%22")+'&quot;)"><span>'+(index===0?t("mainImage"):String(index+1).padStart(2,"0"))+'</span></div>'+
        '<div class="adfilm-media-item__copy"><b>'+escapeHtml(file.name||("image-"+(index+1)))+'</b><small>'+Math.max(.1,file.size/1024/1024).toFixed(1)+' MB</small></div>'+
        '<div class="adfilm-media-item__actions">'+
          (index===0?'':'<button type="button" data-media-action="main" title="'+escapeHtml(t("makeMain"))+'">'+actionIcon("main")+'</button>')+
          '<button type="button" data-media-action="left" title="'+escapeHtml(t("moveLeft"))+'" '+(index===0?'disabled':'')+'>'+actionIcon("left")+'</button>'+
          '<button type="button" data-media-action="right" title="'+escapeHtml(t("moveRight"))+'" '+(index===list.length-1?'disabled':'')+'>'+actionIcon("right")+'</button>'+
          '<button type="button" class="is-danger" data-media-action="remove" title="'+escapeHtml(t("remove"))+'">'+actionIcon("remove")+'</button>'+
        '</div></article>';
    }).join("");
    manager.innerHTML='<div class="adfilm-media-manager__head"><div><h3>'+t("mediaManager")+'</h3><p>'+t("mediaManagerHint")+'</p></div><span>'+list.length+' '+t("imageCount")+'</span></div><div class="adfilm-media-manager__grid">'+cards+'</div>';
    renderSingleClear(scope,"logo");renderSingleClear(scope,"extraMedia");
  }

  function renderSingleClear(scope,key){
    var input=scope.querySelector('[data-adfilm-file="'+key+'"]');if(!input)return;
    var zone=input.closest(".adfilm-upload-zone"),old=zone&&zone.querySelector('[data-clear-file="'+key+'"]');
    if(!files(input).length){if(old)old.remove();return}
    if(!old){old=document.createElement("button");old.type="button";old.className="adfilm-upload-clear";old.setAttribute("data-clear-file",key);old.setAttribute("title",t("clearFile"));old.innerHTML=actionIcon("remove");zone.appendChild(old)}
  }

  function addError(control,key){
    if(!control)return null;
    var error=control.querySelector('[data-adfilm-error="'+key+'"]');
    if(!error){error=document.createElement("em");error.className="adfilm-control-error";error.setAttribute("data-adfilm-error",key);control.appendChild(error)}
    return error;
  }

  function fieldState(scope,key,valid,message,force){
    var input=scope.querySelector('[data-adfilm-input="'+key+'"]');if(!input)return;
    var control=input.closest(".adfilm-control"),show=!valid&&(force||touched.has(input));
    input.setAttribute("aria-invalid",show?"true":"false");
    if(control)control.classList.toggle("has-error",show);
    var error=addError(control,key);if(error){error.textContent=message;error.hidden=!show}
  }

  function validation(scope){
    var product=clean(currentValue(scope,"productName")),description=clean(currentValue(scope,"description")),manual=clean(currentValue(scope,"narrationText"));
    var voice=!!currentValue(scope,"voiceEnabled"),manualMode=!!scope.querySelector('[data-adfilm-choice="scriptMode"] .is-selected[data-value="manual"]');
    var imageReady=files(productInput(scope)).length>0;
    var issues=[];
    if(!product)issues.push({key:"productName",message:t("missingTitle")});
    if(description.length<10)issues.push({key:"description",message:t("missingDescription")});
    if(!imageReady)issues.push({key:"productImages",message:t("missingImage")});
    if(voice&&manualMode&&manual.length<10)issues.push({key:"narrationText",message:t("missingNarration")});
    return{ready:issues.length===0,issues:issues,voice:voice,manualMode:manualMode};
  }

  function syncValidation(scope,force){
    if(!scope)return;
    var result=validation(scope),keys=["productName","description","narrationText"];
    keys.forEach(function(key){var issue=result.issues.find(function(x){return x.key===key});fieldState(scope,key,!issue,issue?issue.message:"",force)});
    var imageIssue=result.issues.find(function(x){return x.key==="productImages"}),zone=productInput(scope)&&productInput(scope).closest(".adfilm-upload-zone");
    if(zone)zone.classList.toggle("has-error",!!imageIssue&&(force||zone.dataset.afTouched==="1"));
    var actionbar=scope.querySelector(".adfilm-actionbar"),button=scope.querySelector("[data-adfilm-build]");
    if(actionbar){
      var hint=actionbar.querySelector("[data-adfilm-build-reason]");
      if(!hint){hint=document.createElement("div");hint.className="adfilm-build-reason";hint.setAttribute("data-adfilm-build-reason","");actionbar.appendChild(hint)}
      hint.classList.toggle("is-ready",result.ready);hint.innerHTML='<span></span><b>'+escapeHtml(result.ready?t("ready"):result.issues[0].message)+'</b>';
    }
    if(button){button.disabled=!result.ready;button.classList.toggle("is-ready",result.ready);button.setAttribute("aria-disabled",result.ready?"false":"true");button.title=result.ready?t("interfaceOnly"):result.issues[0].message}
    scope.classList.toggle("is-basic-ready",result.ready);
    return result;
  }

  function syncVoice(scope){
    var card=scope.querySelector(".adfilm-card--voice"),toggle=scope.querySelector('[data-adfilm-input="voiceEnabled"]');if(!card||!toggle)return;
    var enabled=!!toggle.checked;card.classList.toggle("is-voice-off",!enabled);
    card.querySelectorAll("select,textarea,.adfilm-segmented button").forEach(function(el){el.disabled=!enabled;el.setAttribute("aria-disabled",enabled?"false":"true")});
    var label=card.querySelector(".adfilm-switch b");if(label)label.textContent=t(enabled?"voiceEnabled":"voiceDisabled");
    var note=card.querySelector("[data-adfilm-voice-note]");
    if(!note){note=document.createElement("div");note.className="adfilm-voice-note";note.setAttribute("data-adfilm-voice-note","");card.appendChild(note)}
    note.innerHTML='<span>✦</span><b>'+t(enabled?"voiceEnabled":"voiceDisabled")+'</b><small>'+t(enabled?"manualRequired":"voiceDisabledHint")+'</small>';
    note.hidden=enabled;
  }

  function syncStylePreview(scope){
    var selected=scope.querySelector('[data-adfilm-choice="sceneStyle"] .is-selected[data-value]'),style=selected?selected.getAttribute("data-value"):"premium";
    document.querySelectorAll("[data-panel-frame]").forEach(function(frame){
      Array.from(frame.classList).forEach(function(name){if(name.indexOf("style-")===0)frame.classList.remove(name)});
      frame.classList.add("style-"+style);
    });
    var kicker=document.querySelector("[data-panel-kicker]");if(kicker)kicker.textContent=t("style"+style.charAt(0).toUpperCase()+style.slice(1));
  }

  function sync(scope,force){
    if(!scope||!scope.isConnected)return;
    activeRoot=scope;renderMediaManager(scope);syncVoice(scope);syncStylePreview(scope);syncValidation(scope,!!force);
  }

  function manageMediaClick(event,scope){
    var button=event.target.closest("[data-media-action]");if(!button)return false;
    event.preventDefault();event.stopPropagation();
    var item=button.closest("[data-media-index]"),index=Number(item&&item.getAttribute("data-media-index")),input=productInput(scope),list=files(input),action=button.getAttribute("data-media-action");
    if(!Number.isInteger(index)||!list[index])return true;
    if(action==="remove")list.splice(index,1);
    else if(action==="main"){var chosen=list.splice(index,1)[0];list.unshift(chosen)}
    else if(action==="left"&&index>0){var left=list[index-1];list[index-1]=list[index];list[index]=left}
    else if(action==="right"&&index<list.length-1){var right=list[index+1];list[index+1]=list[index];list[index]=right}
    setFiles(input,list);return true;
  }

  document.addEventListener("change",function(event){
    var input=event.target&&event.target.closest?event.target.closest("[data-adfilm-file]"):null;if(!input)return;
    if(redispatching.has(input)){redispatching.delete(input);setTimeout(function(){sync(root())},0);return}
    var result=validateFiles(input);
    if(result.changed){event.stopImmediatePropagation();result.reasons.forEach(function(message){toast(message,"warning")});setFiles(input,result.files);return}
    setTimeout(function(){var scope=root();if(scope){var zone=input.closest(".adfilm-upload-zone");if(zone)zone.dataset.afTouched="1";sync(scope)}},0);
  },true);

  document.addEventListener("focusout",function(event){
    var input=event.target&&event.target.closest?event.target.closest('[data-module="adfilm"] [data-adfilm-input]'):null;if(!input)return;
    touched.add(input);setTimeout(function(){syncValidation(root())},0);
  },true);

  document.addEventListener("click",function(event){
    var scope=root();if(!scope)return;
    if(manageMediaClick(event,scope))return;
    var clear=event.target.closest("[data-clear-file]");if(clear){event.preventDefault();event.stopPropagation();var input=scope.querySelector('[data-adfilm-file="'+clear.getAttribute("data-clear-file")+'"]');setFiles(input,[]);return}
    var build=event.target.closest("[data-adfilm-build]");if(build){var result=syncValidation(scope,true);if(!result.ready){event.preventDefault();event.stopImmediatePropagation();toast(t("formIncomplete"),"warning");return}}
    setTimeout(function(){sync(scope)},0);
  },true);

  document.addEventListener("input",function(event){if(event.target&&event.target.closest('[data-module="adfilm"] [data-adfilm-input]'))setTimeout(function(){syncValidation(root())},0)},true);
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){sync(event.detail.root)},30)});
  window.addEventListener("storage",function(event){if(event&&(event.key==="aivo_language"||event.key==="aivo_lang"))setTimeout(function(){sync(root())},30)});

  var observer=new MutationObserver(function(){var scope=root();if(scope&&scope!==activeRoot)setTimeout(function(){sync(scope)},20)});
  if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){sync(root())},{once:true});else sync(root());
})();
