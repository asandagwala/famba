// Base Sepolia USDC verification over plain JSON-RPC (no wallet keys on the server).
export const CHAIN_ID = 84532;
export const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const EXPLORER_TX = "https://sepolia.basescan.org/tx/";
const RPCS = [
  process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
  "https://base-sepolia-rpc.publicnode.com",
];
// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  let lastErr: unknown;
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      const body = (await res.json()) as { result?: T; error?: { message: string } };
      if (body.error) throw new Error(body.error.message);
      return body.result as T;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Base Sepolia RPC unreachable");
}

const topicToAddr = (t: string) => ("0x" + t.slice(-40)).toLowerCase();

type Receipt = { status: string; logs: { address: string; topics: string[]; data: string }[] } | null;

/** Confirms a tx moved at least `minUsdc` USDC to `to`. */
export async function verifyUsdcTransfer(txHash: string, to: string, minUsdc: number) {
  const receipt = await rpc<Receipt>("eth_getTransactionReceipt", [txHash]);
  if (!receipt) return { ok: false as const, reason: "Transaction not mined yet. Try again in a few seconds." };
  if (receipt.status !== "0x1") return { ok: false as const, reason: "Transaction failed on-chain." };
  const want = BigInt(Math.round(minUsdc * 1e6));
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== USDC_ADDRESS.toLowerCase() || log.topics[0] !== TRANSFER_TOPIC) continue;
    if (topicToAddr(log.topics[2]) !== to.toLowerCase()) continue;
    const amount = BigInt(log.data);
    if (amount >= want) return { ok: true as const, from: topicToAddr(log.topics[1]), amountUsdc: Number(amount) / 1e6 };
    return { ok: false as const, reason: `Only ${Number(amount) / 1e6} USDC was sent; ${minUsdc} needed.` };
  }
  return { ok: false as const, reason: "No USDC transfer to this wallet found in that transaction." };
}

export async function usdcBalance(address: string) {
  const data = "0x70a08231" + address.replace(/^0x/, "").toLowerCase().padStart(64, "0");
  const raw = await rpc<string>("eth_call", [{ to: USDC_ADDRESS, data }, "latest"]);
  return Number(BigInt(raw)) / 1e6;
}

export const isTxHash = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
export const isAddress = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
