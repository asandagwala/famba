"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";

// ── Data helpers ─────────────────────────────────────────
export const COUNTRIES = [
  { name: "South Africa", code: "ZA", ccy: "ZAR" },
  { name: "Kenya", code: "KE", ccy: "KES" },
  { name: "Nigeria", code: "NG", ccy: "NGN" },
  { name: "Ghana", code: "GH", ccy: "GHS" },
  { name: "Zambia", code: "ZM", ccy: "ZMW" },
] as const;
export const countryByName = (n: string) => COUNTRIES.find((c) => c.name === n) ?? COUNTRIES[0];

export const EXPLORER_TX = "https://sepolia.basescan.org/tx/";
const CHAIN_HEX = "0x14a34"; // 84532 Base Sepolia
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

export const money = (n: number, ccy: string, dp = 2) =>
  `${ccy === "ZAR" ? "R" : ccy + " "}${n.toLocaleString("en-ZA", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
export const usdc = (n: number) => `${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
export const shortHex = (h: string, a = 6, b = 4) => `${h.slice(0, a)}…${h.slice(-b)}`;
export const when = (iso: string) =>
  new Date(iso).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    throw new Error("Can't reach the Famba server.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

// ── Wallet (MetaMask / any injected EIP-1193 wallet) ─────
type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
const eth = () => (typeof window !== "undefined" ? (window as unknown as { ethereum?: Eth }).ethereum : undefined);
const pad = (hex: string) => hex.replace(/^0x/, "").toLowerCase().padStart(64, "0");

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);

  const connect = useCallback(async () => {
    const e = eth();
    if (!e) throw new Error("No wallet found. Install MetaMask (or another browser wallet) to pay with USDC.");
    const [addr] = (await e.request({ method: "eth_requestAccounts" })) as string[];
    if (parseInt((await e.request({ method: "eth_chainId" })) as string, 16) !== 84532) {
      try {
        await e.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
      } catch {
        await e.request({
          method: "wallet_addEthereumChain",
          params: [{ chainId: CHAIN_HEX, chainName: "Base Sepolia", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://sepolia.base.org"], blockExplorerUrls: ["https://sepolia.basescan.org"] }],
        });
      }
    }
    setAddress(addr);
    return addr;
  }, []);

  /** Sends a real USDC transfer; returns the tx hash once the user confirms. */
  const sendUsdc = useCallback(
    async (to: string, amount: number) => {
      const from = address ?? (await connect());
      const units = BigInt(Math.round(amount * 1e6));
      return (await eth()!.request({
        method: "eth_sendTransaction",
        params: [{ from, to: USDC, value: "0x0", data: "0xa9059cbb" + pad(to) + pad(units.toString(16)) }],
      })) as string;
    },
    [address, connect],
  );

  /** Retries the server-side verifier until the tx is mined (up to ~60s). */
  const waitAndVerify = useCallback(async <T,>(verify: () => Promise<T>) => {
    let lastErr: unknown;
    for (let i = 0; i < 20; i++) {
      try {
        return await verify();
      } catch (e) {
        lastErr = e;
        if (!/not mined/i.test((e as Error).message)) throw e;
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    throw lastErr;
  }, []);

  return { address, connect, sendUsdc, waitAndVerify };
}

// ── Brand ────────────────────────────────────────────────
/** Famba mark: four kente blocks held by bold black weave lines, like the cloth. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <rect width="28" height="28" rx="2" fill="#141414" />
      <rect x="3" y="3" width="10" height="10" fill="#d9a22b" />
      <rect x="15" y="3" width="10" height="10" fill="#17713f" />
      <rect x="3" y="15" width="10" height="10" fill="#a8201f" />
      <rect x="15" y="15" width="10" height="10" fill="#d9a22b" />
      <path d="M15 8h10M8 15v10M3 20h10M20 15v10" stroke="#141414" strokeWidth="1.6" />
    </svg>
  );
}

export const SLOGAN = "Where money moves freely.";

export function Logo({ tone = "dark", slogan = true }: { tone?: "dark" | "light"; slogan?: boolean }) {
  const light = tone === "light";
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <Mark size={slogan ? 32 : 28} />
      <span className="flex flex-col">
        <span className={`font-display text-[22px] font-semibold leading-none tracking-tight ${light ? "text-ivory" : "text-ink"}`}>Famba</span>
        {slogan && <span className={`mt-1 text-[11px] leading-none ${light ? "text-ivory/60" : "text-stone"}`}>{SLOGAN}</span>}
      </span>
    </Link>
  );
}

export const KenteStripe = ({ className = "h-1" }: { className?: string }) => <div className={`kente-stripe w-full ${className}`} aria-hidden />;

/** The real kente cloth, faded up into the blue background. Use at the bottom of a blue section. */
export function KenteFade({ className = "h-24" }: { className?: string }) {
  return (
    <div className={`pointer-events-none relative w-full overflow-hidden ${className}`} aria-hidden>
      <Image src="/famba/kente.png" alt="" fill sizes="100vw" className="object-cover object-bottom opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-b from-night via-night/60 to-transparent" />
    </div>
  );
}

const NAV = [
  { href: "/dashboard", label: "Payments" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/settlements", label: "Settlements" },
];

export function AppHeader({ merchant }: { merchant?: string }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 bg-night text-ivory">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <div className="flex items-center gap-8">
          <Logo tone="light" />
          <nav className="hidden gap-1 text-[14px] sm:flex">
            {NAV.map((n) => {
              const active = path === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`relative px-3 py-5 transition-colors ${active ? "text-ivory" : "text-ivory/60 hover:text-ivory"}`}
                >
                  {n.label}
                  {active && <span className="absolute inset-x-3 bottom-0 h-[3px] bg-gold" />}
                </Link>
              );
            })}
          </nav>
        </div>
        {merchant && <span className="py-5 text-[13px] text-ivory/60">{merchant}</span>}
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 text-[14px] sm:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`rounded px-3 py-1.5 ${path === n.href ? "bg-night-3 text-ivory" : "text-ivory/60"}`}>
            {n.label}
          </Link>
        ))}
      </nav>
      <KenteStripe />
    </header>
  );
}

