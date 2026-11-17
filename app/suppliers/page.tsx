"use client";

import { useCallback, useEffect, useState } from "react";
import type { Supplier, SupplierPayment } from "@/lib/famba/db";
import type { Currency, RateSnapshot } from "@/lib/famba/rates";
import { AppHeader, Card, EXPLORER_TX, Pill, Route, api, btnDark, btnPrimary, inputCls, labelCls, money, usdc, useWallet, when } from "@/components/famba/ui";
import Chatbot from "@/components/famba/chatbot";

type Overview = {
  merchant: { name: string };
  balance: { available: number };
  rates: RateSnapshot;
  suppliers: Supplier[];
  supplierPayments: SupplierPayment[];
};

export default function SuppliersPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [paying, setPaying] = useState<Supplier | null>(null);
  const [done, setDone] = useState<SupplierPayment | null>(null);

  const load = useCallback(async () => setData(await api<Overview>("/api/overview")), []);
  useEffect(() => {
    const t = window.setTimeout(() => load().catch(() => {}), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  return (
    <div className="min-h-screen bg-white text-[#181412]">
      <AppHeader merchant={data?.merchant.name} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        <h1 className="text-3xl font-black" style={{ fontFamily: "var(--font-display)" }}>
          Pay suppliers across Africa
        </h1>
        <p className="text-[#685D55]">
          Pick a supplier, enter what they should receive in their currency, and Famba sends it as USDC in seconds.
          {data && <> Available: <b className="font-mono">{usdc(data.balance.available)}</b></>}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data?.suppliers.map((s) => (
            <Card key={s.id} className="flex flex-col p-5">
              <div className="flex items-center justify-between">
                <Route from="South Africa" to={s.country} />
                <Pill tone="muted">{s.currency}</Pill>
              </div>
              <h2 className="mt-3 font-bold leading-tight">{s.name}</h2>
              <p className="text-sm text-[#685D55]">{s.product}</p>
              <p className="mt-2 text-xs text-[#685D55]">
                {s.country} · paid by <b>{s.payoutMethod}</b>
              </p>
              <button onClick={() => setPaying(s)} className={`${btnPrimary} mt-4 py-2.5 text-sm`}>
                Pay {s.name.split(" ")[0]}
              </button>
            </Card>
          ))}
        </div>

        <Card className="mt-8">
          <h2 className="border-b border-[#EDE2D6] px-5 py-4 text-lg font-bold">Payment history</h2>
          <ul className="divide-y divide-[#EDE2D6]">
            {data?.supplierPayments.map((p) => {
              const s = data.suppliers.find((x) => x.id === p.supplierId);
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{p.supplierName}</p>
                      <Route from="South Africa" to={s?.country ?? "South Africa"} />
                    </div>
                    <p className="text-sm text-[#685D55]">
                      {p.note} · {when(p.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-[#1E6B45]">{money(p.localAmount, p.currency)}</p>
                    <p className="text-xs text-[#685D55]">
                      {usdc(p.usdcAmount)} ·{" "}
                      {p.txHash ? (
                        <a href={EXPLORER_TX + p.txHash} target="_blank" rel="noreferrer" className="text-[#1E6B45] underline">
                          on-chain
                        </a>
                      ) : (
                        "from balance"
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
            {data && data.supplierPayments.length === 0 && <li className="px-5 py-6 text-center text-sm text-[#685D55]">No supplier payments yet.</li>}
          </ul>
        </Card>
      </main>

      {paying && data && (
        <PayModal
          supplier={paying}
          rate={data.rates.rates[paying.currency as Currency]}
          zarRate={data.rates.rates.ZAR}
          available={data.balance.available}
          onClose={() => setPaying(null)}
          onPaid={(p) => {
            setPaying(null);
            setDone(p);
            load();
          }}
        />
      )}

      {done && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setDone(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#1E6B45] text-2xl text-white">✓</div>
            <h3 className="mt-3 text-2xl font-black" style={{ fontFamily: "var(--font-display)" }}>
              Supplier paid
            </h3>
            <p className="mt-1 text-[#685D55]">{done.supplierName} receives</p>
            <p className="font-mono text-3xl font-black text-[#1E6B45]">{money(done.localAmount, done.currency)}</p>
            <p className="mt-1 text-xs text-[#685D55]">{usdc(done.usdcAmount)} · arrived in seconds</p>
            {done.txHash && (
              <a href={EXPLORER_TX + done.txHash} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-[#1E6B45] underline">
                View on Basescan
              </a>
            )}
            <button onClick={() => setDone(null)} className={`${btnDark} mt-5 w-full`}>
              Done
            </button>
          </div>
        </div>
      )}
      <Chatbot />
    </div>
  );
}

function PayModal({
  supplier,
  rate,
  zarRate,
  available,
  onClose,
  onPaid,
}: {
  supplier: Supplier;
  rate: number;
  zarRate: number;
  available: number;
  onClose: () => void;
  onPaid: (p: SupplierPayment) => void;
}) {
  const [local, setLocal] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wallet = useWallet();

  const amount = Number(local);
  const usdcAmount = amount > 0 ? Math.round((amount / rate) * 100) / 100 : 0;
  const zar = usdcAmount * zarRate;

  const record = (txHash?: string) =>
    api<{ payment: SupplierPayment }>("/api/suppliers/pay", {
      method: "POST",
      body: JSON.stringify({ supplierId: supplier.id, usdcAmount, note, txHash }),
    });

  const payFromBalance = async () => {
    setError(null);
    setBusy("Sending…");
    try {
      onPaid((await record()).payment);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const payFromWallet = async () => {
    setError(null);
    try {
      setBusy("Confirm in your wallet…");
      const hash = await wallet.sendUsdc(supplier.walletAddress, usdcAmount);
      setBusy("Confirming on the blockchain…");
      onPaid((await wallet.waitAndVerify(() => record(hash))).payment);
    } catch (e) {
      const msg = (e as { message?: string }).message ?? "Payment failed";
      setError(/denied|rejected/i.test(msg) ? "You cancelled the payment in your wallet." : msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md space-y-4 overflow-auto rounded-3xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div>
          <Route from="South Africa" to={supplier.country} />
          <h2 className="mt-2 text-2xl font-black" style={{ fontFamily: "var(--font-display)" }}>
            Pay {supplier.name}
          </h2>
          <p className="text-sm text-[#685D55]">
            {supplier.country} · they receive {supplier.currency} by {supplier.payoutMethod}
          </p>
        </div>
        <label className="block">
          <span className={labelCls}>They should receive ({supplier.currency})</span>
          <input className={`${inputCls} font-mono text-xl`} type="number" min="1" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="0.00" autoFocus />
        </label>
        <label className="block">
          <span className={labelCls}>Reference (optional)</span>
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Invoice #TS-120" />
        </label>
        {usdcAmount > 0 && (
          <div className="space-y-1 rounded-2xl bg-[#FFF8EE] p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-[#685D55]">You send</span>
              <b className="font-mono">{usdc(usdcAmount)}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-[#685D55]">In rand</span>
              <span className="font-mono">≈ {money(zar, "ZAR")}</span>
            </div>
            <div className="flex justify-between text-[#1E6B45]">
              <span>Saved vs bank</span>
              <b className="font-mono">{money(zar * 0.093, "ZAR")}</b>
            </div>
          </div>
        )}
        {error && <p className="rounded-xl bg-[#FBEDEA] px-3 py-2 text-sm text-[#8B1E24]">{error}</p>}
        <button onClick={payFromBalance} disabled={!!busy || !(usdcAmount > 0)} className={`${btnPrimary} w-full`}>
          {busy ?? `Pay from Famba balance (${usdc(available)})`}
        </button>
        <button onClick={payFromWallet} disabled={!!busy || !(usdcAmount > 0)} className="w-full rounded-xl border-2 border-[#181412] py-2.5 font-bold disabled:opacity-50">
          Pay from my wallet (real testnet USDC)
        </button>
        <button onClick={onClose} className="w-full text-sm text-[#685D55] underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
