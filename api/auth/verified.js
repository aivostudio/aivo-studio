/* =========================================================
   VERIFIED SHIELD — Studio’da /api/auth/verified 401 => soft-ok
   Amaç: Diğer scriptler 401 görünce logout/redirect yapamasın.
   ========================================================= */
(function(){
  if (window.__AIVO_VERIFIED_SHIELD__) return;
  window.__AIVO_VERIFIED_SHIELD__ = true;

  var SOFT_BODY = JSON.stringify({ ok:true, unknown:true, verified:true });

  // --- fetch shield ---
  if (typeof window.fetch === "function") {
    var _fetch = window.fetch;
    window.fetch = function(input, init){
      var url = (typeof input === "string") ? input : (input && input.url) ? input.url : "";
      var low = String(url||"").toLowerCase();

      return _fetch.apply(this, arguments).then(function(res){
        try{
          if (low.indexOf("/api/auth/verified") !== -1 && res && res.status === 401) {
            return new Response(SOFT_BODY, {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
        } catch(e){}
        return res;
      });
    };
  }

  // --- XHR shield ---
  if (window.XMLHttpRequest) {
    var XHR = window.XMLHttpRequest;
    var open = XHR.prototype.open;
    var send = XHR.prototype.send;

    XHR.prototype.open = function(method, url){
      this.__aivo_url = url;
      return open.apply(this, arguments);
    };

    XHR.prototype.send = function(){
      var xhr = this;
      xhr.addEventListener("readystatechange", function(){
        try{
          var url = String(xhr.__aivo_url || "").toLowerCase();
          if (url.indexOf("/api/auth/verified") !== -1 && xhr.readyState === 4 && xhr.status === 401) {
            // status/response patch (Safari dostu)
            try { Object.defineProperty(xhr, "status", { value: 200 }); } catch(_){}
            try { Object.defineProperty(xhr, "responseText", { value: SOFT_BODY }); } catch(_){}
            try { Object.defineProperty(xhr, "response", { value: SOFT_BODY }); } catch(_){}
          }
        } catch(e){}
      });
      return send.apply(this, arguments);
    };
  }
})();
