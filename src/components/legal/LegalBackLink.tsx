"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Explicit "back" control for the legal pages. Uses browser history so a
 * visitor who opened a policy from checkout (or anywhere) returns exactly
 * where they were; falls back to the home page when there's no history to go
 * back to (e.g. the page was opened directly in a fresh tab).
 */
export function LegalBackLink() {
  const router = useRouter();

  function goBack(): void {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink/55 transition-colors hover:text-pink"
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" strokeWidth={2.5} />
      back
    </button>
  );
}
