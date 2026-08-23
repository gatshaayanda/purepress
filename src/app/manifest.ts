import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PurePress Printers — Your Vision, Fully Printed",
    short_name: "PurePress",
    description:
      "Computerized embroidery and garment branding from Gaborone, Botswana.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#fffef9",
    theme_color: "#00AEEF",
    lang: "en",
    categories: ["business", "lifestyle"],
    icons: [
      {
        src: "/purepress/brand/purepress-app-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/purepress/brand/purepress-app-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/purepress/brand/purepress-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Request a Quote",
        short_name: "Quote",
        url: "/request-a-quote",
      },
      {
        name: "My PurePress",
        short_name: "My PurePress",
        url: "/client/login",
      },
      {
        name: "Our Work",
        short_name: "Our Work",
        url: "/gallery",
      },
    ],
  };
}
