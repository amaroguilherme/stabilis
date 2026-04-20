import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stabilis — Drug Recommendation Engine",
  description: "Psychiatric drug recommendation engine for clinical use",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased">
        <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
            <Link href="/" className="text-xl font-bold tracking-tight text-indigo-700 hover:text-indigo-800 transition-colors">
              Stabilis
            </Link>
            <span className="text-slate-300 select-none">|</span>
            <span className="text-sm text-slate-500 font-medium flex-1">
              Motor de Recomendação Psiquiátrica
            </span>
            <Link href="/about" className="text-sm text-slate-500 hover:text-indigo-600 font-medium transition-colors">
              Sobre
            </Link>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
