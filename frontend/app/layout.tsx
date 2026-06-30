import type { Metadata } from "next";
import { Fraunces, Inter_Tight } from "next/font/google";
import "./globals.css";

// Display / headings. Loaded as a variable font with the optical-size axis so
// large editorial headings get true optical sizing; weights 400 & 600 in use.
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-display",
  display: "swap",
});

// Body, UI, and dense data/tables.
const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Prahari",
  description:
    "Autonomous civic accountability infrastructure for urban India.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${interTight.variable}`}>
      <body className="font-body bg-ink text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
