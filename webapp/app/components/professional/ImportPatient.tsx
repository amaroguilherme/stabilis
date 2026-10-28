"use client";

import { useId, useState } from "react";
import { knowledgeBase } from "@/app/lib/kb";
import { parsePatientExport, toProfessionalCase, type ImportedCase } from "@/app/lib/patient/import";

// "Importar respostas do paciente": reads the file exported in the patient journey, locally.
export default function ImportPatient({ onImport }: { onImport: (imported: ImportedCase) => void }) {
  const id = useId();
  const [message, setMessage] = useState<{ kind: "error" | "warning" | "ok"; text: string; notes?: string[] } | null>(null);

  async function read(file: File | undefined) {
    if (!file) return;
    if (file.size > 256 * 1024) {
      setMessage({ kind: "error", text: "Arquivo grande demais para ser um arquivo de respostas do Stabilis." });
      return;
    }
    const result = await parsePatientExport(await file.text());
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    const imported = toProfessionalCase(knowledgeBase.data, result.file);
    onImport(imported);
    setMessage({
      kind: result.checksumOk ? "ok" : "warning",
      text: result.checksumOk
        ? `Respostas importadas (exportadas em ${new Date(result.file.exported_at).toLocaleDateString("pt-BR")}). Revise todos os campos antes de continuar.`
        : "Atenção: o arquivo foi alterado depois de exportado. Os dados foram carregados, mas confira tudo com a pessoa.",
      notes: imported.notes,
    });
  }

  const styles = { error: "border-rose-300 bg-rose-50 text-rose-900", warning: "border-amber-300 bg-amber-50 text-amber-950", ok: "border-emerald-300 bg-emerald-50 text-emerald-950" };
  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">Arquivo de respostas exportado pela pessoa (stabilis-respostas.json)</label>
      <input id={id} type="file" accept="application/json,.json" onChange={(e) => read(e.target.files?.[0])} className="block w-full text-sm text-slate-700 file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:font-semibold file:text-indigo-800" />
      <p className="text-xs text-slate-600">O arquivo é lido no seu navegador; nada é enviado.</p>
      {message && (
        <div role={message.kind === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${styles[message.kind]}`}>
          <p>{message.text}</p>
          {message.notes && message.notes.length > 0 && <ul className="mt-1 list-disc pl-5">{message.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}
