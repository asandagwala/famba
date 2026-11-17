import { balanceOf, newId, transact, type CashOut } from "@/lib/famba/db";
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
  const result = await transact((db) => {
    const available = balanceOf(db).available;
    if (usdcAmount > available + 1e-9) return { error: `You only have ${available.toFixed(2)} USDC available.` };
    const gross = usdcAmount * rates.ZAR;
    const fee = (gross * FEE_PCT) / 100;
    const c: CashOut = {
      id: newId("cash"),
      usdcAmount: round(usdcAmount, 2),
      zarAmount: round(gross - fee),
      fee: round(fee),
      bank,
      createdAt: new Date().toISOString(),
    };
    db.cashOuts.push(c);
    return { cashOut: c };
  });
  if ("error" in result) return Response.json(result, { status: 422 });
  return Response.json(result, { status: 201 });
}
