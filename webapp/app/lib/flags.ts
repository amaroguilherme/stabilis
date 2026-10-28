// Build-time switches, set as environment variables on Vercel. Everything is off unless set.

/** Language-model suggestions in the patient journey: only after a model passes the promotion gates (eval/README.md). */
export const PATIENT_SUGGESTIONS = process.env.NEXT_PUBLIC_PATIENT_SUGGESTIONS === "on";
