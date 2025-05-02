import { Analytics } from "@vercel/analytics/next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "./components/PosthogProvider";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {/* Fallback for browsers that don't support SVG favicons */}
        <link rel="alternate icon" href="/favicon.ico" />
      </head>
      <body
        className={`${jetbrainsMono.variable} font-mono antialiased bg-white text-gray-900`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
