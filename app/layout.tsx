import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "일본어 쉐도잉",
  description: "유튜브로 배우는 일본어 쉐도잉 학습 앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">
        <header className="h-14 border-b bg-white sticky top-0 z-20">
          <nav className="h-full max-w-3xl mx-auto flex items-center gap-4 px-4">
            <Link href="/" className="font-semibold">
              日本語シャドーイング
            </Link>
            <Link href="/bookmarks" className="text-sm text-neutral-600 hover:text-neutral-900">
              북마크
            </Link>
          </nav>
        </header>
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
