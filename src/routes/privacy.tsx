import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/soliq/AppShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | SOLIQ by BatCave Innovations" },
      {
        name: "description",
        content:
          "How SOLIQ collects and uses data: account details, usage logs, wallet public addresses, brokerage and bank connection data, subscription information handled by our payment processor, community content and AI interactions.",
      },
      { property: "og:title", content: "SOLIQ Privacy Policy" },
      {
        property: "og:description",
        content: "What data SOLIQ collects, why it is processed, who processes it, and the choices you have.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "https://soliqintel.com/privacy" }],
  }),
  component: Privacy,
});

const EFFECTIVE = "August 17, 2026";

type Section = { n: number; title: string; body: string[] };

const SECTIONS: Section[] = [
  {
    n: 1,
    title: "Scope",
    body: [
      "This Privacy Policy describes how BatCave Innovations, doing business as SOLIQ (\u201cSOLIQ\u201d, \u201cwe\u201d, \u201cus\u201d), handles personal data in connection with the SOLIQ website, applications, and related services (the \u201cService\u201d). It forms part of, and should be read together with, our Terms of Service.",
      "This page describes the practices of the Service as it is currently built. Where a practice depends on a feature you never use \u2014 for example a wallet, brokerage, or bank connection \u2014 the related data is simply not collected.",
    ],
  },
  {
    n: 2,
    title: "Account Data",
    body: [
      "When you create an account we process your email address, authentication identifiers, and, if you sign in with Google or Apple, the basic profile identifiers those providers return. Optional profile details you choose to add \u2014 display name, handle, avatar, and bio \u2014 are also stored.",
      "Passwords are handled by our authentication provider and are not visible to us in plain text.",
    ],
  },
  {
    n: 3,
    title: "Usage, Device, and Log Data",
    body: [
      "Our infrastructure and error-reporting layers record technical information such as IP address, browser and device characteristics, timestamps, requested routes, and error diagnostics. This data is used to operate, secure, debug, and improve the Service.",
      "We do not sell this data. Retention periods follow what is needed for security, debugging, and legal obligations.",
    ],
  },
  {
    n: 4,
    title: "Preferences, Watchlists, and Alerts",
    body: [
      "Watchlists, alert rules, notification preferences, appearance settings, journal entries, and similar in-app configuration are stored against your account so the Service works consistently across your devices.",
      "If you enable browser notifications, the permission is granted by your browser and can be revoked there at any time.",
    ],
  },
  {
    n: 5,
    title: "Wallet Data",
    body: [
      "If you connect a self-custodial wallet, we store the public address you connect and read publicly available on-chain information associated with it \u2014 balances, token holdings, and transaction history \u2014 in order to display your holdings, ledger, and performance.",
      "SOLIQ does not have custody of your funds and does not obtain your private keys or seed phrase. If you choose an action that requires a wallet signature, that transaction is presented for your explicit review and authorization inside your own wallet.",
    ],
  },
  {
    n: 6,
    title: "Brokerage and Bank Connection Data",
    body: [
      "Brokerage and bank connections are established through third-party aggregation providers. When you connect an account, those providers handle the credential flow and return account information such as balances, positions, cost basis, performance, and transaction history, which we process to display your aggregated portfolio.",
      "Access tokens for connected accounts are held server-side under restricted access and are not exposed to the browser. You can disconnect an account at any time from the relevant page in the app.",
    ],
  },
  {
    n: 7,
    title: "Subscription and Payment Information",
    body: [
      "Paid plans are processed by our payment processor, Stripe. Card details are collected and stored by Stripe, not by SOLIQ. We receive and store the subscription record required to run entitlements \u2014 identifiers, plan and price references, status, and billing period dates.",
      "Invoices, receipts, payment methods, and cancellation are managed through the billing portal linked in the app.",
    ],
  },
  {
    n: 8,
    title: "Community Content",
    body: [
      "Posts and other content you publish in community features, along with the profile details attached to them, are visible to other signed-in members. Do not post information you do not want other members to see.",
    ],
  },
  {
    n: 9,
    title: "AI Interactions",
    body: [
      "When you use AI features, the prompts you submit and the relevant account context needed to answer \u2014 such as your plan, connection status, and the symbols or portfolio data in view \u2014 are sent to the AI model provider that generates the response.",
      "Do not submit credentials, private keys, seed phrases, or sensitive personal information into AI features.",
    ],
  },
  {
    n: 10,
    title: "Market and Third-Party Data Providers",
    body: [
      "The Service queries third-party market, on-chain, options, flow, and reference data providers to render prices, charts, screens, and research. These requests are made to support the views you open in the app and are governed by the providers' own terms.",
    ],
  },
  {
    n: 11,
    title: "How We Use Data",
    body: [
      "We process the data described above to provide and maintain the Service, authenticate you, run plan entitlements and billing, deliver alerts and notifications you configure, display portfolio and on-chain information, operate community and AI features, provide support, and to secure, debug, and improve the platform.",
    ],
  },
  {
    n: 12,
    title: "Sharing and Processors",
    body: [
      "We share personal data with service providers who process it on our behalf \u2014 hosting and database infrastructure, authentication, our payment processor, market and on-chain data providers, brokerage and bank aggregators, AI model providers, and error monitoring \u2014 in each case limited to what the feature requires.",
      "We may also disclose data where required by law or legal process, or to protect the rights, safety, and security of SOLIQ, our users, or the public. We do not sell personal data.",
    ],
  },
  {
    n: 13,
    title: "Retention",
    body: [
      "We retain personal data for as long as your account is active and thereafter only as needed to meet legal, accounting, security, and dispute-resolution requirements. Aggregated or de-identified data that no longer identifies you may be retained.",
    ],
  },
  {
    n: 14,
    title: "Security",
    body: [
      "We apply commercially reasonable technical and organizational measures, including access controls on database rows and server-side handling of connection tokens. No system is perfectly secure. You are responsible for using a strong unique password and for keeping your devices and wallet software secure.",
    ],
  },
  {
    n: 15,
    title: "Your Choices",
    body: [
      "You can update or remove profile details, disconnect wallets, brokerage accounts, and bank accounts, adjust or disable alerts and notifications, cancel a paid plan from the billing portal, and delete your account.",
      "To request a copy of your data, correction, or deletion, contact Support@SOLIQintel.com from the email address on your account. Depending on where you live, you may have additional rights under local data-protection law; we will honor applicable requests.",
    ],
  },
  {
    n: 16,
    title: "Children",
    body: [
      "The Service is not intended for anyone under 18, and we do not knowingly collect personal data from children. If you believe a minor has created an account, contact us and we will remove it.",
    ],
  },
  {
    n: 17,
    title: "International Transfers",
    body: [
      "Our infrastructure and service providers may process data in countries other than your own. Where such transfers occur, we rely on the protections our providers make available for cross-border processing.",
    ],
  },
  {
    n: 18,
    title: "Changes to This Policy",
    body: [
      "We may update this Policy. Material changes will be posted here with a revised effective date and, where required, notified to you. Continued use after the effective date constitutes acceptance.",
    ],
  },
  {
    n: 19,
    title: "Contact",
    body: [
      "BatCave Innovations, doing business as SOLIQ. Privacy questions, data requests, and complaints: Support@SOLIQintel.com.",
    ],
  },
];

function Privacy() {
  return (
    <AppShell>
      <article className="mx-auto max-w-3xl pb-16">
        <header className="border-b border-border pb-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Legal</p>
          <h1 className="font-display mt-2 text-2xl font-bold lg:text-3xl">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            BatCave Innovations, doing business as SOLIQ. Effective and last updated {EFFECTIVE}.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            See also our{" "}
            <Link to="/terms" className="text-primary">
              Terms of Service
            </Link>{" "}
            and the{" "}
            <Link to="/support" className="text-primary">
              Support hub
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
          This page describes current product behavior and is not legal advice.
        </p>
      </article>
    </AppShell>
  );
}
