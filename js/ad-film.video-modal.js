/* AIVO AI Reklam Filmi — video-only fullscreen modal */
(function AIVO_AD_FILM_VIDEO_MODAL(){
  "use strict";
  if(window.__AIVO_AD_FILM_VIDEO_MODAL_V1__)return;
  window.__AIVO_AD_FILM_VIDEO_MODAL_V1__=true;

  var modal=null,player=null,lastFocus=null;
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function label(tr,en){return english()?en:tr}
  function ensure(){
    if(modal&&modal.isConnected)return modal;
    modal=document.createElement("div");
    modal.className="adfilm-video-modal";
    modal.hidden=true;
    modal.innerHTML='<div class="adfilm-video-modal__backdrop" data-video-modal-close></div><section class="adfilm-video-modal__dialog" role="dialog" aria-modal="true" aria-label="'+label("Video ön izleme","Video preview")+'"><button type="button" class="adfilm-video-modal__close" data-video-modal-close aria-label="'+label("Kapat","Close")+'">×</button><video class="adfilm-video-modal__player" controls playsinline preload="metadata"></video></section>';
    document.body.appendChild(modal);
    player=modal.querySelector("video");
    modal.addEventListener("click",function(event){if(event.target.closest("[data-video-modal-close]"))close()});
    return modal;
  }
  function open(url,muted){
    if(!url)return;
    ensure();
    lastFocus=document.activeElement;
    player.src=url;
    player.muted=!!muted;
    modal.hidden=false;
    document.documentElement.classList.add("adfilm-video-modal-open");
    document.body.classList.add("adfilm-video-modal-open");
    setTimeout(function(){player.play().catch(function(){})},30);
  }
  function close(){
    if(!modal||modal.hidden)return;
    try{player.pause()}catch(_){}
    player.removeAttribute("src");
    player.load();
    modal.hidden=true;
    document.documentElement.classList.remove("adfilm-video-modal-open");
    document.body.classList.remove("adfilm-video-modal-open");
    if(lastFocus&&typeof lastFocus.focus==="function")try{lastFocus.focus()}catch(_){}
  }
  document.addEventListener("keydown",function(event){if(event.key==="Escape")close()});
  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-adfilm-output-gallery] [data-output-action="fullscreen"]');
    if(!button)return;
    var card=button.closest("[data-output-id]"),video=card&&card.querySelector("video");
    if(!video||!video.currentSrc&&!video.src)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    open(video.currentSrc||video.src,video.muted);
  },true);
  window.AIVOAdFilmVideoModal={open:open,close:close};
})();
