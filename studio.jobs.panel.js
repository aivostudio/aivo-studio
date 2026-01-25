/* =========================================================
   JOBS PERSIST (SINGLE BLOCK / NO PATCH)
   - waits for AIVO_JOBS to exist
   - hydrates from localStorage
   - wraps mutators to persist on every change
========================================================= */
(function AIVO_JOBS_PERSIST_V1(){
  "use strict";

  if (window.__aivoJobsPersistBound) return;
  window.__aivoJobsPersistBound = true;

  var LS_KEY = "aivo_jobs_v1";
  var MAX = 50;

  function safeParse(raw){
    try{
      var x = JSON.parse(raw || "[]");
      return Array.isArray(x) ? x : [];
    }catch(_){ return []; }
  }
  function lsRead(){
    try{ return safeParse(localStorage.getItem(LS_KEY)); }catch(_){ return []; }
  }
  function lsWrite(list){
    try{
      var arr = Array.isArray(list) ? list.slice(0, MAX) : [];
      localStorage.setItem(LS_KEY, JSON.stringify(arr));
    }catch(_){}
  }

  function getJobs(){
    try{
      var J = window.AIVO_JOBS;
      if (J){
        if (Array.isArray(J.list)) return J.list;
        if (typeof J.getAll === "function") return J.getAll() || [];
        if (typeof J.get === "function") return J.get() || [];
      }
    }catch(_){}
    return lsRead();
  }

  function waitForJobs(cb){
    var tries = 0;
    var t = setInterval(function(){
      tries++;
      if (window.AIVO_JOBS && (typeof window.AIVO_JOBS.setAll === "function" || Array.isArray(window.AIVO_JOBS.list))){
        clearInterval(t);
        cb(window.AIVO_JOBS);
      }
      if (tries > 80){ // ~8sn
        clearInterval(t);
      }
    }, 100);
  }

  function wrapPersist(J){
    if (!J || J.__persistWrapped) return;
    J.__persistWrapped = true;

    function persistNow(){
      try{ lsWrite(getJobs()); }catch(_){}
    }

    // hydrate once
    try{
      var saved = lsRead();
      if (saved.length && typeof J.setAll === "function") {
        J.setAll(saved);
      } else if (saved.length && Array.isArray(J.list)) {
        J.list = saved;
      }
    }catch(_){}

    // wrap mutators (varsa)
    ["setAll","upsert","remove","clear"].forEach(function(fn){
      try{
        if (typeof J[fn] !== "function") return;
        var orig = J[fn].bind(J);
        J[fn] = function(){
          var out = orig.apply(null, arguments);
          // async olabilir, yine de yaz
          try{ persistNow(); }catch(_){}
          return out;
        };
      }catch(_){}
    });

    // subscribe varsa ayrıca yakala
    try{
      if (typeof J.subscribe === "function"){
        J.subscribe(function(){ try{ persistNow(); }catch(_){} });
      }
    }catch(_){}

    // ilk persist (RAM boşsa bile LS'yi senkronla)
    try{ persistNow(); }catch(_){}
  }

  // start
  waitForJobs(wrapPersist);

  // debug helper
  window.__AIVO_JOBS_PERSIST_DEBUG__ = function(){
    return { ls: lsRead(), ram: getJobs(), hasJobs: !!window.AIVO_JOBS };
  };
})();