// ── Building blocks ──────────────────────────────────────
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-rule bg-paper ${className}`}>{children}</section>;
}

export function PanelHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-rule px-6 py-4">
      <div>
        <h2 className="font-display text-[19px] font-semibold">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-stone">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Status({ tone, children }: { tone: "leaf" | "gold" | "stone" | "kred"; children: React.ReactNode }) {
  const dot = { leaf: "bg-leaf", gold: "bg-gold", stone: "bg-stone/50", kred: "bg-kred" }[tone];
  const text = { leaf: "text-leaf", gold: "text-gold-deep", stone: "text-stone", kred: "text-kred" }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium ${text}`}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

export function Route({ from, to }: { from: string; to: string }) {
  return (
    <span className="whitespace-nowrap text-[12px] font-semibold tracking-wide text-stone">
      {countryByName(from).code}
      <span className="mx-1 text-gold">→</span>
      {countryByName(to).code}
    </span>
  );
}

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-[13px] font-medium text-stone">{eyebrow}</p>}
        <h1 className="mt-1 font-display text-[34px] font-semibold leading-tight tracking-tight">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export const inputCls =
  "w-full rounded-sm border border-rule bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-stone/50 focus:border-night-3 focus:ring-2 focus:ring-night-3/15";
export const labelCls = "mb-1.5 block text-[13px] font-medium text-stone";
/** Primary action: kente royal blue. */
export const btnPrimary =
  "inline-flex items-center justify-center rounded-sm bg-night px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-night-3 disabled:cursor-not-allowed disabled:opacity-50";
export const btnNight =
  "inline-flex items-center justify-center rounded-md bg-night px-5 py-3 text-[15px] font-semibold text-ivory transition hover:bg-night-3 disabled:opacity-50";
export const btnLine =
  "inline-flex items-center justify-center rounded-md border border-ink/20 px-4 py-2.5 text-[14px] font-semibold text-ink transition hover:border-ink disabled:opacity-50";

export function Modal({ children, onClose, width = "max-w-md" }: { children: React.ReactNode; onClose: () => void; width?: string }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-night/70 p-4" onClick={onClose}>
      <div className={`max-h-[92vh] w-full ${width} overflow-auto rounded-lg bg-paper shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <KenteStripe className="h-1.5" />
        {children}
      </div>
    </div>
  );
}
