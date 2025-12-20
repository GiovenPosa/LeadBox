// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "./service_worker/registerSW";
import { InboxProvider } from "./context/inboxContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

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
    <html lang="en" className={inter.variable}>
      <head>
        {/* Inline critical splash styles - renders BEFORE JS loads */}
        <style dangerouslySetInnerHTML={{ __html: `
          #splash-screen {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            background-color: #121212;
            transition: opacity 0.3s ease-out, transform 0.3s ease-out;
          }
          @media (prefers-color-scheme: light) {
            #splash-screen { background-color: #f5f4ef; }
          }
          #splash-screen.hide {
            opacity: 0;
            pointer-events: none;
          }
          #splash-screen .splash-icon {
            width: 100px;
            height: 100px;
            border-radius: 18px;
            animation: splashExpand 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          @media (prefers-color-scheme: light) {
            #splash-screen{ color: #6b6b6b; }
          }
          @keyframes splashExpand {
            0% { opacity: 0; transform: scale(0.5); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes splashFadeUp {
            0% { opacity: 0; transform: translateY(10px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes splashRing {
            0% { transform: scale(0.8); opacity: 0.5; }
            100% { transform: scale(1.6); opacity: 0; }
          }
        `}} />
      </head>
      <body className={inter.className}>
        {/* Splash screen - renders instantly with HTML */}
        <div id="splash-screen">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img 
              src="/icons/icon2-512.png" 
              alt="" 
              className="splash-icon"
              width={100}
              height={100}
            />
            <div className="splash-ring" />
          </div>
        </div>

        <ServiceWorkerRegister />
        <InboxProvider>
          {children}
        </InboxProvider>
      </body>
    </html>
  );
}