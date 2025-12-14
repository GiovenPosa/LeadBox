// app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "./service_worker/registerSW";

export const metadata: Metadata = {
  title: "LeadBox",
  description: "gios.build lead inbox and inquiry management",
  manifest: "/manifest.webmanifest",
  applicationName: "gios.build LeadBox",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LeadBox",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}