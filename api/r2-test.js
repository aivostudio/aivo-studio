import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { r2 } from "../_lib/r2.js"; // <-- düzeltildi (./ değil ../)

export default async function handler(req, res) {
  try {
    const out = await r2.send(new ListBucketsCommand({}));
    res.status(200).json({ ok: true, buckets: out.Buckets?.map((b) => b.Name) ?? [] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
