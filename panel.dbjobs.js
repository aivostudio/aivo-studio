// panel.dbjobs.js
(function(){
  // Single source of truth helper for RightPanel modules
  // - hydrate from DB: /api/jobs/list?app=...
  // - poll only PROCESSING jobs: /api/jobs/status?job_id=...
  // - normalize outputs + prefer archive_url
  // - optional delete hook (if endpoint exists)

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
      app: String(opts.app || ""),
      items: [],
      isHydrated: false,
      lastHydrateAt: 0,
      pollTimer: null,
      destroyed: false,
      inFlight: new Set(),
      onChange: (typeof opts.onChange === "function") ? opts.onChange : null,
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

        // optional output filtering (panel-specific)
        let final = list;
        if(state.acceptOutput){
          final = list.map(job => {
            const outs = (job.outputs || []).filter(state.acceptOutput);
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

          // optional output filtering again
          if(state.acceptOutput){
            fresh.outputs = (fresh.outputs || []).filter(state.acceptOutput);
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
    normalizeOutputs
  };

})();
