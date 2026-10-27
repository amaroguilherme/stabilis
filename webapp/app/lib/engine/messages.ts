import type { KnowledgeBaseData, Message } from "./types.ts";

export type Variant = "plain" | "clinical";

/** Renders a message from i18n/pt-BR.json. Falls back to the clinical text when there is no plain one. */
export function renderMessage(kb: KnowledgeBaseData, message: Message, variant: Variant): string {
  const entry = kb.messages[message.key];
  if (!entry) return message.key;
  const template = (variant === "plain" ? entry.plain : undefined) ?? entry.clinical;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => message.params[name] ?? match);
}
