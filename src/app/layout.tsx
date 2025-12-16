// app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "./service_worker/registerSW";
import { InboxProvider } from "./context/inboxContext";

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
  width: "device-width",
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        <InboxProvider>
          {children}
        </InboxProvider>
      </body>
    </html>
  );
}