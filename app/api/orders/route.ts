import { createOrder, newId, type Order } from "@/lib/famba/db";
import { getRates, round } from "@/lib/famba/rates";

// POST /api/orders — create a payment link a customer anywhere in Africa can pay
export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (v: unknown, n = 120) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const customerName = str(b?.customerName);
  const customerCountry = str(b?.customerCountry, 40);
  const description = str(b?.description, 200);
  const amountZar = Number(b?.amountZar);
  if (!customerName || !description)
    return Response.json({ error: "Add the customer's name and what they're buying." }, { status: 400 });
  if (!(amountZar > 0) || amountZar > 1_000_000)
    return Response.json({ error: "Enter an amount between R1 and R1,000,000." }, { status: 400 });

  const { rates } = await getRates();
  const order: Order = {
    id: newId("ord"),
    customerName,
    customerCountry: customerCountry || "South Africa",
    description,
    amountZar: round(amountZar),
    usdcAmount: round(amountZar / rates.ZAR, 2),
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  await createOrder(order);
  return Response.json({ order }, { status: 201 });
}
