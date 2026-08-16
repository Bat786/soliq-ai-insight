import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/soliq/AppShell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service | SOLIQ by BatCave Innovations" },
      {
        name: "description",
        content:
          "SOLIQ Terms of Service — subscription plans and billing, cancellation and refunds, market data and AI disclaimers, wallet and brokerage connections, liability and dispute resolution.",
      },
      { property: "og:title", content: "SOLIQ Terms of Service" },
      {
        property: "og:description",
        content: "The agreement governing your use of SOLIQ, operated by BatCave Innovations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "https://soliqintel.com/terms" }],
  }),
  component: Terms,
});

const EFFECTIVE = "August 15, 2026";

type Section = { n: number; title: string; body: string[] };

const SECTIONS: Section[] = [
  {
    n: 1,
    title: "Agreement to Terms",
    body: [
      "These Terms of Service (\u201cTerms\u201d) form a binding agreement between you and BatCave Innovations, doing business as SOLIQ (\u201cSOLIQ\u201d, \u201cwe\u201d, \u201cus\u201d, \u201cour\u201d), governing your access to and use of the SOLIQ website, applications, APIs, data feeds, and all related services (collectively, the \u201cService\u201d).",
      "By creating an account, subscribing to a paid plan, connecting a wallet or financial account, or otherwise using the Service, you accept these Terms in full. If you do not agree, you must not use the Service.",
    ],
  },
  {
    n: 2,
    title: "Eligibility",
    body: [
      "You must be at least 18 years old and legally capable of entering into a binding contract. You must not use the Service if you are barred from doing so under the laws of your jurisdiction, or if you appear on any applicable sanctions or restricted-party list.",
      "If you use the Service on behalf of an entity, you represent that you are authorized to bind that entity to these Terms.",
    ],
  },
  {
    n: 3,
    title: "Accounts and Security of Credentials",
    body: [
      "You are responsible for the accuracy of the information you provide, for maintaining the confidentiality of your credentials, and for all activity that occurs under your account. Notify us immediately at Support@SOLIQintel.com if you suspect unauthorized access.",
      "We may suspend or terminate accounts that contain false information, are shared with unauthorized parties, or are used in violation of these Terms.",
    ],
  },
  {
    n: 4,
    title: "Description of the Service",
    body: [
      "SOLIQ is a market intelligence and research platform. It aggregates market data, on-chain activity, institutional and unusual-activity flow, screening tools, portfolio tracking, and AI-generated research summaries across equities, ETFs, futures, FX, metals, and digital assets.",
      "SOLIQ is not a broker-dealer, exchange, investment adviser, financial planner, custodian, bank, or money transmitter. SOLIQ does not hold, custody, or transmit your funds or digital assets.",
    ],
  },
  {
    n: 5,
    title: "Subscription Plans",
    body: [
      "Orbit (free): baseline access to multi-asset desks, SOLIQ Scores, portfolio and wallet tracking, and a limited number of watchlist alerts evaluated on a delayed queue.",
      "Pro: $20 per month, or $200 per year billed annually. Includes unlimited real-time alerts, minute-resolution alert evaluation, whale flow and unusual-activity feeds, the trading journal, and posting rights in the community terminal.",
      "Elite: $30 per month, or $300 per year billed annually. Includes everything in Pro plus the strategy backtesting workspace, AI deep-research reports, advanced scanner presets, the dark-pool tape and institutional positioning module, aggregated cross-account portfolio analytics, and priority signal delivery.",
      "Plan contents, limits, and pricing may change. Where a change affects an active paid subscription, it takes effect at the start of your next billing period.",
    ],
  },
  {
    n: 6,
    title: "Billing, Authorization, and Automatic Renewal",
    body: [
      "Paid plans are billed in advance through our payment processor. By subscribing, you authorize us and our processor to charge your payment method the applicable plan fee, plus any taxes, on a recurring basis \u2014 monthly for monthly plans and annually for annual plans \u2014 until you cancel.",
      "Subscriptions renew automatically at the then-current price for the same term. Card details are handled solely by our payment processor; SOLIQ does not store full payment card numbers.",
    ],
  },
  {
    n: 7,
    title: "Taxes",
    body: [
      "Stated prices exclude taxes unless indicated otherwise. Sales tax, VAT, GST, and similar amounts are calculated and collected at checkout where required, based on your billing location and the nature of the product.",
    ],
  },
  {
    n: 8,
    title: "Failed Payments and Past-Due Accounts",
    body: [
      "If a charge fails, our processor may retry it. We may continue to provide access during the retry window and will display a notice asking you to update your payment method. If payment is not resolved, the subscription is canceled and access reverts to the Orbit tier.",
    ],
  },
  {
    n: 9,
    title: "Cancellation",
    body: [
      "You may cancel at any time from the billing portal linked in the app. Cancellation stops future renewals; it does not generate a partial refund. Paid access continues until the end of the period you have already paid for, after which your account reverts to Orbit.",
    ],
  },
  {
    n: 10,
    title: "Refund Policy",
    body: [
      "All sales are final and subscription fees are non-refundable, except where a refund is required by applicable law, or where we determine at our sole discretion that a refund is appropriate \u2014 for example a duplicate charge, a billing error on our side, or a documented failure of the Service to deliver the purchased tier for a sustained period.",
      "Refund requests must be sent to Support@SOLIQintel.com with the account email and the transaction details.",
    ],
  },
  {
    n: 11,
    title: "Free Trials and Promotions",
    body: [
      "Where offered, trials and promotional pricing apply only to the terms stated at the time of the offer, are limited to one per person or entity, and convert to the standard recurring price at the end of the promotional period unless canceled first.",
    ],
  },
  {
    n: 12,
    title: "No Investment, Legal, Tax, or Accounting Advice",
    body: [
      "Everything on the Service \u2014 scores, signals, alerts, screens, backtests, flow interpretations, AI summaries, and commentary \u2014 is provided for informational and educational purposes only. Nothing on the Service is a recommendation, solicitation, or offer to buy or sell any security, futures contract, digital asset, or other financial instrument, and nothing is tailored to your financial circumstances.",
      "You are solely responsible for your own investment decisions and should consult a licensed professional before acting.",
    ],
  },
  {
    n: 13,
    title: "Risk Disclosure",
    body: [
      "Trading and investing involve substantial risk of loss, including the total loss of capital. Leveraged instruments such as futures, options, margin, and perpetual products can produce losses that exceed your deposits. Past performance and backtested results are not indicative of future results and do not account for all real-world costs, slippage, liquidity constraints, or execution failures.",
    ],
  },
  {
    n: 14,
    title: "Market Data and Third-Party Sources",
    body: [
      "Market data, on-chain data, fundamentals, options and flow data, news, and reference information are supplied by third parties. Data may be delayed, incomplete, adjusted, restated, or unavailable, and coverage varies by asset class, venue, and plan tier. We do not warrant the accuracy, timeliness, sequence, or completeness of any data and are not liable for decisions made in reliance on it.",
      "Where a third-party provider imposes usage restrictions, those restrictions pass through to you. You may not redistribute, resell, scrape, or systematically extract data obtained through the Service.",
    ],
  },
  {
    n: 15,
    title: "Alerts and Notifications",
    body: [
      "Alerts, push notifications, and emails are delivered on a best-effort basis and depend on data-provider latency, your device, browser permissions, and network conditions. Alerts may be delayed, duplicated, or missed. Do not rely on any alert as the sole trigger for a time-sensitive financial decision.",
    ],
  },
  {
    n: 16,
    title: "Digital Asset and Blockchain Risks",
    body: [
      "Digital assets are volatile and largely unregulated. Blockchain transactions are irreversible; a transaction sent to the wrong address or approved to a malicious contract cannot be recovered by us. Networks may fork, congest, halt, or reorganize. Tokens may be illiquid, manipulated, or fraudulent, including tokens surfaced by discovery and scanning features.",
    ],
  },
  {
    n: 17,
    title: "Wallet Connections",
    body: [
      "Connecting a self-custodial wallet grants SOLIQ read access to public addresses and, where you explicitly approve it, permission to request signatures for actions you initiate. SOLIQ never holds your private keys, seed phrase, or funds, and cannot move assets on your behalf without your in-wallet approval.",
      "You are solely responsible for safeguarding your keys and for reviewing every transaction and approval before signing.",
    ],
  },
  {
    n: 18,
    title: "Brokerage, Bank, and Trading Integrations",
    body: [
      "Brokerage and bank connections are provided through third-party aggregators. By connecting an account you authorize those providers and SOLIQ to retrieve the account information required to display balances, positions, cost basis, performance, and transaction history.",
      "Where a trading integration is offered, orders are routed and executed by the connected brokerage or protocol, not by SOLIQ. SOLIQ does not guarantee order transmission, execution, price, fill quality, or timing, and is not responsible for outages, rejections, or errors at the executing venue or aggregator.",
    ],
  },
  {
    n: 19,
    title: "AI Features",
    body: [
      "AI-generated output is probabilistic and can be incorrect, outdated, or incomplete, and may misstate figures or context. Output is informational only and is not advice. The assistant is read-only with respect to your account: it can explain your plan, billing status, and connection status, but it cannot make purchases, change billing, move funds, place orders, or modify account data.",
      "Do not submit credentials, private keys, seed phrases, or sensitive personal information into AI features.",
    ],
  },
  {
    n: 20,
    title: "Intellectual Property",
    body: [
      "The Service, including the SOLIQ and AETHRON names and marks, software, models, scoring methodologies, interfaces, and content, is owned by BatCave Innovations or its licensors and is protected by intellectual property laws. Subject to these Terms and payment of applicable fees, we grant you a limited, revocable, non-exclusive, non-transferable license to use the Service for your own internal purposes.",
      "You may not copy, modify, translate, reverse engineer, decompile, create derivative works from, frame, or white-label the Service, nor remove any proprietary notice.",
    ],
  },
  {
    n: 21,
    title: "User Content",
    body: [
      "You retain ownership of content you post, including community posts, journal entries, watchlists, and support messages. You grant us a worldwide, royalty-free, sublicensable license to host, store, reproduce, display, and distribute that content as needed to operate, secure, and improve the Service.",
      "You represent that you hold the rights to the content you post and that it does not infringe the rights of others. We may remove content or restrict accounts at our discretion.",
    ],
  },
  {
    n: 22,
    title: "Community Conduct",
    body: [
      "You may not use community features to promote pump-and-dump schemes, paid signal groups, fraudulent tokens, or unlicensed advisory services, nor to post spam, harassment, hate speech, or unlawful content. Posting rights are a paid privilege and may be revoked without refund for violations.",
    ],
  },
  {
    n: 23,
    title: "Prohibited Conduct",
    body: [
      "You may not: use the Service unlawfully or for market manipulation, insider trading, money laundering, or sanctions evasion; scrape, crawl, cache, or systematically extract data; resell, sublicense, or redistribute the Service or its data; share credentials or exceed the seats your plan provides; circumvent rate limits, tier gates, paywalls, or security controls; probe or attack the Service or its infrastructure; upload malware; or misrepresent your affiliation with SOLIQ.",
    ],
  },
  {
    n: 24,
    title: "Fair Use and Rate Limits",
    body: [
      "The Service is subject to usage, request, and query limits that vary by plan and by upstream provider entitlements. We may throttle, queue, or suspend usage that degrades the Service for others or breaches a provider agreement.",
    ],
  },
  {
    n: 25,
    title: "Privacy and Data Protection",
    body: [
      "Our handling of personal data is described in our Privacy Policy, which is incorporated into these Terms by reference. Connected-account credentials and access tokens are stored server-side under restricted access and are never exposed to the browser.",
    ],
  },
  {
    n: 26,
    title: "Security",
    body: [
      "We apply commercially reasonable technical and organizational measures to protect the Service, but no system is perfectly secure. You are responsible for using a strong unique password, enabling available protections, and keeping your devices and wallet software secure.",
    ],
  },
  {
    n: 27,
    title: "Third-Party Services and Links",
    body: [
      "The Service integrates and links to third-party products, data providers, wallets, exchanges, aggregators, and payment processors. Your use of those services is governed by their own terms, and we are not responsible for their acts, omissions, availability, or content.",
    ],
  },
  {
    n: 28,
    title: "Availability, Changes, and Beta Features",
    body: [
      "We may modify, suspend, or discontinue any part of the Service, including individual features, data sources, or asset coverage, at any time. Features labeled beta, preview, or experimental are provided as-is, may change or be withdrawn, and should not be relied upon.",
      "We do not guarantee uninterrupted or error-free operation and do not commit to any specific uptime unless stated in a separate written agreement.",
    ],
  },
  {
    n: 29,
    title: "Disclaimer of Warranties",
    body: [
      "THE SERVICE, INCLUDING ALL DATA, SIGNALS, SCORES, BACKTESTS, AND AI OUTPUT, IS PROVIDED \u201cAS IS\u201d AND \u201cAS AVAILABLE\u201d WITHOUT WARRANTY OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING ANY IMPLIED WARRANTY OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, TITLE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, TIMELY, OR ERROR-FREE, OR THAT ANY RESULT WILL BE ACHIEVED.",
    ],
  },
  {
    n: 30,
    title: "Limitation of Liability",
    body: [
      "TO THE MAXIMUM EXTENT PERMITTED BY LAW, BATCAVE INNOVATIONS AND ITS OFFICERS, EMPLOYEES, AND SUPPLIERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY TRADING LOSS, LOST PROFIT, LOST OPPORTUNITY, LOST DATA, OR LOSS OF DIGITAL ASSETS, ARISING FROM OR RELATED TO THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY.",
      "OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US FOR THE SERVICE IN THE TWELVE MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS.",
    ],
  },
  {
    n: 31,
    title: "Indemnification",
    body: [
      "You will indemnify, defend, and hold harmless BatCave Innovations and its personnel from and against any claim, demand, loss, liability, damage, penalty, cost, or expense (including reasonable legal fees) arising out of your use of the Service, your content, your trading or investment activity, your connected accounts and wallets, or your breach of these Terms or applicable law.",
    ],
  },
  {
    n: 32,
    title: "Termination",
    body: [
      "You may stop using the Service and delete your account at any time. We may suspend or terminate your access immediately, with or without notice, for breach of these Terms, suspected fraud or abuse, non-payment, or legal or regulatory requirement.",
      "On termination, your license ends and paid access ceases. Sections that by their nature survive \u2014 including intellectual property, disclaimers, limitation of liability, indemnification, and dispute resolution \u2014 continue to apply.",
    ],
  },
  {
    n: 33,
    title: "Dispute Resolution",
    body: [
      "The parties will first attempt to resolve any dispute informally by contacting Support@SOLIQintel.com and negotiating in good faith for at least thirty days.",
      "If the dispute is not resolved within that period, any dispute, claim, or controversy arising out of or relating to these Terms or the Services will be resolved exclusively by final and binding individual arbitration administered by the American Arbitration Association under its Consumer Arbitration Rules, before a single arbitrator, seated in Wilmington, Delaware, or conducted by videoconference or on documents only at your election where the rules allow. The Federal Arbitration Act governs the interpretation and enforcement of this section.",
      "Class-action waiver: all claims must be brought in the parties' individual capacity, and not as a plaintiff or class member in any purported class, collective, consolidated, or representative proceeding. The arbitrator may not consolidate claims or preside over any form of class or representative proceeding, and may award relief only in favor of the individual party seeking relief and only to the extent necessary to provide relief warranted by that party's individual claim.",
      "Jury-trial waiver: to the fullest extent permitted by law, each party knowingly and voluntarily waives any right to a trial by jury in any action arising out of or relating to these Terms or the Services.",
      "Exceptions: either party may bring an individual claim in small-claims court where jurisdiction and venue requirements are met, and either party may seek injunctive or other equitable relief in court to protect its intellectual property or to prevent unauthorized access to the Services. If the class-action waiver above is found unenforceable as to any claim or request for relief, that claim or request will be severed and heard in court, and the remainder of this section will continue to apply in arbitration.",
      "Opt-out: you may reject this arbitration agreement by sending written notice to Support@SOLIQintel.com within thirty days of first accepting these Terms, stating your name, the email on your account, and that you decline arbitration. Opting out does not affect any other part of these Terms.",
    ],
  },
  {
    n: 34,
    title: "Governing Law and Venue",
    body: [
      "These Terms are governed by the laws of the State of Delaware, without regard to its conflict-of-laws rules, and the parties submit to the exclusive jurisdiction of the state and federal courts located in New Castle County, Delaware, for any dispute not subject to the dispute-resolution section above.",
      "Nothing in this section limits mandatory consumer-protection rights you may hold under the laws of your place of residence.",

    ],
  },
  {
    n: 35,
    title: "General Terms",
    body: [
      "These Terms, together with the Privacy Policy and any plan-specific terms presented at checkout, are the entire agreement between the parties. If any provision is held unenforceable, the remainder stays in effect. Our failure to enforce a provision is not a waiver. You may not assign these Terms without our written consent; we may assign them in connection with a merger, acquisition, or sale of assets. Neither party is liable for delays caused by events beyond its reasonable control.",
      "We may update these Terms from time to time. Material changes will be posted with a revised effective date and, where required, notified to you. Continued use after the effective date constitutes acceptance.",
    ],
  },
  {
    n: 36,
    title: "Contact",
    body: [
      "BatCave Innovations, doing business as SOLIQ. Questions about these Terms, billing, or your account: Support@SOLIQintel.com.",
    ],
  },
];

