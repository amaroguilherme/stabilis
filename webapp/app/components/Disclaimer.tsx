export default function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-slate-600 ${className}`}>
      <strong className="font-semibold text-slate-800">Ferramenta experimental e educacional.</strong>{" "}
      Não substitui a avaliação de um profissional de saúde e não é prescrição. As regras ainda não
      passaram por validação clínica.
    </p>
  );
}
