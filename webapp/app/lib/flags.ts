// Build-time switches, set as environment variables on Vercel. Everything is off unless set.

/** Language-model suggestions in the patient journey: only after a model passes the promotion gates (eval/README.md). */
export const PATIENT_SUGGESTIONS = process.env.NEXT_PUBLIC_PATIENT_SUGGESTIONS === "on";

/**
 * "Extrair do texto" in the professional form: sends the anamnesis to the server outside Brazil. Off
 * until a legal mechanism for that international transfer is chosen (docs/lgpd/ripd.md, R3b): the
 * data subject is the patient, so the professional's click is not the patient's consent.
 */
export const PROFESSIONAL_EXTRACTION = process.env.NEXT_PUBLIC_PROFESSIONAL_EXTRACTION === "on";
