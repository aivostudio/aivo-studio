/* AIVO AI Reklam Filmi — selected avatar preview actions */
(function AIVO_AD_FILM_AVATAR_ACTIONS(){
  "use strict";
  if(window.__AIVO_AD_FILM_AVATAR_ACTIONS_V1__)return;
  window.__AIVO_AD_FILM_AVATAR_ACTIONS_V1__=true;

  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function clean(value){return String(value||"").trim()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function notify(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:3400});if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }

  function icon(name){
    var paths={
      expand:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      download:'<path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      trash:'<path d="M5 7h14M9 7V4h6v3M8 10v8m4-8v8m4-8v8M7 7l1 14h8l1-14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
      close:'<path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">'+paths[name]+'</svg>';
  }

  function action(name,label){
    var button=document.createElement("button");
    button.type="button";
    button.className="adfilm-avatar-preview__action"+(name==="remove"?" is-danger":"");
    button.dataset.avatarPreviewAction=name;
    button.title=label;
    button.setAttribute("aria-label",label);
    button.innerHTML=icon(name==="remove"?"trash":name);
    return button;
  }

  function avatarImage(preview){
    var image=preview&&preview.querySelector('[data-avatar-image]');
    return image&&clean(image.currentSrc||image.src)?image:null;
  }

  function ensureViewer(){
    var viewer=document.querySelector('[data-avatar-image-viewer]');
    if(viewer)return viewer;
    viewer=document.createElement("div");
    viewer.className="adfilm-avatar-viewer";
    viewer.dataset.avatarImageViewer="";
    viewer.hidden=true;
    viewer.innerHTML=''+
      '<div class="adfilm-avatar-viewer__backdrop" data-avatar-viewer-close></div>'+
      '<section class="adfilm-avatar-viewer__dialog" role="dialog" aria-modal="true" aria-label="'+text("Avatar ön izlemesi","Avatar preview")+'">'+
        '<div class="adfilm-avatar-viewer__bar">'+
          '<b>'+text("Avatar ön izlemesi","Avatar preview")+'</b>'+
          '<div class="adfilm-avatar-viewer__actions">'+
            '<button type="button" data-avatar-viewer-download title="'+text("İndir","Download")+'" aria-label="'+text("İndir","Download")+'">'+icon("download")+'</button>'+
            '<button type="button" data-avatar-viewer-close title="'+text("Kapat","Close")+'" aria-label="'+text("Kapat","Close")+'">'+icon("close")+'</button>'+
          '</div>'+
        '</div>'+
        '<div class="adfilm-avatar-viewer__stage"><img data-avatar-viewer-image alt="Avatar"></div>'+
      '</section>';
    document.body.appendChild(viewer);
    return viewer;
  }

  function openViewer(url){
    if(!url)return;
    var viewer=ensureViewer(),image=viewer.querySelector('[data-avatar-viewer-image]');
    image.src=url;
    viewer.dataset.avatarUrl=url;
    viewer.hidden=false;
    document.documentElement.classList.add("is-avatar-viewer-open");
    var close=viewer.querySelector('[data-avatar-viewer-close]');
    if(close)setTimeout(function(){try{close.focus({preventScroll:true})}catch(_){close.focus()}},0);
  }

  function closeViewer(){
    var viewer=document.querySelector('[data-avatar-image-viewer]');
    if(!viewer||viewer.hidden)return;
    viewer.hidden=true;
    viewer.dataset.avatarUrl="";
    var image=viewer.querySelector('[data-avatar-viewer-image]');if(image)image.removeAttribute("src");
    document.documentElement.classList.remove("is-avatar-viewer-open");
  }

  async function downloadAvatar(url){
    if(!url)return;
    var state=project()&&project().avatar&&project().avatar.image||{};
    var fileName=clean(state.name)||"aivo-avatar.jpg";
    try{
      var response=await fetch(url,{method:"GET",cache:"no-store",mode:"cors"});
      if(!response.ok)throw new Error("download_failed");
      var blob=await response.blob(),objectUrl=URL.createObjectURL(blob),anchor=document.createElement("a");
      anchor.href=objectUrl;anchor.download=fileName;anchor.rel="noopener";anchor.style.display="none";
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      setTimeout(function(){URL.revokeObjectURL(objectUrl)},1800);
    }catch(error){
      var fallback=document.createElement("a");
      fallback.href=url;fallback.download=fileName;fallback.target="_blank";fallback.rel="noopener";fallback.style.display="none";
      document.body.appendChild(fallback);fallback.click();fallback.remove();
      notify(text("Avatar yeni sekmede açıldı. Görseli buradan kaydedebilirsin.","The avatar opened in a new tab. You can save it from there."),"info");
    }
  }

  function enhancePreview(){
    var preview=document.querySelector('[data-adfilm-avatar-card] [data-avatar-preview]');
    if(!preview)return false;
    var image=preview.querySelector('[data-avatar-image]');
    if(image&&!image.dataset.avatarPreviewBound){
      image.dataset.avatarPreviewBound="1";
      image.dataset.avatarPreviewAction="expand";
      image.tabIndex=0;
      image.title=text("Büyüt","Enlarge");
      image.setAttribute("role","button");
      image.setAttribute("aria-label",text("Avatarı büyüt","Enlarge avatar"));
    }
    if(preview.querySelector('[data-avatar-preview-actions]'))return true;
    var originalRemove=preview.querySelector('[data-avatar-remove]');
    if(!originalRemove)return false;
    var toolbar=document.createElement("div");
    toolbar.className="adfilm-avatar-preview__actions";
    toolbar.dataset.avatarPreviewActions="";
    toolbar.appendChild(action("expand",text("Büyüt","Enlarge")));
    toolbar.appendChild(action("download",text("İndir","Download")));
    originalRemove.className="adfilm-avatar-preview__action is-danger";
    originalRemove.title=text("Sil","Delete");
    originalRemove.setAttribute("aria-label",text("Avatarı sil","Delete avatar"));
    originalRemove.innerHTML=icon("trash");
    toolbar.appendChild(originalRemove);
    preview.appendChild(toolbar);
    return true;
  }

  function schedule(){[0,80,240,600].forEach(function(delay){setTimeout(enhancePreview,delay)})}

  document.addEventListener("click",function(event){
    var close=event.target&&event.target.closest&&event.target.closest('[data-avatar-viewer-close]');
    if(close){event.preventDefault();closeViewer();return}
    var viewerDownload=event.target&&event.target.closest&&event.target.closest('[data-avatar-viewer-download]');
    if(viewerDownload){event.preventDefault();var viewer=viewerDownload.closest('[data-avatar-image-viewer]');downloadAvatar(clean(viewer&&viewer.dataset.avatarUrl));return}
    var control=event.target&&event.target.closest&&event.target.closest('[data-adfilm-avatar-card] [data-avatar-preview-action]');
    if(!control)return;
    var preview=control.closest('[data-avatar-preview]'),image=avatarImage(preview);if(!image)return;
    var name=control.dataset.avatarPreviewAction;
    if(name==="expand"){event.preventDefault();event.stopPropagation();openViewer(image.currentSrc||image.src)}
    else if(name==="download"){event.preventDefault();event.stopPropagation();downloadAvatar(image.currentSrc||image.src)}
  },true);

  document.addEventListener("keydown",function(event){
    if(event.key==="Escape")closeViewer();
    var target=event.target;
    if((event.key==="Enter"||event.key===" ")&&target&&target.matches&&target.matches('[data-avatar-image][data-avatar-preview-action="expand"]')){
      event.preventDefault();openViewer(target.currentSrc||target.src);
    }
  });
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule()});
  document.addEventListener("aivo:adfilm-project-sync",schedule);
  window.addEventListener("pageshow",schedule);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",schedule,{once:true});else schedule();
})();
