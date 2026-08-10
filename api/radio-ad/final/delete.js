// api/radio-ad/final/delete.js
export const config = { runtime: "nodejs" };

import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "../../_lib/r2.js";
import {
  getOwnedRadioProject,
  mediaPrefix,
  resolveRadioAdUser,
  saveRadioProject,
  sendJson,
} from "../../_lib/radio-ad-projects.js";

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

export default async function handler(req, res) {
  try {
    if (!['DELETE', 'POST'].includes(req.method)) {
      res.setHeader("Allow", "DELETE, POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveRadioAdUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projectId = clean(req.query?.projectId || req.body?.projectId, 120);
    const finalId = clean(req.query?.finalId || req.body?.finalId, 160);
    if (!projectId) return sendJson(res, 400, { ok: false, error: "missing_project_id" });
    if (!finalId) return sendJson(res, 400, { ok: false, error: "missing_final_id" });

    const project = await getOwnedRadioProject(user, projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const history = Array.isArray(project.finalHistory) ? project.finalHistory : [];
    const target = history.find((item) => clean(item?.id, 160) === finalId);
    if (!target) return sendJson(res, 404, { ok: false, error: "final_not_found" });

    const prefix = mediaPrefix(user, projectId);
    const key = clean(target.key, 1000);
    if (key && key.startsWith(prefix)) {
      const bucket = process.env.R2_BUCKET;
      if (!bucket) throw new Error("missing_env:R2_BUCKET");
      await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    }

    const nextHistory = history.filter((item) => clean(item?.id, 160) !== finalId);
    const deletingCurrent = clean(project.final?.id, 160) === finalId;
    const nextFinal = deletingCurrent ? nextHistory[0] || null : project.final || null;
    const nextStatus = nextFinal ? "completed" : "draft";

    const saved = await saveRadioProject(user, {
      ...project,
      status: nextStatus,
      final: nextFinal,
      finalHistory: nextHistory,
      finalGeneration: nextFinal ? project.finalGeneration || null : null,
    });

    return sendJson(res, 200, {
      ok: true,
      deleted: true,
      finalId,
      final: saved.final || null,
      finalHistory: saved.finalHistory || [],
      project: saved,
    });
  } catch (error) {
    console.error("[radio-ad/final/delete]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: String(error?.message || error),
    });
  }
}
