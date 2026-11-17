import Anthropic from "@anthropic-ai/sdk";
import { balanceOf, readDb } from "@/lib/famba/db";
import { COUNTRY, CURRENCIES, FAMBA, SWIFT, getRates, round, type Currency } from "@/lib/famba/rates";

// POST /api/chat { messages: [{role, content}] } — Famba assistant.
// Read-only: it can look things up, but it has no tool that moves money.

const SYSTEM = `You are Famba Assistant, the helper inside Famba, a cross-border payments app for African small businesses.
Famba lets a business get paid by customers anywhere in Africa and pay suppliers in other African countries, using USDC (a digital US dollar) on the Base network. Money arrives in about 15 seconds for a 0.2% fee, instead of 3-5 days and around 9.5% through banks.

You help the merchant understand their money: balances, who has paid, who hasn't, supplier payments, cash-outs, exchange rates, and fee savings. Use the tools to get real numbers; never invent figures.
You are read-only. You cannot send, move, refund, or cash out money. If asked to, explain how the merchant can do it in the app (Dashboard → New payment link, Suppliers → Pay, Cash out).
Keep answers short, warm and in plain language. Show amounts in both USDC and the local currency where useful. Use South African formatting (R 1 234,56) for rand.`;

const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: "get_balance",
    description: "The merchant's current Famba balance: USDC received from customers, paid to suppliers, cashed out, and available now, plus the rand equivalent.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_customer_payments",
    description: "Customer orders / payment links, newest first. Filter by status PAID or PENDING (unpaid).",
    input_schema: {
      type: "object",
      properties: { status: { type: "string", enum: ["PAID", "PENDING", "ALL"] } },
      additionalProperties: false,
    },
  },
  {
    name: "list_supplier_payments",
    description: "Payments the merchant has sent to suppliers in other African countries, newest first, and the supplier list.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_exchange_rates",
    description: "Live exchange rates: how many units of ZAR, KES, NGN, GHS and ZMW equal 1 USDC.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "compare_fees",
    description: "Compare the cost of sending an amount across borders with a bank (SWIFT) versus Famba.",
    input_schema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Amount to send" },
        currency: { type: "string", enum: [...CURRENCIES] },
      },
      required: ["amount", "currency"],
      additionalProperties: false,
    },
  },
];

async function runTool(name: string, input: Record<string, unknown>) {
  const [db, r] = await Promise.all([readDb(), getRates()]);
  const zar = (usdc: number) => round(usdc * r.rates.ZAR);
  switch (name) {
    case "get_balance": {
      const b = balanceOf(db);
      return { ...b, availableZar: zar(b.available), rateSource: r.source };
    }
    case "list_customer_payments": {
      const status = (input.status as string) ?? "ALL";
      return db.orders
        .filter((o) => status === "ALL" || o.status === status)
        .reverse()
        .map((o) => ({ customer: o.customerName, from: o.customerCountry, item: o.description, amountZar: o.amountZar, usdc: o.usdcAmount, status: o.status, created: o.createdAt, paidAt: o.paidAt, verifiedOnChain: o.mode === "onchain" }));
    }
    case "list_supplier_payments":
      return {
        payments: [...db.supplierPayments].reverse().map((p) => ({ supplier: p.supplierName, usdc: p.usdcAmount, received: `${p.currency} ${p.localAmount}`, note: p.note, date: p.createdAt, onChain: p.mode === "onchain" })),
        suppliers: db.suppliers.map((s) => ({ name: s.name, product: s.product, country: s.country, currency: s.currency, payoutMethod: s.payoutMethod })),
      };
    case "get_exchange_rates":
      return { usdcTo: r.rates, source: r.source, asOf: r.fetchedAt, countries: COUNTRY };
    case "compare_fees": {
      const amount = Number(input.amount);
      const ccy = input.currency as Currency;
      if (!(amount > 0) || !CURRENCIES.includes(ccy)) return { error: "amount and currency required" };
      return {
        bank: { fee: round((amount * SWIFT.feePct) / 100), time: SWIFT.label },
        famba: { fee: round((amount * FAMBA.feePct) / 100), time: FAMBA.label },
        saved: round((amount * (SWIFT.feePct - FAMBA.feePct)) / 100),
        currency: ccy,
      };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { messages?: { role: string; content: string }[] } | null;
  const history = (body?.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 2000) }));
  if (!history.length || history[0].role !== "user" || history.at(-1)?.role !== "user")
    return Response.json({ error: "Send a question." }, { status: 400 });

  let client: Anthropic;
  try {
    client = new Anthropic();
  } catch {
    return Response.json({ reply: "The assistant isn't set up yet. Add ANTHROPIC_API_KEY to a .env.local file and restart the app." });
  }

  const messages: Anthropic.Beta.BetaMessageParam[] = history;
  try {
    for (let turn = 0; turn < 6; turn++) {
      const response = await client.beta.messages.create({
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default", // re-run on a fallback model if a safety classifier declines
        model: "claude-opus-5-5",
        max_tokens: 4000,
        output_config: { effort: "low" },
        system: SYSTEM,
        tools,
        messages,
      });

      if (response.stop_reason === "refusal")
        return Response.json({ reply: "Sorry, I can't help with that one. Ask me about your payments, balance or rates." });

      if (response.stop_reason !== "tool_use") {
        const reply = response.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return Response.json({ reply: reply || "I'm not sure. Could you rephrase that?" });
      }

      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        try {
          const out = await runTool(block.name, (block.input ?? {}) as Record<string, unknown>);
          results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out) });
        } catch (e) {
          results.push({ type: "tool_result", tool_use_id: block.id, content: String(e), is_error: true });
        }
      }
      messages.push({ role: "user", content: results });
    }
    return Response.json({ reply: "That took too many steps. Could you ask something more specific?" });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      return Response.json({ reply: "The assistant's API key is missing or invalid. Set ANTHROPIC_API_KEY in .env.local and restart." });
    if (error instanceof Anthropic.RateLimitError)
      return Response.json({ reply: "I'm getting a lot of questions right now. Try again in a moment." });
    if (error instanceof Anthropic.APIError)
      return Response.json({ reply: `The assistant hit an error (${error.status}). Try again.` });
    const msg = error instanceof Error ? error.message : "";
    if (/api key|apiKey|credentials|auth/i.test(msg))
      return Response.json({ reply: "The assistant isn't set up yet. Add ANTHROPIC_API_KEY to a .env.local file and restart the app." });
    return Response.json({ reply: "I couldn't reach the assistant service. Check your internet connection." });
  }
}
