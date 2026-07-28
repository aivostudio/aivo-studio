/* =========================================================
   AIVO — AI REKLAM FILMI / CREATIVE PLAN
   Separates the hero product, product angles and scene references,
   and gives users a guided advertising-director workflow.
   ========================================================= */
(function AIVO_AD_FILM_CREATIVE_PLAN(){
  "use strict";
  if(window.__AIVO_AD_FILM_CREATIVE_PLAN__)return;
  window.__AIVO_AD_FILM_CREATIVE_PLAN__=true;

  var STORAGE_KEY="aivo_adfilm_creative_plan_v1";
  var LAYOUT_KEY="aivo_adfilm_reference_layout_v1";
  var DB_NAME="aivo_adfilm_creative_roles";
  var DB_VERSION=1;
  var STORE_NAME="roleMedia";
  var RECORD_KEY="basic";
  var previewUrls=[];
  var syncingLegacy=false;
  var restoringRoles=false;

  var COPY={
    tr:{
      planTitle:"Reklam Planı",
      planSub:"Ana ürünü, reklam fikrini ve sahne akışını netleştir.",
      required:"Plan gerekli",
      autoMode:"AIVO tasarlasın",
      manualMode:"Sahneleri ben belirleyeceğim",
      conceptTitle:"Reklam yaklaşımı",
      conceptAuto:"Ürüne göre otomatik",
      conceptLifestyle:"Yaşam tarzı",
      conceptStudio:"Premium stüdyo",
      conceptPerformance:"Hareket / performans",
      conceptHint:"AIVO ürün bilgilerini, ana görseli ve seçtiğin yaklaşımı birleştirerek sahne planını hazırlayacak.",
      direction:"Reklam fikri ve yönetmen talimatı",
      directionOptional:"İsteğe bağlı",
      directionPlaceholder:"Örn: Ürün modern bir mutfakta sabah ışığında kullanılsın. Yakın plan detaylar, yumuşak kamera hareketleri ve güçlü bir final ürün çekimi olsun.",
      directionHint:"Mekânı, atmosferi, ürünün ne yapacağını ve görmek istediğin önemli anları yaz. Boş bırakırsan AIVO ürüne göre tasarlar.",
      scenesTitle:"5 sahnelik akış",
      scenesHint:"Kısa ve net yaz. Sahne görsellerini Medya Yükle bölümünde aynı sırayla ekleyebilirsin.",
      scene1:"Sahne 1 · Açılış",
      scene2:"Sahne 2 · Problem / ihtiyaç",
      scene3:"Sahne 3 · Ürün kullanımı",
      scene4:"Sahne 4 · Fayda / duygu",
      scene5:"Sahne 5 · Final ürün çekimi",
      scenePlaceholder:"Bu sahnede ne olsun?",
      mediaTitle:"Akıllı Referans Yükleme",
      mediaSub:"Ana ürünü ve sahne referanslarını görevlerine göre ayrı yükle.",
      refs:"referans",
      hero:"Ana Ürün / Ana Karakter",
      heroHint:"Zorunlu · Her sahnede korunacak ana görsel",
      heroBadge:"@Image1",
      angles:"Ürünün Diğer Açıları",
      anglesHint:"En fazla 3 · Aynı ürünün farklı açıları",
      anglesBadge:"@Image2–4",
      scenes:"Sahne / Ortam Referansları",
      scenesUploadHint:"En fazla 5 · Sahne sırasına göre ekle",
      scenesBadge:"@Image5–9",
      logo:"Logo",
      logoHint:"Videoya sonradan temiz olarak eklenecek",
      logoBadge:"Overlay",
      mapHero:"Ana ürün sabit",
      mapAngles:"Ürün detayları",
      mapScenes:"Sahne ve atmosfer",
      mediaNote:"Seedance görselleri sırayla okuyacak: önce ana ürün, sonra ürün açıları, ardından sahne referansları.",
      mainTag:"ANA",
      angleTag:"AÇI",
      sceneTag:"SAHNE",
      maxHero:"Ana ürün için yalnızca 1 görsel seçebilirsin.",
      maxAngles:"En fazla 3 ürün açısı ekleyebilirsin.",
      maxScenes:"En fazla 5 sahne referansı ekleyebilirsin.",
      invalidImage:"Yalnızca JPG, PNG veya WEBP görsel kullan.",
      tooLarge:"Her görsel en fazla 12 MB olabilir.",
      remove:"Kaldır",
      restored:"Akıllı referans görsellerin bu cihazdan geri yüklendi."
    },
    en:{
      planTitle:"Advertising Plan",
      planSub:"Define the hero product, creative direction and scene flow.",
      required:"Plan required",
      autoMode:"Let AIVO design it",
      manualMode:"I will define the scenes",
      conceptTitle:"Advertising approach",
      conceptAuto:"Automatic for the product",
      conceptLifestyle:"Lifestyle",
      conceptStudio:"Premium studio",
      conceptPerformance:"Motion / performance",
      conceptHint:"AIVO will combine the product brief, hero image and selected approach to build the scene plan.",
      direction:"Advertising idea and director instructions",
      directionOptional:"Optional",
      directionPlaceholder:"Example: Use the product in a modern kitchen with soft morning light. Include detail close-ups, smooth camera motion and a strong final product shot.",
      directionHint:"Describe the location, atmosphere, what the product should do and the key moments you want. Leave it empty for AIVO to design automatically.",
      scenesTitle:"Five-scene flow",
      scenesHint:"Keep each scene clear and concise. Add scene reference images in the same order under Media Upload.",
      scene1:"Scene 1 · Opening",
      scene2:"Scene 2 · Problem / need",
      scene3:"Scene 3 · Product in use",
      scene4:"Scene 4 · Benefit / emotion",
      scene5:"Scene 5 · Final product shot",
      scenePlaceholder:"What should happen in this scene?",
      mediaTitle:"Smart Reference Upload",
      mediaSub:"Upload the hero product and scene references in separate roles.",
      refs:"references",
      hero:"Hero Product / Main Character",
      heroHint:"Required · The main visual preserved across scenes",
      heroBadge:"@Image1",
      angles:"Additional Product Angles",
      anglesHint:"Up to 3 · Different views of the same product",
      anglesBadge:"@Image2–4",
      scenes:"Scene / Environment References",
      scenesUploadHint:"Up to 5 · Add them in scene order",
      scenesBadge:"@Image5–9",
      logo:"Logo",
      logoHint:"Added cleanly after video generation",
      logoBadge:"Overlay",
      mapHero:"Hero product locked",
      mapAngles:"Product details",
      mapScenes:"Scenes and atmosphere",
      mediaNote:"Seedance will read references in order: hero product first, product angles next, then scene references.",
      mainTag:"HERO",
      angleTag:"ANGLE",
      sceneTag:"SCENE",
      maxHero:"Choose only one hero product image.",
      maxAngles:"You can add up to 3 product angles.",
      maxScenes:"You can add up to 5 scene references.",
      invalidImage:"Use JPG, PNG or WEBP images only.",
      tooLarge:"Each image can be up to 12 MB.",
      remove:"Remove",
      restored:"Your smart reference images were restored on this device."
    }
  };

  function language(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function t(key){return(COPY[language()]&&COPY[language()][key])||COPY.tr[key]||key}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function clean(value){return String(value==null?"":value).trim()}
  function escapeHtml(value){return String(value||"").replace(/[&<>"']/g,function(ch){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]})}
  function list(input){return input?Array.from(input.files||[]):[]}
  function input(scope,key){return scope.querySelector('[data-adfilm-role-file="'+key+'"]')}
  function legacyInput(scope){return scope.querySelector('[data-adfilm-file="productImages"]')}
  function setFiles(field,files,dispatch){
    if(!field)return;
    var transfer=new DataTransfer();
    files.forEach(function(file){transfer.items.add(file)});
    field.files=transfer.files;
    if(dispatch!==false)field.dispatchEvent(new Event("change",{bubbles:true}));
  }
  function notify(message,type){
    try{
      var fn=window.toast&&window.toast[type||"info"];
      if(typeof fn==="function"){fn({message:message,duration:2800});return}
      if(typeof window.showToast==="function"){window.showToast(message,type||"info");return}
    }catch(_){}
  }
  function validImage(file){return !!file&&(/^image\/(jpeg|png|webp)$/i.test(file.type)||/\.(jpe?g|png|webp)$/i.test(file.name||""))}
  function validate(files,max){
    var accepted=[],invalid=false,large=false;
    files.forEach(function(file){
      if(!validImage(file)){invalid=true;return}
      if(file.size>12*1024*1024){large=true;return}
      if(accepted.length<max)accepted.push(file);
    });
    if(invalid)notify(t("invalidImage"),"warning");
    if(large)notify(t("tooLarge"),"warning");
    return accepted;
  }

  function planIcon(){return '<svg viewBox="0 0 24 24" fill="none"><path d="M5 4h14v16H5V4Z" stroke="currentColor" stroke-width="1.7"/><path d="M8 8h8M8 12h5M8 16h7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="m16 13 1.5 1.5L20 12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'}
  function mediaIcon(){return '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.7"/><circle cx="8.5" cy="9" r="2" stroke="currentColor" stroke-width="1.7"/><path d="m5 18 4.5-4.5 3.2 3.2 2.1-2.1L19 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'}
  function uploadIcon(){return '<svg viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'}

  function field(scope,key){return scope.querySelector('[data-adfilm-input="'+key+'"]')}
  function setField(scope,key,value,silent){
    var el=field(scope,key);if(!el)return;
    el.value=value==null?"":String(value);
    if(!silent)el.dispatchEvent(new Event(el.tagName==="SELECT"?"change":"input",{bubbles:true}));
  }
  function planState(scope){
    return{
      mode:(field(scope,"planMode")||{}).value||"auto",
      concept:(field(scope,"planConcept")||{}).value||"auto",
      direction:(field(scope,"creativeDirection")||{}).value||"",
      scenes:[1,2,3,4,5].map(function(index){return(field(scope,"scene"+index)||{}).value||""}),
      referenceLayout:{heroCount:list(input(scope,"hero")).length,angleCount:list(input(scope,"angles")).length,sceneCount:list(input(scope,"scenes")).length}
    };
  }
  function savePlan(scope){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(planState(scope)));localStorage.setItem(LAYOUT_KEY,JSON.stringify(planState(scope).referenceLayout))}catch(_){} }
  function readPlan(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"null")}catch(_){return null}}

  function planMarkup(){
    var sceneRows=[1,2,3,4,5].map(function(index){
      return '<label class="adfilm-scene-line'+(index===5?' is-last':'')+'"><span data-plan-copy="scene'+index+'">'+t("scene"+index)+'</span><input type="text" maxlength="180" data-adfilm-input="scene'+index+'" data-plan-placeholder="scenePlaceholder" placeholder="'+escapeHtml(t("scenePlaceholder"))+'"></label>';
    }).join("");
    return '<article class="adfilm-card adfilm-card--creative-plan">'+
      '<div class="adfilm-card__head"><span class="adfilm-card__icon" aria-hidden="true">'+planIcon()+'</span><div class="adfilm-card__heading"><span class="adfilm-card__eyebrow">02</span><h2 data-plan-copy="planTitle">'+t("planTitle")+'</h2><p data-plan-copy="planSub">'+t("planSub")+'</p></div><span class="adfilm-card__required" data-plan-copy="required">'+t("required")+'</span></div>'+
      '<input type="hidden" value="auto" data-adfilm-input="planMode"><input type="hidden" value="auto" data-adfilm-input="planConcept">'+
      '<div class="adfilm-plan-mode" role="tablist"><button type="button" class="is-selected" data-plan-mode="auto" data-plan-copy="autoMode">'+t("autoMode")+'</button><button type="button" data-plan-mode="manual" data-plan-copy="manualMode">'+t("manualMode")+'</button></div>'+
      '<div class="adfilm-plan-layout">'+
        '<section class="adfilm-plan-concept"><b data-plan-copy="conceptTitle">'+t("conceptTitle")+'</b><div class="adfilm-plan-concept__grid"><button type="button" class="is-selected" data-plan-concept="auto" data-plan-copy="conceptAuto">'+t("conceptAuto")+'</button><button type="button" data-plan-concept="lifestyle" data-plan-copy="conceptLifestyle">'+t("conceptLifestyle")+'</button><button type="button" data-plan-concept="studio" data-plan-copy="conceptStudio">'+t("conceptStudio")+'</button><button type="button" data-plan-concept="performance" data-plan-copy="conceptPerformance">'+t("conceptPerformance")+'</button></div><p data-plan-copy="conceptHint">'+t("conceptHint")+'</p></section>'+
        '<label class="adfilm-plan-direction"><span><b data-plan-copy="direction">'+t("direction")+'</b><em data-plan-copy="directionOptional">'+t("directionOptional")+'</em></span><textarea maxlength="700" rows="5" data-adfilm-input="creativeDirection" data-plan-placeholder="directionPlaceholder" placeholder="'+escapeHtml(t("directionPlaceholder"))+'"></textarea><small><span data-plan-copy="directionHint">'+t("directionHint")+'</span><b><i data-plan-direction-count>0</i> / 700</b></small></label>'+
      '</div>'+
      '<section class="adfilm-manual-scenes" data-plan-manual hidden><div class="adfilm-manual-scenes__head"><div><b data-plan-copy="scenesTitle">'+t("scenesTitle")+'</b><small data-plan-copy="scenesHint">'+t("scenesHint")+'</small></div><span>01—05</span></div><div class="adfilm-scene-lines">'+sceneRows+'</div></section>'+
    '</article>';
  }

  function installPlan(scope){
    var product=scope.querySelector(".adfilm-card--product");if(!product)return null;
    var card=scope.querySelector(".adfilm-card--creative-plan");
    if(!card){product.insertAdjacentHTML("afterend",planMarkup());card=scope.querySelector(".adfilm-card--creative-plan")}
    if(card.__bound)return card;
    card.__bound=true;
    card.addEventListener("click",function(event){
      var mode=event.target.closest("[data-plan-mode]");
      if(mode){event.preventDefault();setField(scope,"planMode",mode.getAttribute("data-plan-mode"));syncPlanUi(scope);savePlan(scope);return}
      var concept=event.target.closest("[data-plan-concept]");
      if(concept){event.preventDefault();setField(scope,"planConcept",concept.getAttribute("data-plan-concept"));syncPlanUi(scope);savePlan(scope)}
    });
    card.addEventListener("input",function(){syncDirectionCount(scope);savePlan(scope)},true);
    return card;
  }

  function syncDirectionCount(scope){
    var textarea=field(scope,"creativeDirection"),count=scope.querySelector("[data-plan-direction-count]");
    if(count)count.textContent=String((textarea&&textarea.value||"").length);
  }
  function syncPlanUi(scope){
    var mode=(field(scope,"planMode")||{}).value||"auto",concept=(field(scope,"planConcept")||{}).value||"auto";
    scope.querySelectorAll("[data-plan-mode]").forEach(function(button){button.classList.toggle("is-selected",button.getAttribute("data-plan-mode")===mode)});
    scope.querySelectorAll("[data-plan-concept]").forEach(function(button){button.classList.toggle("is-selected",button.getAttribute("data-plan-concept")===concept)});
    var manual=scope.querySelector("[data-plan-manual]"),conceptSection=scope.querySelector(".adfilm-plan-concept");
    if(manual)manual.hidden=mode!=="manual";
    if(conceptSection)conceptSection.classList.toggle("is-muted",mode==="manual");
    syncDirectionCount(scope);
  }
  function applyPlan(scope,plan,silent){
    if(!plan)return;
    setField(scope,"planMode",plan.mode||"auto",!!silent);
    setField(scope,"planConcept",plan.concept||"auto",!!silent);
    setField(scope,"creativeDirection",plan.direction||"",!!silent);
    (plan.scenes||[]).slice(0,5).forEach(function(value,index){setField(scope,"scene"+(index+1),value||"",!!silent)});
    syncPlanUi(scope);
  }

  function roleZone(key,title,hint,badge,multiple,legacy){
    var inputHtml=legacy?"":'<input type="file" accept="image/png,image/jpeg,image/webp" '+(multiple?"multiple ":"")+'data-adfilm-role-file="'+key+'">';
    return '<label class="adfilm-role-zone adfilm-role-zone--'+key+'">'+inputHtml+(legacy||"")+'<span class="adfilm-role-zone__badge">'+badge+'</span><span class="adfilm-role-zone__icon">'+uploadIcon()+'</span><b data-plan-copy="'+title+'">'+t(title)+'</b><small data-plan-copy="'+hint+'">'+t(hint)+'</small><em data-role-count="'+key+'">0</em></label>';
  }

  function installMedia(scope){
    var card=scope.querySelector(".adfilm-card--media");if(!card)return;
    var head=card.querySelector(".adfilm-card__head");
    var oldProduct=legacyInput(scope),oldLogo=scope.querySelector('[data-adfilm-file="logo"]'),oldExtra=scope.querySelector('[data-adfilm-file="extraMedia"]');
    if(!head||!oldProduct||!oldLogo)return;
    var heading=head.querySelector(".adfilm-card__heading"),counter=head.querySelector(".adfilm-card__counter");
    if(heading){var eye=heading.querySelector(".adfilm-card__eyebrow"),h2=heading.querySelector("h2"),p=heading.querySelector("p");if(eye)eye.textContent="03";if(h2){h2.removeAttribute("data-adfilm-i18n");h2.setAttribute("data-plan-copy","mediaTitle");h2.textContent=t("mediaTitle")}if(p){p.removeAttribute("data-adfilm-i18n");p.setAttribute("data-plan-copy","mediaSub");p.textContent=t("mediaSub")}}
    Array.from(card.children).forEach(function(child){if(child!==head)child.remove()});
    oldProduct.remove();oldLogo.remove();if(oldExtra)oldExtra.remove();
    oldProduct.multiple=true;oldProduct.hidden=true;oldProduct.setAttribute("aria-hidden","true");
    oldLogo.hidden=false;oldLogo.removeAttribute("aria-hidden");
    var heroLegacy='<input type="file" accept="image/png,image/jpeg,image/webp" data-adfilm-role-file="hero">'+oldProduct.outerHTML;
    var logoLegacy=oldLogo.outerHTML;
    card.insertAdjacentHTML("beforeend",'<section class="adfilm-role-media">'+
      '<div class="adfilm-role-primary">'+roleZone("hero","hero","heroHint",t("heroBadge"),false,heroLegacy)+roleZone("angles","angles","anglesHint",t("anglesBadge"),true,"")+'</div>'+
      '<div class="adfilm-role-secondary">'+roleZone("scenes","scenes","scenesUploadHint",t("scenesBadge"),true,"")+roleZone("logo","logo","logoHint",t("logoBadge"),false,logoLegacy)+'</div>'+
      '<div class="adfilm-reference-map"><span><i>1</i><b data-plan-copy="mapHero">'+t("mapHero")+'</b></span><span><i>2–4</i><b data-plan-copy="mapAngles">'+t("mapAngles")+'</b></span><span><i>5–9</i><b data-plan-copy="mapScenes">'+t("mapScenes")+'</b></span></div>'+
      '<div class="adfilm-role-preview" data-role-preview></div>'+
      '<div class="adfilm-media-note"><span aria-hidden="true">✦</span><span data-plan-copy="mediaNote">'+t("mediaNote")+'</span></div>'+
      (oldExtra?'<div class="adfilm-compat-media" hidden>'+oldExtra.outerHTML+'</div>':'')+
    '</section>');
    card.classList.add("is-role-media");
    card.querySelectorAll("[data-adfilm-role-file]").forEach(function(field){field.addEventListener("change",function(){handleRoleChange(scope,field)})});
    renderRoleMedia(scope);
    updateMediaCounter(scope);
  }

  function roleLimits(key){return key==="hero"?1:key==="angles"?3:5}
  function handleRoleChange(scope,field){
    var key=field.getAttribute("data-adfilm-role-file"),selected=validate(list(field),roleLimits(key));
    if(selected.length!==list(field).length)setFiles(field,selected,false);
    if(key==="hero")syncHeroLegacy(scope);
    renderRoleMedia(scope);updateMediaCounter(scope);savePlan(scope);scheduleRoleSave(scope);
  }
  function syncHeroLegacy(scope){
    var legacy=legacyInput(scope),hero=list(input(scope,"hero"));if(!legacy)return;
    syncingLegacy=true;setFiles(legacy,hero.slice(0,1),true);setTimeout(function(){syncingLegacy=false},30);
  }
  function clearPreviewUrls(){previewUrls.forEach(function(url){try{URL.revokeObjectURL(url)}catch(_){}});previewUrls=[]}
  function renderRoleMedia(scope){
    clearPreviewUrls();
    ["hero","angles","scenes"].forEach(function(key){
      var zone=input(scope,key)&&input(scope,key).closest(".adfilm-role-zone"),count=scope.querySelector('[data-role-count="'+key+'"]'),files=list(input(scope,key));
      if(zone)zone.classList.toggle("has-file",files.length>0);if(count)count.textContent=String(files.length);
    });
    var logo=scope.querySelector('[data-adfilm-file="logo"]'),logoZone=logo&&logo.closest(".adfilm-role-zone"),logoCount=scope.querySelector('[data-role-count="logo"]');
    if(logoZone)logoZone.classList.toggle("has-file",list(logo).length>0);if(logoCount)logoCount.textContent=String(list(logo).length);
    var preview=scope.querySelector("[data-role-preview]");if(!preview)return;
    var entries=[];
    list(input(scope,"hero")).forEach(function(file){entries.push({file:file,tag:t("mainTag"),index:1,role:"hero"})});
    list(input(scope,"angles")).forEach(function(file,index){entries.push({file:file,tag:t("angleTag"),index:2+index,role:"angles",roleIndex:index})});
    list(input(scope,"scenes")).forEach(function(file,index){entries.push({file:file,tag:t("sceneTag")+" "+(index+1),index:5+index,role:"scenes",roleIndex:index})});
    if(!entries.length){preview.innerHTML="";preview.hidden=true;return}
    preview.hidden=false;
    preview.innerHTML=entries.map(function(entry){
      var url=URL.createObjectURL(entry.file);previewUrls.push(url);
      return '<article class="adfilm-role-thumb"><div style="background-image:url(&quot;'+url.replace(/&/g,"&amp;").replace(/"/g,"%22")+'&quot;)"><span>@Image'+entry.index+'</span></div><b>'+escapeHtml(entry.tag)+'</b><button type="button" data-role-remove="'+entry.role+'" data-role-index="'+(entry.roleIndex==null?0:entry.roleIndex)+'" title="'+escapeHtml(t("remove"))+'">×</button></article>';
    }).join("");
    if(!preview.__bound){preview.__bound=true;preview.addEventListener("click",function(event){var button=event.target.closest("[data-role-remove]");if(!button)return;event.preventDefault();removeRoleFile(scope,button.getAttribute("data-role-remove"),Number(button.getAttribute("data-role-index")||0))})}
  }
  function removeRoleFile(scope,key,index){
    var field=input(scope,key),files=list(field);if(!field||!files.length)return;
    files.splice(index,1);setFiles(field,files,false);if(key==="hero")syncHeroLegacy(scope);renderRoleMedia(scope);updateMediaCounter(scope);scheduleRoleSave(scope);savePlan(scope);
  }
  function updateMediaCounter(scope){
    var card=scope.querySelector(".adfilm-card--media"),counter=card&&card.querySelector(".adfilm-card__counter");if(!counter)return;
    var count=list(input(scope,"hero")).length+list(input(scope,"angles")).length+list(input(scope,"scenes")).length;
    counter.innerHTML='<b>'+count+'</b><span> / 9 '+t("refs")+'</span>';
  }

  function openDb(){
    return new Promise(function(resolve,reject){
      if(!("indexedDB" in window)){reject(new Error("IndexedDB unavailable"));return}
      var request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=function(){var db=request.result;if(!db.objectStoreNames.contains(STORE_NAME))db.createObjectStore(STORE_NAME,{keyPath:"id"})};
      request.onsuccess=function(){resolve(request.result)};request.onerror=function(){reject(request.error||new Error("IndexedDB failed"))};
    });
  }
  function cloneFile(file){return{name:file.name||"image",type:file.type||"image/png",lastModified:file.lastModified||Date.now(),blob:file.slice(0,file.size,file.type||"image/png")}}
  function fileFrom(item){try{return new File([item.blob],item.name,{type:item.type,lastModified:item.lastModified})}catch(_){return item.blob}}
  function roleRecord(scope){return{id:RECORD_KEY,updatedAt:new Date().toISOString(),hero:list(input(scope,"hero")).map(cloneFile),angles:list(input(scope,"angles")).map(cloneFile),scenes:list(input(scope,"scenes")).map(cloneFile)}}
  function saveRoleMedia(scope){
    if(restoringRoles)return;
    openDb().then(function(db){var tx=db.transaction(STORE_NAME,"readwrite");tx.objectStore(STORE_NAME).put(roleRecord(scope));tx.oncomplete=function(){db.close()};tx.onerror=function(){db.close()}}).catch(function(){});
  }
  var roleSaveTimer=null;
  function scheduleRoleSave(scope){clearTimeout(roleSaveTimer);roleSaveTimer=setTimeout(function(){saveRoleMedia(scope)},100)}
  function restoreRoleMedia(scope){
    restoringRoles=true;
    return openDb().then(function(db){return new Promise(function(resolve,reject){var req=db.transaction(STORE_NAME,"readonly").objectStore(STORE_NAME).get(RECORD_KEY);req.onsuccess=function(){db.close();resolve(req.result||null)};req.onerror=function(){db.close();reject(req.error)}})}).then(function(record){
      if(record){setFiles(input(scope,"hero"),(record.hero||[]).map(fileFrom),false);setFiles(input(scope,"angles"),(record.angles||[]).map(fileFrom),false);setFiles(input(scope,"scenes"),(record.scenes||[]).map(fileFrom),false);syncHeroLegacy(scope);renderRoleMedia(scope);updateMediaCounter(scope);notify(t("restored"),"info")}
      restoringRoles=false;return !!record;
    }).catch(function(){restoringRoles=false;return false});
  }
  function migrateLegacy(scope){
    if(list(input(scope,"hero")).length||list(input(scope,"angles")).length||list(input(scope,"scenes")).length)return;
    var files=list(legacyInput(scope));if(!files.length)return;
    var layout=null;try{layout=JSON.parse(localStorage.getItem(LAYOUT_KEY)||"null")}catch(_){}
    var heroCount=Math.min(1,Number(layout&&layout.heroCount)||1),angleCount=Math.min(3,Number(layout&&layout.angleCount)||Math.min(3,Math.max(0,files.length-heroCount)));
    setFiles(input(scope,"hero"),files.slice(0,heroCount),false);setFiles(input(scope,"angles"),files.slice(heroCount,heroCount+angleCount),false);setFiles(input(scope,"scenes"),files.slice(heroCount+angleCount,heroCount+angleCount+5),false);
    syncHeroLegacy(scope);renderRoleMedia(scope);updateMediaCounter(scope);scheduleRoleSave(scope);
  }

  function collectCloudPlan(scope){return planState(scope)}
  function augmentPayload(payload){
    var scope=root();if(!scope)return payload;
    return Object.assign({},payload||{},{creativePlan:collectCloudPlan(scope)});
  }
  function patchCloudApi(){
    var api=window.AIVOAdFilmProjects;if(!api||api.__creativePlanPatched)return;
    api.__creativePlanPatched=true;
    var create=api.createProject.bind(api),update=api.updateProject.bind(api);
    api.createProject=function(project){return create(augmentPayload(project))};
    api.updateProject=function(id,project){return update(id,augmentPayload(project))};
  }

  function renumber(scope){
    [[".adfilm-card--product","01"],[".adfilm-card--creative-plan","02"],[".adfilm-card--media","03"],[".adfilm-card--voice","04"],[".adfilm-card--settings","05"]].forEach(function(item){var eye=scope.querySelector(item[0]+" .adfilm-card__eyebrow");if(eye)eye.textContent=item[1]});
  }
  function refreshLanguage(scope){
    if(!scope)return;
    scope.querySelectorAll("[data-plan-copy]").forEach(function(node){node.textContent=t(node.getAttribute("data-plan-copy"))});
    scope.querySelectorAll("[data-plan-placeholder]").forEach(function(node){node.setAttribute("placeholder",t(node.getAttribute("data-plan-placeholder")))});
    syncPlanUi(scope);renderRoleMedia(scope);updateMediaCounter(scope);
  }
  function setup(scope){
    if(!scope||!scope.isConnected)return;
    patchCloudApi();
    if(scope.__creativePlanReady){refreshLanguage(scope);return}
    scope.__creativePlanReady=true;scope.classList.add("is-creative-plan-ready");
    installPlan(scope);installMedia(scope);renumber(scope);
    applyPlan(scope,readPlan(),true);syncPlanUi(scope);
    restoreRoleMedia(scope).then(function(found){if(!found)setTimeout(function(){migrateLegacy(scope)},520)});
    scope.addEventListener("input",function(event){if(event.target.closest(".adfilm-card--creative-plan"))savePlan(scope)},true);
    scope.addEventListener("click",function(event){if(event.target.closest("[data-adfilm-draft-reset]")){try{localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(LAYOUT_KEY)}catch(_){}setTimeout(function(){["hero","angles","scenes"].forEach(function(key){setFiles(input(scope,key),[],false)});syncHeroLegacy(scope);renderRoleMedia(scope);updateMediaCounter(scope);saveRoleMedia(scope)},80)}},true);
    setTimeout(function(){renumber(scope);updateMediaCounter(scope)},700);
  }
  function schedule(scope){[40,180,520,1000].forEach(function(delay){setTimeout(function(){setup(scope||root())},delay)})}

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(event.detail.root)});
  document.addEventListener("aivo:adfilm-project-sync",function(event){var scope=root(),plan=event&&event.detail&&event.detail.project&&event.detail.project.creativePlan;if(scope&&plan){applyPlan(scope,plan,true);savePlan(scope)}});
  window.addEventListener("storage",function(event){if(event&&(event.key==="aivo_language"||event.key==="aivo_lang"))refreshLanguage(root())});
  window.addEventListener("pagehide",function(){var scope=root();if(scope){savePlan(scope);saveRoleMedia(scope)}clearPreviewUrls()});

  patchCloudApi();
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(root())},{once:true});else schedule(root());
})();