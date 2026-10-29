import type { MetadataRoute } from "next";

// Lets the site be installed on the phone's home screen and opened without connection (public/sw.js).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stabilis — guia para a consulta em saúde mental",
    short_name: "Stabilis",
    description: "Um guia baseado em diretrizes públicas de saúde mental para levar à consulta.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#4f46e5",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Ajuda agora", url: "/ajuda-agora" },
      { name: "Meu plano de segurança", url: "/paciente/plano-de-seguranca" },
    ],
  };
}
