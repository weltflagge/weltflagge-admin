"use client";

import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { login } from "./actions";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(login, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />
      <div>
        <label htmlFor="username" className="text-sm font-medium text-slate-300">
          Username
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          required
          className="mt-2 h-11 w-full rounded-lg border border-[#27364f] bg-[#111827] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#465fff]/70 focus:ring-4 focus:ring-[#465fff]/10"
        />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium text-slate-300">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 h-11 w-full rounded-lg border border-[#27364f] bg-[#111827] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#465fff]/70 focus:ring-4 focus:ring-[#465fff]/10"
        />
      </div>
      {state.error ? (
        <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {state.error}
        </div>
      ) : null}
      <Button type="submit" disabled={pending} className="h-11 w-full rounded-lg bg-[#465fff] text-white hover:bg-[#5a70ff]">
        <LockKeyhole className="h-4 w-4" />
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
