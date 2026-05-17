"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, CircleHelp, Code2, Loader2, LogOut, Menu, Moon, Search, X } from "lucide-react";

type SearchResult = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  badges: string[];
};

export function Topbar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const showResults = focused && query.trim().length >= 2;

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { results?: SearchResult[] };
        setResults(data.results ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setFocused(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <header className="sticky top-0 z-30 hidden border-b border-[#1f2a3d] bg-[#111827]/95 px-5 py-3 backdrop-blur-xl lg:block">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            aria-label="Toggle sidebar"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#27364f] bg-[#172033] text-slate-400 transition hover:border-[#465fff]/40 hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </button>
        <div ref={wrapperRef} className="relative w-full max-w-[27rem]">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="Search or type command..."
            className="h-10 w-full rounded-lg border border-[#27364f] bg-[#172033] pl-11 pr-14 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-[#465fff]/70 focus:ring-4 focus:ring-[#465fff]/10"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md bg-[#22304a] px-2 py-0.5 text-xs font-medium text-slate-400 xl:block">
            ⌘K
          </span>
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-slate-500 transition hover:bg-[#27364f] hover:text-slate-200 xl:right-11"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {showResults ? (
            <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-[#27364f] bg-[#172033] shadow-2xl shadow-black/40">
              <div className="border-b border-[#27364f] px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Global search
              </div>
              {loading ? (
                <div className="flex items-center gap-2 px-4 py-5 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin text-[#8095ff]" />
                  Searching orders...
                </div>
              ) : results.length ? (
                <div className="max-h-[24rem] overflow-y-auto p-2">
                  {results.map((result) => (
                    <Link
                      key={result.id}
                      href={result.href}
                      onClick={() => setFocused(false)}
                      className="block rounded-lg px-3 py-3 transition hover:bg-[#22304a]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{result.title}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">{result.subtitle}</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {result.badges.slice(0, 3).map((badge) => (
                            <span key={`${result.id}-${badge}`} className="rounded-full border border-[#27364f] bg-[#111827] px-2 py-0.5 text-[11px] text-slate-400">
                              {badge}
                            </span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-5 text-sm text-slate-500">No matching orders, print files or tracking codes.</div>
              )}
            </div>
          ) : null}
        </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-slate-400">
          <button type="button" aria-label="Theme" className="grid h-10 w-10 place-items-center rounded-full border border-[#27364f] bg-[#172033] transition hover:border-[#465fff]/40 hover:text-white">
            <Moon className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-full border border-[#27364f] bg-[#172033] transition hover:border-[#465fff]/40 hover:text-white">
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#ff8a00]" />
          </button>
          <button type="button" aria-label="Help" className="grid h-10 w-10 place-items-center rounded-full border border-[#27364f] bg-[#172033] transition hover:border-[#465fff]/40 hover:text-white">
            <CircleHelp className="h-4 w-4" />
          </button>
          <button type="button" aria-label="GitHub" className="grid h-10 w-10 place-items-center rounded-full border border-[#27364f] bg-[#172033] transition hover:border-[#465fff]/40 hover:text-white">
            <Code2 className="h-4 w-4" />
          </button>
          <form action="/logout" method="post">
            <button type="submit" aria-label="Log out" className="grid h-10 w-10 place-items-center rounded-full border border-[#27364f] bg-[#172033] transition hover:border-[#465fff]/40 hover:text-white">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
          <div className="ml-1 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full border border-[#27364f] bg-[linear-gradient(135deg,#2d3a55,#6678ff)]" />
            <div className="hidden xl:block">
              <p className="text-sm font-semibold text-white">Weltflagge</p>
              <p className="text-xs text-slate-500">Admin</p>
            </div>
            <ChevronDownIcon />
          </div>
        </div>
      </div>
    </header>
  );
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" className="hidden h-4 w-4 text-slate-500 xl:block" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
