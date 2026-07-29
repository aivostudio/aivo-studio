/* AIVO AI Reklam Filmi — stable one-second progress UI */
(function(){
  "use strict";
  if(window.__AIVO_AD_FILM_PROGRESS_STABILITY__)return;
  window.__AIVO_AD_FILM_PROGRESS_STABILITY__=true;

  var timer=null;
  var baseSeconds=0;
  var baseAt=0;
  var lastBusyTitle="";
  var lastBusyDetail="";
  var applying=false;

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function status(){var scope=root();return scope&&scope.querySelector('[data-adfilm-engine-status]')}
  function buildButton(){var scope=root();return scope&&scope.querySelector('[data-adfilm-build]')}
  function generating(){var button=buildButton();return!!(button&&button.classList.contains('is-generating'))}
  function parseElapsed(text){
    var match=String(text||'').match(/(\d+)\s*(?:dk|min)\s*(\d+)\s*(?:sn|sec)/i);
    return match?Number(match[1])*60+Number(match[2]):null;
  }
  function formatElapsed(total){
    var en=String(document.documentElement.lang||'').toLowerCase().indexOf('en')===0;
    var minutes=Math.floor(total/60),seconds=total%60;
    return minutes+' '+(en?'min':'dk')+' '+String(seconds).padStart(2,'0')+' '+(en?'sec':'sn');
  }
  function remember(){
    var node=status();if(!node)return;
    var title=node.querySelector('b'),detail=node.querySelector('small');
    if(node.classList.contains('is-busy')){
      lastBusyTitle=title&&title.textContent||lastBusyTitle;
      lastBusyDetail=detail&&detail.textContent||lastBusyDetail;
      var parsed=parseElapsed(lastBusyDetail);
      if(parsed!=null){baseSeconds=parsed;baseAt=Date.now()}
    }
  }
  function forceBusyIfNeeded(){
    var node=status();if(!node||!generating()||!node.classList.contains('is-success'))return;
    applying=true;
    node.className='adfilm-engine-status is-visible is-busy';
    var title=node.querySelector('b'),detail=node.querySelector('small');
    if(title&&lastBusyTitle)title.textContent=lastBusyTitle;
    if(detail&&lastBusyDetail)detail.textContent=lastBusyDetail;
    applying=false;
  }
  function tick(){
    var node=status();if(!node)return;
    forceBusyIfNeeded();
    if(!node.classList.contains('is-busy'))return;
    var detail=node.querySelector('small');if(!detail)return;
    var current=parseElapsed(detail.textContent);
    if(current!=null&&(!baseAt||Math.abs(current-baseSeconds)>2)){baseSeconds=current;baseAt=Date.now()}
    if(!baseAt)return;
    var total=baseSeconds+Math.floor((Date.now()-baseAt)/1000);
    detail.textContent=detail.textContent.replace(/\d+\s*(?:dk|min)\s*\d+\s*(?:sn|sec)/i,formatElapsed(total));
  }
  function start(){clearInterval(timer);remember();timer=setInterval(tick,1000)}

  var observer=new MutationObserver(function(){
    if(applying)return;
    remember();
    forceBusyIfNeeded();
  });
  function observe(){
    var node=status();if(node)observer.observe(node,{attributes:true,childList:true,subtree:true,characterData:true});
    start();
  }
  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm')setTimeout(observe,500)});
  document.addEventListener('aivo:adfilm-project-sync',function(){setTimeout(remember,80)});
  window.addEventListener('pagehide',function(){clearInterval(timer);observer.disconnect()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(observe,700)},{once:true});else setTimeout(observe,700);
})();
