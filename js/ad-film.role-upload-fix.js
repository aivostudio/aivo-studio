/* =========================================================
   AIVO — AI REKLAM FILMI / ROLE UPLOAD HOTFIX
   - Keeps previously selected product-angle and scene files when the
     user opens the picker again.
   - Bridges smart-role media to the legacy live preview after the
     original file inputs were rebuilt by the creative-plan layout.
   - Shows the uploaded logo in the thumbnail tray as an overlay asset.
   ========================================================= */
(function AIVO_AD_FILM_ROLE_UPLOAD_FIX(){
  "use strict";
  if(window.__AIVO_AD_FILM_ROLE_UPLOAD_FIX__)return;
  window.__AIVO_AD_FILM_ROLE_UPLOAD_FIX__=true;

  var cache=new WeakMap();
  var LIMITS={hero:1,angles:3,scenes:5};
  var heroPreview={key:"",url:""};
  var logoPreview={key:"",url:""};

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function files(field){return field?Array.from(field.files||[]):[]}
  function identity(file){return[file&&file.name||"",Number(file&&file.size||0),file&&file.type||"",Number(file&&file.lastModified||0)].join("|")}
  function language(){
    var html=String(document.documentElement.lang||"").toLowerCase(),stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }
  function text(tr,en){return language()==="en"?en:tr}

  function assign(field,next){
    if(!field)return;
    var transfer=new DataTransfer();
    next.forEach(function(file){transfer.items.add(file)});
    field.files=transfer.files;
    cache.set(field,next.slice());
  }

  function merge(previous,incoming,limit){
    var result=[],seen=new Set();
    previous.concat(incoming).forEach(function(file){
      if(!file||result.length>=limit)return;
      var key=identity(file);
      if(seen.has(key))return;
      seen.add(key);result.push(file);
    });
    return result;
  }

  function syncCache(scope){
    if(!scope)return;
    scope.querySelectorAll("[data-adfilm-role-file]").forEach(function(field){cache.set(field,files(field))});
  }

  function clearObjectPreview(holder){
    if(holder.url){try{URL.revokeObjectURL(holder.url)}catch(_){} }
    holder.key="";holder.url="";
  }

  function objectPreview(holder,file){
    if(!file){clearObjectPreview(holder);return""}
    var key=identity(file);
    if(holder.key===key&&holder.url)return holder.url;
    clearObjectPreview(holder);
    try{holder.url=URL.createObjectURL(file);holder.key=key}catch(_){holder.url="";holder.key=""}
    return holder.url;
  }

  function heroFile(scope){
    var role=scope&&scope.querySelector('[data-adfilm-role-file="hero"]');
    return files(role)[0]||null;
  }

  function logoFile(scope){
    var field=scope&&scope.querySelector('[data-adfilm-file="logo"]');
    return files(field)[0]||null;
  }

  function ensureLogoThumb(scope,file,url){
    var tray=scope&&scope.querySelector("[data-role-preview]");if(!tray)return;
    var old=tray.querySelector(".adfilm-role-thumb--logo");if(old)old.remove();
    if(!file||!url)return;
    tray.hidden=false;
    var article=document.createElement("article");
    article.className="adfilm-role-thumb adfilm-role-thumb--logo";
    var image=document.createElement("div");
    image.style.backgroundImage='url("'+url.replace(/"/g,"%22")+'")';
    var badge=document.createElement("span");badge.textContent="Overlay";image.appendChild(badge);
    var label=document.createElement("b");label.textContent="LOGO";
    var remove=document.createElement("button");remove.type="button";remove.setAttribute("data-smart-logo-remove","");remove.title=text("Logoyu kaldır","Remove logo");remove.textContent="×";
    article.appendChild(image);article.appendChild(label);article.appendChild(remove);tray.appendChild(article);
  }

  function syncLivePreview(scope){
    if(!scope||!scope.isConnected)return;
    var hero=heroFile(scope),logo=logoFile(scope);
    var heroUrl=objectPreview(heroPreview,hero),logoUrl=objectPreview(logoPreview,logo);

    ensureLogoThumb(scope,logo,logoUrl);

    var panel=document.querySelector('.rpPanelWrap[data-panel-key="adfilm"]');
    if(!panel)return;

    var media=panel.querySelector("[data-panel-media]");
    if(media){
      media.classList.toggle("has-media",!!heroUrl);
      media.style.backgroundImage=heroUrl?'url("'+heroUrl.replace(/"/g,"%22")+'")':"";
    }

    var logoHost=panel.querySelector("[data-panel-logo]");
    if(logoHost){
      logoHost.hidden=!logoUrl;
      logoHost.style.backgroundImage=logoUrl?'url("'+logoUrl.replace(/"/g,"%22")+'")':"";
    }

    var mediaReady=panel.querySelector('[data-ready-item="media"]');
    if(mediaReady){
      mediaReady.classList.toggle("is-ready",!!hero);
      var state=mediaReady.querySelector("em");if(state)state.textContent=hero?text("Hazır","Ready"):text("Eksik","Missing");
    }
    var progress=panel.querySelector("[data-panel-progress]");
    if(progress){
      var ready=panel.querySelectorAll(".adfilm-readiness-list > div.is-ready").length;
      progress.textContent=ready+" / 3";
    }
  }

  function scheduleVisualSync(scope){
    [0,60,180,520].forEach(function(delay){setTimeout(function(){syncLivePreview(scope||root())},delay)});
  }

  function clearLogo(scope){
    var field=scope&&scope.querySelector('[data-adfilm-file="logo"]');if(!field)return;
    assign(field,[]);
    field.dispatchEvent(new Event("change",{bubbles:true}));
    scheduleVisualSync(scope);
  }

  /* Capture runs before creative-plan's direct change listener. */
  document.addEventListener("change",function(event){
    var field=event.target&&event.target.closest&&event.target.closest("[data-adfilm-role-file]");
    if(field){
      var key=field.getAttribute("data-adfilm-role-file"),limit=LIMITS[key];
      if(limit){
        var incoming=files(field),previous=cache.get(field)||[];
        var next=key==="hero"?incoming.slice(0,1):merge(previous,incoming,limit);
        assign(field,next);
      }
      scheduleVisualSync(field.closest('[data-module-root][data-module="adfilm"]')||root());
      return;
    }

    var legacy=event.target&&event.target.closest&&event.target.closest('[data-adfilm-file="productImages"]');
    if(legacy&&legacy.closest(".adfilm-role-media")&&event.isTrusted===false){
      legacy.dataset.adfilmSkipCloudUpload="1";
      setTimeout(function(){if(legacy)delete legacy.dataset.adfilmSkipCloudUpload},0);
      scheduleVisualSync(legacy.closest('[data-module-root][data-module="adfilm"]')||root());
      return;
    }

    var logo=event.target&&event.target.closest&&event.target.closest('[data-adfilm-file="logo"]');
    if(logo&&logo.closest(".adfilm-role-media"))scheduleVisualSync(logo.closest('[data-module-root][data-module="adfilm"]')||root());
  },true);

  document.addEventListener("input",function(event){
    if(event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-input]'))scheduleVisualSync(root());
  },true);

  document.addEventListener("click",function(event){
    var logoRemove=event.target&&event.target.closest&&event.target.closest("[data-smart-logo-remove]");
    if(logoRemove){
      event.preventDefault();event.stopImmediatePropagation();
      clearLogo(logoRemove.closest('[data-module-root][data-module="adfilm"]')||root());
      return;
    }
    if(event.target&&event.target.closest&&event.target.closest("[data-role-remove],[data-adfilm-draft-reset],[data-adfilm-choice] button[data-value]")){
      setTimeout(function(){syncCache(root());scheduleVisualSync(root())},100);
    }
  },true);

  document.addEventListener("aivo:module-mounted",function(event){
    if(!event||!event.detail||event.detail.key!=="adfilm")return;
    [120,520,1100,1800].forEach(function(delay){setTimeout(function(){syncCache(event.detail.root||root());syncLivePreview(event.detail.root||root())},delay)});
  });

  window.addEventListener("pagehide",function(){clearObjectPreview(heroPreview);clearObjectPreview(logoPreview)});

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){[300,900,1600].forEach(function(delay){setTimeout(function(){syncCache(root());syncLivePreview(root())},delay)})},{once:true});
  else [120,600,1400].forEach(function(delay){setTimeout(function(){syncCache(root());syncLivePreview(root())},delay)});
})();