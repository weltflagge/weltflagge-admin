"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Factory, Inbox, PackageSearch, Settings, Sparkles, Wand2 } from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/", icon: BarChart3 },
  { label: "Orders", href: "/orders", icon: Inbox },
  { label: "Imports", href: "/imports", icon: PackageSearch },
  { label: "Production", href: "/production", icon: Factory },
  { label: "Automations", href: "/automations", icon: Sparkles, disabled: true },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-slate-800/80 bg-slate-950/70 p-5 backdrop-blur-xl lg:block">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
          <Wand2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-semibold tracking-tight text-white">Weltflagge</p>
          <p className="text-xs text-slate-500">Order Management</p>
        </div>
      </div>

      <nav className="mt-10 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const className = `flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
            active
              ? "border border-cyan-300/20 bg-slate-900 text-white"
              : "text-slate-400 hover:bg-slate-900/70 hover:text-white"
          } ${item.disabled ? "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-slate-400" : ""}`;

          if (item.disabled) {
            return (
              <span key={item.href} className={className}>
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
            );
          }

          return (
            <Link key={item.href} href={item.href} className={className}>
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-5 left-5 right-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center gap-2 text-slate-200">
          <Sparkles className="h-4 w-4" />
          <p className="text-sm font-medium">System blueprint</p>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          WooCommerce, eBay and E-Mail integrations will connect after the order workflow is stable.
        </p>
      </div>
    </aside>
  );
}
