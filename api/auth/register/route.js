export const runtime = "nodejs";

export async function POST() {
  return new Response(
    JSON.stringify({ ok: true }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
}
