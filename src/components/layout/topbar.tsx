import { Bell, CircleHelp, Code2, Megaphone, Search } from "lucide-react";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 hidden border-b border-[#1f2024] bg-black/95 px-5 py-3 backdrop-blur-xl lg:block">
      <div className="flex items-center gap-4">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            placeholder="Search orders, customers, tracking..."
            className="h-10 w-full rounded-xl border border-[#24262b] bg-[#18191b] pl-11 pr-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-[#0a84ff]/60 focus:ring-4 focus:ring-[#0a84ff]/10"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2 text-zinc-400">
          <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium transition hover:bg-[#18191b] hover:text-zinc-100">
            <Megaphone className="h-4 w-4" />
            Feedback?
          </button>
          <button type="button" aria-label="Notifications" className="relative grid h-9 w-9 place-items-center rounded-lg transition hover:bg-[#18191b] hover:text-zinc-100">
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#ff2d55]" />
          </button>
          <button type="button" aria-label="Help" className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-[#18191b] hover:text-zinc-100">
            <CircleHelp className="h-4 w-4" />
          </button>
          <button type="button" aria-label="GitHub" className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-[#18191b] hover:text-zinc-100">
            <Code2 className="h-4 w-4" />
          </button>
          <div className="ml-1 h-9 w-9 rounded-full border border-[#33363d] bg-[#18191b]" />
        </div>
      </div>
    </header>
  );
}
