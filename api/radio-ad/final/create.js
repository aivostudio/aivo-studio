// api/radio-ad/final/create.js
export const config = { runtime: "nodejs" };
export const maxDuration = 180;

import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { putObject } from "../../_lib/r2.js";
import {
  getOwnedRadioProject,
  mediaPrefix,
  resolveRadioAdUser,
  saveRadioProject,