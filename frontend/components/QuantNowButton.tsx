"use client";

import { useState } from "react";
import { BarChart2, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type State = "idle" | "loading" | "success" | "error";

export default function QuantNowButton() {
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<{ updated: number; skipped: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleCompute() {
    if (state === "loading") return;
    setState("loading");
    setResult(null);
    setErrorMsg(null);

    try {
      const res = await fetch(`${BASE}/api/admin/quant-now`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setResult({ updated: data.updated ?? 0, skipped: data.skipped ?? 0 });
      setState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    } finally {
      setTimeout(() => {
        setState("idle");
        setResult(null);
        setErrorMsg(null);
      }, 6000);
    }
  }

  const configs: Record<State, { icon: React.ReactNode; label: string; cls: string }> = {
    idle: {
      icon: <BarChart2 size={13} />,
      label: "Compute Signals",
      cls: "bg-[#FFD600]/10 border-[#FFD600]/30 text-[#FFD600] hover:bg-[#FFD600]/20",
    },
    loading: {
      icon: <Loader2 size={13} className="animate-spin" />,
      label: "Computing…",
      cls: "bg-muted border-border text-muted-foreground cursor-not-allowed",
    },
    success: {
      icon: <CheckCircle2 size={13} />,
      label: result
        ? `${result.updated} updated, ${result.skipped} skipped`
        : "Done",
      cls: "bg-[#00E676]/10 border-[#00E676]/30 text-[#00E676]",
    },
    error: {
      icon: <AlertCircle size={13} />,
      label: errorMsg ?? "Failed",
      cls: "bg-[#FF1744]/10 border-[#FF1744]/30 text-[#FF1744]",
    },
  };

  const { icon, label, cls } = configs[state];

  return (
    <button
      onClick={handleCompute}
      disabled={state === "loading"}
      title="Run QuantScore computation for all stocks now"
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${cls}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">
        {state === "idle" ? <RefreshCw size={13} /> : label}
      </span>
    </button>
  );
}
