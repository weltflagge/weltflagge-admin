"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  Database,
  Factory,
  Grid3X3,
  Inbox,
  PackageSearch,
  Settings,
  Sparkles,
  Wand2,
} from "lucide-react";

const sections = [
  {
    label: "Main Menu",
    items: [
      { label: "Dashboard", href: "/", icon: BarChart3 },
      { label: "Orders", href: "/orders", icon: Inbox },
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
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-[#1f2024] bg-black p-4 lg:block">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg border border-[#24262b] bg-[#050505] text-zinc-300">
          <Grid3X3 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-base font-semibold tracking-tight text-white">Weltflagge</p>
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          </div>
          <p className="text-xs font-medium text-zinc-500">Admin System</p>
        </div>
      </div>

      <nav className="mt-8 space-y-7">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">{section.label}</p>
            <div className="space-y-1.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const className = `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-[#0a84ff]/25 text-white ring-1 ring-[#0a84ff]/35"
                    : "text-zinc-400 hover:bg-[#18191b] hover:text-zinc-100"
                } ${item.disabled ? "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-zinc-400" : ""}`;

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
        <div className="rounded-xl border border-[#24262b] bg-[#18191b] p-4">
          <div className="flex items-center gap-2 text-zinc-200">
            <Database className="h-4 w-4 text-[#0a84ff]" />
            <p className="text-sm font-semibold">Live database</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Orders stay searchable after shipping and can be reopened when production needs another run.
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between px-2 text-zinc-500">
          <Settings className="h-4 w-4" />
          <Wand2 className="h-4 w-4" />
          <div className="h-6 w-6 rounded-full border border-[#24262b] bg-[#18191b]" />
        </div>
      </div>
    </aside>
  );
}
