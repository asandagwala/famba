"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { CashOut } from "@/lib/famba/db";
import type { RateSnapshot } from "@/lib/famba/rates";
import { AppHeader, PageTitle, Panel, PanelHead, api, btnPrimary, inputCls, labelCls, money, usdc, when } from "@/components/famba/ui";
import Chatbot from "@/components/famba/chatbot";

type Overview = { merchant: { name: string; city: string }; balance: { available: number }; rates: RateSnapshot; cashOuts: CashOut[] };

const BANKS = ["FNB Business ••4417", "Capitec Business ••0932", "Standard Bank ••7781"];

export default function SettlementsPage() {
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

  const rate = data?.rates.rates.ZAR ?? 0;
  const amt = Number(amount);
  const gross = amt * rate;
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
    <div className="min-h-screen bg-ivory text-ink">
      <AppHeader merchant={data ? `${data.merchant.name} · ${data.merchant.city}` : undefined} />
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <PageTitle eyebrow="Get your money home" title="Settlements" />

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-8">
            <Panel>
              <PanelHead title="Settle to your bank" sub="Turn your USDC balance into rand, usually the same day." />
              {done ? (
                <div className="px-6 py-10 text-center">
                  <p className="inline-flex items-center gap-2 text-[14px] font-semibold text-leaf">
                    <span className="flex size-5 items-center justify-center rounded-full bg-leaf text-[12px] text-white">✓</span>
                    On its way
                  </p>
                  <p className="num mt-3 font-display text-[34px] font-semibold">{money(done.zarAmount, "ZAR")}</p>
                  <p className="mt-1 text-[14px] text-stone">to {done.bank}</p>
                  <button onClick={() => setDone(null)} className={`${btnPrimary} mt-6`}>
                    Settle more
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} className="grid gap-6 px-6 py-6 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="text-[13px] text-stone">Available</p>
                    <p className="num font-display text-[32px] font-semibold leading-tight">{data ? money(data.balance.available * rate, "ZAR") : "—"}</p>
                    <p className="num text-[13px] text-stone">{data ? usdc(data.balance.available) : ""}</p>
                  </div>
                  <label className="block">
                    <span className={labelCls}>Amount (USDC)</span>
                    <div className="flex gap-2">
                      <input className={`${inputCls} num`} type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                      <button type="button" onClick={() => data && setAmount(String(Math.floor(data.balance.available * 100) / 100))} className="rounded-md border border-rule px-3 text-[13px] font-semibold hover:border-ink">
                        All
                      </button>
                    </div>
                  </label>
                  <label className="block">
                    <span className={labelCls}>To</span>
                    <select className={inputCls} value={bank} onChange={(e) => setBank(e.target.value)}>
                      {BANKS.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>
                  </label>
                  <dl className="space-y-2 border-y border-rule py-4 text-[14px] sm:col-span-2">
                    <div className="flex justify-between"><dt className="text-stone">Rate</dt><dd className="num">1 USDC = R{rate.toFixed(2)}</dd></div>
                    <div className="flex justify-between"><dt className="text-stone">Fee (0.5%)</dt><dd className="num">{money(amt > 0 ? fee : 0, "ZAR")}</dd></div>
                    <div className="flex justify-between text-[15px]"><dt className="font-semibold">You receive</dt><dd className="num font-semibold text-leaf">{money(amt > 0 ? gross - fee : 0, "ZAR")}</dd></div>
                  </dl>
                  {error && <p className="rounded-md bg-kred-soft px-3 py-2 text-[14px] text-kred sm:col-span-2">{error}</p>}
                  <div className="sm:col-span-2">
                    <button disabled={busy || !(amt > 0)} className={btnPrimary}>
                      {busy ? "Processing…" : "Settle to bank"}
                    </button>
                    <p className="mt-3 text-[12px] text-stone">Demo: the bank payout is simulated. In production it runs through a licensed off-ramp partner.</p>
                  </div>
                </form>
              )}
            </Panel>

            <Panel>
              <PanelHead title="Past settlements" />
              <ul className="divide-y divide-rule">
                {data?.cashOuts.map((c) => (
                  <li key={c.id} className="flex items-center justify-between px-6 py-3.5">
                    <div>
                      <p className="font-medium">{c.bank}</p>
                      <p className="num text-[13px] text-stone">{when(c.createdAt)} · {usdc(c.usdcAmount)}</p>
                    </div>
                    <p className="num font-semibold">{money(c.zarAmount, "ZAR")}</p>
                  </li>
                ))}
                {data && data.cashOuts.length === 0 && <li className="px-6 py-8 text-center text-stone">No settlements yet.</li>}
              </ul>
            </Panel>
          </div>

          <figure className="lg:sticky lg:top-24">
            <Image
              src="/famba/money-exchange.jpg"
              alt="Two traders at a market stall exchanging South African rand for Nigerian naira by hand"
              width={2000}
              height={1116}
              sizes="(min-width: 1024px) 520px, 100vw"
              className="h-auto w-full"
            />
            <figcaption className="mt-4 border-l-2 border-gold pl-4">
              <p className="font-display text-[19px] font-semibold leading-snug">No more swapping notes at the market.</p>
              <p className="mt-1 text-[14px] leading-relaxed text-stone">
                Rand for naira, cedis for shillings: Famba converts at a clear rate and pays straight into your bank, with no middleman and no stack of cash.
              </p>
            </figcaption>
          </figure>
        </div>
      </main>
      <Chatbot />
    </div>
  );
}
