import { transact } from "@/lib/famba/db";
import { seed } from "@/lib/famba/seed";

// POST /api/reset — restore the demo data
export async function POST() {
  await transact((db) => {
    Object.assign(db, seed());
  });
  return Response.json({ ok: true });
}
