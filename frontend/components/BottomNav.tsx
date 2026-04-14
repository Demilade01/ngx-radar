"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BarChart2, Bell, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/",        label: "Dashboard", icon: LayoutDashboard },
  { href: "/stocks",  label: "Stocks",    icon: BarChart2 },
  { href: "/alerts",  label: "Alerts",    icon: Bell },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md">
      <div className="flex items-stretch h-16 safe-area-pb">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={cn(
                "flex items-center justify-center w-8 h-8 rounded-xl transition-colors",
                active ? "bg-primary/15" : ""
              )}>
                <Icon size={18} strokeWidth={active ? 2.5 : 1.75} />
              </span>
              {label}
            </Link>
          );
        })}

        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-xl">
            <LogOut size={18} strokeWidth={1.75} />
          </span>
          Sign out
        </button>
      </div>
    </nav>
  );
}
