"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { CashOut, Merchant, Order, Supplier, SupplierPayment } from "@/lib/famba/db";
import type { RateSnapshot } from "@/lib/famba/rates";
import { AppHeader, COUNTRIES, Card, EXPLORER_TX, Pill, Route, api, btnDark, btnPrimary, inputCls, labelCls, money, shortHex, usdc, when } from "@/components/famba/ui";
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
  const [showNew, setShowNew] = useState(false);
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
  const stats = useMemo(() => {
    if (!data) return null;
    const paid = data.orders.filter((o) => o.status === "PAID");
    const countries = new Set(paid.map((o) => o.customerCountry));
    const crossBorderUsdc = paid.reduce((s, o) => s + o.usdcAmount, 0) + data.supplierPayments.reduce((s, p) => s + p.usdcAmount, 0);
    return {
      pending: data.orders.filter((o) => o.status === "PENDING"),
      countries: countries.size,
      paidCount: paid.length,
      savedZar: crossBorderUsdc * zar * (0.095 - 0.002),
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
    <div className="min-h-screen bg-white text-[#181412]">
      <AppHeader merchant={data?.merchant.name} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-[#685D55]">Sawubona 👋</p>
            <h1 className="text-3xl font-black" style={{ fontFamily: "var(--font-display)" }}>
              {data?.merchant.name ?? "Loading…"}
            </h1>
            <p className="text-sm text-[#685D55]">{data ? `${data.merchant.tagline} · ${data.merchant.city}` : ""}</p>
          </div>
          <button onClick={() => setShowNew(true)} className={btnPrimary}>
            + New payment link
          </button>
        </div>

        {error && <p className="mt-4 rounded-xl bg-[#FBEDEA] px-4 py-3 text-sm text-[#8B1E24]">{error}</p>}

        {/* Stats */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card className="bg-[#181412] p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-wider text-white/60">Available balance</p>
            <p className="mt-1 font-mono text-3xl font-black">{data ? usdc(data.balance.available) : "—"}</p>
            <p className="text-sm text-[#E59A18]">{data ? `≈ ${money(data.balance.available * zar, "ZAR")}` : ""}</p>
            <div className="mt-4 flex gap-2">
              <Link href="/cash-out" className="rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-[#181412]">
                Cash out
              </Link>
              <Link href="/suppliers" className="rounded-lg border border-white/30 px-3 py-1.5 text-sm font-bold">
                Pay supplier
              </Link>
            </div>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#685D55]">Paid by customers</p>
            <p className="mt-1 font-mono text-3xl font-black">{data ? usdc(data.balance.received) : "—"}</p>
            <p className="text-sm text-[#685D55]">
              {stats ? `${stats.paidCount} payments from ${stats.countries} countries · ${stats.pending.length} waiting` : ""}
            </p>
          </Card>
          <Card className="border-[#1E6B45]/20 bg-[#EAF6F0] p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#1E6B45]">Saved vs bank transfers</p>
            <p className="mt-1 font-mono text-3xl font-black text-[#1E6B45]">{stats ? money(stats.savedZar, "ZAR") : "—"}</p>
            <p className="text-sm text-[#1E6B45]/80">0.2% Famba fee instead of ~9.5% through banks</p>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* Customer payments */}
          <Card>
            <div className="flex items-center justify-between border-b border-[#EDE2D6] px-5 py-4">
              <div>
                <h2 className="text-lg font-bold">Customer payments</h2>
                <p className="text-xs text-[#685D55]">Payment links you&apos;ve sent to customers across Africa</p>
              </div>
            </div>
            <ul className="divide-y divide-[#EDE2D6]">
              {data?.orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{o.customerName}</p>
                      <Route from={o.customerCountry} to="South Africa" />
                    </div>
                    <p className="truncate text-sm text-[#685D55]">
                      {o.description} · {when(o.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold">{money(o.amountZar, "ZAR")}</p>
                    <p className="font-mono text-xs text-[#685D55]">{usdc(o.usdcAmount)}</p>
                  </div>
                  <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                    {o.status === "PAID" ? (
                      <>
                        <Pill tone="green">✓ Paid</Pill>
                        {o.txHash ? (
                          <a href={EXPLORER_TX + o.txHash} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#1E6B45] underline">
                            on-chain
                          </a>
                        ) : (
                          <Pill tone="muted">demo</Pill>
                        )}
                      </>
                    ) : (
                      <>
                        <Pill tone="ochre">Waiting</Pill>
                        <button onClick={() => copyLink(o.id)} className="rounded-lg border border-[#EDE2D6] px-2.5 py-1 text-xs font-bold hover:border-[#C84B24]">
                          {copied === o.id ? "Copied!" : "Copy link"}
                        </button>
                        <Link href={`/pay/${o.id}`} className="rounded-lg bg-[#FFF1EB] px-2.5 py-1 text-xs font-bold text-[#C84B24]">
                          Open
                        </Link>
                      </>
                    )}
                  </div>
                </li>
              ))}
              {data && data.orders.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-[#685D55]">No payments yet. Create your first payment link.</li>
              )}
            </ul>
          </Card>

          <div className="flex flex-col gap-6">
            {/* Wallet */}
            <Card className="p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#685D55]">Your receiving wallet · Base Sepolia</p>
              <p className="mt-1 break-all font-mono text-sm">{data?.merchant.walletAddress}</p>
              <p className="mt-2 text-sm">
                On-chain USDC: <b className="font-mono">{data?.walletUsdc == null ? "unavailable" : usdc(data.walletUsdc)}</b>
              </p>
              <p className="mt-1 text-xs text-[#685D55]">Customer payments are checked against this wallet on the blockchain before they count.</p>
            </Card>

            {/* Activity */}
            <Card>
              <div className="flex items-center justify-between border-b border-[#EDE2D6] px-5 py-4">
                <h2 className="text-lg font-bold">Money out</h2>
                <Link href="/suppliers" className="text-xs font-bold text-[#C84B24]">
                  Pay supplier →
                </Link>
              </div>
              <ul className="divide-y divide-[#EDE2D6]">
                {data?.supplierPayments.slice(0, 5).map((p) => {
                  const s = data.suppliers.find((x) => x.id === p.supplierId);
                  return (
                    <li key={p.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{p.supplierName}</p>
                        <p className="font-mono text-sm font-bold text-[#C84B24]">−{usdc(p.usdcAmount)}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-[#685D55]">
                        <span className="flex items-center gap-1.5">
                          <Route from="South Africa" to={s?.country ?? "South Africa"} /> {when(p.createdAt)}
                        </span>
                        <span>received {money(p.localAmount, p.currency)}</span>
                      </div>
                    </li>
                  );
                })}
                {data?.cashOuts.slice(0, 3).map((c) => (
                  <li key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span>
                      <b>Cash out</b> to {c.bank} · <span className="text-xs text-[#685D55]">{when(c.createdAt)}</span>
                    </span>
                    <span className="font-mono font-bold">{money(c.zarAmount, "ZAR")}</span>
                  </li>
                ))}
                {data && data.supplierPayments.length + data.cashOuts.length === 0 && (
                  <li className="px-5 py-6 text-center text-sm text-[#685D55]">Nothing sent yet.</li>
                )}
              </ul>
            </Card>

            <button onClick={reset} className="self-start text-xs text-[#685D55] underline hover:text-[#C84B24]">
              Reset demo data
            </button>
          </div>
        </div>
      </main>

      {showNew && (
        <NewLinkModal
          onClose={() => setShowNew(false)}
          onCreated={() => load()}
          zarPerUsdc={zar}
        />
      )}
      <Chatbot />
    </div>
  );
}

function NewLinkModal({ onClose, onCreated, zarPerUsdc }: { onClose: () => void; onCreated: () => void; zarPerUsdc: number }) {
  const [form, setForm] = useState({ customerName: "", customerCountry: "Kenya", description: "", amountZar: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Order | null>(null);
  const link = created ? `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${created.id}` : "";

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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-auto rounded-3xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        {!created ? (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <h2 className="text-2xl font-black" style={{ fontFamily: "var(--font-display)" }}>
                New payment link
              </h2>
              <p className="text-sm text-[#685D55]">Your customer can pay from any of our 5 countries.</p>
            </div>
            <label className="block">
              <span className={labelCls}>Customer name</span>
              <input className={inputCls} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="e.g. Wanjiru Kamau" required />
            </label>
            <label className="block">
              <span className={labelCls}>Customer is in</span>
              <select className={inputCls} value={form.customerCountry} onChange={(e) => setForm({ ...form, customerCountry: e.target.value })}>
                {COUNTRIES.map((c) => (
                  <option key={c.code}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>What are they buying?</span>
              <input className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Shea butter 2kg" required />
            </label>
            <label className="block">
              <span className={labelCls}>Price (rand)</span>
              <input className={`${inputCls} font-mono`} type="number" min="1" step="0.01" value={form.amountZar} onChange={(e) => setForm({ ...form, amountZar: e.target.value })} placeholder="0.00" required />
              {amt > 0 && zarPerUsdc > 0 && <span className="mt-1 block text-xs text-[#685D55]">≈ {usdc(amt / zarPerUsdc)} at today&apos;s rate</span>}
            </label>
            {error && <p className="rounded-xl bg-[#FBEDEA] px-3 py-2 text-sm text-[#8B1E24]">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-[#EDE2D6] py-3 font-bold">
                Cancel
              </button>
              <button disabled={busy} className={`${btnPrimary} flex-1`}>
                {busy ? "Creating…" : "Create link"}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center">
            <h2 className="text-2xl font-black" style={{ fontFamily: "var(--font-display)" }}>
              Link ready ✓
            </h2>
            <p className="text-sm text-[#685D55]">Send this to {created.customerName} on WhatsApp or email.</p>
            <div className="mx-auto mt-4 w-fit rounded-2xl border border-[#EDE2D6] p-3">
              <QRCodeSVG value={link} size={180} fgColor="#181412" />
            </div>
            <p className="mt-3 break-all rounded-xl bg-[#FFF8EE] px-3 py-2 font-mono text-xs">{link}</p>
            <p className="mt-2 text-sm">
              <b>{money(created.amountZar, "ZAR")}</b> · {usdc(created.usdcAmount)} · ref {shortHex(created.id, 8, 3)}
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => navigator.clipboard?.writeText(link)} className={`${btnDark} flex-1`}>
                Copy link
              </button>
              <Link href={`/pay/${created.id}`} className={`${btnPrimary} flex-1`}>
                Open checkout
              </Link>
            </div>
            <button onClick={onClose} className="mt-3 text-sm text-[#685D55] underline">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
