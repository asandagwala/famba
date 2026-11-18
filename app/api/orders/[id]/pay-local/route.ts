import { FambaError, getOrder, markOrderPaid } from "@/lib/famba/db";
import { getRates, round, CURRENCIES, type Currency } from "@/lib/famba/rates";
import { LOCAL_METHODS } from "@/lib/famba/payment-methods";

// POST /api/orders/:id/pay-local { method: "mobile_money"|"bank", provider, currency, phone? }
// The customer pays in their own currency; Famba converts it to USDC and settles the merchant.
// On testnet the local collection (M-Pesa, MoMo, bank) is simulated; in production a licensed
// on-ramp partner collects the local currency.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const method = b?.method;
  const currency = b?.currency as Currency;
  const provider = typeof b?.provider === "string" ? b.provider : "";
  if (method !== "mobile_money" && method !== "bank") return Response.json({ error: "Choose how to pay." }, { status: 400 });
  if (!CURRENCIES.includes(currency)) return Response.json({ error: "Unsupported currency." }, { status: 400 });
  const allowed = method === "bank" ? [LOCAL_METHODS[currency].bank] : LOCAL_METHODS[currency].mobile;
  if (!allowed.includes(provider)) return Response.json({ error: "That payment option isn't available in this country." }, { status: 400 });
  if (method === "mobile_money") {
    const phone = typeof b?.phone === "string" ? b.phone.replace(/[^\d+]/g, "") : "";
    if (phone.replace(/\D/g, "").length < 9) return Response.json({ error: "Enter the mobile money number." }, { status: 400 });
  }

  const [{ order }, { rates }] = await Promise.all([getOrder(id), getRates()]);
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
  if (order.status === "PAID") return Response.json({ error: "This order has already been paid." }, { status: 409 });

  try {
    const paid = await markOrderPaid({
      orderId: id,
      paidAt: new Date().toISOString(),
      mode: "demo",
      paidWith: { method, provider, currency, amount: round(order.usdcAmount * rates[currency]) },
    });
    return Response.json({ order: paid });
  } catch (e) {
    if (e instanceof FambaError) return Response.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
