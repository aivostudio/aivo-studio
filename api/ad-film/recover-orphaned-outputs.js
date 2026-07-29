// api/ad-film/recover-orphaned-outputs.js
export const config = { runtime: "nodejs" };

import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { r2 } from "../_lib/r2.js";
import {
  buildPublicUrl,
  createEmptyProject,
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../_lib/ad-film-projects.js";

function clean(value, max = 600) {
  return String(value ?? "").trim().slice(0, max);
}

function versionFromKey(key, fallback) {
  const match = String(key || "").match(/-v(\d+)(?:-|\.)/i);
  const value = Number.parseInt(match?.[1], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function outputIdFromKey(key, fallback) {
  const name = String(key || "").split("/").pop() || "";
  const match = name.match(/^(.+?)-v\d+(?:-logo)?-/i);
  return clean(match?.[1] || name.replace(/\.mp4$/i, "") || fallback, 240);
}

function outputIdentity(item) {
  return `${clean(item?.id, 240)}:${Number.parseInt(item?.version, 10) || 1}`;
}

function itemFromObject(item, index, total) {
  const key = clean(item?.Key, 1200);
  const id = outputIdFromKey(key, `recovered-${index + 1}`);
  const version = versionFromKey(key, Math.max(1, total - index));
  const createdAt = item?.LastModified
    ? new Date(item.LastModified).toISOString()
    : new Date().toISOString();
  const logoApplied = /-logo-/i.test(key);

  return {
    id,
    requestId: null,
    version,
    videoUrl: buildPublicUrl(key),
    sourceVideoUrl: null,
    logoApplied,
    recovered: true,
    recoveredKey: key,
    createdAt,
    completedAt: createdAt,
    duration: "15",
    aspectRatio: "16:9",
    resolution: "1080p",
    generateAudio: true,
  };
}

function preferOutput(current, candidate) {
  if (!current) return candidate;
  if (candidate.logoApplied && !current.logoApplied) return candidate;
  if (current.logoApplied && !candidate.logoApplied) return current;
  return String(candidate.completedAt || "").localeCompare(String(current.completedAt || "")) > 0
    ? candidate
    : current;
}

async function listAll(Bucket, Prefix) {
  const items = [];
  let token;
  do {
    const result = await r2.send(new ListObjectsV2Command({
      Bucket,
      Prefix,
      ContinuationToken: token,
      MaxKeys: 1000,
    }));
    items.push(...(Array.isArray(result.Contents) ? result.Contents : []));
    token = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (token);
  return items;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const user = await resolveAdFilmUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const Bucket = process.env.R2_BUCKET;
    if (!Bucket) return sendJson(res, 500, { ok: false, error: "missing_r2_bucket" });

    const rootPrefix = `uploads/ad-film/${user.ownerHash}/`;
    const objects = await listAll(Bucket, rootPrefix);
    const candidates = objects.filter((item) => {
      const key = clean(item?.Key, 1200);
      return key.includes("/outputs/seedance/") && /\.mp4$/i.test(key);
    });

    const groups = new Map();
    for (const item of candidates) {
      const key = clean(item?.Key, 1200);
      const relative = key.slice(rootPrefix.length);
      const projectId = clean(relative.split("/")[0], 120);
      if (!projectId) continue;
      if (!groups.has(projectId)) groups.set(projectId, []);
      groups.get(projectId).push(item);
    }

    const recovered = [];
    for (const [projectId, group] of groups.entries()) {
      const existing = await getOwnedProject(user, projectId);
      const sortedObjects = group
        .slice()
        .sort((a, b) => new Date(b?.LastModified || 0) - new Date(a?.LastModified || 0));

      const byIdentity = new Map();
      sortedObjects.forEach((object, index) => {
        const candidate = itemFromObject(object, index, sortedObjects.length);
        const identity = outputIdentity(candidate);
        byIdentity.set(identity, preferOutput(byIdentity.get(identity), candidate));
      });

      const existingOutputs = Array.isArray(existing?.outputs)
        ? existing.outputs.filter((item) => item && clean(item.videoUrl, 4000))
        : [];
      existingOutputs.forEach((item) => {
        const identity = outputIdentity(item);
        byIdentity.set(identity, preferOutput(byIdentity.get(identity), item));
      });

      const outputs = Array.from(byIdentity.values())
        .filter((item) => item && clean(item.videoUrl, 4000))
        .sort((a, b) => {
          const versionDiff = Number(b.version || 0) - Number(a.version || 0);
          return versionDiff || String(b.completedAt || "").localeCompare(String(a.completedAt || ""));
        })
        .slice(0, 30);

      if (!outputs.length) continue;

      const previousCount = existingOutputs.length;
      const addedCount = Math.max(0, outputs.length - previousCount);
      if (existing && addedCount === 0) continue;

      const now = new Date().toISOString();
      const project = existing || createEmptyProject(user, projectId);
      project.status = "completed";
      if (!clean(project.brief?.productName)) project.brief.productName = "Kurtarılan Reklam Projesi";
      project.output.duration = outputs[0].duration || project.output.duration || "15";
      project.output.aspectRatio = outputs[0].aspectRatio || project.output.aspectRatio || "16:9";
      project.output.quality = outputs[0].resolution || project.output.quality || "1080p";
      project.outputs = outputs;
      project.activeOutputId = outputs[0].id;
      project.generation = {
        ...(project.generation || {}),
        provider: "recovered-r2",
        status: "completed",
        outputId: outputs[0].id,
        version: outputs[0].version,
        videoUrl: outputs[0].videoUrl,
        completedAt: outputs[0].completedAt || now,
        updatedAt: now,
        error: null,
        input: {
          ...((project.generation && project.generation.input) || {}),
          duration: outputs[0].duration,
          aspectRatio: outputs[0].aspectRatio,
          resolution: outputs[0].resolution,
          generateAudio: outputs[0].generateAudio !== false,
        },
      };
      await saveProject(user, project);
      recovered.push({
        projectId,
        previousCount,
        outputCount: outputs.length,
        addedCount: existing ? addedCount : outputs.length,
        scannedObjects: sortedObjects.length,
      });
    }

    return sendJson(res, 200, {
      ok: true,
      recovered,
      scanned_objects: candidates.length,
      recovered_projects: recovered.length,
      recovered_outputs: recovered.reduce((sum, item) => sum + Number(item.addedCount || 0), 0),
    });
  } catch (error) {
    console.error("[ad-film/recover-orphaned-outputs]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "recovery_failed",
      message: String(error?.message || error),
    });
  }
}
