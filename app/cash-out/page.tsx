"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { CashOut } from "@/lib/famba/db";
import type { RateSnapshot } from "@/lib/famba/rates";
import { AppHeader, Card, api, btnPrimary, inputCls, labelCls, money, usdc, when } from "@/components/famba/ui";
import Chatbot from "@/components/famba/chatbot";

type Overview = { merchant: { name: string }; balance: { available: number }; rates: RateSnapshot; cashOuts: CashOut[] };

const BANKS = ["FNB Business ••4417", "Capitec Business ••0932", "Standard Bank ••7781"];

export default function CashOutPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState(BANKS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CashOut | null>(null);

  const load = useCallback(async () => setData(await api<Overview>("/api/overview")), []);
  useEffect(() => {
    const t = window.setTimeout(() => load().catch(() => {}), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const zarRate = data?.rates.rates.ZAR ?? 0;
  const amt = Number(amount);
  const gross = amt * zarRate;
  const fee = gross * 0.005;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ cashOut: CashOut }>("/api/cash-out", { method: "POST", body: JSON.stringify({ usdcAmount: amt, bank }) });
      setDone(r.cashOut);
      setAmount("");
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#181412]">
      <AppHeader merchant={data?.merchant.name} />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[1fr_1fr]">
        <div>
          <h1 className="text-3xl font-black" style={{ fontFamily: "var(--font-display)" }}>
            Cash out to your bank
          </h1>
          <p className="text-[#685D55]">Turn USDC from your customers into rand in your South African bank account.</p>

          <Card className="mt-5 p-6">
            {done ? (
              <div className="text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#1E6B45] text-2xl text-white">✓</div>
                <h2 className="mt-3 text-xl font-bold">{money(done.zarAmount, "ZAR")} is on its way</h2>
                <p className="text-sm text-[#685D55]">
                  To {done.bank}. Usually arrives the same day by EFT.
                </p>
                <button onClick={() => setDone(null)} className={`${btnPrimary} mt-4`}>
                  Cash out again
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="rounded-2xl bg-[#181412] p-4 text-white">
                  <p className="text-xs font-bold uppercase tracking-wider text-white/60">Available</p>
                  <p className="font-mono text-2xl font-black">{data ? usdc(data.balance.available) : "—"}</p>
                  <p className="text-sm text-[#E59A18]">{data ? `≈ ${money(data.balance.available * zarRate, "ZAR")}` : ""}</p>
                </div>
                <label className="block">
                  <span className={labelCls}>Amount (USDC)</span>
                  <div className="flex gap-2">
                    <input className={`${inputCls} font-mono text-xl`} type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                    <button type="button" onClick={() => data && setAmount(String(Math.floor(data.balance.available * 100) / 100))} className="rounded-xl border border-[#EDE2D6] px-3 text-sm font-bold">
                      Max
                    </button>
                  </div>
                </label>
                <label className="block">
                  <span className={labelCls}>To bank account</span>
                  <select className={inputCls} value={bank} onChange={(e) => setBank(e.target.value)}>
                    {BANKS.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </label>
                {amt > 0 && (
                  <div className="space-y-1 rounded-2xl bg-[#FFF8EE] p-4 text-sm">
                    <div className="flex justify-between"><span className="text-[#685D55]">Rate</span><span className="font-mono">1 USDC = R{zarRate.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-[#685D55]">Fee (0.5%)</span><span className="font-mono">{money(fee, "ZAR")}</span></div>
                    <div className="flex justify-between text-base"><b>You receive</b><b className="font-mono text-[#1E6B45]">{money(gross - fee, "ZAR")}</b></div>
                  </div>
                )}
                {error && <p className="rounded-xl bg-[#FBEDEA] px-3 py-2 text-sm text-[#8B1E24]">{error}</p>}
                <button disabled={busy || !(amt > 0)} className={`${btnPrimary} w-full`}>
                  {busy ? "Processing…" : "Cash out"}
                </button>
                <p className="text-center text-xs text-[#685D55]">Demo: bank payout is simulated. In production this connects to a licensed off-ramp partner.</p>
              </form>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <div className="relative hidden h-56 overflow-hidden rounded-3xl lg:block">
            <Image src="/famba/woman-bowl.png" alt="" fill className="object-cover object-[center_70%]" />
          </div>
          <Card>
            <h2 className="border-b border-[#EDE2D6] px-5 py-4 text-lg font-bold">Past cash-outs</h2>
            <ul className="divide-y divide-[#EDE2D6]">
              {data?.cashOuts.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span>
                    <b>{c.bank}</b>
                    <span className="block text-xs text-[#685D55]">{when(c.createdAt)} · {usdc(c.usdcAmount)}</span>
                  </span>
                  <b className="font-mono text-[#1E6B45]">{money(c.zarAmount, "ZAR")}</b>
                </li>
              ))}
              {data && data.cashOuts.length === 0 && <li className="px-5 py-6 text-center text-sm text-[#685D55]">No cash-outs yet.</li>}
            </ul>
          </Card>
        </div>
      </main>
      <Chatbot />
    </div>
  );
}
