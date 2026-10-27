import Link from "next/link";

// Shown on every page. Server component: works without JavaScript.
export default function CrisisBar() {
  return (
    <aside aria-label="Ajuda imediata" className="bg-rose-50 border-b border-rose-200 text-rose-950 print:hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">Pensando em se machucar ou em crise?</span>
        <span>
          <a href="tel:188" className="font-semibold underline underline-offset-2">CVV 188</a> (24h, gratuito)
        </span>
        <span aria-hidden="true">·</span>
        <a href="tel:192" className="font-semibold underline underline-offset-2">SAMU 192</a>
        <span aria-hidden="true">·</span>
        <span>UPA ou pronto-socorro</span>
        <Link href="/ajuda-agora" className="sm:ml-auto underline underline-offset-2">
          Mais formas de ajuda
        </Link>
      </div>
    </aside>
  );
}
