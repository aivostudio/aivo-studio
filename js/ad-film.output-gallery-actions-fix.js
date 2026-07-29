/* AIVO AI Reklam Filmi — resilient Other Versions actions */
(function AIVO_AD_FILM_OUTPUT_GALLERY_ACTIONS_FIX(){
  "use strict";
  if(window.__AIVO_AD_FILM_OUTPUT_GALLERY_ACTIONS_FIX_V1__)return;
  window.__AIVO_AD_FILM_OUTPUT_GALLERY_ACTIONS_FIX_V1__=true;

  function clean(value){return String(value||"").trim()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function outputs(){var source=project()||{};return Array.isArray(source.outputs)?source.outputs.filter(function(x){return x&&clean(x.videoUrl)}):[]}
  function item(card){var id=clean(card&&card.dataset.outputId);return outputs().find(function(x){return clean(x.id)===id})||null}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function toast(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:3200})}catch(_){} }

  function icon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10v4h3l4 3V7l-4 3H5Zm10-1.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'}
  function ensureMuteButtons(){document.querySelectorAll('[data-adfilm-output-gallery] [data-output-id]').forEach(function(card){var tools=card.querySelector('.adfilm-output-card__tools');if(!tools||tools.querySelector('[data-output-action="mute"]'))return;var button=document.createElement('button');button.type='button';button.dataset.outputAction='mute';button.title=text('Sesi aç / kapat','Toggle sound');button.setAttribute('aria-label',button.title);button.innerHTML=icon();tools.insertBefore(button,tools.firstChild)})}

  async function remove(selected){var source=project();if(!source||!selected||!window.confirm(text('Bu reklam sürümü silinsin mi?','Delete this advertising version?')))return;var response=await fetch('/api/ad-film/seedance/result?projectId='+encodeURIComponent(source.id)+'&outputId='+encodeURIComponent(selected.id),{method:'DELETE',credentials:'include',cache:'no-store'});var data=await response.json().catch(function(){return{}});if(!response.ok)throw new Error(data.error||'remove_failed');window.AIVOAdFilmActiveProject=data.project||source;document.dispatchEvent(new CustomEvent('aivo:adfilm-project-sync',{detail:{project:window.AIVOAdFilmActiveProject,projectId:source.id,media:window.AIVOAdFilmActiveProject.media||{}}}))}

  document.addEventListener('click',function(event){var button=event.target&&event.target.closest&&event.target.closest('[data-adfilm-output-gallery] [data-output-action]');if(!button)return;var card=button.closest('[data-output-id]'),selected=item(card);if(!selected)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();var action=button.dataset.outputAction,video=card.querySelector('video'),source=project();
    try{
      if(action==='download'&&window.AIVOAdFilmResultControls)window.AIVOAdFilmResultControls.downloadOutput(selected.id,selected.version||1,source&&source.id);
      else if(action==='fullscreen'&&window.AIVOAdFilmResultControls)window.AIVOAdFilmResultControls.fullscreen(video);
      else if(action==='mute'&&video){video.muted=!video.muted;if(!video.paused)video.play().catch(function(){})}
      else if(action==='trash')remove(selected).catch(function(){toast(text('Video silinemedi.','The video could not be deleted.'),'error')});
      else if(action==='open'){if(window.AIVOAdFilmResultControls)window.AIVOAdFilmResultControls.mount(selected.videoUrl,selected.logoUrl||'',{projectId:source&&source.id,outputId:selected.id,version:selected.version||1,play:true})}
    }catch(error){console.error('[ADFILM] gallery action',error)}
  },true);

  var observer=new MutationObserver(function(){ensureMuteButtons()});observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm')setTimeout(ensureMuteButtons,500)});
  document.addEventListener('aivo:adfilm-project-sync',function(){setTimeout(ensureMuteButtons,250)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureMuteButtons,{once:true});else ensureMuteButtons();
})();
