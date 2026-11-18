import { addCashOut, FambaError, newId, type CashOut } from "@/lib/famba/db";
import { getRates, round } from "@/lib/famba/rates";

const FEE_PCT = 0.5;

// POST /api/cash-out { usdcAmount, bank } — withdraw USDC to a local ZAR bank account (simulated off-ramp)
export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const usdcAmount = Number(b?.usdcAmount);
  const bank = typeof b?.bank === "string" ? b.bank.trim().slice(0, 80) : "";
  if (!(usdcAmount > 0)) return Response.json({ error: "Enter an amount above zero." }, { status: 400 });
  if (!bank) return Response.json({ error: "Choose a bank account." }, { status: 400 });

  const { rates } = await getRates();
  const gross = usdcAmount * rates.ZAR;
  const fee = (gross * FEE_PCT) / 100;
  const cashOut: CashOut = {
    id: newId("cash"),
    usdcAmount: round(usdcAmount, 2),
    zarAmount: round(gross - fee),
    fee: round(fee),
    bank,
    createdAt: new Date().toISOString(),
  };
  try {
    await addCashOut(cashOut);
  } catch (e) {
    if (e instanceof FambaError) return Response.json({ error: e.message }, { status: 422 });
    throw e;
  }
  return Response.json({ cashOut }, { status: 201 });
}
