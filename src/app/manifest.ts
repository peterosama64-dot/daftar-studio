import type { MetadataRoute } from "next";

// Lets phones "add to home screen" (required for notifications on iPhone).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "دفتر الاستوديو",
    short_name: "الدفتر",
    start_url: "/app",
    display: "standalone",
    dir: "rtl",
    lang: "ar",
    background_color: "#f4f3ef",
    theme_color: "#f4f3ef",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