function Terms() {
  return (
    <AppShell>
      <article className="mx-auto max-w-3xl pb-16">
        <header className="border-b border-border pb-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Legal</p>
          <h1 className="font-display mt-2 text-2xl font-bold lg:text-3xl">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            BatCave Innovations, doing business as SOLIQ. Effective and last updated {EFFECTIVE}.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            See also our{" "}
            <Link to="/support" className="text-primary">
              Support hub
            </Link>{" "}
            for billing help, and the{" "}
            <Link to="/pricing" className="text-primary">
              plan comparison
            </Link>
            .
          </p>
        </header>

        <nav aria-label="Sections" className="mt-6 grid gap-1 text-xs sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <a key={s.n} href={`#section-${s.n}`} className="text-muted-foreground transition-colors hover:text-primary">
              {s.n}. {s.title}
            </a>
          ))}
        </nav>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.n} id={`section-${s.n}`} className="scroll-mt-24">
              <h2 className="font-display text-base font-semibold">
                {s.n}. {s.title}
              </h2>
              {s.body.map((p, i) => (
                <p key={i} className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        <p className="mt-12 border-t border-border pt-6 text-[11px] leading-relaxed text-muted-foreground">
          Nothing on this page is legal advice. Sections 33 and 34 contain unresolved placeholders that require review
          by qualified counsel before launch.
        </p>
      </article>
    </AppShell>
  );
}
