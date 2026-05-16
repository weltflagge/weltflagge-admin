import type { Metadata } from "next";
import { Sidebar } from "@/src/components/layout/sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Weltflagge Admin",
  description: "Internal order management system for weltflagge.de",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[#070a12] text-slate-100">
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.82)_0%,rgba(7,10,18,1)_42%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_28%)]" />
        </div>
        <div className="relative flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1 p-4 md:p-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
