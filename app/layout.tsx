import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Sidebar } from "@/src/components/layout/sidebar";
import { Topbar } from "@/src/components/layout/topbar";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/src/lib/auth-session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Weltflagge Admin",
  description: "Internal order management system for weltflagge.de",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const isAuthenticated = verifySessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);

  return (
    <html lang="en" className="h-full dark antialiased">
      <body className="min-h-full bg-[#0f172a] text-slate-100">
        {isAuthenticated ? (
          <div className="flex min-h-screen bg-[#0f172a]">
            <Sidebar />
            <div className="min-w-0 flex-1">
              <Topbar />
              <main className="px-4 py-6 md:px-8 lg:px-10">
                <div className="mx-auto max-w-[90rem]">{children}</div>
              </main>
            </div>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
