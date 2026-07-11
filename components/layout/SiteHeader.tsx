"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/", label: "홈" },
  { href: "/bookmarks", label: "북마크" },
  { href: "/vocab", label: "단어장" },
  { href: "/history", label: "캐시 히스토리" },
  { href: "/accounts", label: "계정 관리" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 경로가 바뀌면(메뉴 항목 클릭 등) 메뉴를 닫는다. 렌더 도중 상태를 맞추는
  // 방식(React 권장 패턴)이라 별도 effect 없이 이전 경로와 비교해 처리한다.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  // 메뉴 바깥을 클릭하면 닫는다
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (pathname === "/login") return null;

  return (
    <header className="h-14 border-b border-neutral-200/70 bg-white/80 backdrop-blur-md sticky top-0 z-30 supports-[backdrop-filter]:bg-white/60">
      <div ref={menuRef} className="relative h-full max-w-3xl mx-auto flex items-center px-4">
        <Link href="/" className="flex items-center gap-1.5 font-semibold tracking-tight">
          <span className="h-2 w-2 rounded-full bg-indigo-600" />
          日本語シャドーイング
        </Link>

        <button
          type="button"
          data-testid="btn-menu-toggle"
          aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
        >
          {open ? (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          )}
        </button>

        {open && (
          <nav
            data-testid="menu-dropdown"
            className="absolute right-0 top-[calc(100%+0.5rem)] flex w-48 flex-col overflow-hidden rounded-2xl border border-neutral-200/70 bg-white/95 py-1.5 shadow-xl shadow-neutral-900/5 backdrop-blur-md"
          >
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`mx-1.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  pathname === link.href
                    ? "bg-indigo-50 font-medium text-indigo-600"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="my-1.5 border-t border-neutral-100" />
            <form action="/api/logout" method="POST" className="px-1.5 pb-0.5">
              <button
                type="submit"
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                로그아웃
              </button>
            </form>
          </nav>
        )}
      </div>
    </header>
  );
}
