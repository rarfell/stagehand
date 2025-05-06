import { Analytics } from "@vercel/analytics/next";
import { Geist_Mono } from "next/font/google";
import localFont from 'next/font/local';
import "./globals.css";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const stepsMono = localFont({
  src: '../public/fonts/Steps-Mono.otf',
  variable: '--font-steps-mono',
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
        className={`${geistMono.variable} ${stepsMono.variable} font-mono antialiased bg-white text-gray-900`}
      >
        {children}
      </body>
    </html>
  );
}
