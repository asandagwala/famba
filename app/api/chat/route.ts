import { GoogleGenAI, Type, type Content, type FunctionDeclaration, type Part } from "@google/genai";
import { balanceOf, readDb } from "@/lib/famba/db";
import { COUNTRY, CURRENCIES, FAMBA, SWIFT, getRates, round, type Currency } from "@/lib/famba/rates";

// POST /api/chat { messages: [{role, content}] } — Famba Assistant, powered by Gemini.
// Read-only: it can look things up, but it has no tool that moves money.

// Tried in order: if one is overloaded (503) or unavailable to this key (404), the next is used.
const MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ["gemini-3.1-flash-lite", "gemini-flash-lite-latest", "gemini-3.5-flash-lite"];

const SYSTEM = `You are Famba Assistant, the helper inside Famba, a stablecoin payment gateway for African businesses.
Customers in other African countries pay in their own currency (mobile money, bank or a USDC wallet); Famba settles it as USDC on the Base network in about 15 seconds for a 0.2% fee, matches it to the order, and the merchant settles to their bank in rand. Bank transfers between African countries usually take 3-5 days and cost 2-7%.

You help the merchant understand their money: balances, who has paid, who hasn't, how customers paid, supplier payments, settlements, exchange rates and fee savings. Always use the tools to get real numbers; never invent figures.
You are read-only. You cannot send, move, refund or settle money. If asked to, explain how the merchant can do it in the app (Payments → Create payment link, Suppliers → Pay, Settlements → Settle to bank).
Keep answers short, warm and in plain language, without markdown headings or tables. Use South African formatting for rand (R1 234,56).`;

const noArgs = { type: Type.OBJECT, properties: {} };

const tools: FunctionDeclaration[] = [
  {
    name: "get_balance",
    description: "The merchant's Famba balance: USDC received from customers, paid to suppliers, settled to bank, and available now, plus the rand equivalent.",
    parameters: noArgs,
  },
  {
    name: "list_customer_payments",
    description: "Customer orders / payment links, newest first, including how each customer paid. Filter by status PAID, PENDING (unpaid) or ALL.",
    parameters: {
      type: Type.OBJECT,
      properties: { status: { type: Type.STRING, enum: ["PAID", "PENDING", "ALL"] } },
    },
  },
  {
    name: "list_supplier_payments",
    description: "Payments the merchant has sent to suppliers in other African countries, newest first, and the supplier list.",
    parameters: noArgs,
  },
  {
    name: "get_exchange_rates",
    description: "Live exchange rates: how many units of ZAR, KES, NGN, GHS and ZMW equal 1 USDC.",
    parameters: noArgs,
  },
  {
    name: "compare_fees",
    description: "Compare the cost of sending an amount across borders by bank versus with Famba.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: { type: Type.NUMBER, description: "Amount to send" },
        currency: { type: Type.STRING, enum: [...CURRENCIES] },
      },
      required: ["amount", "currency"],
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
        .map((o) => ({
          customer: o.customerName,
          from: o.customerCountry,
          item: o.description,
          amountZar: o.amountZar,
          usdc: o.usdcAmount,
          status: o.status,
          paidWith: o.paidWith ? `${o.paidWith.provider} (${o.paidWith.currency} ${o.paidWith.amount})` : null,
          created: o.createdAt,
          paidAt: o.paidAt,
          verifiedOnChain: o.mode === "onchain",
        }));
    }
    case "list_supplier_payments":
      return {
        payments: [...db.supplierPayments].reverse().map((p) => ({ supplier: p.supplierName, usdc: p.usdcAmount, received: `${p.currency} ${p.localAmount}`, note: p.note, date: p.createdAt, onChain: p.mode === "onchain" })),
        suppliers: db.suppliers.map((s) => ({ name: s.name, product: s.product, country: s.country, currency: s.currency, payoutMethod: s.payoutMethod })),
        settlements: db.cashOuts.map((c) => ({ bank: c.bank, zar: c.zarAmount, usdc: c.usdcAmount, date: c.createdAt })),
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

async function generate(ai: GoogleGenAI, contents: Content[]) {
  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      return await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: SYSTEM,
          tools: [{ functionDeclarations: tools }],
          temperature: 0.3,
          httpOptions: { timeout: 20_000 },
        },
      });
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number }).status;
      if (status && status !== 404 && status !== 429 && status < 500) throw e; // a real error, not "busy"
    }
  }
  throw lastErr;
}

const NOT_SET_UP ="The assistant isn't set up yet. Add GEMINI_API_KEY to a .env.local file (or your Vercel settings) and restart the app.";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { messages?: { role: string; content: string }[] } | null;
  const history = (body?.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12);
  if (!history.length || history[0].role !== "user" || history.at(-1)?.role !== "user")
    return Response.json({ error: "Send a question." }, { status: 400 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ reply: NOT_SET_UP });
  const ai = new GoogleGenAI({ apiKey });

  const contents: Content[] = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content.slice(0, 2000) }],
  }));

  try {
    for (let turn = 0; turn < 6; turn++) {
      const response = await generate(ai, contents);

      const calls = response.functionCalls ?? [];
      if (calls.length === 0) {
        const reply = (response.text ?? "").trim();
        return Response.json({ reply: reply || "I'm not sure. Could you rephrase that?" });
      }

      // Keep the model's turn (including its function calls), then answer every call in one user turn.
      const modelTurn = response.candidates?.[0]?.content;
      if (modelTurn) contents.push(modelTurn);
      const results: Part[] = [];
      for (const call of calls) {
        let result: unknown;
        try {
          result = await runTool(call.name ?? "", (call.args ?? {}) as Record<string, unknown>);
        } catch (e) {
          result = { error: String(e) };
        }
        results.push({ functionResponse: { id: call.id, name: call.name, response: { result } } });
      }
      contents.push({ role: "user", parts: results });
    }
    return Response.json({ reply: "That took too many steps. Could you ask something more specific?" });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403) return Response.json({ reply: "The assistant's API key was rejected. Check GEMINI_API_KEY and restart." });
    if (status === 429) return Response.json({ reply: "I'm getting a lot of questions right now. Try again in a moment." });
    if (status) return Response.json({ reply: `The assistant hit an error (${status}). Try again.` });
    return Response.json({ reply: "I couldn't reach the assistant service. Check your internet connection." });
  }
}
