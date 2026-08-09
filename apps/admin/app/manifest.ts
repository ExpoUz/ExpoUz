import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ExpoUz Admin",
    short_name: "ExpoUz Admin",
    description: "Admin panel for the ExpoUz sports platform",
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
