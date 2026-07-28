export const config = { runtime: "nodejs" };

import crypto from "node:crypto";
import authModule from "../../../_lib/auth.js";
import { buildAdFilmMusicPrompt } from "../../../_lib/ad-film-music-prompt.js";

const { requireAuth } = authModule;
const MODEL_ID = "fal-ai/stable-audio-3/small/music/text-to-audio";
const MODEL_URL = `https://queue.fal.run/${MODEL_ID}`;
const PREVIEW_TICKET_TTL_MS = 30 *