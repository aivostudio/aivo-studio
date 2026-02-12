import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  const sql = neon(process.env.POSTGRES_URL_NON_POOLING);

  const rows = await sql`
    select id, request_id, app, status, created_at
    from jobs
    order by created_at desc
    limit 5
  `;

  res.json({ ok: true, rows });
}
