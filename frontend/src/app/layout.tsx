import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "FileZiper - Premium File Compression Bot",
  description: "Compress multiple files into a single high-ratio ZIP archive instantly inside Telegram.",
  metadataBase: new URL("https://fileziper-mini-app.vercel.app"),
  openGraph: {
    title: "FileZiper - Premium File Compression Bot",
    description: "Compress multiple files into a single high-ratio ZIP archive instantly inside Telegram.",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "FileZiper Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FileZiper - Premium File Compression Bot",
    description: "Compress multiple files into a single high-ratio ZIP archive instantly inside Telegram.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} dark h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Load Telegram WebApp SDK Script BEFORE interactive components load */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="min-h-full bg-tg-bg text-tg-text font-sans antialiased flex flex-col" suppressHydrationWarning>
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
