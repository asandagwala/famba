"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { CashOut, Merchant, Order, Supplier, SupplierPayment } from "@/lib/famba/db";
import type { RateSnapshot } from "@/lib/famba/rates";
import {
  AppHeader, COUNTRIES, EXPLORER_TX, Modal, PageTitle, Panel, PanelHead, Route, Status,
  api, btnPrimary, btnLine, inputCls, labelCls, money, shortHex, usdc, when,
} from "@/components/famba/ui";
import Chatbot from "@/components/famba/chatbot";

type Overview = {
  merchant: Merchant;
  balance: { received: number; paidOut: number; cashedOut: number; available: number };
  walletUsdc: number | null;
  rates: RateSnapshot;
  orders: Order[];
  suppliers: Supplier[];
  supplierPayments: SupplierPayment[];
  cashOuts: CashOut[];
};

export default function Dashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Overview>("/api/overview"));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(load, 0);
    const id = window.setInterval(load, 15_000); // pick up payments made on the checkout page
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [load]);

  const zar = data?.rates.rates.ZAR ?? 0;
  const s = useMemo(() => {
    if (!data) return null;
    const paid = data.orders.filter((o) => o.status === "PAID");
    const pending = data.orders.filter((o) => o.status === "PENDING");
    const moved = paid.reduce((t, o) => t + o.amountZar, 0) + data.supplierPayments.reduce((t, p) => t + p.usdcAmount * zar, 0);
    return {
      paidCount: paid.length,
      countries: new Set(paid.map((o) => o.customerCountry)).size,
      pendingCount: pending.length,
      pendingZar: pending.reduce((t, o) => t + o.amountZar, 0),
      saved: moved * (0.07 - 0.002),
    };
  }, [data, zar]);

  const copyLink = async (id: string) => {
    const url = `${window.location.origin}/pay/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt("Copy this payment link:", url);
    }
  };

  const reset = async () => {
    if (!window.confirm("Reset all demo data back to the starting example?")) return;
    await api("/api/reset", { method: "POST" });
    load();
  };

  return (
    <div className="min-h-screen bg-ivory text-ink">
      <AppHeader merchant={data ? `${data.merchant.name} · ${data.merchant.city}` : undefined} />

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <PageTitle eyebrow={data?.merchant.name} title="Payments">
          <button onClick={() => setCreating(true)} className={btnPrimary}>
            Create payment link
          </button>
        </PageTitle>

        {error && <p className="mt-6 rounded-md bg-kred-soft px-4 py-3 text-[14px] text-kred">{error}</p>}

        {/* Summary */}
        <Panel className="mt-8 grid divide-y divide-rule sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          <Stat label="Available to settle" value={data ? money(data.balance.available * zar, "ZAR") : "—"} note={data ? usdc(data.balance.available) : ""}>
            <Link href="/settlements" className="mt-3 inline-block text-[13px] font-semibold text-night-3 hover:underline">
              Settle to bank →
            </Link>
          </Stat>
          <Stat label="Received" value={data ? money(data.orders.filter((o) => o.status === "PAID").reduce((t, o) => t + o.amountZar, 0), "ZAR") : "—"} note={s ? `${s.paidCount} payments from ${s.countries} countries` : ""} />
          <Stat label="Awaiting payment" value={s ? money(s.pendingZar, "ZAR") : "—"} note={s ? `${s.pendingCount} open payment link${s.pendingCount === 1 ? "" : "s"}` : ""} />
          <Stat label="Saved vs bank transfers" value={s ? money(s.saved, "ZAR") : "—"} note="0.2% fee instead of up to 7%" accent />
        </Panel>

        {/* Payments table */}
        <Panel className="mt-8">
          <PanelHead title="Customer payments" sub="Every payment is matched to its order automatically." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-rule text-[12px] text-stone">
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">Route</th>
                  <th className="px-3 py-3 font-medium">They paid</th>
                  <th className="px-3 py-3 text-right font-medium">You receive</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {data?.orders.map((o) => (
                  <tr key={o.id} className="align-top">
                    <td className="px-6 py-4">
                      <p className="font-medium">{o.customerName}</p>
                      <p className="text-[13px] text-stone">{o.description}</p>
                    </td>
                    <td className="px-3 py-4 pt-[18px]">
                      <Route from={o.customerCountry} to="South Africa" />
                    </td>
                    <td className="px-3 py-4">
                      {o.paidWith ? (
                        <>
                          <p className="num">{o.paidWith.method === "usdc_wallet" ? usdc(o.usdcAmount) : money(o.paidWith.amount, o.paidWith.currency)}</p>
                          <p className="text-[13px] text-stone">{o.paidWith.provider}</p>
                        </>
                      ) : (
                        <p className="text-stone">—</p>
                      )}
                    </td>
                    <td className="px-3 py-4 text-right">
                      <p className="num font-semibold">{money(o.amountZar, "ZAR")}</p>
                      <p className="num text-[13px] text-stone">{usdc(o.usdcAmount)}</p>
                    </td>
                    <td className="px-3 py-4">
                      {o.status === "PAID" ? (
                        <>
                          <Status tone="leaf">Paid · matched</Status>
                          <p className="mt-0.5 text-[12px] text-stone">
                            {o.paidAt ? when(o.paidAt) : ""}
                            {o.txHash && (
                              <>
                                {" · "}
                                <a href={EXPLORER_TX + o.txHash} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
                                  {shortHex(o.txHash)}
                                </a>
                              </>
                            )}
                          </p>
                        </>
                      ) : (
                        <>
                          <Status tone="gold">Awaiting payment</Status>
                          <p className="mt-0.5 text-[12px] text-stone">Sent {when(o.createdAt)}</p>
                        </>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {o.status === "PENDING" && (
                        <div className="flex justify-end gap-3 text-[13px] font-semibold">
                          <button onClick={() => copyLink(o.id)} className="text-ink hover:text-night-3">
                            {copied === o.id ? "Copied" : "Copy link"}
                          </button>
                          <Link href={`/pay/${o.id}`} className="text-night-3 hover:underline">
                            Open
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data && data.orders.length === 0 && <p className="px-6 py-10 text-center text-stone">No payments yet. Create your first payment link.</p>}
          </div>
        </Panel>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <Panel>
            <PanelHead title="Money out" sub="Supplier payments and bank settlements" action={<Link href="/suppliers" className="text-[13px] font-semibold text-night-3 hover:underline">Pay a supplier</Link>} />
            <ul className="divide-y divide-rule">
              {data &&
                [
                  ...data.supplierPayments.map((p) => ({ id: p.id, at: p.createdAt, title: p.supplierName, sub: `${data.suppliers.find((x) => x.id === p.supplierId)?.country ?? ""} · received ${money(p.localAmount, p.currency)}`, amount: `−${money(p.usdcAmount * zar, "ZAR")}` })),
                  ...data.cashOuts.map((c) => ({ id: c.id, at: c.createdAt, title: `Settled to ${c.bank}`, sub: usdc(c.usdcAmount), amount: money(c.zarAmount, "ZAR") })),
                ]
                  .sort((a, b) => b.at.localeCompare(a.at))
                  .slice(0, 6)
                  .map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-4 px-6 py-3.5">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.title}</p>
                        <p className="truncate text-[13px] text-stone">
                          {when(r.at)} · {r.sub}
                        </p>
                      </div>
                      <p className="num shrink-0 font-semibold">{r.amount}</p>
                    </li>
                  ))}
              {data && data.supplierPayments.length + data.cashOuts.length === 0 && <li className="px-6 py-8 text-center text-stone">Nothing sent yet.</li>}
            </ul>
          </Panel>

          <Panel>
            <PanelHead title="Settlement wallet" sub="Where customer USDC lands, on Base Sepolia" />
            <div className="space-y-4 px-6 py-5 text-[14px]">
              <p className="break-all rounded-md bg-ivory px-3 py-2.5 font-mono text-[13px]">{data?.merchant.walletAddress}</p>
              <div className="flex justify-between">
                <span className="text-stone">On-chain balance</span>
                <span className="num font-semibold">{data?.walletUsdc == null ? "Unavailable" : usdc(data.walletUsdc)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone">Today&apos;s rate</span>
                <span className="num">1 USDC = R{zar.toFixed(2)}</span>
              </div>
              <p className="text-[13px] leading-relaxed text-stone">
                Wallet payments only count once Famba has found the matching USDC transfer to this address on the blockchain.
              </p>
            </div>
          </Panel>
        </div>

        <button onClick={reset} className="mt-8 text-[13px] text-stone underline underline-offset-2 hover:text-ink">
          Reset demo data
        </button>
      </main>

      {creating && <NewLink zarPerUsdc={zar} onClose={() => setCreating(false)} onCreated={load} />}
      <Chatbot />
    </div>
  );
}

function Stat({ label, value, note, accent, children }: { label: string; value: string; note?: string; accent?: boolean; children?: React.ReactNode }) {
  return (
    <div className="px-6 py-5">
      <p className="text-[13px] text-stone">{label}</p>
      <p className={`num mt-1.5 font-display text-[28px] font-semibold leading-none tracking-tight ${accent ? "text-leaf" : ""}`}>{value}</p>
      {note && <p className="mt-2 text-[13px] text-stone">{note}</p>}
      {children}
    </div>
  );
}

function NewLink({ zarPerUsdc, onClose, onCreated }: { zarPerUsdc: number; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ customerName: "", customerCountry: "Kenya", description: "", amountZar: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Order | null>(null);
  const [copied, setCopied] = useState(false);
  const link = created && typeof window !== "undefined" ? `${window.location.origin}/pay/${created.id}` : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { order } = await api<{ order: Order }>("/api/orders", { method: "POST", body: JSON.stringify({ ...form, amountZar: Number(form.amountZar) }) });
      setCreated(order);
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const amt = Number(form.amountZar);
  return (
    <Modal onClose={onClose}>
      {!created ? (
        <form onSubmit={submit} className="space-y-5 p-7">
          <div>
            <h2 className="font-display text-[24px] font-semibold">Create a payment link</h2>
            <p className="mt-1 text-[14px] text-stone">Your customer will see the price in their own currency.</p>
          </div>
          <label className="block">
            <span className={labelCls}>Customer name</span>
            <input className={inputCls} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Wanjiru Kamau" required />
          </label>
          <label className="block">
            <span className={labelCls}>Customer&apos;s country</span>
            <select className={inputCls} value={form.customerCountry} onChange={(e) => setForm({ ...form, customerCountry: e.target.value })}>
              {COUNTRIES.map((c) => (
                <option key={c.code}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>What they&apos;re buying</span>
            <input className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Shea butter, 2kg" required />
          </label>
          <label className="block">
            <span className={labelCls}>Price in rand</span>
            <input className={`${inputCls} num`} type="number" min="1" step="0.01" value={form.amountZar} onChange={(e) => setForm({ ...form, amountZar: e.target.value })} placeholder="0.00" required />
            {amt > 0 && zarPerUsdc > 0 && <span className="num mt-1.5 block text-[13px] text-stone">Settles as {usdc(amt / zarPerUsdc)}</span>}
          </label>
          {error && <p className="rounded-md bg-kred-soft px-3 py-2 text-[14px] text-kred">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className={`${btnLine} flex-1`}>
              Cancel
            </button>
            <button disabled={busy} className={`${btnPrimary} flex-1`}>
              {busy ? "Creating…" : "Create link"}
            </button>
          </div>
        </form>
      ) : (
        <div className="p-7 text-center">
          <h2 className="font-display text-[24px] font-semibold">Your link is ready</h2>
          <p className="mt-1 text-[14px] text-stone">Send it to {created.customerName} on WhatsApp or email, or let them scan the code.</p>
          <div className="mx-auto mt-6 w-fit rounded-md border border-rule bg-white p-4">
            <QRCodeSVG value={link} size={176} fgColor="#0a1631" />
          </div>
          <p className="mt-4 break-all rounded-md bg-ivory px-3 py-2 font-mono text-[12px]">{link}</p>
          <p className="num mt-3 text-[14px]">
            {money(created.amountZar, "ZAR")} · {created.description}
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(link);
                setCopied(true);
              }}
              className={`${btnLine} flex-1`}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <Link href={`/pay/${created.id}`} className={`${btnPrimary} flex-1`}>
              Open checkout
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}
