import { CORRIDORS, FAMBA, SWIFT, crossRate, getRates, quote, getCorridor } from "@/lib/famba/rates";


// GET /api/rates[?corridor=ZAR-KES&amount=100000]
export async function GET(request: Request) {
  const snap = await getRates();
  const url = new URL(request.url);
  const corridors = CORRIDORS.map((c) => ({
    ...c,
    crossRate: crossRate(snap.rates, c.from, c.to),
  }));

  let q = null;
  const corridorId = url.searchParams.get("corridor");
  const amountParam = url.searchParams.get("amount");
  if (corridorId && amountParam) {
    const corridor = getCorridor(corridorId);
    const amount = Number(amountParam);
    if (!corridor) return Response.json({ error: `Unknown corridor ${corridorId}` }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0)
      return Response.json({ error: "amount must be a positive number" }, { status: 400 });
    q = quote(snap.rates, corridor, amount);
  }

  return Response.json({ ...snap, fees: { swift: SWIFT, famba: FAMBA }, corridors, quote: q });
}
