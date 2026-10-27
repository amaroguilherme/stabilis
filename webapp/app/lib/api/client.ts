// Client for the analysis backend. All calls go through the same-origin proxy (/api/backend),
// which keeps the Hugging Face token on the server.
//
// Analyses run as jobs: submit, then poll until done. This survives the Space's cold start
// (several minutes on CPU) and the 300 s limit of Vercel functions.

export type JobKind = "legacy_analyze" | "legacy_reanalyze";

export type BackendErrorCode =
  | "aborted"
  | "backend_unavailable"
  | "internal"
  | "invalid_input"
  | "job_lost"
  | "model_unavailable"
  | "network"
  | "text_too_long"
  | "timeout";

export class BackendError extends Error {
  readonly code: BackendErrorCode;

  constructor(code: BackendErrorCode) {
    super(code);
    this.name = "BackendError";
    this.code = code;
  }
}

export type JobProgress = { phase: "starting" } | { phase: "queued"; position?: number } | { phase: "running" };

export interface RunJobOptions {
  signal?: AbortSignal;
  onProgress?: (progress: JobProgress) => void;
  timeoutMs?: number;
}

const BASE_URL = "/api/backend";
const DEFAULT_TIMEOUT_MS = 8 * 60_000;
const RETRY_DEFAULT_MS = 15_000;

interface ApiResponse {
  status: number;
  body: Record<string, unknown> | null;
  retryAfterMs: number;
}

async function call(path: string, init: RequestInit, signal?: AbortSignal): Promise<ApiResponse> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/${path}`, {
      ...init,
      signal,
      cache: "no-store",
      headers: { "content-type": "application/json" },
    });
  } catch {
    throw new BackendError(signal?.aborted ? "aborted" : "network");
  }
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const retryAfter = Number(response.headers.get("retry-after"));
  return { status: response.status, body, retryAfterMs: retryAfter > 0 ? retryAfter * 1000 : RETRY_DEFAULT_MS };
}

function wait(ms: number, deadline: number, signal?: AbortSignal): Promise<void> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return Promise.reject(new BackendError("timeout"));
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new BackendError("aborted"));
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, Math.min(ms, remaining));
    function onAbort() {
      clearTimeout(timer);
      reject(new BackendError("aborted"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function errorFromBody(body: ApiResponse["body"], fallback: BackendErrorCode): BackendError {
  const code = typeof body?.error === "string" ? body.error : "";
  const known: BackendErrorCode[] = ["invalid_input", "text_too_long", "model_unavailable", "backend_unavailable"];
  return new BackendError(known.includes(code as BackendErrorCode) ? (code as BackendErrorCode) : fallback);
}

async function submit(kind: JobKind, input: unknown, deadline: number, options: RunJobOptions): Promise<string> {
  for (;;) {
    const res = await call("jobs", { method: "POST", body: JSON.stringify({ kind, input }) }, options.signal);
    if (res.status === 202 && typeof res.body?.job_id === "string") {
      const position = typeof res.body.position === "number" ? res.body.position : undefined;
      options.onProgress?.({ phase: "queued", position });
      return res.body.job_id;
    }
    if (res.status === 503) {
      options.onProgress?.({ phase: "starting" });
    } else if (res.status === 429) {
      options.onProgress?.({ phase: "queued" });
    } else if (res.status === 400) {
      throw errorFromBody(res.body, "invalid_input");
    } else if (res.status === 502) {
      throw new BackendError("backend_unavailable");
    } else {
      throw errorFromBody(res.body, "internal");
    }
    await wait(res.retryAfterMs, deadline, options.signal);
  }
}

async function poll<T>(jobId: string, deadline: number, options: RunJobOptions): Promise<T> {
  let delay = 2_000;
  for (;;) {
    await wait(delay, deadline, options.signal);
    delay = Math.min(5_000, delay + 1_000);

    const res = await call(`jobs/${jobId}`, { method: "GET" }, options.signal);
    if (res.status === 404) throw new BackendError("job_lost");
    if (res.status === 503) {
      options.onProgress?.({ phase: "starting" });
      continue;
    }
    if (res.status !== 200 || !res.body) throw errorFromBody(res.body, "internal");

    const { status, backend, position, result, error } = res.body;
    if (status === "done") return result as T;
    if (status === "error") throw new BackendError(error === "model_unavailable" ? "model_unavailable" : "internal");
    if (status === "running") options.onProgress?.({ phase: "running" });
    else if (backend === "ready") options.onProgress?.({ phase: "queued", position: typeof position === "number" ? position : undefined });
    else options.onProgress?.({ phase: "starting" });
  }
}

/** Submits a job and resolves with its result. Rejects with BackendError. */
export async function runJob<T>(kind: JobKind, input: unknown, options: RunJobOptions = {}): Promise<T> {
  const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const jobId = await submit(kind, input, deadline, options);
  try {
    return await poll<T>(jobId, deadline, options);
  } catch (err) {
    if (err instanceof BackendError && (err.code === "aborted" || err.code === "timeout")) {
      // Best effort: free the queue slot and discard the result on the server.
      fetch(`${BASE_URL}/jobs/${jobId}`, { method: "DELETE", keepalive: true }).catch(() => {});
    }
    throw err;
  }
}

const MESSAGES: Record<BackendErrorCode, string> = {
  aborted: "",
  backend_unavailable: "O servidor de análise está indisponível no momento. Tente novamente mais tarde.",
  internal: "Ocorreu um erro inesperado no servidor de análise. Tente novamente.",
  invalid_input: "Alguns dados do formulário são inválidos. Revise os campos e tente novamente.",
  job_lost: "A análise foi interrompida porque o servidor reiniciou. Envie novamente.",
  model_unavailable: "O motor de análise não conseguiu carregar no servidor. Tente novamente mais tarde.",
  network: "Não foi possível falar com o servidor de análise. Verifique sua conexão e tente novamente.",
  text_too_long: "Os textos livres passaram do limite de 4.000 caracteres somados. Resuma e tente novamente.",
  timeout: "O servidor demorou demais para responder (ele pode estar acordando). Tente novamente em alguns minutos.",
};

export function describeBackendError(err: unknown): string {
  return err instanceof BackendError ? MESSAGES[err.code] : MESSAGES.internal;
}
