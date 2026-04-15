"use client";

import { useState } from "react";
import { Zap, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type State = "idle" | "loading" | "success" | "error";

export default function DetectNowButton() {
  const [state, setState] = useState<State>("idle");
  const [eventsFound, setEventsFound] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleDetect() {
    if (state === "loading") return;
    setState("loading");
    setEventsFound(null);
    setErrorMsg(null);

    try {
      const res = await fetch(`${BASE}/api/admin/detect-now`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setEventsFound(data.eventsDetected ?? 0);
      setState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    } finally {
      setTimeout(() => {
        setState("idle");
        setEventsFound(null);
        setErrorMsg(null);
      }, 5000);
    }
  }

  const configs = {
    idle: {
      icon: <Zap size={13} />,
      label: "Detect Now",
      cls: "bg-[#FF6D00]/10 border-[#FF6D00]/30 text-[#FF6D00] hover:bg-[#FF6D00]/20",
    },
    loading: {
      icon: <Loader2 size={13} className="animate-spin" />,
      label: "Running…",
      cls: "bg-muted border-border text-muted-foreground cursor-not-allowed",
    },
    success: {
      icon: <CheckCircle2 size={13} />,
      label: eventsFound === 0 ? "No anomalies" : `${eventsFound} event${eventsFound !== 1 ? "s" : ""} found`,
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
      onClick={handleDetect}
      disabled={state === "loading"}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${cls}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{state === "idle" ? "Detect" : label}</span>
    </button>
  );
}
