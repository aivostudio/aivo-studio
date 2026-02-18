// panel.dbjobs.js
(function(){
  // Single source of truth helper for RightPanel modules
  // - hydrate from DB: /api/jobs/list?app=...
  // - poll only PROCESSING jobs: /api/jobs/status?job_id=...
  // - normalize outputs + prefer archive_url
  // - optional delete hook (if endpoint exists)
  // - STRICT app filtering so VIDEO/ATMO/SOCIAL/HOOK outputs never mix

  function safeJsonParse(s){
    try { return JSON.parse(s); } catch(e){ return null; }
  }

  function nowTs(){
    return Date.now();
  }

  function normalizeUrl(u){
    if(!u) return "";
    return String(u || "").trim();
  }

  function normKey(x){
    return String(x || "").trim().toLowerCase();
  }

  // --- APP FILTER STANDARD ----------------------------------------------------
  // IMPORTANT: Social + Hook can produce video outputs too.
  // To prevent mixing in Video panel, we enforce:
  // - Job must match target app (job.app OR job.meta.app)
  // - Output must match target app if output.meta.app exists
  // - Optionally restrict output types per panel (video panel only wants type="video", etc.)

  const APP_ALIASES = {
    // core
    video: ["video"],
    atmo: ["atmo", "atmos", "atmosphere", "atmosfer"],
    cover: ["cover", "kapak"],
    music: ["music", "müzik"],
    recording: ["recording", "ses", "voice", "kayıt"],
    dashboard: ["dashboard"],

    // important: these may ALSO emit video outputs
    social: ["social", "socialpack", "sm-pack", "smpack", "sm_pack", "sosyal"],
    hook: ["hook", "viral-hook", "viral_hook", "viralhook"]
  };

  function resolveAppAliases(appKey){
    const k = normKey(appKey);
    const list = APP_ALIASES[k] || [k];
    // normalize + uniq
    const set = {};
    list.forEach(x => { const nx = normKey(x); if(nx) set[nx] = 1; });
    return Object.keys(set);
  }

  function pickJobApp(job){
    if(!job) return "";
    return normKey(
      job.app ||
      job.app_key ||
      job.appKey ||
      (job.meta && job.meta.app) ||
      ""
    );
  }

  function pickOutApp(out){
    if(!out) return "";
    const m = out.meta;
    if(m && typeof m === "object" && m.app) return normKey(m.app);
    return "";
  }

  function makeAppFilters(appKey, opts){
    opts = opts || {};
    const aliases = resolveAppAliases(appKey);
    const aliasSet = new Set(aliases);

    // If set, a panel can restrict outputs by type(s).
    // Example:
    // - Video panel: ["video"]
    // - Atmo panel:  ["video"] (since outputs are video, but meta.app must be atmo)
    // - Social panel: ["image","video"] etc (still meta.app keeps them separated)
    const allowedTypes = Array.isArray(opts.allowedTypes) ? opts.allowedTypes.map(normKey) : null;
    const allowedTypeSet = allowedTypes ? new Set(allowedTypes) : null;

    function matchesAlias(x){
      const k = normKey(x);
      if(!k) return false;
      return aliasSet.has(k);
    }

    function acceptJob(job){
      const jobApp = pickJobApp(job);
      // If backend list is correct, this will always pass — but we keep it strict to prevent UI mixing.
      return matchesAlias(jobApp);
    }

    // Signature: (output, job) => boolean
    function acceptOutput(out, job){
      out = out || {};
      const t = normKey(out.type || (out.meta && out.meta.type) || "unknown");
      if(allowedTypeSet && !allowedTypeSet.has(t)) return false;

      const outApp = pickOutApp(out);
      if(outApp){
        // if meta.app exists, it must match the panel app
        return matchesAlias(outApp);
      }

      // if output.meta.app missing, fallback to the job app (still strict)
      const jobApp = pickJobApp(job);
      return matchesAlias(jobApp);
    }

    return { acceptJob, acceptOutput, aliases };
  }
  // ---------------------------------------------------------------------------

  function normalizeOutputs(job){
    // backend may return outputs as stringified json or object
    let outputs = job && job.outputs;

    if(typeof outputs === "string"){
      const parsed = safeJsonParse(outputs);
      if(parsed) outputs = parsed;
    }

    if(!Array.isArray(outputs)) outputs = [];

    // ensure every output has url + archive_url preference
    outputs = outputs.map((o, idx) => {
      o = o || {};
      const meta = (o.meta && typeof o.meta === "object") ? o.meta : {};

      const url = normalizeUrl(o.archive_url || o.archiveUrl || o.url || "");
      const rawUrl = normalizeUrl(o.url || "");
      const archiveUrl = normalizeUrl(o.archive_url || o.archiveUrl || "");

      return {
        ...o,
        index: (o.index != null) ? o.index : idx,
        type: o.type || meta.type || "unknown",
        url: url || rawUrl,
        raw_url: rawUrl,
        archive_url: archiveUrl,
        meta
      };
    });

    return outputs;
  }

  function normalizeJobRow(row){
    row = row || {};

    // unify common fields
    const createdAt =
      row.created_at ||
      row.createdAt ||
      row.created ||
      row.ts ||
      null;

    const updatedAt =
      row.updated_at ||
      row.updatedAt ||
      row.updated ||
      null;

    const status = String(row.status || row.state || "").toUpperCase();

    const jobId = row.job_id || row.jobId || row.id || row.uuid || "";

    const app =
      row.app ||
      row.app_key ||
      row.appKey ||
      (row.meta && row.meta.app) ||
      "";

    const provider =
      row.provider ||
      (row.meta && row.meta.provider) ||
      "";

    const prompt =
      row.prompt ||
      (row.input && row.input.prompt) ||
      (row.meta && row.meta.prompt) ||
      "";

    const outputs = normalizeOutputs(row);

    return {
      ...row,
      job_id: jobId,
      app,
      provider,
      status,
      prompt,
      created_at: createdAt,
      updated_at: updatedAt,
      outputs
    };
  }

  function sortNewestFirst(items){
    return (items || []).slice().sort((a,b) => {
      const ta = +new Date(a.created_at || a.updated_at || 0);
      const tb = +new Date(b.created_at || b.updated_at || 0);
      return tb - ta;
    });
  }

  async function fetchList(appKey){
    const url = `/api/jobs/list?app=${encodeURIComponent(appKey)}`;
    const res = await fetch(url, { credentials: "include" });
    const json = await res.json().catch(() => null);

    if(!json || json.ok === false){
      throw new Error((json && json.error) || "list_failed");
    }

    const rows = json.rows || json.items || json.jobs || json.data || [];
    const normalized = rows.map(normalizeJobRow);

    return sortNewestFirst(normalized);
  }

  async function fetchStatus(jobId){
    const url = `/api/jobs/status?job_id=${encodeURIComponent(jobId)}`;
    const res = await fetch(url, { credentials: "include" });
    const json = await res.json().catch(() => null);

    if(!json || json.ok === false){
      throw new Error((json && json.error) || "status_failed");
    }

    // normalize into job-like object
    return normalizeJobRow(json.job || json.row || json.data || json);
  }

  async function tryDelete(jobId){
    // optional endpoint (if exists)
    // recommended: POST /api/jobs/delete { job_id }
    try{
      const res = await fetch("/api/jobs/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ job_id: jobId })
      });
      const json = await res.json().catch(() => null);
      if(json && json.ok) return true;
      return false;
    }catch(e){
      return false;
    }
  }

  function createController(opts){
    opts = opts || {};

    const state = {
      app: String(opts.app || ""), // backend list key
      items: [],
      isHydrated: false,
      lastHydrateAt: 0,
      pollTimer: null,
      destroyed: false,
      inFlight: new Set(),
      onChange: (typeof opts.onChange === "function") ? opts.onChange : null,

      // NEW:
      // - acceptJob(job) => boolean   (strict: app isolation)
      // - acceptOutput(out, job) => boolean
      acceptJob: (typeof opts.acceptJob === "function") ? opts.acceptJob : null,
      acceptOutput: (typeof opts.acceptOutput === "function") ? opts.acceptOutput : null,

      debug: !!opts.debug,
      pollIntervalMs: Math.max(2000, Number(opts.pollIntervalMs || 4000)),
      hydrateEveryMs: Math.max(5000, Number(opts.hydrateEveryMs || 15000))
    };

    function log(...a){
      if(state.debug) console.log("[DBJobs]", ...a);
    }

    function emit(){
      if(state.onChange) {
        try { state.onChange(state.items); } catch(e){}
      }
    }

    function upsert(job){
      const jobId = job && job.job_id;
      if(!jobId) return;

      // strict app isolation on any inbound upsert too
      if(state.acceptJob && !state.acceptJob(job)) return;

      const idx = state.items.findIndex(x => x.job_id === jobId);
      if(idx >= 0){
        state.items[idx] = { ...state.items[idx], ...job };
      }else{
        state.items.unshift(job);
      }

      state.items = sortNewestFirst(state.items);
      emit();
    }

    function remove(jobId){
      state.items = (state.items || []).filter(x => x.job_id !== jobId);
      emit();
    }

    async function hydrate(force){
      if(state.destroyed) return;

      const t = nowTs();
      if(!force && state.lastHydrateAt && (t - state.lastHydrateAt) < state.hydrateEveryMs){
        return;
      }

      state.lastHydrateAt = t;

      try{
        const list = await fetchList(state.app);

        // 1) strict job filter (prevents cross-app list/render bugs)
        let final = list;
        if(state.acceptJob){
          final = final.filter(state.acceptJob);
        }

        // 2) strict outputs filter (prevents video/social/hook mixing)
        if(state.acceptOutput){
          final = final.map(job => {
            const outs = (job.outputs || []).filter(o => {
              // support legacy acceptOutput(o) signature too
              try {
                return (state.acceptOutput.length >= 2) ? state.acceptOutput(o, job) : state.acceptOutput(o);
              } catch(e) { return false; }
            });
            return { ...job, outputs: outs };
          });
        }

        state.items = final;
        state.isHydrated = true;

        log("hydrated", state.app, state.items.length);
        emit();
      }catch(e){
        log("hydrate failed", e);
      }
    }

    async function pollOnce(){
      if(state.destroyed) return;

      // only PROCESSING jobs are polled
      const processing = (state.items || []).filter(j => {
        const st = String(j.status || "").toUpperCase();
        return (st === "PROCESSING" || st === "RUNNING" || st === "PENDING");
      });

      if(processing.length === 0) return;

      for(const job of processing){
        if(state.destroyed) return;

        const jobId = job.job_id;
        if(!jobId) continue;
        if(state.inFlight.has(jobId)) continue;

        state.inFlight.add(jobId);

        try{
          const fresh = await fetchStatus(jobId);

          // strict job app gate (protect against status returning mixed meta)
          if(state.acceptJob && !state.acceptJob(fresh)){
            state.inFlight.delete(jobId);
            continue;
          }

          // optional output filtering again
          if(state.acceptOutput){
            fresh.outputs = (fresh.outputs || []).filter(o => {
              try {
                return (state.acceptOutput.length >= 2) ? state.acceptOutput(o, fresh) : state.acceptOutput(o);
              } catch(e) { return false; }
            });
          }

          upsert(fresh);
        }catch(e){
          // ignore errors, keep polling next time
        }finally{
          state.inFlight.delete(jobId);
        }
      }
    }

    function start(){
      if(state.destroyed) return;

      hydrate(true);

      if(state.pollTimer) clearInterval(state.pollTimer);
      state.pollTimer = setInterval(() => {
        pollOnce();
      }, state.pollIntervalMs);
    }

    function destroy(){
      state.destroyed = true;
      if(state.pollTimer) clearInterval(state.pollTimer);
      state.pollTimer = null;
      state.inFlight.clear();
    }

    async function deleteJob(jobId){
      if(!jobId) return false;

      // optimistic remove
      remove(jobId);

      const ok = await tryDelete(jobId);
      return ok;
    }

    return {
      state,
      hydrate,
      pollOnce,
      start,
      destroy,
      upsert,
      remove,
      deleteJob
    };
  }

  // global export
  window.DBJobs = {
    create: createController,
    normalizeJobRow,
    normalizeOutputs,

    // NEW: shared filter helper
    makeAppFilters
  };

  // Handy presets you can reuse in panels (optional):
  // - Video panel should only accept VIDEO app + type=video outputs
  // - Atmo panel accepts ATMO app + type=video outputs
  // - Social/Hook can accept video outputs too, but meta.app keeps them separate
  window.DBJobsFilters = {
    video: function(){ return makeAppFilters("video", { allowedTypes: ["video"] }); },
    atmo: function(){ return makeAppFilters("atmo",  { allowedTypes: ["video"] }); },
    cover:function(){ return makeAppFilters("cover", { allowedTypes: ["image"] }); },
    social:function(){ return makeAppFilters("social", { allowedTypes: ["image","video"] }); },
    hook: function(){ return makeAppFilters("hook",  { allowedTypes: ["video"] }); }
  };

})();
