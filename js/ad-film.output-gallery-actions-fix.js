/* AIVO AI Reklam Filmi — authoritative Other Versions actions */
(function AIVO_AD_FILM_OUTPUT_GALLERY_ACTIONS_FIX(){
  "use strict";
  if(window.__AIVO_AD_FILM_OUTPUT_GALLERY_ACTIONS_FIX_V2__)return;
  window.__AIVO_AD_FILM_OUTPUT_GALLERY_ACTIONS_FIX_V2__=true;

  function clean(value){return String(value||"").trim()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function projectId(){return clean(project()&&project().id||root()&&root().dataset.adfilmProjectId)}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function toast(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:3200});if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }
  function icon(muted){return muted?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10v4h3l4 3V7l-4 3H5Zm10-1 5 5m0-5-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10v4h3l4 3V7l-4 3H5Zm10-1.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'}

  function ensureMuteButtons(){
    document.querySelectorAll('[data-adfilm-output-gallery] [data-output-id]').forEach(function(card){
      var tools=card.querySelector('.adfilm-output-card__tools');if(!tools)return;
      var video=card.querySelector('video');
      var button=tools.querySelector('[data-output-action="mute"]');
      if(!button){button=document.createElement('button');button.type='button';button.dataset.outputAction='mute';tools.insertBefore(button,tools.firstChild)}
      button.title=video&&video.muted?text('Sesi aç','Unmute'):text('Sesi kapat','Mute');
      button.setAttribute('aria-label',button.title);button.innerHTML=icon(!!(video&&video.muted));
    });
  }

  function download(pid,oid,version){
    if(!pid||!oid){toast(text('Video indirilemedi.','The video could not be downloaded.'),'error');return}
    var anchor=document.createElement('a');
    anchor.href='/api/ad-film/seedance/download?projectId='+encodeURIComponent(pid)+'&outputId='+encodeURIComponent(oid);
    anchor.download='aivo-reklam-v'+(Number(version)||1)+'.mp4';anchor.rel='noopener';anchor.style.display='none';
    document.body.appendChild(anchor);anchor.click();setTimeout(function(){anchor.remove()},1200);
  }

  function fullscreen(video){
    if(!video)return;
    try{
      if(document.fullscreenElement&&document.exitFullscreen){document.exitFullscreen();return}
      if(video.requestFullscreen){var promise=video.requestFullscreen();if(promise&&promise.catch)promise.catch(function(){})}
      else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();
      else if(video.webkitRequestFullscreen)video.webkitRequestFullscreen();
    }catch(error){console.warn('[ADFILM] gallery fullscreen',error)}
  }

  async function select(pid,oid,video,play){
    if(!pid||!oid||!video)return;
    try{
      var response=await fetch('/api/ad-film/seedance/result',{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:pid,outputId:oid})});
      var data=await response.json().catch(function(){return{}});if(!response.ok)throw new Error(data.error||'select_failed');
      var next=data.project||project();if(next)window.AIVOAdFilmActiveProject=next;
      var source=video.currentSrc||video.src;
      if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.mount==='function')window.AIVOAdFilmResultControls.mount(source,'',{projectId:pid,outputId:oid,version:Number(video.closest('[data-output-id]')&&video.closest('[data-output-id]').dataset.outputVersion)||1,play:!!play});
      if(next)document.dispatchEvent(new CustomEvent('aivo:adfilm-project-sync',{detail:{project:next,projectId:next.id||pid,media:next.media||{}}}));
    }catch(error){console.error('[ADFILM] gallery select',error);toast(text('Video açılamadı.','The video could not be opened.'),'error')}
  }

  async function remove(pid,oid){
    if(!pid||!oid||!window.confirm(text('Bu reklam sürümü silinsin mi?','Delete this advertising version?')))return;
    try{
      var response=await fetch('/api/ad-film/seedance/result?projectId='+encodeURIComponent(pid)+'&outputId='+encodeURIComponent(oid),{method:'DELETE',credentials:'include',cache:'no-store'});
      var data=await response.json().catch(function(){return{}});if(!response.ok)throw new Error(data.error||'remove_failed');
      var next=data.project||project();if(next)window.AIVOAdFilmActiveProject=next;
      if(next)document.dispatchEvent(new CustomEvent('aivo:adfilm-project-sync',{detail:{project:next,projectId:next.id||pid,media:next.media||{}}}));
      toast(text('Video silindi.','Video deleted.'),'success');
    }catch(error){console.error('[ADFILM] gallery delete',error);toast(text('Video silinemedi.','The video could not be deleted.'),'error')}
  }

  document.addEventListener('click',function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-adfilm-output-gallery] [data-output-action]');if(!button)return;
    var card=button.closest('[data-output-id]');if(!card)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    var action=button.dataset.outputAction;
    var pid=clean(card.dataset.outputProjectId||projectId());
    var oid=clean(card.dataset.outputId);
    var version=Number(card.dataset.outputVersion)||1;
    var video=card.querySelector('video');
    if(action==='download')download(pid,oid,version);
    else if(action==='fullscreen')fullscreen(video);
    else if(action==='mute'&&video){video.muted=!video.muted;if(!video.paused)video.play().catch(function(){});ensureMuteButtons()}
    else if(action==='trash')remove(pid,oid);
    else if(action==='open')select(pid,oid,video,true);
  },true);

  var observer=new MutationObserver(function(){ensureMuteButtons()});observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm')setTimeout(ensureMuteButtons,300)});
  document.addEventListener('aivo:adfilm-project-sync',function(){setTimeout(ensureMuteButtons,100)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureMuteButtons,{once:true});else ensureMuteButtons();
})();
