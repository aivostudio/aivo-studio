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

function cancelUrlFor(generation) {
  const direct = clean(generation?.cancelUrl, 1600);
  if (direct) return direct;

  const statusUrl = clean(generation?.statusUrl, 1600);
  if (statusUrl) return statusUrl.replace(/\/status\/?$/i, "/cancel");

  const requestId = clean(generation?.requestId, 240);
  return requestId
    ? `https://queue.fal.run/${MODEL}/requests/${encodeURIComponent(requestId)}/cancel`
    : "";
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
    const cancelUrl = cancelUrlFor(generation);
    const key = falKey();
    let providerStatus = null;
    let providerResponse = null;

    if (cancelUrl && key && generation.requestId && ["queued", "processing"].includes(String(generation.status))) {
      try {
        const response = await fetch(cancelUrl, {
          method: "PUT",
          headers: {
            Authorization: `Key ${key}`,
            Accept: "application/json",
          },
        });
        providerStatus = response.status;
        providerResponse = await response.json().catch(() => ({}));
      } catch (error) {
        providerResponse = { message: String(error?.message || error) };
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
