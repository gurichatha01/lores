"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BrandWordmark } from "@/components/BrandWordmark";
import { narrativeFirstLine } from "@/lib/funnel";
import { getModePreset } from "@/lib/modePresets";
import { ReportBackdrop } from "@/components/report/ReportBackdrop";
import {
  loadRazorpayScript,
  openRazorpayCheckout,
  type RazorpayHandlerResponse,
} from "@/lib/razorpayCheckout";
import { AuthOverlay, type AuthMode } from "@/components/account/AuthOverlay";
import { useAccount } from "@/components/account/useAccount";
import { checkPendingPack, claimPack, spendCreditForReport } from "@/lib/authClient";
import { clearPendingPack, readPendingPack, stashPendingPack } from "@/lib/packPurchase";
import {
  buildModeStatCards,
  formatCount,
  formatNovelsComparison,
  formatParticipantTitle,
  formatSpanLabel,
} from "@/lib/reportPresentation";
import type { ReportSessionData } from "@/lib/types";

interface LockedReportProps {
  report: ReportSessionData;
  onUnlocked: () => void;
}

type UnlockStatus =
  | "idle"
  | "starting"
  | "checkout"
  | "verifying"
  | "cancelled"
  | "unavailable"
  | "error";

interface OrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  label: string;
  keyId: string;
  productType?: string;
  credits?: number;
}

interface PricingResponse {
  label: string;
  pack10?: { label?: string };
  packAvailable?: boolean;
}

