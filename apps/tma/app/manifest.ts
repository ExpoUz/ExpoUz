import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ExpoUz",
    short_name: "ExpoUz",
    description: "Find and join padel & football games in Uzbekistan",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#00A651",
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
