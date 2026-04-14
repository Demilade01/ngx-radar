"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, Bell, LayoutDashboard, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/stocks", label: "Stocks", icon: BarChart2 },
  { href: "/alerts", label: "Alerts", icon: Bell },
];

interface NavbarProps {
  marketOpen?: boolean;
  watTime?: string;
}

export default function Navbar({ marketOpen, watTime }: NavbarProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="max-w-screen-xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
        {/* Logo + wordmark */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img
            src="/logo.jpg"
            alt="Ngix"
            width={0}
            height={0}
            sizes="100vw"
            style={{ height: 30, width: "auto" }}
          />
          <div className="leading-none">
            <span className="text-base font-bold text-foreground tracking-tight">Ngix</span>
            <span className="hidden sm:block text-[10px] text-muted-foreground -mt-0.5 tracking-widest uppercase">
              NGX Intelligence
            </span>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-0.5 sm:gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Market status pill — sm+ only */}
          {watTime !== undefined && (
            <div
              className={cn(
                "hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
                marketOpen
                  ? "bg-[#00E676]/10 border-[#00E676]/30 text-[#00E676]"
                  : "bg-muted border-border text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  marketOpen ? "bg-[#00E676] animate-pulse" : "bg-muted-foreground"
                )}
              />
              {marketOpen ? "OPEN" : "CLOSED"}
              <span className="text-muted-foreground font-normal ml-0.5">{watTime}</span>
            </div>
          )}

          {/* Market dot — mobile only */}
          {watTime !== undefined && (
            <span
              className={cn(
                "sm:hidden w-2 h-2 rounded-full shrink-0",
                marketOpen ? "bg-[#00E676] animate-pulse" : "bg-muted-foreground"
              )}
            />
          )}

          {/* Sign out */}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
