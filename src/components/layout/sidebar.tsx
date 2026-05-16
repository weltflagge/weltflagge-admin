"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  Database,
  Factory,
  Inbox,
  PackageSearch,
  Settings,
  Sparkles,
  SquareKanban,
  Wand2,
} from "lucide-react";

const sections = [
  {
    label: "Main Menu",
    items: [
      { label: "Dashboard", href: "/", icon: BarChart3 },
      { label: "Orders", href: "/orders", icon: Inbox },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Production", href: "/production", icon: Factory },
      { label: "Imports", href: "/imports", icon: PackageSearch },
    ],
  },
  {
    label: "General",
    items: [
      { label: "Automations", href: "/automations", icon: Sparkles, disabled: true },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-[17.5rem] shrink-0 overflow-y-auto border-r border-[#1f2a3d] bg-[#111827] px-4 py-5 lg:block">
      <div className="flex items-center gap-3 px-1">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#465fff] text-white shadow-lg shadow-[#465fff]/20">
          <SquareKanban className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-lg font-semibold tracking-tight text-white">Weltflagge</p>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </div>
          <p className="text-xs font-medium text-slate-500">Order Admin</p>
        </div>
      </div>

      <nav className="mt-8 space-y-6 pb-36">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{section.label}</p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const className = `group flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-[#1d2b53] text-[#8095ff] ring-1 ring-[#465fff]/20"
                    : "text-slate-300 hover:bg-[#1a2335] hover:text-white"
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
            </div>
          </div>
        ))}
      </nav>

      <div className="absolute bottom-4 left-4 right-4">
        <div className="rounded-xl border border-[#27364f] bg-[#172033] p-4">
          <div className="flex items-center gap-2 text-slate-100">
            <Database className="h-4 w-4 text-[#8095ff]" />
            <p className="text-sm font-semibold">Live database</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Orders stay searchable after shipping and can be reopened when production needs another run.
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between px-2 text-slate-500">
          <Settings className="h-4 w-4" />
          <Wand2 className="h-4 w-4" />
          <div className="h-6 w-6 rounded-full border border-[#27364f] bg-[#172033]" />
        </div>
      </div>
    </aside>
  );
}
