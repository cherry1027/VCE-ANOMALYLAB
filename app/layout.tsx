import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VCE AnomalyLab",
  description: "A simulated heavy equipment transmission anomaly detection and verification lab.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
