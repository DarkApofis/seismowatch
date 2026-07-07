import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Inter, exposed as the `--font-inter` CSS variable consumed by the Tailwind
// `--font-sans` token in globals.css. `display: swap` avoids a blocking font.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://seismowatch.vercel.app";
const TITLE = "SeismoWatch — Real-time earthquake dashboard";
const DESCRIPTION =
  "A live global earthquake map, virtualized table, and analytics powered by the public USGS GeoJSON feeds.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "SeismoWatch",
  openGraph: {
    type: "website",
    siteName: "SeismoWatch",
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
