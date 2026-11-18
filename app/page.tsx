import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { KenteFade, KenteStripe, Logo } from "@/components/famba/ui";

const stats = [
  { figure: "14.4%", text: "of Africa's trade is between African countries, compared with over 60% in Europe.", source: "Afreximbank, African Trade Report" },
  { figure: "3–5 days", text: "for a typical cross-border business payment to settle through correspondent banks.", source: "FXC Intelligence" },
  { figure: "2–7%", text: "lost per payment to wire fees, FX spreads and intermediaries, often $28–$52 a transfer.", source: "FXC Intelligence, Tazapay" },
];

const steps = [
  {
    n: "01",
    title: "Your customer pays in their own currency",
    body: "They open your payment link and pay the way they already do: M-Pesa, MTN MoMo, a bank transfer, or a USDC wallet. The price is shown in their currency, with the rate locked.",
  },
  {
    n: "02",
    title: "Famba settles it in seconds",
    body: "The payment moves as USDC on Base for a 0.2% fee. Famba checks it, matches it to the right order and marks it paid. No one reconciles bank statements by hand.",
  },
  {
    n: "03",
    title: "You receive rand, or keep dollars",
    body: "Settle to your local bank account whenever you like, or hold USDC to pay your own suppliers in Ghana, Kenya or Nigeria the same way.",
  },
];

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#why", label: "Why Famba" },
  { href: "/pay/ord_basket4", label: "See the checkout" },
];

