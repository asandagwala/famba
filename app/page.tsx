import Image from "next/image";
import Link from "next/link";
import { Logo, StripeBar } from "@/components/famba/ui";

const steps = [
  {
    tag: "Get paid",
    title: "Get paid from anywhere in Africa",
    body: "Send a payment link. A customer in Nairobi, Lagos or Accra pays in USDC from their wallet, and it lands in your account in about 15 seconds.",
    image: "/famba/hands-harvest.png",
    color: "#1E6B45",
  },
  {
    tag: "Pay suppliers",
    title: "Pay suppliers across borders",
    body: "Pay a shea co-op in Ghana or a packaging supplier in Kenya. They're paid in their own currency by mobile money, M-Pesa or bank.",
    image: "/famba/baskets.png",
    color: "#E59A18",
  },
  {
    tag: "Cash out",
    title: "Cash out to your local bank",
    body: "Turn your USDC balance into rand in your South African bank account whenever you need it, at a clear rate with no hidden FX margin.",
    image: "/famba/woman-bowl.png",
    color: "#C84B24",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-[#181412]">
      <StripeBar />
      <header className="border-b border-[#EDE2D6]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Logo />
          <nav className="flex items-center gap-2 text-sm font-bold sm:gap-6">
            <a href="#how" className="hidden text-[#463C35] hover:text-[#C84B24] sm:block">How it works</a>
            <a href="#problem" className="hidden text-[#463C35] hover:text-[#C84B24] sm:block">Why Famba</a>
            <Link href="/dashboard" className="rounded-xl bg-[#181412] px-4 py-2.5 text-white hover:bg-[#C84B24]">
              Open dashboard
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-8 lg:grid-cols-2 lg:py-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#E59A18]/30 bg-[#FFF5DF] px-3 py-1 text-xs font-bold text-[#A86A06]">
            ZA · KE · NG · GH · ZM
          </span>
          <h1 className="mt-4 text-4xl font-black leading-[1.05] sm:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
            Cross-border payments as fast as African trade.
          </h1>
          <p className="mt-4 max-w-lg text-lg text-[#463C35]">
            Famba helps African businesses get paid by customers in other countries, and pay suppliers across borders, in seconds instead of days. Money moves as USDC, a digital US dollar, so it skips the bank chain.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard" className="rounded-xl bg-[#C84B24] px-6 py-3.5 font-bold text-white hover:bg-[#A63816]">
              Open merchant dashboard →
            </Link>
            <Link href="/pay/ord_basket4" className="rounded-xl border-2 border-[#181412] px-6 py-3 font-bold hover:border-[#C84B24] hover:text-[#C84B24]">
              Try paying as a customer
            </Link>
          </div>
        </div>

        {/* Example route */}
        <div className="relative overflow-hidden rounded-3xl">
          <Image src="/famba/hero.png" alt="Women weaving baskets and preparing shea butter" width={1000} height={760} className="h-[420px] w-full object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white/95 p-4 shadow-xl backdrop-blur">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#685D55]">Example payment</p>
            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
              <div>
                <p className="text-xs text-[#685D55]">Customer in Nairobi pays</p>
                <p className="font-mono text-lg font-bold">KES 9 640</p>
              </div>
              <div className="text-center">
                <p className="rounded-full bg-[#FFF5DF] px-2 py-1 font-mono text-xs font-bold text-[#A86A06]">74 USDC</p>
                <p className="mt-1 text-[10px] text-[#685D55]">~15 seconds</p>
              </div>
              <div>
                <p className="text-xs text-[#685D55]">Shop in Cape Town gets</p>
                <p className="font-mono text-lg font-bold text-[#1E6B45]">R1 350</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="bg-[#FFF8EE]">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
          <h2 className="text-3xl font-black" style={{ fontFamily: "var(--font-display)" }}>
            Paying across African borders is still too hard.
          </h2>
          <p className="mt-2 max-w-2xl text-[#463C35]">
            A payment from Kenya to South Africa usually goes through banks in New York or London first, converting to dollars and back. Small businesses pay for every step.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ["Up to 9.5%", "lost to bank fees and exchange-rate margins on a cross-border payment"],
              ["3–5 days", "for money to arrive, while stock and wages wait"],
              ["0.2% · 15 sec", "with Famba: one transfer of USDC, then local currency on arrival"],
            ].map(([big, small], i) => (
              <div key={big} className={`rounded-2xl p-5 ${i === 2 ? "bg-[#1E6B45] text-white" : "border border-[#EDE2D6] bg-white"}`}>
                <p className={`font-mono text-3xl font-black ${i === 2 ? "" : "text-[#8B1E24]"}`}>{big}</p>
                <p className={`mt-1 text-sm ${i === 2 ? "text-white/85" : "text-[#685D55]"}`}>{small}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-14 sm:px-8">
        <h2 className="text-3xl font-black" style={{ fontFamily: "var(--font-display)" }}>
          How Famba works
        </h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <article key={s.title} className="group overflow-hidden rounded-3xl border border-[#EDE2D6] transition hover:shadow-xl">
              <Image src={s.image} alt="" width={600} height={400} className="h-48 w-full object-cover transition duration-500 group-hover:scale-105" />
              <div className="p-5">
                <span className="text-xs font-black uppercase tracking-wider" style={{ color: s.color }}>
                  {i + 1}. {s.tag}
                </span>
                <h3 className="mt-1 text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-sm text-[#685D55]">{s.body}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-3xl bg-[#181412] p-6 text-white sm:flex-row sm:items-center sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#E59A18]">Famba Assistant</p>
            <h3 className="mt-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              Ask about your money in plain language.
            </h3>
            <p className="mt-1 text-sm text-white/70">
              &ldquo;Who still owes me?&rdquo; &middot; &ldquo;How much did I save on fees this month?&rdquo; &middot; &ldquo;What&apos;s the rand to shilling rate?&rdquo; It reads your data but never moves money.
            </p>
          </div>
          <Link href="/dashboard" className="shrink-0 rounded-xl bg-[#E59A18] px-5 py-3 font-bold text-[#181412]">
            Try it in the dashboard
          </Link>
        </div>
      </section>

      <footer className="relative">
        <Image src="/famba/textiles.png" alt="" width={1600} height={200} className="h-24 w-full object-cover" />
        <div className="bg-[#181412] px-4 py-6 text-center text-xs text-white/60">
          Famba (&ldquo;to go&rdquo; in Shona) · Demo on Base Sepolia testnet: no real money moves.
        </div>
      </footer>
    </div>
  );
}
