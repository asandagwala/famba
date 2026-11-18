import { resetDemo } from "@/lib/famba/db";

// POST /api/reset — restore the demo data
export async function POST() {
  await resetDemo();
  return Response.json({ ok: true });
}
