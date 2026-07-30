// api/ad-film/avatar/create.js
export const config = { runtime: "nodejs" };
export const maxDuration = 180;

import { copyUrlToR2 } from "../../_lib/copy-to-r2.js";
import {
  getOwnedProject,
  mediaPrefix,
  resolveAdFilmUser,
  saveProject,
  sendJson,
} from "../../_lib/ad-film-projects.js";

const MODEL = "fal-ai/flux-2-pro";
const COUNTRIES = {
  tr: