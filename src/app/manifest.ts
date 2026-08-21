import type { MetadataRoute } from "next";

type BoardSignalManifest = MetadataRoute.Manifest & {
  screenshots: Array<{
    src: string;
    sizes: string;
    type: "image/png";
    form_factor: "narrow" | "wide";
    label: string;
  }>;
};

export default function manifest(): BoardSignalManifest {
  return {
    id: "/boardsignal",
    name: "BoardSignal — Weekly Chess Review",
    short_name: "BoardSignal",
    description: "Your weekly chess Review. Follow your latest seven-day Review, Progress, Universe movement and Friends — with offline access after you've opened your Player Room.",
    start_url: "/boardsignal?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    orientation: "portrait",
    background_color: "#f4f0e7",
    theme_color: "#101923",
    lang: "en",
    categories: ["sports", "education", "productivity"],
    icons: [
      { src: "/icons/boardsignal-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/boardsignal-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/boardsignal-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Player Room", short_name: "Player Room", url: "/boardsignal/player-room", icons: [{ src: "/icons/boardsignal-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Universe", short_name: "Universe", url: "/boardsignal", icons: [{ src: "/icons/boardsignal-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Inbox", short_name: "Inbox", url: "/boardsignal/player-room?tab=inbox", icons: [{ src: "/icons/boardsignal-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Friends", short_name: "Friends", url: "/boardsignal/player-room?tab=friends", icons: [{ src: "/icons/boardsignal-192.png", sizes: "192x192", type: "image/png" }] },
    ],
    screenshots: [
      { src: "/pwa/boardsignal-player-room-mobile.png", sizes: "1080x1920", type: "image/png", form_factor: "narrow", label: "Your weekly chess Review" },
      { src: "/pwa/boardsignal-universe-mobile.png", sizes: "1080x1920", type: "image/png", form_factor: "narrow", label: "Current BoardSignal Universe movement" },
      { src: "/pwa/boardsignal-player-room-wide.png", sizes: "1440x900", type: "image/png", form_factor: "wide", label: "Review, Progress and your BoardSignal week" },
      { src: "/pwa/boardsignal-universe-wide.png", sizes: "1440x900", type: "image/png", form_factor: "wide", label: "BoardSignal Universe and recent field movement" },
    ],
  };
}
