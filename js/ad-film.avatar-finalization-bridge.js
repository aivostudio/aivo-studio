/* AIVO AI Reklam Filmi — avatar finalization compatibility bridge
   The current finalization endpoint already returns the finalized project.
   This bridge exists so legacy loaders do not fail with 404 while keeping
   avatar-related hooks available for modules that feature-detect them. */
(function AIVO_AD_FILM_AVATAR_FINALIZATION_BRIDGE(){
  "use strict";
  if(window.__AIVO_AD_FILM_AVATAR_FINALIZATION_BRIDGE_V7__)return;
  window.__AIVO_AD_FILM_AVATAR_FINALIZATION_BRIDGE_V7__=true;

  function project(){
    return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"
      ? window.AIVOAdFilmActiveProject
      : null;
  }

  function sync(nextProject){
    if(nextProject&&typeof nextProject==="object"){
      window.AIVOAdFilmActiveProject=nextProject;
    }
    return project();
  }

  window.AIVOAdFilmAvatarFinalizationBridge={
    sync:sync,
    project:project
  };
})();
