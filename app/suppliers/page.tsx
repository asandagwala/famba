"use client";

import { useCallback, useEffect, useState } from "react";
import type { Supplier, SupplierPayment } from "@/lib/famba/db";
import type { Currency, RateSnapshot } from "@/lib/famba/rates";
import {
  AppHeader, EXPLORER_TX, Modal, PageTitle, Panel, PanelHead, Route,
  api, btnPrimary, btnLine, inputCls, labelCls, money, usdc, useWallet, when,
} from "@/components/famba/ui";
import Chatbot from "@/components/famba/chatbot";

type Overview = {
  merchant: { name: string; city: string };
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

  const zar = data?.rates.rates.ZAR ?? 0;

  return (
    <div className="min-h-screen bg-ivory text-ink">
      <AppHeader merchant={data ? `${data.merchant.name} · ${data.merchant.city}` : undefined} />
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <PageTitle eyebrow="Pay across borders" title="Suppliers" />
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-stone">
          Enter what your supplier should receive in their own currency. Famba sends it as USDC and it lands as mobile money or a bank deposit in seconds.
          {data && (
            <>
              {" "}You have <span className="num font-semibold text-ink">{usdc(data.balance.available)}</span> available.
            </>
          )}
        </p>

        <Panel className="mt-8">
          <PanelHead title="Your suppliers" />
          <ul className="divide-y divide-rule">
            {data?.suppliers.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-[13px] text-stone">
                    {s.product} · {s.country} · paid by {s.payoutMethod} in {s.currency}
                  </p>
                </div>
                <div className="flex items-center gap-5">
                  <Route from="South Africa" to={s.country} />
                  <button onClick={() => setPaying(s)} className={`${btnLine} py-2`}>
                    Pay
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="mt-8">
          <PanelHead title="Payment history" />
          <ul className="divide-y divide-rule">
            {data?.supplierPayments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="font-medium">{p.supplierName}</p>
                  <p className="text-[13px] text-stone">
                    {p.note} · {when(p.createdAt)}
                    {p.txHash && (
                      <>
                        {" · "}
                        <a href={EXPLORER_TX + p.txHash} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                          on-chain
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num font-semibold text-leaf">{money(p.localAmount, p.currency)}</p>
                  <p className="num text-[13px] text-stone">{usdc(p.usdcAmount)} · {money(p.usdcAmount * zar, "ZAR")}</p>
                </div>
              </li>
            ))}
            {data && data.supplierPayments.length === 0 && <li className="px-6 py-8 text-center text-stone">No supplier payments yet.</li>}
          </ul>
        </Panel>
      </main>

      {paying && data && (
        <PayModal
          supplier={paying}
          rate={data.rates.rates[paying.currency as Currency]}
          zarRate={zar}
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
        <Modal onClose={() => setDone(null)} width="max-w-sm">
          <div className="p-7 text-center">
            <p className="inline-flex items-center gap-2 text-[14px] font-semibold text-leaf">
              <span className="flex size-5 items-center justify-center rounded-full bg-leaf text-[12px] text-white">✓</span>
              Sent
            </p>
            <h3 className="mt-3 font-display text-[24px] font-semibold leading-tight">{done.supplierName} has been paid</h3>
            <p className="num mt-3 font-display text-[34px] font-semibold text-leaf">{money(done.localAmount, done.currency)}</p>
            <p className="num mt-1 text-[13px] text-stone">{usdc(done.usdcAmount)} · arrived in seconds</p>
            {done.txHash && (
              <a href={EXPLORER_TX + done.txHash} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[13px] underline">
                View on Basescan
              </a>
            )}
            <button onClick={() => setDone(null)} className={`${btnPrimary} mt-6 w-full`}>
              Done
            </button>
          </div>
        </Modal>
      )}
      <Chatbot />
    </div>
  );
}

function PayModal({
  supplier, rate, zarRate, available, onClose, onPaid,
}: {
  supplier: Supplier; rate: number; zarRate: number; available: number; onClose: () => void; onPaid: (p: SupplierPayment) => void;
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
    api<{ payment: SupplierPayment }>("/api/suppliers/pay", { method: "POST", body: JSON.stringify({ supplierId: supplier.id, usdcAmount, note, txHash }) });

  const fromBalance = async () => {
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

  const fromWallet = async () => {
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
    <Modal onClose={onClose}>
      <div className="space-y-5 p-7">
        <div>
          <Route from="South Africa" to={supplier.country} />
          <h2 className="mt-1 font-display text-[24px] font-semibold leading-tight">Pay {supplier.name}</h2>
          <p className="mt-1 text-[14px] text-stone">
            They receive {supplier.currency} by {supplier.payoutMethod}.
          </p>
        </div>
        <label className="block">
          <span className={labelCls}>Amount they receive ({supplier.currency})</span>
          <input className={`${inputCls} num text-[20px]`} type="number" min="1" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="0.00" autoFocus />
        </label>
        <label className="block">
          <span className={labelCls}>Reference</span>
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Invoice TS-120" />
        </label>
        {usdcAmount > 0 && (
          <dl className="space-y-2 border-y border-rule py-4 text-[14px]">
            <div className="flex justify-between"><dt className="text-stone">You send</dt><dd className="num font-semibold">{usdc(usdcAmount)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone">In rand</dt><dd className="num">{money(zar, "ZAR")}</dd></div>
            <div className="flex justify-between"><dt className="text-stone">Fee</dt><dd className="num">{money(zar * 0.002, "ZAR")}</dd></div>
          </dl>
        )}
        {error && <p className="rounded-md bg-kred-soft px-3 py-2 text-[14px] text-kred">{error}</p>}
        <button onClick={fromBalance} disabled={!!busy || !(usdcAmount > 0)} className={`${btnPrimary} w-full`}>
          {busy ?? "Pay from Famba balance"}
        </button>
        <p className="num -mt-2 text-center text-[13px] text-stone">{usdc(available)} available</p>
        <button onClick={fromWallet} disabled={!!busy || !(usdcAmount > 0)} className={`${btnLine} w-full`}>
          Pay from my own wallet instead
        </button>
      </div>
    </Modal>
  );
}
