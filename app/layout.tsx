import type { Metadata } from "next";
import { Sidebar } from "@/src/components/layout/sidebar";
import { Topbar } from "@/src/components/layout/topbar";
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
    <html lang="en" className="h-full dark antialiased">
      <body className="min-h-full bg-black text-zinc-100">
        <div className="flex min-h-screen bg-black">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <Topbar />
            <main className="px-4 py-6 md:px-8 lg:px-10">
              <div className="mx-auto max-w-[108rem]">{children}</div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
