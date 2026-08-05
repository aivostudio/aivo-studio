import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { r2 } from "./r2.js";

export async function deleteR2Prefix(prefix) {
  const Bucket = process.env.R2_BUCKET;
  if (!Bucket) throw new Error("missing_env:R2_BUCKET");
  const safePrefix = String(prefix || "").trim();
  if (!safePrefix || !safePrefix.startsWith("uploads/radio-ad/")) {
    throw new Error("unsafe_r2_delete_prefix");
  }

  let continuationToken;
  let deletedCount = 0;

  do {
    const listed = await r2.send(new ListObjectsV2Command({
      Bucket,
      Prefix: safePrefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }));

    const objects = (listed.Contents || [])
      .map((item) => String(item?.Key || "").trim())
      .filter((key) => key && key.startsWith(safePrefix))
      .map((Key) => ({ Key }));

    if (objects.length) {
      const result = await r2.send(new DeleteObjectsCommand({
        Bucket,
        Delete: { Objects: objects, Quiet: false },
      }));
      if (Array.isArray(result.Errors) && result.Errors.length) {
        throw new Error(`r2_delete_failed:${result.Errors[0]?.Code || "unknown"}`);
      }
      deletedCount += objects.length;
    }

    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);

  return deletedCount;
}