export function LockedReport({ report, onUnlocked }: LockedReportProps) {
  const [status, setStatus] = useState<UnlockStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [priceDisplay, setPriceDisplay] = useState<string | null>(null);
  const [packLabel, setPackLabel] = useState<string | null>(null);
  const [packAvailable, setPackAvailable] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const account = useAccount();
  const { awards, content, stats } = report;
  const preset = getModePreset(report.mode);
  const soft = preset.treatment === "soft";
  const dark = preset.treatment === "dark";
  const names = formatParticipantTitle(stats.people);
  const cards = buildModeStatCards(report.mode, stats);
  const novelsComparison = formatNovelsComparison(stats.novelsEquivalent);
  const receipt = content.highlights[0];
  const busy = status === "starting" || status === "checkout" || status === "verifying";

  useEffect(() => {
    let active = true;
    fetch("/api/pricing")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        const quote = body as PricingResponse | null;
        if (!active || !quote) return;
        if (typeof quote.label === "string") setPriceDisplay(quote.label);
        if (typeof quote.pack10?.label === "string") setPackLabel(quote.pack10.label);
        setPackAvailable(quote.packAvailable === true);
      })
      .catch(() => {
        /* Price is a nicety on the button; failing to fetch it is non-fatal. */
      });
    return () => {
      active = false;
    };
  }, []);

  // Same-browser stranded-payment recovery: a buyer who paid for a pack but
  // closed the tab before finishing signup returns to the "claim your reports"
  // prompt automatically. The local stash only PROPOSES a payment id — it is
  // never sufficient on its own (it can be stale: already claimed on another
  // device, left over from an earlier session on this browser, or simply
  // unrelated to whatever the visitor is doing right now, e.g. signing out or
  // paying for an unrelated single report). The server must confirm the
  // payment id is a real, still-unclaimed pack before the prompt shows; if the
  // server says otherwise, the stash is cleared so it can never resurface.
  useEffect(() => {
    if (!account.configured || !account.ready) return;
    const paymentId = readPendingPack();
    if (!paymentId) return;

    let cancelled = false;
    void checkPendingPack(paymentId).then((result) => {
      if (cancelled) return;
      if (!result) return; // Couldn't reach the server — don't guess either way.
      if (!result.pending) {
        clearPendingPack();
        return;
      }
      if (!account.signedIn) {
        setAuthMode("signup");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [account.configured, account.ready, account.signedIn]);

  async function runVerify(
    response: RazorpayHandlerResponse,
    productType: "single" | "pack10",
  ): Promise<void> {
    setStatus("verifying");
    try {
      const verifyResponse = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(response),
      });
      const verifyBody = (await verifyResponse.json().catch(() => null)) as
        | { verified?: boolean; reportId?: string; productType?: string; paymentId?: string; error?: string }
        | null;
      if (verifyResponse.ok && verifyBody?.verified) {
        if (productType === "pack10" && verifyBody.productType === "pack10" && verifyBody.paymentId) {
          // The success screen IS the signup step — stash the payment id so the
          // credits can be claimed to the new account (and recovered on refresh).
          stashPendingPack(verifyBody.paymentId);
          setStatus("idle");
          setMessage(null);
          setAuthMode("signup");
          return;
        }
        if (productType === "single" && verifyBody.reportId === report.reportId) {
          onUnlocked();
          return;
        }
      }
      setStatus("error");
      setMessage(
        typeof verifyBody?.error === "string"
          ? verifyBody.error
          : "We couldn't verify that payment. If you were charged, nothing was unlocked. Please contact support.",
      );
    } catch {
      setStatus("error");
      setMessage("We couldn't reach the server to verify the payment. Please try again.");
    }
  }

  async function startCheckout(productType: "single" | "pack10"): Promise<void> {
    if (busy) return;
    setStatus("starting");
    setMessage(null);

    let order: OrderResponse;
    try {
      const orderResponse = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          productType === "single" ? { productType, reportId: report.reportId } : { productType },
        ),
      });
      if (orderResponse.status === 503) {
        setStatus("unavailable");
        setMessage("Payments aren't switched on yet · nothing was charged.");
        return;
      }
      if (orderResponse.status === 409) {
        setStatus("error");
        setMessage("This report session has expired. Regenerate it before checkout so we can unlock the right report.");
        return;
      }
      if (!orderResponse.ok) {
        setStatus("error");
        setMessage("We couldn't start checkout. Please try again.");
        return;
      }
      order = (await orderResponse.json()) as OrderResponse;
    } catch {
      setStatus("error");
      setMessage("We couldn't reach the server to start checkout. Please try again.");
      return;
    }

    const loaded = await loadRazorpayScript();
    if (!loaded) {
      setStatus("error");
      setMessage("We couldn't load the payment window. Check your connection and try again.");
      return;
    }

    setStatus("checkout");
    const opened = openRazorpayCheckout({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "lores_",
      description:
        productType === "pack10"
          ? "10-report pack · 10 unlocks bound to your account"
          : "Unlock the full report · PDF keepsake · Wrapped card",
      theme: { color: preset.accent },
      handler: (response) => {
        void runVerify(response, productType);
      },
      modal: {
        ondismiss: () => {
          setStatus((previous) => (previous === "checkout" ? "cancelled" : previous));
          setMessage((previous) =>
            previous ?? "Checkout closed · no charge. Your report is still here whenever you're ready.",
          );
        },
      },
    });

    if (!opened) {
      setStatus("error");
      setMessage("We couldn't open the payment window. Please try again.");
    }
  }

  /** Spends one pack credit to unlock the report currently being viewed. */
  async function unlockWithCredit(): Promise<void> {
    if (busy) return;
    setStatus("verifying");
    setMessage(null);
    const result = await spendCreditForReport(report.reportId);
    if (result.ok) {
      onUnlocked();
      return;
    }
    setStatus("error");
    setMessage(result.error ?? "We couldn't use a credit. Please try again.");
    await account.refresh();
  }

  /** After the pack success-screen signup/login: claim the pack, then unlock. */
  async function handleSignupAuthed(): Promise<void> {
    const paymentId = readPendingPack();
    if (paymentId) {
      const claim = await claimPack(paymentId);
      if (!claim.ok) {
        setAuthMode(null);
        setStatus("error");
        setMessage(claim.error ?? "We couldn't attach your reports. Please contact support with your payment id.");
        return;
      }
      clearPendingPack();
    }
    await account.refresh();
    setAuthMode(null);
    // Spend one of the freshly-claimed credits to unlock the report they bought against.
    const spend = await spendCreditForReport(report.reportId);
    if (spend.ok) {
      onUnlocked();
      return;
    }
    await account.refresh();
  }

  async function handleLoginAuthed(): Promise<void> {
    await account.refresh();
    setAuthMode(null);
  }

  const hasCredits = account.signedIn && (account.credits ?? 0) > 0;
  const singleLabel = busy
    ? status === "verifying"
      ? "working…"
      : "opening checkout…"
    : `unlock this report · ${priceDisplay ?? "₹99"}`;

  return (
    <ReportBackdrop accent={preset.accent} accentSoft={preset.accentSoft} background={dark ? "#080706" : "#dcdcd7"}>
      <article
        className={`relative mx-auto min-h-screen max-w-[430px] overflow-hidden px-6 pb-48 pt-6 shadow-editorial sm:min-h-0 sm:px-7 sm:pt-8 lg:max-w-[760px] lg:border-2 lg:px-12 lg:pt-12 ${soft ? "sm:rounded-[44px]" : "sm:rounded-[8px]"}`}
        style={{ background: preset.surface, borderColor: preset.border, color: preset.text }}
        data-report-state="teaser"
        data-report-mode={report.mode}
      >
        {dark ? <WarningTape accent={preset.accent} /> : null}
        <header className="flex items-center justify-between border-b-2 pb-2" style={{ borderColor: dark ? preset.border : preset.text }}>
          <div className="min-w-0 truncate font-mono text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: preset.accent }}>
            {preset.emoji} {report.subtype} · {names}
          </div>
          <Link href="/create" className="ml-3 shrink-0 font-mono text-[10px] font-bold" style={{ color: preset.muted }}>← new</Link>
        </header>

        <section className="mt-5" aria-labelledby="teaser-hero">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: preset.muted }}>total messages · {formatSpanLabel(stats.spanDays)}</p>
          <h1 id="teaser-hero" className="mt-2 text-[clamp(4.3rem,20vw,5.7rem)] font-black leading-[0.82] tracking-[-4px]" style={{ color: dark ? preset.accent : preset.text }}>{formatCount(stats.totalMessages)}</h1>
          <p className="mt-4 text-base font-semibold leading-[1.35]">
            {formatCount(stats.totalWords)} words
            {novelsComparison ? (
              <>
                {" · "}
                <span className="px-1.5" style={{ background: dark ? preset.accentSoft : "#ccff00" }}>
                  {novelsComparison}
                </span>
              </>
            ) : null}
          </p>
          <p className="mt-3 text-[15px] font-medium leading-relaxed" style={{ color: preset.muted }}>{content.heroLine}</p>
          <div className="mt-4 inline-block border-2 px-3 py-2 font-mono text-[10px] font-bold" style={{ background: preset.card, borderColor: preset.text }}>↓ free · your trailer</div>
        </section>

        <section className="relative mt-6" aria-label="Locked report statistics">
          <div className="pointer-events-none grid grid-cols-2 gap-2.5 blur-[6px] opacity-80" aria-hidden="true">
            {cards.map((card) => (
              <div key={card.label} className={`min-h-[112px] p-3 ${soft ? "rounded-[18px]" : dark ? "rounded-[10px]" : "border-2"}`} style={{ background: preset.card, border: `${soft || dark ? 1 : 2}px solid ${preset.border}` }}>
                <div className="font-mono text-[9px] font-bold uppercase" style={{ color: preset.muted }}>{card.label}</div>
                <div className="my-1 text-[29px] font-black leading-none tracking-[-1px]" style={{ color: preset.accent }}>{card.value}</div>
                <div className="text-[11px] font-semibold">{card.detail}</div>
              </div>
            ))}
          </div>
          <div className="absolute inset-x-0 top-5 flex flex-col items-center gap-11" aria-hidden="true">
            <LockPill>{cards.length} stat cards 🔒</LockPill>
            <LockPill>{awards.length} computed awards 🔒</LockPill>
          </div>
        </section>

        <section className="relative mt-5" aria-label="Locked report awards">
          <div className="pointer-events-none space-y-2 blur-[6px] opacity-75" aria-hidden="true">
            {awards.slice(0, 3).map((award, index) => (
              <div key={award.id} className={`flex items-center gap-3 px-4 py-3 ${soft ? "rounded-full" : dark ? "rounded-[10px]" : "border-2"}`} style={{ background: index === 1 ? preset.accent : preset.card, border: `${soft || dark ? 1 : 2}px solid ${index === 1 ? preset.accent : preset.border}`, color: index === 1 ? "#fff" : preset.text }}>
                <span>{award.emoji}</span><b className="text-[13px] uppercase">{award.label}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 border-2 border-dashed p-4 text-center" style={{ background: preset.card, borderColor: dark ? preset.border : preset.text }} aria-label="Locked receipt">
          <p className="text-[15px] font-bold leading-snug">we found one of your receipts 👀</p>
          <div className="mx-auto mt-3 w-fit max-w-[90%] rounded-[14px_14px_14px_3px] px-3 py-2 text-[13px] font-semibold text-white blur-[5px]" style={{ background: preset.accent }} aria-hidden="true">{receipt?.snippet.messages[0]?.text ?? receipt?.body ?? content.title}</div>
          <p className="mt-3 font-mono text-[10px] font-bold" style={{ color: preset.accent }}>🔒 unlock to read it</p>
        </section>

        <section className="mt-6" aria-labelledby="narrative-teaser-title">
          <p className="border-b-2 pb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: preset.accent, borderColor: preset.accent }}>{preset.storyLabel}</p>
          <h2 id="narrative-teaser-title" className="mt-4 text-[28px] font-black leading-none tracking-[-1px]">{content.title}</h2>
          <p className="mt-3 text-[15px] font-medium leading-[1.55]">{narrativeFirstLine(content.narrative)}</p>
          <div className="relative -mt-5 h-20" style={{ background: `linear-gradient(180deg, transparent 0%, ${preset.surface} 75%)` }} aria-hidden="true" />
        </section>

        {dark ? <WarningTape accent={preset.accent} /> : null}

        <aside className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t-2 border-ink bg-ink px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-4 text-white shadow-[0_-16px_30px_rgba(0,0,0,.18)] lg:max-w-[760px] lg:border-x-2 lg:px-8 lg:pb-5" aria-label="Unlock report">
          {account.signedIn ? (
            <div className="mb-2 flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-[0.08em] text-white/55">
              <span className="min-w-0 truncate">{account.email}</span>
              <span className="shrink-0">
                {typeof account.credits === "number" ? `${account.credits} of 10 left` : "…"}
                {" · "}
                <Link href="/account" className="underline">
                  account
                </Link>
                {" · "}
                <button type="button" onClick={() => void account.signOut()} className="underline">
                  log out
                </button>
              </span>
            </div>
          ) : null}

          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xl font-black tracking-[-0.5px]">
                {hasCredits ? "unlock this report" : "unlock the full lores"}
              </p>
              <p className="mt-1 font-mono text-[9px] leading-relaxed text-white/55">full report · PDF keepsake · Wrapped card</p>
            </div>
            <BrandWordmark
              accent={preset.accent}
              contrastPlate
              className="text-xl font-black tracking-[-0.5px]"
            />
          </div>

          {hasCredits ? (
            <button
              type="button"
              onClick={() => void unlockWithCredit()}
              disabled={busy}
              aria-busy={busy}
              className={`mt-3 min-h-[52px] w-full px-4 py-3 text-[14px] font-extrabold uppercase text-white disabled:opacity-60 ${soft ? "rounded-full" : "rounded-[3px]"}`}
              style={{ background: preset.accent }}
            >
              {busy ? "unlocking…" : `use 1 credit · ${account.credits} left`}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void startCheckout("single")}
                disabled={busy}
                aria-busy={busy}
                className={`mt-3 min-h-[52px] w-full px-4 py-3 text-[14px] font-extrabold uppercase text-white disabled:opacity-60 ${soft ? "rounded-full" : "rounded-[3px]"}`}
                style={{ background: preset.accent }}
              >
                {singleLabel}
              </button>
              {packAvailable ? (
                <button
                  type="button"
                  onClick={() => void startCheckout("pack10")}
                  disabled={busy}
                  className={`mt-2 min-h-[44px] w-full border-2 border-white/30 bg-transparent px-4 text-[12px] font-extrabold uppercase text-white disabled:opacity-60 ${soft ? "rounded-full" : "rounded-[3px]"}`}
                >
                  or 10 reports for {packLabel ?? "₹499"} →
                </button>
              ) : null}
              {account.configured && packAvailable ? (
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  disabled={busy}
                  className="mt-2 w-full text-center font-mono text-[9px] uppercase tracking-[0.08em] text-white/45 underline disabled:opacity-60"
                >
                  already have a pack? log in
                </button>
              ) : null}
            </>
          )}

          {message ? (
            <p
              role="status"
              className={`mt-2 text-center font-mono text-[9px] uppercase ${status === "error" ? "text-roast" : "text-acid"}`}
            >
              {message}
            </p>
          ) : null}
        </aside>
      </article>

      {authMode ? (
        <AuthOverlay
          mode={authMode}
          accent={preset.accent}
          headline={authMode === "signup" ? "You've got 10 reports." : "Log in to your pack."}
          subhead={
            authMode === "signup"
              ? "Create your account to unlock them — starting with this one."
              : "Use a credit to unlock this report."
          }
          busyLabel="setting up…"
          onClose={() => setAuthMode(null)}
          onAuthed={authMode === "signup" ? handleSignupAuthed : handleLoginAuthed}
        />
      ) : null}
    </ReportBackdrop>
  );
}

function LockPill({ children }: { children: React.ReactNode }) {
  return <div className="bg-ink px-3 py-2 font-mono text-[10px] font-bold text-white">{children}</div>;
}

function WarningTape({ accent }: { accent: string }) {
  return <div aria-hidden="true" className="-mx-7 mb-6 h-3" style={{ background: `repeating-linear-gradient(135deg, ${accent} 0 14px, #090909 14px 28px)` }} />;
}
