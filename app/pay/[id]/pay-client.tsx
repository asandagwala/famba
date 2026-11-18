"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Order } from "@/lib/famba/db";
import type { Currency } from "@/lib/famba/rates";
import { LOCAL_METHODS } from "@/lib/famba/payment-methods";
import { COUNTRIES, EXPLORER_TX, KenteFade, Logo, api, btnPrimary, countryByName, inputCls, labelCls, money, shortHex, usdc, useWallet, when } from "@/components/famba/ui";

type Checkout = {
  order: Order;
  merchant: { name: string; city: string; walletAddress: string };
  rates: Record<Currency, number>;
  rateSource: "live" | "fallback";
};

type Method = { kind: "mobile_money" | "bank" | "usdc_wallet"; provider: string };

export default function PayClient() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Checkout | null>(null);
  const [missing, setMissing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Checkout>(`/api/orders/${encodeURIComponent(id)}`));
    } catch (e) {
      setMissing((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  return (
    <div className="relative flex min-h-screen flex-col bg-night">
      <div className="relative z-10 mx-auto w-full max-w-[960px] flex-1 px-4 pb-10 pt-8">
        <div className="mb-4 flex items-center justify-between">
          <Logo tone="light" />
          <span className="text-[13px] text-ivory/60">Secure checkout</span>
        </div>
        {missing ? (
          <div className="rounded-lg bg-paper p-10 text-center">
            <h1 className="font-display text-2xl font-semibold">Payment link not found</h1>
            <p className="mt-2 text-stone">{missing}</p>
          </div>
        ) : !data ? (
          <div className="rounded-lg bg-paper p-10 text-center text-stone">Loading payment…</div>
        ) : data.order.status === "PAID" ? (
          <Receipt data={data} />
        ) : (
          <PayForm data={data} onPaid={(order) => setData({ ...data, order })} />
        )}
        <p className="mt-5 text-center text-[12px] leading-relaxed text-ivory/50">
          Settled in USDC on Base. Mobile money and bank collection are simulated on this testnet demo; USDC wallet payments are real and verified on-chain.
        </p>
      </div>

      {/* A subtle hint of kente cloth along the bottom, fading into the background */}
      <KenteFade />
    </div>
  );
}

function PayForm({ data, onPaid }: { data: Checkout; onPaid: (o: Order) => void }) {
  const { order, merchant, rates } = data;
  const [country, setCountry] = useState(order.customerCountry);
  const payer = countryByName(country);
  const ccy = payer.ccy as Currency;
  const options = LOCAL_METHODS[ccy];

  const methods: Method[] = [
    ...options.mobile.map((p) => ({ kind: "mobile_money" as const, provider: p })),
    { kind: "bank", provider: options.bank },
    { kind: "usdc_wallet", provider: "USDC wallet" },
  ];
  const [methodKey, setMethodKey] = useState(0);
  const method = methods[Math.min(methodKey, methods.length - 1)];

  const [phone, setPhone] = useState("");
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wallet = useWallet();

  const local = order.usdcAmount * rates[ccy];
  const perUnit = order.amountZar / local;
  const bankCost = order.amountZar * 0.07;

  const payLocal = async () => {
    setError(null);
    setBusy(method.kind === "mobile_money" ? `Approve the ${method.provider} request on your phone…` : `Confirming with ${method.provider}…`);
    try {
      await new Promise((r) => setTimeout(r, 1600)); // time for the customer to approve on their phone
      const r = await api<{ order: Order }>(`/api/orders/${order.id}/pay-local`, {
        method: "POST",
        body: JSON.stringify({ method: method.kind, provider: method.provider, currency: ccy, phone }),
      });
      onPaid(r.order);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const verify = (txHash: string) => api<{ order: Order }>(`/api/orders/${order.id}/verify`, { method: "POST", body: JSON.stringify({ txHash }) });

  const payWallet = async () => {
    setError(null);
    try {
      setBusy("Connecting your wallet…");
      await wallet.connect();
      setBusy("Confirm the payment in your wallet…");
      const tx = await wallet.sendUsdc(merchant.walletAddress, order.usdcAmount);
      setBusy("Confirming on the blockchain…");
      onPaid((await wallet.waitAndVerify(() => verify(tx))).order);
    } catch (e) {
      const msg = (e as { message?: string }).message ?? "Payment failed";
      setError(/denied|rejected/i.test(msg) ? "You cancelled the payment in your wallet." : msg);
    } finally {
      setBusy(null);
    }
  };

  const checkHash = async () => {
    setError(null);
    setBusy("Checking the blockchain…");
    try {
      onPaid((await verify(hash.trim())).order);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const eip681 = `ethereum:0x036CbD53842c5426634e7929541eC2318f3dCF7e@84532/transfer?address=${merchant.walletAddress}&uint256=${Math.round(order.usdcAmount * 1e6)}`;

  return (
    <div className="grid overflow-hidden rounded-lg bg-paper shadow-2xl md:grid-cols-[340px_1fr]">
      {/* Order */}
      <aside className="border-b border-rule bg-ivory p-7 md:border-b-0 md:border-r">
        <p className="text-[13px] text-stone">Paying</p>
        <p className="font-display text-[22px] font-semibold leading-tight">{merchant.name}</p>
        <p className="text-[13px] text-stone">{merchant.city}</p>

        <div className="mt-6 border-t border-rule pt-5">
          <p className="text-[15px]">{order.description}</p>
          <p className="mt-1 text-[13px] text-stone">Order for {order.customerName}</p>
        </div>

        <dl className="mt-6 space-y-2.5 border-t border-rule pt-5 text-[14px]">
          <div className="flex justify-between">
            <dt className="text-stone">Price</dt>
            <dd className="num font-semibold">{money(order.amountZar, "ZAR")}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone">Settles as</dt>
            <dd className="num">{usdc(order.usdcAmount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone">Arrives</dt>
            <dd>in about 15 seconds</dd>
          </div>
        </dl>
      </aside>

      {/* Pay */}
      <div className="p-7">
        <label className="block">
          <span className={labelCls}>Where are you paying from?</span>
          <select className={inputCls} value={country} onChange={(e) => { setCountry(e.target.value); setMethodKey(0); }}>
            {COUNTRIES.map((c) => (
              <option key={c.code}>{c.name}</option>
            ))}
          </select>
        </label>

        <div className="mt-6">
          <p className="text-[13px] text-stone">You pay</p>
          <p className="num font-display text-[44px] font-semibold leading-none tracking-tight">{money(local, ccy)}</p>
          <p className="mt-2 text-[13px] text-stone">
            {ccy === "ZAR" ? "No conversion needed." : <>Rate locked for 15 minutes · 1 {ccy} = R{perUnit.toFixed(4)}</>}
          </p>
        </div>

        <fieldset className="mt-7">
          <legend className={labelCls}>Pay with</legend>
          <div className="divide-y divide-rule overflow-hidden rounded-md border border-rule">
            {methods.map((m, i) => {
              const active = i === methodKey;
              return (
                <label key={m.provider} className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition ${active ? "bg-azure-soft" : "bg-white hover:bg-ivory"}`}>
                  <span className="flex items-center gap-3">
                    <input type="radio" name="method" checked={active} onChange={() => setMethodKey(i)} className="accent-[#1d4c99]" />
                    <span className="text-[15px] font-medium">{m.provider}</span>
                  </span>
                  <span className="text-[12px] text-stone">
                    {m.kind === "mobile_money" ? "Mobile money" : m.kind === "bank" ? "Bank" : "Stablecoin"}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {method.kind === "mobile_money" && (
          <label className="mt-5 block">
            <span className={labelCls}>{method.provider} number</span>
            <input className={inputCls} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={ccy === "KES" ? "07XX XXX XXX" : "Mobile number"} />
          </label>
        )}

        {method.kind === "usdc_wallet" && (
          <details className="mt-5 rounded-md border border-rule bg-white p-4 text-[14px]">
            <summary className="cursor-pointer font-medium">Paying from a phone wallet? Scan instead</summary>
            <div className="mt-4 flex flex-col items-center gap-3">
              <QRCodeSVG value={eip681} size={150} />
              <p className="break-all text-center text-[12px] text-stone">
                Send {usdc(order.usdcAmount)} to {merchant.walletAddress}
              </p>
              <div className="flex w-full gap-2">
                <input className={`${inputCls} text-[13px]`} placeholder="Paste transaction hash 0x…" value={hash} onChange={(e) => setHash(e.target.value)} />
                <button onClick={checkHash} disabled={!!busy || !hash} className="shrink-0 rounded-md bg-night px-4 text-[14px] font-semibold text-ivory disabled:opacity-50">
                  Check
                </button>
              </div>
            </div>
          </details>
        )}

        {error && <p className="mt-5 rounded-md bg-kred-soft px-4 py-3 text-[14px] text-kred">{error}</p>}

        <button onClick={method.kind === "usdc_wallet" ? payWallet : payLocal} disabled={!!busy} className={`${btnPrimary} mt-6 w-full py-4 text-[16px]`}>
          {busy ?? (method.kind === "usdc_wallet" ? `Pay ${usdc(order.usdcAmount)}` : `Pay ${money(local, ccy)}`)}
        </button>

        {ccy !== "ZAR" && (
          <p className="mt-4 text-[13px] leading-relaxed text-stone">
            A bank transfer from {payer.name} would typically lose around <span className="num font-medium text-kred">{money(bankCost, "ZAR")}</span> to fees and take 3–5 days. With Famba the fee is 0.2% and {merchant.name} is paid in seconds.
          </p>
        )}
      </div>
    </div>
  );
}

function Receipt({ data }: { data: Checkout }) {
  const { order, merchant } = data;
  const pw = order.paidWith;
  return (
    <div className="mx-auto max-w-[620px] overflow-hidden rounded-lg bg-paper shadow-2xl">
      <div className="p-8 sm:p-10">
        <p className="inline-flex items-center gap-2 text-[14px] font-semibold text-leaf">
          <span className="flex size-5 items-center justify-center rounded-full bg-leaf text-[12px] text-white">✓</span>
          Payment complete
        </p>
        <h1 className="mt-3 font-display text-[30px] font-semibold leading-tight">
          {merchant.name} has been paid {money(order.amountZar, "ZAR")}
        </h1>
        <p className="mt-2 text-stone">Thank you. This payment has been matched to your order automatically.</p>

        <dl className="mt-7 divide-y divide-rule border-y border-rule text-[14px]">
          {[
            ["Order", order.description],
            ["You paid", pw ? (pw.method === "usdc_wallet" ? usdc(order.usdcAmount) : money(pw.amount, pw.currency)) : usdc(order.usdcAmount)],
            ["Paid with", pw?.provider ?? "USDC"],
            ["Settled as", usdc(order.usdcAmount)],
            ["Date", order.paidAt ? when(order.paidAt) : "—"],
            ["Reference", order.id],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5">
              <dt className="text-stone">{k}</dt>
              <dd className="num text-right font-medium">{v}</dd>
            </div>
          ))}
          {order.txHash && (
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-stone">Blockchain proof</dt>
              <dd>
                <a href={EXPLORER_TX + order.txHash} target="_blank" rel="noreferrer" className="font-medium text-leaf underline underline-offset-2">
                  {shortHex(order.txHash, 10, 6)}
                </a>
              </dd>
            </div>
          )}
        </dl>
        <button onClick={() => window.print()} className="no-print mt-6 text-[14px] font-medium text-stone underline underline-offset-2 hover:text-ink">
          Print receipt
        </button>
      </div>
    </div>
  );
}
