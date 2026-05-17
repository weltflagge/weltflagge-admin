import { ShieldCheck } from "lucide-react";
import { sanitizeReturnPath } from "@/src/lib/auth-session";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = sanitizeReturnPath(params?.next);

  return (
    <main className="grid min-h-screen place-items-center bg-[#0f172a] px-4">
      <section className="w-full max-w-md rounded-xl border border-[#27364f] bg-[#172033] p-6 shadow-2xl shadow-black/30">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg border border-[#465fff]/35 bg-[#465fff]/15 text-[#aeb8ff]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#aeb8ff]">Weltflagge Admin</p>
            <h1 className="text-xl font-semibold text-white">Secure login</h1>
          </div>
        </div>
        <LoginForm nextPath={nextPath} />
      </section>
    </main>
  );
}
