import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mão de Esperança — Gestão Financeira",
    short_name: "Mão Financeiro",
    description: "Controlo interno financeiro da Clínica Mão de Esperança.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7f5",
    theme_color: "#0f665e",
    lang: "pt-PT",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
