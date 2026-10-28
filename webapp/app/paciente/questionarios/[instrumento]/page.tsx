import { notFound } from "next/navigation";
import { knowledgeBase } from "@/app/lib/kb";
import { questionnaires } from "@/app/lib/patient/flow";
import Questionnaire from "./Questionnaire";

export function generateStaticParams() {
  return questionnaires(knowledgeBase.data).map((i) => ({ instrumento: i.id }));
}

export const dynamicParams = false;

export default async function QuestionnairePage({ params }: { params: Promise<{ instrumento: string }> }) {
  const { instrumento } = await params;
  if (!questionnaires(knowledgeBase.data).some((i) => i.id === instrumento)) notFound();
  return <Questionnaire id={instrumento} />;
}
