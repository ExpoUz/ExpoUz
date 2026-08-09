import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ExpoUz Pitch Owner Portal",
    short_name: "ExpoUz Portal",
    description: "Manage your pitches, matches, players and revenue on ExpoUz",
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
