// api/radio-ad/projects.js
export const config = { runtime: "nodejs" };

import kvModule from "../_kv.js";
import {
  getOwnedRadioProject,
  resolveRadioAdUser,
  sendJson,
} from "../_lib/radio-ad-projects.js";

const kv = kvModule?.default || kvModule || {};
const { kvGetJson } = kv;
const MAX_PROJECTS = 50;

function indexKey(user) {
  return `radioad:user:${user.ownerHash}:projects`;
}

function clean(value, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    if (typeof kvGetJson !== "function") {
      throw new Error("radio_ad_kv_helpers_unavailable");
    }

    const user = await resolveRadioAdUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: "unauthorized" });

    const rawIndex = await kvGetJson(indexKey(user)).catch(() => []);
    const summaries = Array.isArray(rawIndex) ? rawIndex : [];
    const ids = Array.from(new Set(
      summaries
        .map((item) => clean(item?.id, 120))
        .filter(Boolean)
    )).slice(0, MAX_PROJECTS);

    const projects = (await Promise.all(
      ids.map((id) => getOwnedRadioProject(user, id).catch(() => null))
    ))
      .filter(Boolean)
      .map((project) => ({
        id: project.id,
        title: clean(project.title || "Radyo Reklamı", 100) || "Radyo Reklamı",
        status: clean(project.status || "draft", 30) || "draft",
        output: project.output || { duration: 10, format: "mp3" },
        final: project.final || null,
        finalHistory: Array.isArray(project.finalHistory) ? project.finalHistory : [],
        createdAt: project.createdAt || null,
        updatedAt: project.updatedAt || null,
      }))
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

    return sendJson(res, 200, {
      ok: true,
      projects,
      count: projects.length,
    });
  } catch (error) {
    console.error("[radio-ad/projects]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: String(error?.message || error),
    });
  }
}
