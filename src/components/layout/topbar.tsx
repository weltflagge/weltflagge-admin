"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, CircleHelp, Code2, Loader2, Megaphone, Search, X } from "lucide-react";

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
      setResults([]);
      setLoading(false);
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
      } catch (error) {
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
    <header className="sticky top-0 z-30 hidden border-b border-[#1f2024] bg-black/95 px-5 py-3 backdrop-blur-xl lg:block">
      <div className="flex items-center gap-4">
        <div ref={wrapperRef} className="relative min-w-0 flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="Search orders, customers, tracking, print files..."
            className="h-10 w-full rounded-xl border border-[#24262b] bg-[#18191b] pl-11 pr-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-[#0a84ff]/60 focus:ring-4 focus:ring-[#0a84ff]/10"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-zinc-500 transition hover:bg-[#24262b] hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {showResults ? (
            <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-[#24262b] bg-[#18191b] shadow-2xl shadow-black/40">
              <div className="border-b border-[#24262b] px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Global search
              </div>
              {loading ? (
                <div className="flex items-center gap-2 px-4 py-5 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin text-[#0a84ff]" />
                  Searching orders...
                </div>
              ) : results.length ? (
                <div className="max-h-[24rem] overflow-y-auto p-2">
                  {results.map((result) => (
                    <Link
                      key={result.id}
                      href={result.href}
                      onClick={() => setFocused(false)}
                      className="block rounded-lg px-3 py-3 transition hover:bg-[#24262b]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{result.title}</p>
                          <p className="mt-1 truncate text-xs text-zinc-500">{result.subtitle}</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {result.badges.slice(0, 3).map((badge) => (
                            <span key={`${result.id}-${badge}`} className="rounded-full border border-[#33363d] bg-black px-2 py-0.5 text-[11px] text-zinc-400">
                              {badge}
                            </span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-5 text-sm text-zinc-500">No matching orders, print files or tracking codes.</div>
              )}
            </div>
          ) : null}
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
