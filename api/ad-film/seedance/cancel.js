// api/ad-film/seedance/cancel.js
export const config = { runtime: "nodejs" };

import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

const MODEL = "bytedance/seedance-2.0/reference-to-video";

function clean(value, max = 1600) {
  return String(value ?? "").trim().slice(0, max);
}

function falKey() {
  return process.env.FAL_KEY || process.env.FAL_API_KEY || "";
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch (_) {
    return { raw: text || "" };
  }
}

function statusUrlFor(generation) {
  const direct = clean(generation?.statusUrl, 1600);
  if (direct) return direct;
  const requestId = clean(generation?.requestId, 240);
  return requestId
    ? `https://queue.fal.run/${MODEL}/requests/${encodeURIComponent(requestId)}/status`
    : "";
}

function cancelUrlFor(generation) {
  const direct = clean(generation?.cancelUrl, 1600);
  if (direct) return direct;
  const statusUrl = statusUrlFor(generation);
  return statusUrl ? statusUrl.replace(/\/status\/?$/i, "/cancel") : "";
}

function normalizedProviderStatus(payload) {
  const value = clean(payload?.status || payload?.state || payload?.data?.status || payload?.result?.status, 80).toUpperCase();
  if (["COMPLETED", "COMPLETE", "SUCCEEDED", "READY", "DONE"].includes(value)) return "COMPLETED";
  if (["FAILED", "ERROR", "CANCELED", "CANCELLED"].includes(value)) return "FAILED";
  if (["IN_PROGRESS", "PROCESSING", "RUNNING", "STARTED"].includes(value)) return "RUNNING";
  if (["IN_QUEUE", "QUEUED", "PENDING"].includes(value)) return "IN_QUEUE";
  return value || "UNKNOWN";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projectId = clean(req.body?.projectId, 120);
    const mode = clean(req.body?.mode, 30).toLowerCase() === "failed" ? "failed" : "cancelled";
    const reason = clean(req.body?.reason, 1200) || (mode === "failed" ? "generation_failed" : "user_cancelled");
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });

    const project = await getOwnedProject(user, projectId);
    if (!project) {
      return sendJson(res, 200, {
        ok: true,
        projectId,
        provider_cancelled: false,
        project_missing: true,
      });
    }

    const generation = project.generation || {};
    const generationStatus = clean(generation.status, 80).toLowerCase();
    const active = ["queued", "processing"].includes(generationStatus) && Boolean(clean(generation.requestId, 240));
    const key = falKey();
    let providerStatus = null;
    let providerResponse = null;
    let providerCancelled = !active;

    if (active) {
      if (!key) {
        return sendJson(res, 500, { ok: false, error: "missing_fal_key" });
      }

      const statusUrl = statusUrlFor(generation);
      if (statusUrl) {
        try {
          const statusResponse = await fetch(statusUrl, {
            method: "GET",
            headers: { Authorization: `Key ${key}`, Accept: "application/json" },
          });
          const statusText = await statusResponse.text().catch(() => "");
          const statusData = parseJson(statusText);
          const providerState = normalizedProviderStatus(statusData);
          if (statusResponse.ok && providerState === "COMPLETED") {
            return sendJson(res, 409, {
              ok: false,
              error: "generation_completed_before_cancel",
              provider_status: statusResponse.status,
              provider_state: providerState,
              provider_response: statusData,
              generation,
            });
          }
          if (statusResponse.ok && providerState === "FAILED") {
            providerCancelled = true;
            providerStatus = statusResponse.status;
            providerResponse = statusData;
          }
        } catch (error) {
          console.warn("[ad-film/seedance/cancel] provider status check failed", error);
        }
      }

      if (!providerCancelled) {
        const cancelUrl = cancelUrlFor(generation);
        if (!cancelUrl) {
          return sendJson(res, 502, { ok: false, error: "missing_provider_cancel_url" });
        }
        try {
          const response = await fetch(cancelUrl, {
            method: "PUT",
            headers: {
              Authorization: `Key ${key}`,
              Accept: "application/json",
            },
          });
          const responseText = await response.text().catch(() => "");
          providerStatus = response.status;
          providerResponse = parseJson(responseText);
          providerCancelled = response.ok || response.status === 404 || response.status === 409;
        } catch (error) {
          providerResponse = { message: String(error?.message || error) };
          providerCancelled = false;
        }
      }

      if (!providerCancelled) {
        return sendJson(res, 502, {
          ok: false,
          error: "provider_cancel_failed",
          provider_status: providerStatus,
          provider_response: providerResponse,
          generation,
        });
      }
    }

    const now = new Date().toISOString();
    const nextProject = await saveProject(user, {
      ...project,
      status: mode,
      generation: {
        ...generation,
        status: mode,
        updatedAt: now,
        cancelledAt: mode === "cancelled" ? now : generation.cancelledAt || null,
        failedAt: mode === "failed" ? now : generation.failedAt || null,
        error: reason,
      },
    });

    return sendJson(res, 200, {
      ok: true,
      projectId,
      status: mode.toUpperCase(),
      provider_cancelled: providerCancelled,
      provider_status: providerStatus,
      provider_response: providerResponse,
      project: nextProject,
    });
  } catch (error) {
    console.error("[ad-film/seedance/cancel]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: String(error?.message || error),
    });
  }
}
