import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KOMA Studio",
    short_name: "KOMA",
    description:
      "Free and open-source (MIT) scanlation software for manga translation, cleaning, redraw, and typesetting.",
    start_url: "/",
    display: "standalone",
    background_color: "#060810",
    theme_color: "#a855f7",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