export default function Landing() {
  return (
    <div className="bg-ivory text-ink">
      {/* ── Menu ── */}
      <header className="sticky top-0 z-40 bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
          <div className="py-3.5">
            <Logo />
          </div>
          <nav className="hidden items-center gap-1 text-[15px] font-medium md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="relative px-3.5 py-6 text-ink/70 transition-colors after:absolute after:inset-x-3.5 after:bottom-0 after:h-[2px] after:origin-left after:scale-x-0 after:bg-night after:transition-transform hover:text-ink hover:after:scale-x-100"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2.5">
            <Link href="/dashboard" className="hidden rounded-sm border border-night/30 px-4 py-2.5 text-[14px] font-semibold text-night transition hover:border-night sm:inline-flex">
              Merchant login
            </Link>
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-sm bg-night px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-night-3">
              Get started <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
        <KenteStripe />
      </header>

      {/* ── Hero: the shop photo, full width and uncropped ── */}
      <section className="bg-ivory">
        <Image
          src="/famba/shop-hero-v2.webp"
          alt="Connecting African commerce: a shop owner in a kente dress at her clothing store counter, with instant NGN to ZAR settlements, payments in seconds, borderless, low fees of 0.2%"
          width={1679}
          height={937}
          priority
          sizes="100vw"
          className="h-auto w-full"
        />
      </section>

      {/* ── Intro ── */}
      <section className="border-b border-rule bg-ivory">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-[14px] font-semibold text-night-3">Stablecoin payment gateway for African businesses</p>
            <h1 className="mt-4 font-display text-[44px] font-semibold leading-[1.04] tracking-tight sm:text-[58px]">
              Get paid from anywhere in Africa, in seconds.
            </h1>
            <p className="mt-6 max-w-lg text-[18px] leading-relaxed text-stone">
              Your customer in Nairobi pays in shillings. You receive rand in Cape Town. Famba handles the currency, the settlement and the paperwork in between.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/pay/ord_basket4" className="inline-flex items-center gap-2 rounded-sm bg-night px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-night-3">
                Try the checkout <ArrowRight className="size-4" />
              </Link>
              <Link href="/dashboard" className="rounded-sm border border-ink/25 px-6 py-3.5 text-[15px] font-semibold hover:border-ink">
                Open the dashboard
              </Link>
            </div>
            <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-rule pt-6">
              {[
                ["~15 sec", "to settle"],
                ["0.2%", "per payment"],
                ["5", "countries"],
              ].map(([v, k]) => (
                <div key={k}>
                  <dt className="num font-display text-[26px] font-semibold text-night">{v}</dt>
                  <dd className="text-[13px] text-stone">{k}</dd>
                </div>
              ))}
            </dl>
          </div>

          <figure className="mx-auto w-full max-w-[440px]">
            <Image
              src="/famba/crossborder-phone.jpg"
              alt="Cross-border payments made easy: a phone showing the Famba checkout with MTN MoMo, M-Pesa, card and USDC, over South African and Nigerian banknotes"
              width={1493}
              height={2000}
              sizes="(min-width: 1024px) 440px, 90vw"
              className="h-auto w-full shadow-[0_30px_60px_-30px_rgba(16,48,106,0.6)]"
            />
          </figure>
        </div>
      </section>

      {/* ── Why ── */}
      <section id="why" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="max-w-3xl">
          <h2 className="font-display text-[34px] font-semibold leading-tight tracking-tight sm:text-[42px]">
            Selling to the country next door shouldn&apos;t mean routing money through New York.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-stone">
            Africa has more than 42 currencies, and most can&apos;t be exchanged directly. A payment from Nigeria to Kenya is usually converted to dollars at a bank overseas and back again. Each step adds fees and days, and while the money sits in transit, a weakening currency can wipe out the margin on the sale.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.figure} className="bg-paper p-7">
              <p className="num font-display text-[44px] font-semibold leading-none tracking-tight text-kred">{s.figure}</p>
              <p className="mt-4 text-[15px] leading-relaxed">{s.text}</p>
              <p className="mt-4 text-[12px] text-stone">{s.source}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How ── */}
      <section id="how" className="border-t border-rule bg-paper">
        <div className="mx-auto grid max-w-6xl items-start gap-16 px-5 py-24 sm:px-8 lg:grid-cols-2">
          <figure className="mx-auto w-full max-w-[480px] lg:sticky lg:top-24">
            <Image
              src="/famba/merchant-laptop.webp"
              alt="A clothing seller packing an order, with her Famba dashboard open on the laptop"
              width={1083}
              height={1452}
              sizes="(min-width: 1024px) 480px, 90vw"
              className="h-auto w-full shadow-[0_24px_60px_-24px_rgba(22,19,15,0.45)]"
            />
            <figcaption className="mt-3 text-[13px] text-stone">Payments from four countries, matched and settled before the parcel is packed.</figcaption>
          </figure>
          <div>
            <h2 className="font-display text-[34px] font-semibold leading-tight tracking-tight sm:text-[42px]">How Famba works</h2>
            <ol className="mt-10 space-y-10">
              {steps.map((s) => (
                <li key={s.n} className="grid grid-cols-[48px_1fr] gap-4">
                  <span className="num font-display text-[20px] font-semibold text-night-3">{s.n}</span>
                  <div className="border-t border-rule pt-4">
                    <h3 className="text-[19px] font-semibold">{s.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-stone">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-12 grid gap-6 border-t border-rule pt-8 sm:grid-cols-2">
              <div>
                <h3 className="font-semibold">Every payment, accounted for</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-stone">Payments are matched to their orders automatically, and USDC payments are verified on the blockchain before they count.</p>
              </div>
              <div>
                <h3 className="font-semibold">Ask, don&apos;t dig</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-stone">The Famba Assistant answers questions like &ldquo;who still owes me?&rdquo; from your real data. It can read, but it can never move money.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Close ── */}
      <section className="bg-night text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-16 sm:px-8 md:flex-row md:items-center">
          <h2 className="max-w-xl font-display text-[32px] font-semibold leading-tight tracking-tight">
            Famba means &ldquo;to go&rdquo; in Shona. Your money should move as freely as your trade.
          </h2>
          <Link href="/dashboard" className="inline-flex shrink-0 items-center gap-2 rounded-sm bg-white px-6 py-3.5 text-[15px] font-semibold text-night hover:bg-azure-soft">
            Open the merchant dashboard <ArrowRight className="size-4" />
          </Link>
        </div>
        <p className="px-5 pb-2 text-center text-[12px] text-white/50">Demo on Base Sepolia testnet. No real money moves.</p>
        <KenteFade className="h-28" />
      </section>
    </div>
  );
}
