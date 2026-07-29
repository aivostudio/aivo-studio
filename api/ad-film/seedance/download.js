// api/ad-film/seedance/download.js
export const config = { runtime: "nodejs" };

import { Readable } from "node:stream";
import {
  getOwnedProject,
  resolveAdFilmUser,
  sendJson,
} from "../../_lib/ad-film-projects.js";

function clean(value, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

function outputsOf(project) {
  const outputs = Array.isArray(project?.outputs)
    ? project.outputs.filter((item) => item?.videoUrl)
    : [];

  if (!outputs.length && project?.generation?.videoUrl) {
    outputs.push({
      id:
        project.generation.outputId ||
        project.generation.requestId ||
        "legacy-output",
      version: project.generation.version || 1,
      videoUrl: project.generation.videoUrl,
    });
  }

  return outputs;
}

function safeFilename(value) {
  return String(value || "reklam-filmi")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "reklam-filmi";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const projectId = clean(req.query?.projectId, 120);
    const outputId = clean(req.query?.outputId, 240);
    if (!projectId) {
      return sendJson(res, 400, { ok: false, error: "missing_project_id" });
    }

    const project = await getOwnedProject(user, projectId);
    if (!project) {
      return sendJson(res, 404, { ok: false, error: "project_not_found" });
    }

    const outputs = outputsOf(project);
    const selected =
      outputs.find((item) => String(item.id) === outputId) ||
      outputs.find((item) => String(item.id) === String(project.activeOutputId || "")) ||
      outputs[0];

    const videoUrl = clean(selected?.videoUrl, 4000);
    if (!videoUrl || !/^https:\/\//i.test(videoUrl)) {
      return sendJson(res, 404, { ok: false, error: "video_not_found" });
    }

    const upstream = await fetch(videoUrl, {
      method: "GET",
      redirect: "follow",
      headers: { Accept: "video/mp4,video/*;q=0.9,*/*;q=0.1" },
    });

    if (!upstream.ok || !upstream.body) {
      return sendJson(res, 502, {
        ok: false,
        error: "video_fetch_failed",
        status: upstream.status,
      });
    }

    const title = safeFilename(project?.brief?.productName || "aivo-reklam-filmi");
    const version = Number(selected?.version) || 1;
    const filename = `${title}-v${version}.mp4`;

    res.setHeader("Content-Type", upstream.headers.get("content-type") || "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const length = upstream.headers.get("content-length");
    if (length) res.setHeader("Content-Length", length);

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    console.error("[ad-film/seedance/download]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: String(error?.message || error),
    });
  }
}
