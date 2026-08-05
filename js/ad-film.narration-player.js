/* AIVO AI Ad Film — premium narration player */
(function AIVO_AD_FILM_NARRATION_PLAYER(){
  "use strict";
  if(window.__AIVO_AD_FILM_NARRATION_PLAYER_V2__)return;
  window.__AIVO_AD_FILM_NARRATION_PLAYER_V2__=true;

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function playerHost(scope){return scope&&scope.querySelector('[