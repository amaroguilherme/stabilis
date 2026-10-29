"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DICTATION_WARNING_KEY } from "@/app/lib/patient/store";

// Voice dictation for free-text fields (POLICY §18): only where the browser offers it, and only
// after the person reads that the audio goes to the browser's company (Google in Chrome, Apple in
// Safari) to become text. Stabilis never receives the audio; the words land in the text box, where
// the crisis lexicon runs as usual.

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionConstructor = new () => Recognition;

const ERRORS: Record<string, string> = {
  "not-allowed": "O navegador não deixou usar o microfone. Você pode escrever normalmente.",
  "service-not-allowed": "O navegador não deixou usar o ditado. Você pode escrever normalmente.",
  "no-speech": "Não ouvimos nada. Tente de novo, mais perto do microfone.",
  network: "Sem conexão para transformar a fala em texto. Você pode escrever normalmente.",
  "audio-capture": "Não encontramos um microfone neste aparelho.",
};

function recognitionConstructor(): RecognitionConstructor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noSubscription = () => () => {};

export default function Dictation({ onText }: { onText: (text: string) => void }) {
  const supported = useSyncExternalStore(noSubscription, () => recognitionConstructor() !== null, () => false);
  const [stage, setStage] = useState<"idle" | "warning" | "listening">("idle");
  const [message, setMessage] = useState("");
  const recognition = useRef<Recognition | null>(null);
  useEffect(() => () => recognition.current?.stop(), []);
  if (!supported) return null;

  function start() {
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    const r = new Constructor();
    r.lang = "pt-BR";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (event) => {
      const parts: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) if (event.results[i].isFinal) parts.push(event.results[i][0].transcript);
      const text = parts.join(" ").trim();
      if (text) onText(text);
    };
    r.onerror = (event) => setMessage(ERRORS[event.error] ?? "Não foi possível usar o ditado agora. Você pode escrever normalmente.");
    r.onend = () => setStage("idle");
    recognition.current = r;
    try {
      r.start();
      setStage("listening");
      setMessage("Ouvindo. Fale com calma e toque em Parar quando terminar.");
    } catch {
      setMessage("Não foi possível usar o ditado agora. Você pode escrever normalmente.");
    }
  }

  function accept() {
    sessionStorage.setItem(DICTATION_WARNING_KEY, "1");
    start();
  }

  function toggle() {
    if (stage === "listening") {
      recognition.current?.stop();
      setMessage("");
      return;
    }
    if (sessionStorage.getItem(DICTATION_WARNING_KEY) === "1") start();
    else setStage("warning");
  }

  return (
    <div className="mt-2 space-y-2">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={stage === "listening"}
        className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-800 hover:border-indigo-400"
      >
        {stage === "listening" ? "Parar o ditado" : "Falar em vez de escrever"}
      </button>
      {stage === "warning" && (
        <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <p>
            Para virar texto, o que você falar é enviado pelo navegador à empresa que o faz (no Chrome, ao Google; no Safari, à Apple),
            fora do Brasil. O Stabilis não recebe nem guarda o áudio. Se preferir que nada saia do aparelho, escreva.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={accept} className="min-h-12 rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700">
              Entendi, quero falar
            </button>
            <button type="button" onClick={() => setStage("idle")} className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-800">
              Prefiro escrever
            </button>
          </div>
        </div>
      )}
      <p aria-live="polite" className="text-sm text-slate-700">{message}</p>
    </div>
  );
}
