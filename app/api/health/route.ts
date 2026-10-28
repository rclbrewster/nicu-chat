export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, service: "nicu-chat", time: new Date().toISOString() });
}
