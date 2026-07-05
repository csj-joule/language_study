"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteHeader() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <header className="h-14 border-b bg-white sticky top-0 z-20">
      <nav className="h-full max-w-3xl mx-auto flex items-center gap-4 px-4">
        <Link href="/" className="font-semibold">
          日本語シャドーイング
        </Link>
        <Link href="/bookmarks" className="text-sm text-neutral-600 hover:text-neutral-900">
          북마크
        </Link>
        <form action="/api/logout" method="POST" className="ml-auto">
          <button
            type="submit"
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            로그아웃
          </button>
        </form>
      </nav>
    </header>
  );
}
