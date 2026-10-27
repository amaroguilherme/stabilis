import type { Metadata } from "next";
import Link from "next/link";
import CrisisBar from "@/app/components/CrisisBar";
import Disclaimer from "@/app/components/Disclaimer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stabilis — apoio à decisão em saúde mental (experimental)",
  description:
    "Ferramenta experimental e educacional de apoio à decisão em saúde mental. Não substitui avaliação profissional e não é prescrição.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased">
        <CrisisBar />
        <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50 print:hidden">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
            <Link href="/" className="text-xl font-bold tracking-tight text-indigo-700 hover:text-indigo-800 transition-colors">
              Stabilis
            </Link>
            <span className="text-slate-300 select-none" aria-hidden="true">|</span>
            <span className="text-sm text-slate-600 font-medium flex-1 hidden sm:inline">
              Apoio à decisão — experimental
            </span>
            <span className="flex-1 sm:hidden" />
            <Link href="/ajuda-agora" className="text-sm text-rose-700 hover:text-rose-900 font-medium transition-colors">
              Ajuda agora
            </Link>
            <Link href="/about" className="text-sm text-slate-600 hover:text-indigo-700 font-medium transition-colors">
              Sobre
            </Link>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-2">
            <Disclaimer />
            <p className="text-sm text-slate-600">
              Em emergência: <a href="tel:192" className="font-semibold underline underline-offset-2">SAMU 192</a>
              {" · "}Apoio emocional 24h: <a href="tel:188" className="font-semibold underline underline-offset-2">CVV 188</a>
              {" · "}<Link href="/ajuda-agora" className="underline underline-offset-2">Ajuda agora</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
