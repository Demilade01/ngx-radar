import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ngix — Nigerian Stock Intelligence",
  description: "Private financial intelligence platform for the NGX. Detect smart money flows before the market reacts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark h-full ${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <link rel="icon" href="/logo.jpg" type="image/jpeg" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
