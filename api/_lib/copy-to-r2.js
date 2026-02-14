// api/_lib/copy-to-r2.js
import crypto from "crypto";
import { putObject } from "./r2.js";

export async function copyUrlToR2({ url, key, contentType }) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`copy_fetch_failed:${r.status}`);

  const ct = contentType || r.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await r.arrayBuffer());

  const sha = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 10);

  const publicUrl = await putObject({
    key,
    body: buf,
    contentType: ct,
  });

  return { url: publicUrl, sha, bytes: buf.length, contentType: ct };
}
