/* AIVO AI Reklam Filmi — preserve local avatar selections across async project syncs */
(function AIVO_AD_FILM_AVATAR_RECOVERY(){
  "use strict";
  if(window.__AIVO_AD_FILM_AVATAR_RECOVERY_V1__)return;
  window.__AIVO_AD_FILM_AVATAR_RECOVERY_V1__=true;

  var localValues=Object.create(null);
  var localExpires=Object.create(null);
  var HOLD_MS=15000;

  function clean(value){return String(value==null?"":value).trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function card(){var scope=root();return scope&&scope.querySelector('[data-adfilm-avatar-card]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function active(name){return Object.prototype.hasOwnProperty.call(localValues,name)&&Date.now()<Number(localExpires[name]||0)}
  function clear(name){delete localValues[name];delete localExpires[name]}

  function remember(input){
    if(!input||!input.dataset||!input.dataset.avatarField)return;
    var name=input.dataset.avatarField;
    var value=input.value;
    localValues[name]=value;
    localExpires[name]=Date.now()+HOLD_MS;
    var current=project();
    if(current){
      current.avatar=Object.assign({},current.avatar||{});
      current.avatar[name]=value;
    }
  }

  function reconcileFromProject(next){
    var avatar=next&&next.avatar||{};
    Object.keys(localValues).forEach(function(name){
      if(!active(name)){clear(name);return}
      if(avatar[name]!=null&&String(avatar[name])===String(localValues[name]))clear(name);
    });
  }

  function reapply(){
    var target=card();if(!target)return;
    var current=project();
    if(current)current.avatar=Object.assign({},current.avatar||{});
    Object.keys(localValues).forEach(function(name){
      if(!active(name)){clear(name);return}
      var input=target.querySelector('[data-avatar-field="'+name+'"]');
      if(input&&String(input.value)!==String(localValues[name]))input.value=localValues[name];
      if(current)current.avatar[name]=localValues[name];
    });
  }

  function scheduleReapply(){[0,35,120,320].forEach(function(delay){setTimeout(reapply,delay)})}

  document.addEventListener('change',function(event){
    var input=event.target;
    if(!input||!input.matches||!input.matches('[data-adfilm-avatar-card] [data-avatar-field]'))return;
    remember(input);
    scheduleReapply();
  },true);

  document.addEventListener('input',function(event){
    var input=event.target;
    if(!input||!input.matches||!input.matches('[data-adfilm-avatar-card] [data-avatar-field]'))return;
    remember(input);
  },true);

  document.addEventListener('aivo:adfilm-project-sync',function(event){
    var next=event&&event.detail&&event.detail.project;
    reconcileFromProject(next);
    scheduleReapply();
  });

  document.addEventListener('aivo:module-mounted',function(event){
    if(event&&event.detail&&event.detail.key==='adfilm')scheduleReapply();
  });
})();
