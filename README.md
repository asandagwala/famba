# Famba — Cross-border payments for African businesses

*Famba* means "to go" in Shona.

## The problem

Paying across African borders is slow and expensive. A payment from Kenya to South Africa usually goes through
correspondent banks in New York or London, converting to dollars and back. Small businesses lose up to ~9.5% to fees
and exchange-rate margins, and wait 3–5 days for the money.

## What Famba does

Famba is a payment app for small businesses that sell to, and buy from, other African countries. Money moves as
**USDC** (a digital US dollar) on the **Base** network, so it arrives in about 15 seconds for a 0.2% fee.

| | What happens |
|---|---|
| **Get paid from anywhere in Africa** | The merchant creates a payment link (or QR code) and sends it on WhatsApp. A customer in Kenya, Nigeria, Ghana or Zambia sees the price in their own currency and pays in USDC from their wallet. Famba **verifies the transfer on the blockchain** before marking the order paid. |
| **Pay suppliers across borders** | Pay a shea co-op in Ghana or a packaging supplier in Kenya: enter what they should receive in their own currency (GHS, KES, NGN…), and Famba sends the USDC. Pay from the Famba balance, or as a real on-chain transfer from your wallet. |
| **Cash out** | Turn your USDC balance into rand in your South African bank account. |
| **Famba Assistant** | A Claude-powered chatbot that answers questions like "Who hasn't paid me yet?" or "How much have I saved on fees?" using your real data. It is **read-only**: it has no tool that can move money. |

The demo business is **Ubuntu Naturals**, a Cape Town shea butter and black soap brand that buys from women's co-ops
in Ghana and sells across Africa.

## Run it

This project uses **pnpm**. Run each line separately (Windows PowerShell 5.1 does not support `&&`):

```bash
pnpm install
pnpm start
```

Wait for `Ready`, then open <http://localhost:3000>. Data is saved to `data/famba-db.json`, so it survives refreshes and restarts. Use
**Reset demo data** on the dashboard to start again.

To turn on the chatbot, create a `.env.local` file containing:

```
ANTHROPIC_API_KEY=your-key-here
```

Optional: `MERCHANT_WALLET_ADDRESS=0x…` sets the merchant's receiving wallet.

### Paying with a real wallet (optional)

Install MetaMask, get Base Sepolia test ETH and test USDC from a faucet (for example faucet.circle.com), open a
payment link, and click **Pay with wallet**. With no wallet, use **Make a demo payment instead**.

## How it's built

- **Next.js 16** (App Router) frontend and API routes in one app, with no separate server.
- **Base Sepolia** testnet USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). The server checks payments by
  reading the transaction receipt over public RPC and matching the USDC `Transfer` event (recipient and amount). It
  never holds private keys.
- **Live exchange rates** for ZAR, KES, NGN, GHS and ZMW from open.er-api.com, cached for 10 minutes, with fallback
  rates when offline.
- **Claude** (`claude-opus-5-5`) through the Anthropic SDK with read-only tools for the assistant.
- **JSON-file database** with serialised, atomic writes.

### API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/overview` | Merchant dashboard data: balance, orders, suppliers, payouts, rates |
| `GET` | `/api/rates` | Live USDC exchange rates and the bank vs Famba fee model |
| `POST` | `/api/orders` | Create a payment link `{customerName, customerCountry, description, amountZar}` |
| `GET` | `/api/orders/:id` | Public checkout data |
| `POST` | `/api/orders/:id/verify` | Verify a USDC payment on-chain `{txHash}` |
| `POST` | `/api/orders/:id/simulate` | Demo payment (no wallet) |
| `POST` | `/api/suppliers/pay` | Pay a supplier `{supplierId, usdcAmount, note, txHash?}` |
| `POST` | `/api/cash-out` | Withdraw to a bank `{usdcAmount, bank}` (simulated off-ramp) |
| `POST` | `/api/chat` | Famba Assistant `{messages}` |
| `POST` | `/api/reset` | Restore demo data |

> Demo on testnet: no real money moves. Local-currency payouts to M-Pesa, mobile money and bank accounts are
> simulated; in production they would go through a licensed off-ramp partner.

## How we kept tokens low

1. Built on the existing Next.js scaffold and installed packages, with no extra frameworks, auth or external database: one JSON file stores everything.
2. Payments are verified with plain JSON-RPC calls to Base Sepolia instead of a heavy web3 SDK, and FX rates are cached for 10 minutes.
3. The assistant runs Claude at low effort with small read-only tools and only the last 12 messages, so each chat turn stays short.

*Note: much of this code was written with Claude Code. See the `/usage` screenshot in our submission for GitHub Copilot token usage.*
