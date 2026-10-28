import { notFound } from "next/navigation";
import { knowledgeBase } from "@/app/lib/kb";
import { questionnaires } from "@/app/lib/patient/flow";
import TrackingQuestionnaire from "./TrackingQuestionnaire";

const tracked = () => questionnaires(knowledgeBase.data).filter((i) => knowledgeBase.data.tracking?.instruments.includes(i.id));

export function generateStaticParams() {
  return tracked().map((i) => ({ instrumento: i.id }));
}

export const dynamicParams = false;

export default async function TrackingQuestionnairePage({ params }: { params: Promise<{ instrumento: string }> }) {
  const { instrumento } = await params;
  if (!tracked().some((i) => i.id === instrumento)) notFound();
  return <TrackingQuestionnaire id={instrumento} />;
}
