"use client";

import { useEffect, useSyncExternalStore } from "react";

// Registers the service worker (public/sw.js) in production and tells the person when there is no
// connection: what was already opened keeps working, and the crisis help page always does.

function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export default function OfflineSupport() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID ?? "1"}`).catch(() => {});
  }, []);
  if (online) return null;
  return (
    <p role="status" className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-950 print:hidden">
      Sem conexão. O que você já abriu continua funcionando, e a página Ajuda agora também.
    </p>
  );
}
