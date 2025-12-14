import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "gios.build LeadBox",
  description: "Lead inbox for gios.build",

  manifest: "/manifest.webmanifest",

  appleWebApp: {
    capable: true,
    title: "gios.build LeadBox",
    statusBarStyle: "black-translucent",
  },

  themeColor: "#0b0b0b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}