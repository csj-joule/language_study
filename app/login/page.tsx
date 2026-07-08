"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const SAVED_USERNAME_KEY = "shadowing-saved-username";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberId, setRememberId] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 브라우저에 저장해둔 아이디가 있으면 불러와 채워준다 (비밀번호는 저장하지 않는다).
  // localStorage는 서버 렌더링 중에는 접근할 수 없어 마운트 이후(effect)에 읽어야 하는,
  // 구독 콜백 패턴이 적용되지 않는 정당한 예외라 이 effect 안에서는 규칙을 끈다.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = window.localStorage.getItem(SAVED_USERNAME_KEY);
    if (saved) {
      setUsername(saved);
      setRememberId(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "로그인에 실패했습니다");
        return;
      }
      if (rememberId) {
        window.localStorage.setItem(SAVED_USERNAME_KEY, username);
      } else {
        window.localStorage.removeItem(SAVED_USERNAME_KEY);
      }
      const next = searchParams.get("next") || "/";
      router.push(next);
      router.refresh();
    } catch {
      setError("로그인 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center gap-4">
      <h1 className="text-center text-xl font-semibold">日本語シャドーイング</h1>
      <p className="text-center text-sm text-neutral-500">로그인이 필요합니다</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="아이디"
          autoComplete="username"
          className="rounded-md border px-3 py-2"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          autoComplete="current-password"
          className="rounded-md border px-3 py-2"
        />
        <label className="flex items-center gap-1.5 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={rememberId}
            onChange={(e) => setRememberId(e.target.checked)}
          />
          아이디 저장
        </label>
        <button
          type="submit"
          disabled={loading || !username || !password}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
