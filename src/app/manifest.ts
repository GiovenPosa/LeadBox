import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "gios.build LeadBox",
    short_name: "LeadBox",
    description: "gios.build lead inbox and inquiry management",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b0b",
    theme_color: "#0b0b0b",
    orientation: "portrait",
    scope: "/",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    "screenshots": [
      {
        "src": "/screenshots/mobile-view.png",
        "sizes": "503x995",
        "type": "image/png",
        "label": "Inbox"
      },
      {
        "src": "/screenshots/desktop-view.png",
        "sizes": "2560x1315",
        "type": "image/png",
        "form_factor": "wide",
        "label": "Dashboard"
      }
    ]
  };
}