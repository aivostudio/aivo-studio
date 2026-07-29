// api/ad-film/seedance/result.js
export const config = { runtime: "nodejs" };

import {
  getOwnedProject,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

function clean(value, max = 160) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeOutputs(project) {
  const list = Array.isArray(project?.outputs) ? project.outputs.filter(Boolean) : [];
  if (!list.length && project?.generation?.videoUrl) {
    const generation = project.generation;
   