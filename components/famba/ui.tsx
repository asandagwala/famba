"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";

// ── Brand ────────────────────────────────────────────────
export const C = {
  terracotta: "#C84B24",
  terracottaDark: "#A63816",
  ochre: "#E59A18",
  ochreSoft: "#FFF5DF",
  green: "#1E6B45",
  greenSoft: "#EAF6F0",
  crimson: "#8B1E24",
  cream: "#FFF8EE",
  ink: "#181412",
  muted: "#685D55",
  line: "#EDE2D6",
};

export const COUNTRIES = [
  { name: "South Africa", code: "ZA", ccy: "ZAR", payout: "Bank EFT" },
  { name: "Kenya", code: "KE", ccy: "KES", payout: "M-Pesa" },
  { name: "Nigeria", code: "NG", ccy: "NGN", payout: "Bank transfer" },
  { name: "Ghana", code: "GH", ccy: "GHS", payout: "Mobile money" },
  { name: "Zambia", code: "ZM", ccy: "ZMW", payout: "Bank transfer" },
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
  const [balance, setBalance] = useState<number | null>(null);

  const refresh = useCallback(async (addr: string) => {
    const raw = (await eth()!.request({ method: "eth_call", params: [{ to: USDC, data: "0x70a08231" + pad(addr) }, "latest"] })) as string;
    setBalance(Number(BigInt(raw)) / 1e6);
  }, []);

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
    await refresh(addr).catch(() => {});
    return addr;
  }, [refresh]);

  /** Sends a real USDC transfer; returns the tx hash once the user confirms. */
  const sendUsdc = useCallback(
    async (to: string, amount: number) => {
      const from = address ?? (await connect());
      const units = BigInt(Math.round(amount * 1e6));
      const hash = (await eth()!.request({
        method: "eth_sendTransaction",
        params: [{ from, to: USDC, value: "0x0", data: "0xa9059cbb" + pad(to) + pad(units.toString(16)) }],
      })) as string;
      return hash;
    },
    [address, connect],
  );

  /** Polls the server-side verifier until the tx is mined (up to ~60s). */
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

  return { address, balance, connect, sendUsdc, waitAndVerify, refresh };
}

// ── Layout ───────────────────────────────────────────────
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-[10px] text-2xl font-black text-white" style={{ background: C.terracotta, fontFamily: "var(--font-display)" }}>
        F
      </span>
      <span>
        <span className={`block text-xl font-black tracking-[0.08em] ${light ? "text-white" : ""}`} style={{ fontFamily: "var(--font-display)" }}>
          FAMBA
        </span>
        <span className={`block text-[9px] font-bold uppercase tracking-[0.16em] ${light ? "text-white/70" : "text-[#685D55]"}`}>
          Pay across Africa, instantly
        </span>
      </span>
    </Link>
  );
}

export const StripeBar = () => <div className="h-1.5 w-full bg-gradient-to-r from-[#C84B24] via-[#E59A18] to-[#1E6B45]" />;

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/suppliers", label: "Pay suppliers" },
  { href: "/cash-out", label: "Cash out" },
];

export function AppHeader({ merchant }: { merchant?: string }) {
  const path = usePathname();
  return (
    <>
      <StripeBar />
      <header className="sticky top-0 z-30 border-b border-[#EDE2D6] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Logo />
          <nav className="order-3 flex w-full gap-1 overflow-x-auto text-sm font-bold sm:order-none sm:w-auto">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`whitespace-nowrap rounded-lg px-3 py-2 transition ${path === n.href ? "bg-[#FFF1EB] text-[#C84B24]" : "text-[#463C35] hover:text-[#C84B24]"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          {merchant && (
            <span className="hidden rounded-full border border-[#EDE2D6] bg-[#FFF8EE] px-3 py-1.5 text-xs font-bold text-[#463C35] md:block">
              {merchant}
            </span>
          )}
        </div>
      </header>
    </>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const bg = /(^|\s)bg-/.test(className) ? "" : "bg-white";
  return <div className={`rounded-2xl border border-[#EDE2D6] ${bg} ${className}`}>{children}</div>;
}

export function Pill({ tone, children }: { tone: "green" | "ochre" | "muted" | "terracotta"; children: React.ReactNode }) {
  const cls = {
    green: "bg-[#EAF6F0] text-[#1E6B45]",
    ochre: "bg-[#FFF5DF] text-[#A86A06]",
    muted: "bg-[#F4EEE7] text-[#685D55]",
    terracotta: "bg-[#FFF1EB] text-[#C84B24]",
  }[tone];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>{children}</span>;
}

export function Route({ from, to }: { from: string; to: string }) {
  const a = countryByName(from).code;
  const b = countryByName(to).code;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#FFF8EE] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#463C35]">
      {a} <span className="text-[#E59A18]">→</span> {b}
    </span>
  );
}

export const inputCls =
  "w-full rounded-xl border border-[#E8DCD0] bg-white px-3.5 py-2.5 text-[15px] outline-none transition focus:border-[#C84B24] focus:ring-2 focus:ring-[#C84B24]/15";
export const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#685D55]";
export const btnPrimary =
  "rounded-xl bg-[#C84B24] px-5 py-3 font-bold text-white transition hover:bg-[#A63816] disabled:cursor-not-allowed disabled:opacity-50";
export const btnDark = "rounded-xl bg-[#181412] px-5 py-3 font-bold text-white transition hover:bg-[#C84B24] disabled:opacity-50";
