import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tribu — Suscripciones compartidas",
    short_name: "Tribu",
    description:
      "Paga y administra suscripciones compartidas: crea grupos, aprueba comprobantes y paga con QR.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d0f14",
    theme_color: "#0d0f14",
    lang: "es",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
