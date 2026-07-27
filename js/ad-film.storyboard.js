/* =========================================================
   AIVO — AI REKLAM FILMI / STORYBOARD V1
   Rule-based scene plan generation before the paid AI engine.
   Reads the Basic Mode brief, splits timing, prepares narration
   and visual prompts, and exposes the result for later API use.
   ========================================================= */
(function AIVO_AD_FILM_STORYBOARD(){
  "use strict";
  if(window.__AIVO_AD_FILM_STORYBOARD__) return;
  window.__AIVO_AD_FILM_STORYBOARD__=true;

  var activeRoot=null;
  var autoTimer=null;
  var variant=0;
  var lastSignature="";

  var COPY={
    tr:{
      refresh:"Sahne Planını Yenile",
      ready:"Sahne planı hazır",
      readyText:"Ürün bilgilerine göre 4 sahnelik reklam akışı hazırlandı.",
      renewed:"Yeni sahne planı hazırlandı.",
      missing:"Önce ürün adı ve kısa açıklamayı tamamla.",
      draft:"Kural tabanlı taslak",
      scenes:[
        [
          ["Güçlü Açılış","{product}, ilk saniyede dikkat çekecek güçlü bir ürün karesiyle açılır."],
          ["Ürün Deneyimi","{product}, farklı açılar ve kullanım detaylarıyla gösterilir."],
          ["Fayda ve Mesaj","{benefit} mesajı kısa, anlaşılır ve hedef kitleye uygun biçimde vurgulanır."],
          ["Logo ve CTA","{brand}, {cta} çağrısıyla net ve akılda kalıcı biçimde kapanır."]
        ],
        [
          ["İhtiyacı Göster","{audience} için çözülmesi gereken ihtiyaç ilk karelerde hissettirilir."],
          ["{product} Çözümü","{product}, ihtiyaca cevap veren ana çözüm olarak sahneye girer."],
          ["Neden Tercih Edilmeli?","{benefit} özelliği ürünün temel tercih sebebi olarak gösterilir."],
          ["Harekete Geç","{cta} mesajı, {brand} logosu ve ürünün güçlü son karesiyle verilir."]
        ],
        [
          ["Merak Uyandır","{product} için dikkat çeken sinematik bir detay planıyla başlanır."],
          ["Detayı Yakala","Ürünün tasarımı, dokusu ve öne çıkan kullanım ayrıntıları gösterilir."],
          ["Sonucu Göster","{benefit} faydası gerçek kullanım sonucuna odaklanarak anlatılır."],
          ["Markayı Hatırlat","{brand} ve {cta} mesajı sade, premium bir kapanışla ekrana gelir."]
        ]
      ]
    },
    en:{
      refresh:"Refresh Scene Plan",
      ready:"Scene plan ready",
      readyText:"A four-scene advertising flow was prepared from the product brief.",
      renewed:"A new scene plan is ready.",
      missing:"Complete the product name and short description first.",
      draft:"Rule-based draft",
      scenes:[
        [
          ["Strong Opening","{product} opens with a strong product shot designed to capture attention immediately."],
          ["Product Experience","{product} is shown through multiple angles and practical usage details."],
          ["Benefit and Message","The message “{benefit}” is delivered clearly for the intended audience."],
          ["Logo and CTA","{brand} closes with a memorable product frame and the call to action “{cta}”."]
        ],
        [
          ["Show the Need","The audience need is established clearly in the opening frames."],
          ["The {product} Solution","{product} enters as the direct solution to that need."],
          ["Why Choose It?","The key benefit “{benefit}” becomes the central reason to choose the product."],
          ["Take Action","The film closes with {brand}, the product and the call to action “{cta}”."]
        ],
        [
          ["Create Curiosity","A cinematic detail shot introduces {product} with visual intrigue."],
          ["Focus on Detail","Design, texture and relevant usage details are shown with controlled motion."],
          ["Show the Result","The benefit “{benefit}” is demonstrated through the desired outcome."],
          ["Remember the Brand","{brand} and “{cta}” appear in a clean, premium closing frame."]
        ]
      ]
    }
  };

  function lang(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function t(key){return (COPY[lang()]&&COPY[lang()][key])||COPY.tr[key]||key}
  function clean(value){return String(value==null?"":value).replace(/\s+/g," ").trim()}
  function field(root,key){var input=root.querySelector('[data-adfilm-input="'+key+'"]');return input?input.type==="checkbox"?!!input.checked:clean(input.value):""}
  function choice(root,key,fallback){var button=root.querySelector('[data-adfilm-choice="'+key+'"] .is-selected[data-value]');return button?button.getAttribute("data-value"):fallback}
  function briefReady(root){return clean(field(root,"productName")).length>0&&clean(field(root,"description")).length>=10}
  function firstSentence(value){
    var text=clean(value),match=text.match(/^(.{1,120}?)(?:[.!?](?:\s|$)|$)/);
    return clean(match&&match[1]||text).slice(0,120);
  }
  function format(template,ctx){
    return String(template||"").replace(/\{(product|brand|benefit|audience|cta)\}/g,function(_,key){return ctx[key]||""}).replace(/\s+/g," ").replace(/\s+([,.!?])/g,"$1").trim();
  }
  function cutsFor(duration){
    var d=Number(duration)||15;
    return d===10?[0,2,5,8,10]:d===30?[0,5,15,24,30]:[0,3,8,12,15];
  }
  function clock(seconds){return "00:"+String(Math.max(0,Number(seconds)||0)).padStart(2,"0")}
  function notify(type,message,duration){
    try{
      var fn=window.toast&&window.toast[type];
      if(typeof fn==="function")return fn({message:message,duration:duration||3000});
      if(typeof window.showToast==="function")return window.showToast(message,type,{duration:duration||3000});
    }catch(_){}
    console.info("[ADFILM STORYBOARD]",message);
    return null;
  }

  function splitManualNarration(text,cuts){
    var words=clean(text).split(/\s+/).filter(Boolean),total=cuts[cuts.length-1]||15;
    if(!words.length)return ["","","",""];
    var result=[],cursor=0;
    for(var index=0;index<4;index++){
      var seconds=cuts[index+1]-cuts[index];
      var remaining=words.length-cursor;
      var count=index===3?remaining:Math.max(1,Math.round(words.length*(seconds/total)));
      count=Math.min(count,remaining-(3-index));
      if(count<1)count=Math.max(0,remaining);
      result.push(words.slice(cursor,cursor+count).join(" "));
      cursor+=count;
    }
    return result;
  }

  function context(root){
    var product=clean(field(root,"productName"))||(lang()==="en"?"Product":"Ürün");
    var brand=clean(field(root,"brandName"))||product;
    var description=clean(field(root,"description"));
    var audience=clean(field(root,"targetAudience"))||(lang()==="en"?"the target audience":"hedef kitle");
    var cta=clean(field(root,"cta"))||(lang()==="en"?"Discover now":"Şimdi keşfet");
    return{
      product:product,
      brand:brand,
      description:description,
      benefit:firstSentence(description)||(lang()==="en"?"its strongest benefit":"en güçlü faydası"),
      audience:audience,
      cta:cta,
      duration:choice(root,"duration","15"),
      aspectRatio:choice(root,"aspectRatio","9:16"),
      quality:choice(root,"quality","1080p"),
      sceneStyle:choice(root,"sceneStyle","premium"),
      scriptMode:choice(root,"scriptMode","ai"),
      narrationText:clean(field(root,"narrationText")),
      voiceEnabled:!!field(root,"voiceEnabled")
    };
  }

  function generatedNarration(ctx,index,title,text){
    if(!ctx.voiceEnabled)return"";
    var tr=lang()==="tr";
    if(index===0)return tr?(ctx.brand+" sunar: "+ctx.product+". "+ctx.benefit+"."):(ctx.brand+" presents "+ctx.product+". "+ctx.benefit+".");
    if(index===1)return tr?(ctx.product+", ihtiyacınıza uyum sağlayan deneyimiyle öne çıkar."):(ctx.product+" stands out through an experience designed around your needs.");
    if(index===2)return tr?(ctx.benefit+". Farkı kısa sürede görün."):(ctx.benefit+". See the difference quickly.");
    return tr?(ctx.cta+". "+ctx.brand+" ile şimdi tanışın."):(ctx.cta+". Discover "+ctx.brand+" today.");
  }

  function visualPrompt(ctx,index,title,text){
    var roles=["attention-grabbing opening hero shot","multi-angle product experience shot","benefit-focused proof and result shot","clean logo and call-to-action closing shot"];
    return[
      "Commercial advertising scene",
      "product: "+ctx.product,
      "brand: "+ctx.brand,
      "scene role: "+roles[index],
      "scene title: "+title,
      "message: "+text,
      "visual style: "+ctx.sceneStyle,
      "aspect ratio: "+ctx.aspectRatio,
      "preserve exact product identity, shape, colors, label and logo",
      "premium studio lighting, coherent campaign art direction, realistic materials",
      "no invented branding, no deformed product, no unreadable text"
    ].join(", ");
  }

  function makePlan(root,nextVariant){
    var ctx=context(root),cuts=cutsFor(ctx.duration),templates=COPY[lang()].scenes[nextVariant%COPY[lang()].scenes.length];
    var manualParts=ctx.scriptMode==="manual"&&ctx.narrationText?splitManualNarration(ctx.narrationText,cuts):null;
    var scenes=templates.map(function(template,index){
      var title=format(template[0],ctx),text=format(template[1],ctx);
      return{
        id:index+1,
        start:cuts[index],
        end:cuts[index+1],
        time:clock(cuts[index])+"–"+clock(cuts[index+1]),
        title:title,
        description:text,
        narration:manualParts?manualParts[index]:generatedNarration(ctx,index,title,text),
        onScreenText:index===0?ctx.product:index===3?ctx.cta:title,
        visualPrompt:visualPrompt(ctx,index,title,text),
        negativePrompt:"distorted product, changed logo, extra objects, duplicate product, unreadable typography, watermark"
      };
    });
    return{
      version:1,
      source:"rule-v1",
      variant:nextVariant%COPY[lang()].scenes.length,
      generatedAt:new Date().toISOString(),
      brief:{productName:ctx.product,brandName:ctx.brand,description:ctx.description,targetAudience:ctx.audience,cta:ctx.cta},
      settings:{duration:ctx.duration,aspectRatio:ctx.aspectRatio,quality:ctx.quality,sceneStyle:ctx.sceneStyle,scriptMode:ctx.scriptMode,voiceEnabled:ctx.voiceEnabled},
      scenes:scenes
    };
  }

  function expose(plan,root){
    window.AIVOAdFilmStoryboardState=plan;
    try{localStorage.setItem("aivo_adfilm_storyboard_v1",JSON.stringify(plan))}catch(_){}
    try{document.dispatchEvent(new CustomEvent("aivo:adfilm-storyboard-updated",{detail:{root:root,storyboard:plan}}))}catch(_){}
  }

  function render(root,plan,animate){
    var cards=Array.from(root.querySelectorAll(".adfilm-scene"));
    plan.scenes.forEach(function(scene,index){
      var card=cards[index];if(!card)return;
      var title=card.querySelector("b"),description=card.querySelector("p"),time=card.querySelector(".adfilm-scene__thumb span");
      if(title){title.removeAttribute("data-adfilm-i18n");title.textContent=scene.title}
      if(description){description.removeAttribute("data-adfilm-i18n");description.textContent=scene.description}
      if(time)time.textContent=scene.time;
      card.dataset.scenePrompt=scene.visualPrompt;
      card.dataset.sceneNarration=scene.narration;
      card.dataset.sceneOnscreen=scene.onScreenText;
      card.classList.add("has-generated-plan");
    });
    var status=root.querySelector("[data-adfilm-storyboard-status]");
    if(status){status.classList.add("is-ready");status.querySelector("b").textContent=t("ready");status.querySelector("small").textContent=t("draft")}
    if(animate){
      var section=root.querySelector(".adfilm-card--storyboard");if(section){section.classList.remove("is-refreshing");void section.offsetWidth;section.classList.add("is-refreshing");setTimeout(function(){section.classList.remove("is-refreshing")},520)}
    }
    expose(plan,root);
  }

  function signature(root){
    var ctx=context(root);
    return [ctx.product,ctx.brand,ctx.description,ctx.audience,ctx.cta,ctx.duration,ctx.aspectRatio,ctx.sceneStyle,ctx.scriptMode,ctx.narrationText,ctx.voiceEnabled,lang()].join("|");
  }

  function setButtonState(root){
    var button=root.querySelector("[data-adfilm-regenerate]");if(!button)return;
    var label=button.querySelector("span");
    if(label){label.removeAttribute("data-adfilm-i18n");label.textContent=t("refresh")}
    var ready=briefReady(root);
    button.disabled=!ready;
    button.setAttribute("aria-disabled",ready?"false":"true");
    button.title=ready?t("refresh"):t("missing");
    button.classList.toggle("is-ready",ready);
  }

  function generate(root,options){
    options=options||{};
    setButtonState(root);
    if(!briefReady(root))return null;
    var next=options.nextVariant?variant+1:variant;
    variant=next%COPY[lang()].scenes.length;
    var plan=makePlan(root,variant);
    render(root,plan,!!options.animate);
    lastSignature=signature(root);
    if(options.toast)notify("success","renewed" in options?options.renewed:t("renewed"),2500);
    return plan;
  }

  function schedule(root){
    clearTimeout(autoTimer);
    setButtonState(root);
    if(!briefReady(root))return;
    autoTimer=setTimeout(function(){var nextSignature=signature(root);if(nextSignature!==lastSignature)generate(root,{animate:false,toast:false})},420);
  }

  function ensureStatus(root){
    var head=root.querySelector(".adfilm-card--storyboard .adfilm-card__head");if(!head||head.querySelector("[data-adfilm-storyboard-status]"))return;
    var status=document.createElement("div");
    status.className="adfilm-storyboard-status";
    status.setAttribute("data-adfilm-storyboard-status","");
    status.innerHTML='<span></span><div><b>'+t("ready")+'</b><small>'+t("draft")+'</small></div>';
    var refresh=head.querySelector("[data-adfilm-regenerate]");
    if(refresh)head.insertBefore(status,refresh);else head.appendChild(status);
  }

  function bind(root){
    if(!root||root.__adfilmStoryboardBound)return;
    root.__adfilmStoryboardBound=true;activeRoot=root;ensureStatus(root);setButtonState(root);

    root.addEventListener("click",function(event){
      var button=event.target.closest("[data-adfilm-regenerate]");if(!button)return;
      event.preventDefault();event.stopImmediatePropagation();
      if(!briefReady(root)){notify("warning",t("missing"),3200);setButtonState(root);return}
      button.disabled=true;button.classList.add("is-loading");
      setTimeout(function(){generate(root,{nextVariant:true,animate:true,toast:true});button.classList.remove("is-loading");setButtonState(root)},320);
    },true);

    root.addEventListener("input",function(event){if(event.target.closest("[data-adfilm-input]"))schedule(root)},true);
    root.addEventListener("change",function(event){if(event.target.closest("[data-adfilm-input],[data-adfilm-choice]"))schedule(root)},true);
    root.addEventListener("click",function(event){if(event.target.closest("[data-adfilm-choice] button[data-value]"))setTimeout(function(){schedule(root)},0)},true);

    if(briefReady(root))generate(root,{animate:false,toast:false});
  }

  function refreshLanguage(){
    if(!activeRoot)return;
    ensureStatus(activeRoot);setButtonState(activeRoot);
    if(briefReady(activeRoot))generate(activeRoot,{animate:false,toast:false});
  }

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){bind(event.detail.root)},140)});
  window.addEventListener("storage",function(event){if(event&&(event.key==="aivo_language"||event.key==="aivo_lang"))setTimeout(refreshLanguage,80)});
  var observer=new MutationObserver(function(){var root=document.querySelector('[data-module-root][data-module="adfilm"]');if(root&&!root.__adfilmStoryboardBound)setTimeout(function(){bind(root)},100)});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){bind(document.querySelector('[data-module-root][data-module="adfilm"]'))},{once:true});else bind(document.querySelector('[data-module-root][data-module="adfilm"]'));
})();
