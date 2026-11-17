"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Order } from "@/lib/famba/db";
import type { Currency } from "@/lib/famba/rates";
import { COUNTRIES, EXPLORER_TX, Logo, StripeBar, api, btnPrimary, countryByName, inputCls, money, shortHex, usdc, useWallet, when } from "@/components/famba/ui";

type Checkout = {
  order: Order;
  merchant: { name: string; city: string; walletAddress: string };
  rates: Record<Currency, number>;
  rateSource: "live" | "fallback";
};

export default function PayClient() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Checkout | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualHash, setManualHash] = useState("");
  const wallet = useWallet();

  const load = useCallback(async () => {
    try {
      setData(await api<Checkout>(`/api/orders/${encodeURIComponent(id)}`));
    } catch (e) {
      setNotFound((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  if (notFound)
    return (
      <Shell>
        <div className="p-8 text-center">
          <h1 className="text-2xl font-black">Payment link not found</h1>
          <p className="mt-2 text-[#685D55]">{notFound}</p>
        </div>
      </Shell>
    );
  if (!data) return <Shell><p className="p-10 text-center text-[#685D55]">Loading payment…</p></Shell>;

  const { order, merchant, rates } = data;
  const payer = countryByName(country ?? order.customerCountry);
  const localAmount = order.usdcAmount * rates[payer.ccy as Currency];
  const bankFee = order.amountZar * 0.095;

  const verify = (txHash: string) =>
    api<{ order: Order }>(`/api/orders/${order.id}/verify`, { method: "POST", body: JSON.stringify({ txHash }) });

  const payWithWallet = async () => {
    setError(null);
    try {
      setBusy("Connecting wallet…");
      await wallet.connect();
      setBusy("Confirm the payment in your wallet…");
      const hash = await wallet.sendUsdc(merchant.walletAddress, order.usdcAmount);
      setBusy("Confirming on the blockchain…");
      const res = await wallet.waitAndVerify(() => verify(hash));
      setData({ ...data, order: res.order });
    } catch (e) {
      const msg = (e as { message?: string }).message ?? "Payment failed";
      setError(/denied|rejected/i.test(msg) ? "You cancelled the payment in your wallet." : msg);
    } finally {
      setBusy(null);
    }
  };

  const verifyManual = async () => {
    setError(null);
    setBusy("Checking the blockchain…");
    try {
      const res = await verify(manualHash.trim());
      setData({ ...data, order: res.order });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const demoPay = async () => {
    setError(null);
    setBusy("Processing demo payment…");
    try {
      const res = await api<{ order: Order }>(`/api/orders/${order.id}/simulate`, { method: "POST" });
      setData({ ...data, order: res.order });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // EIP-681 link mobile wallets understand: transfer USDC on Base Sepolia to the merchant
  const eip681 = `ethereum:0x036CbD53842c5426634e7929541eC2318f3dCF7e@84532/transfer?address=${merchant.walletAddress}&uint256=${Math.round(order.usdcAmount * 1e6)}`;

  if (order.status === "PAID")
    return (
      <Shell>
        <div className="overflow-hidden">
          <Image src="/famba/baskets.png" alt="" width={800} height={300} className="h-32 w-full object-cover" />
          <div className="p-6 text-center">
            <div className="mx-auto -mt-14 flex size-16 items-center justify-center rounded-full border-4 border-white bg-[#1E6B45] text-3xl text-white">✓</div>
            <h1 className="mt-3 text-2xl font-black" style={{ fontFamily: "var(--font-display)" }}>
              Payment complete
            </h1>
            <p className="text-[#685D55]">
              {merchant.name} received {money(order.amountZar, "ZAR")} in {merchant.city.split(",")[0]}.
            </p>
            <dl className="mx-auto mt-5 max-w-sm space-y-2 rounded-2xl bg-[#FFF8EE] p-4 text-left text-sm">
              <Row k="For" v={order.description} />
              <Row k="Paid" v={usdc(order.usdcAmount)} />
              <Row k="When" v={order.paidAt ? when(order.paidAt) : "—"} />
              <Row k="Reference" v={order.id} />
              {order.txHash ? (
                <Row k="Transaction" v={<a className="text-[#1E6B45] underline" href={EXPLORER_TX + order.txHash} target="_blank" rel="noreferrer">{shortHex(order.txHash, 10, 6)}</a>} />
              ) : (
                <Row k="Mode" v="Demo payment (no blockchain transaction)" />
              )}
            </dl>
          </div>
        </div>
      </Shell>
    );

  return (
    <Shell>
      <div className="grid md:grid-cols-[1fr_1.1fr]">
        {/* Order summary */}
        <div className="relative min-h-56 overflow-hidden md:rounded-l-3xl">
          <Image src="/famba/hands-harvest.png" alt="" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
          <div className="relative flex h-full flex-col justify-end p-6 text-white">
            <p className="text-xs font-bold uppercase tracking-wider text-white/70">Pay {merchant.name}</p>
            <p className="text-sm text-white/80">{merchant.city}</p>
            <h1 className="mt-2 text-2xl font-black" style={{ fontFamily: "var(--font-display)" }}>
              {order.description}
            </h1>
            <p className="mt-1 font-mono text-3xl font-black">{money(order.amountZar, "ZAR")}</p>
            <p className="text-sm text-white/80">for {order.customerName}</p>
          </div>
        </div>

        {/* Pay */}
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#685D55]">I&apos;m paying from</label>
            <select className={inputCls} value={payer.name} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-[#EDE2D6] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#685D55]">You pay about</span>
              <span className="font-mono text-xl font-black">{money(localAmount, payer.ccy)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-[#685D55]">Sent as</span>
              <span className="font-mono font-bold text-[#A86A06]">{usdc(order.usdcAmount)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-[#685D55]">{merchant.name} receives</span>
              <span className="font-mono font-bold text-[#1E6B45]">{money(order.amountZar, "ZAR")}</span>
            </div>
            <p className="mt-3 rounded-lg bg-[#EAF6F0] px-3 py-2 text-xs text-[#1E6B45]">
              Arrives in ~15 seconds. A bank transfer from {payer.name === "South Africa" ? "abroad" : payer.name} would cost about {money(bankFee, "ZAR")} and take 3–5 days.
            </p>
          </div>

          {error && <p className="rounded-xl bg-[#FBEDEA] px-3 py-2 text-sm text-[#8B1E24]">{error}</p>}

          <button onClick={payWithWallet} disabled={!!busy} className={`${btnPrimary} w-full py-4 text-lg`}>
            {busy ?? `Pay ${usdc(order.usdcAmount)} with wallet`}
          </button>
          <p className="-mt-2 text-center text-xs text-[#685D55]">MetaMask or any browser wallet · Base Sepolia testnet</p>

          <details className="rounded-2xl border border-[#EDE2D6] p-4 text-sm">
            <summary className="cursor-pointer font-bold">Pay from a phone wallet (QR code)</summary>
            <div className="mt-3 flex flex-col items-center gap-3">
              <QRCodeSVG value={eip681} size={160} />
              <p className="break-all text-center font-mono text-[11px] text-[#685D55]">Send {usdc(order.usdcAmount)} to {merchant.walletAddress}</p>
              <div className="flex w-full gap-2">
                <input className={`${inputCls} font-mono text-xs`} placeholder="Paste transaction hash 0x…" value={manualHash} onChange={(e) => setManualHash(e.target.value)} />
                <button onClick={verifyManual} disabled={!!busy || !manualHash} className="shrink-0 rounded-xl bg-[#181412] px-3 font-bold text-white disabled:opacity-50">
                  Check
                </button>
              </div>
            </div>
          </details>

          <button onClick={demoPay} disabled={!!busy} className="w-full text-center text-xs text-[#685D55] underline hover:text-[#C84B24]">
            No wallet? Make a demo payment instead
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FFF8EE] text-[#181412]">
      <StripeBar />
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-6">
        <div className="mb-5 self-start sm:self-center">
          <Logo />
        </div>
        <div className="w-full overflow-hidden rounded-3xl border border-[#EDE2D6] bg-white shadow-xl shadow-[#C84B24]/5">{children}</div>
        <p className="mt-4 text-center text-xs text-[#685D55]">Secured by Famba · USDC on Base · Payments are verified on the blockchain</p>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[#685D55]">{k}</dt>
      <dd className="text-right font-semibold">{v}</dd>
    </div>
  );
}
