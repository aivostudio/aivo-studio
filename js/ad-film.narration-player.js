/* AIVO AI Ad Film — premium narration player */
(function AIVO_AD_FILM_NARRATION_PLAYER(){
  "use strict";
  if(window.__AIVO_AD_FILM_NARRATION_PLAYER_V1__)return;
  window.__AIVO_AD_FILM_NARRATION_PLAYER_V1__=true;

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function projectId(scope){return String(scope&&scope.dataset.adfilmProjectId||window.AIVOAdFilmActiveProject&&window.AIVOAdFilmActiveProject.id||"").trim()}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function icon(name){
    if(name==="play")return '<svg viewBox="0 0 24 24"><path d="m9 6 9 6-9 6V6Z"/></svg>';
    if(name==="pause")return '<svg viewBox="0 0 24 24"><path d="M8 6h3v12H8zM13 6h3v12h-3z"/></svg>';
    if(name==="volume")return '<svg viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path class="stroke" d="M16 9c1 .8 1.5 1.8 1.5 3S17 14.2 16 15M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
    if(name==="muted")return '<svg viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path class="stroke" d="m16 9 5 6m0-6-5 6"/></svg>';
    if(name==="download")return '<svg viewBox="0 0 24 24"><path class="stroke" d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14"/></svg>';
    return '<svg viewBox="0 0 24 24"><path class="stroke" d="M5 7h14M9 7V4h6v3M8 10v8m4-8v8m4-8v8M7 7l1 14h8l1-14"/></svg>';
  }
  function format(value){var seconds=Number(value);if(!isFinite(seconds)||seconds<0)seconds=0;var whole=Math.floor(seconds);return Math.floor(whole/60)+":"+String(whole%60).padStart(2,"0")}
  function notify(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")fn({message:message,duration:3000})}catch(_){}}

  function markup(){
    return '<div class="adfilm-premium-audio" data-premium-audio>'+ 
      '<button type="button" class="adfilm-premium-audio__button is-primary" data-pa-action="play"></button>'+ 
      '<div class="adfilm-premium-audio__timeline"><input type="range" min="0" max="100" step=".1" value="0" data-pa-progress><div><span data-pa-current>0:00</span><i>/</i><span data-pa-duration>0:00</span></div></div>'+ 
      '<div class="adfilm-premium-audio__tools">'+ 
        '<button type="button" class="adfilm-premium-audio__button" data-pa-action="mute"></button>'+ 
        '<button type="button" class="adfilm-premium-audio__button" data-pa-action="download"></button>'+ 
        '<button type="button" class="adfilm-premium-audio__button is-danger" data-pa-action="delete"></button>'+ 
      '</div></div>'+ 
      '<div class="adfilm-premium-audio__confirm" data-pa-confirm hidden><span>'+text("Bu ses kaydı silinsin mi?","Delete this voice recording?")+'</span><div><button type="button" data-pa-cancel>'+text("Vazgeç","Cancel")+'</button><button type="button" class="is-danger" data-pa-confirm-delete>'+text("Sesi sil","Delete voice")+'</button></div></div>';
  }

  function sync(scope){
    var host=scope&&scope.querySelector('[data-adfilm-narration-engine-player]'),audio=host&&host.querySelector('[data-narration-audio]'),ui=host&&host.querySelector('[data-premium-audio]');
    if(!audio||!ui)return;
    var total=isFinite(audio.duration)?audio.duration:0,percent=total?Math.min(100,Math.max(0,audio.currentTime/total*100)):0;
    var progress=ui.querySelector('[data-pa-progress]');if(progress){progress.value=String(percent);progress.style.setProperty('--audio-progress',percent+'%')}
    var current=ui.querySelector('[data-pa-current]'),duration=ui.querySelector('[data-pa-duration]');if(current)current.textContent=format(audio.currentTime);if(duration)duration.textContent=format(total);
    var play=ui.querySelector('[data-pa-action="play"]'),playing=!audio.paused&&!audio.ended;if(play){play.innerHTML=icon(playing?'pause':'play');play.title=text(playing?'Duraklat':'Oynat',playing?'Pause':'Play');play.setAttribute('aria-label',play.title)}
    var mute=ui.querySelector('[data-pa-action="mute"]');if(mute){mute.innerHTML=icon(audio.muted?'muted':'volume');mute.title=text(audio.muted?'Sesi aç':'Sesi kapat',audio.muted?'Unmute':'Mute');mute.setAttribute('aria-label',mute.title)}
    var download=ui.querySelector('[data-pa-action="download"]');if(download){download.innerHTML=icon('download');download.title=text('Sesi indir','Download voice');download.setAttribute('aria-label',download.title)}
    var remove=ui.querySelector('[data-pa-action="delete"]');if(remove){remove.innerHTML=icon('trash');remove.title=text('Sesi sil','Delete voice');remove.setAttribute('aria-label',remove.title)}
  }

  function mount(scope){
    scope=scope||root();if(!scope)return;
    var host=scope.querySelector('[data-adfilm-narration-engine-player]'),audio=host&&host.querySelector('[data-narration-audio]');if(!host||!audio)return;
    audio.controls=false;audio.classList.add('adfilm-native-audio-hidden');
    if(!host.querySelector('[data-premium-audio]'))host.insertAdjacentHTML('beforeend',markup());
    if(host.dataset.premiumAudioBound==="1"){sync(scope);return}
    host.dataset.premiumAudioBound="1";
    var progress=host.querySelector('[data-pa-progress]');
    host.addEventListener('click',async function(event){
      var action=event.target.closest('[data-pa-action]');
      if(action){
        event.preventDefault();var name=action.getAttribute('data-pa-action');
        if(name==='play'){if(audio.paused)audio.play().catch(function(){});else audio.pause()}
        if(name==='mute'){audio.muted=!audio.muted;sync(scope)}
        if(name==='download'){
          var id=projectId(scope);if(!id)return;
          var link=document.createElement('a');link.href='/api/ad-film/narration/download?projectId='+encodeURIComponent(id);link.style.display='none';document.body.appendChild(link);link.click();setTimeout(function(){link.remove()},0);
        }
        if(name==='delete'){var confirm=host.querySelector('[data-pa-confirm]');if(confirm)confirm.hidden=false}
        return;
      }
      if(event.target.closest('[data-pa-cancel]')){event.preventDefault();var cancelBox=host.querySelector('[data-pa-confirm]');if(cancelBox)cancelBox.hidden=true;return}
      var confirmButton=event.target.closest('[data-pa-confirm-delete]');if(confirmButton){
        event.preventDefault();var id=projectId(scope);if(!id)return;confirmButton.disabled=true;
        try{
          var response=await fetch('/api/ad-film/narration/delete',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:id})});
          var data={};try{data=await response.json()}catch(_){}
          if(!response.ok)throw new Error(data.error||'delete_failed');
          audio.pause();audio.removeAttribute('src');audio.load();host.hidden=true;
          var panel=scope.querySelector('[data-adfilm-narration-engine]'),approve=panel&&panel.querySelector('[data-narration-audio-approve]'),create=panel&&panel.querySelector('[data-narration-create]'),state=panel&&panel.querySelector('[data-narration-engine-state]');
          if(approve){approve.disabled=true;approve.classList.remove('is-approved');approve.textContent=text('Sesi onayla','Approve voice')}
          if(create)create.textContent=text('Sesi oluştur','Generate voice');if(state)state.textContent=text('Henüz ses oluşturulmadı.','No voice has been generated yet.');if(panel)panel.dataset.state='idle';
          notify(text('Ses kaydı silindi.','Voice recording deleted.'),'success');
        }catch(error){notify(text('Ses kaydı silinemedi.','The voice recording could not be deleted.'),'error')}
        finally{confirmButton.disabled=false}
      }
    });
    ['loadedmetadata','durationchange','timeupdate','play','pause','ended','volumechange'].forEach(function(name){audio.addEventListener(name,function(){sync(scope)})});
    if(progress)progress.addEventListener('input',function(){var total=isFinite(audio.duration)?audio.duration:0;if(total)audio.currentTime=Number(progress.value)/100*total;sync(scope)});
    new MutationObserver(function(){audio.controls=false;sync(scope)}).observe(audio,{attributes:true,attributeFilter:['src','controls']});
    sync(scope);
  }

  function schedule(scope){[0,120,400].forEach(function(delay){setTimeout(function(){mount(scope||root())},delay)})}
  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm')schedule(event.detail.root)});
  document.addEventListener('aivo:adfilm-project-sync',function(){schedule(root())});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){schedule(root())},{once:true});else schedule(root());
})();
