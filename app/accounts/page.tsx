"use client";

import { useEffect, useState } from "react";

type AdminAccount = {
  id: number;
  username: string;
  createdAt: string;
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/accounts");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "목록을 가져오지 못했습니다");
        setAccounts(data.accounts ?? []);
        setWarning(data.warning ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다");
      }
    })();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "계정 추가에 실패했습니다");
      setUsername("");
      setPassword("");
      const listRes = await fetch("/api/accounts");
      const listData = await listRes.json();
      if (listRes.ok) setAccounts(listData.accounts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: number, username: string) {
    if (!window.confirm(`"${username}" 계정을 삭제할까요?`)) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/accounts?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "삭제에 실패했습니다");
      setAccounts((prev) => prev?.filter((a) => a.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">계정 관리</h1>
        <p className="mt-1 text-sm text-neutral-500">
          이 앱에 로그인할 수 있는 관리자 계정을 추가/삭제합니다.
        </p>
      </div>

      {warning && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{warning}</p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {accounts === null && !warning && !error && (
        <p className="text-neutral-500">불러오는 중...</p>
      )}

      <div className="flex flex-col gap-2">
        {accounts?.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between rounded-lg border bg-white p-3"
          >
            <div>
              <p className="font-medium">{account.username}</p>
              <p className="text-xs text-neutral-500">
                생성일 {new Date(account.createdAt).toLocaleDateString("ko-KR")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(account.id, account.username)}
              disabled={deletingId === account.id || (accounts?.length ?? 0) <= 1}
              title={
                (accounts?.length ?? 0) <= 1
                  ? "마지막 계정은 삭제할 수 없습니다"
                  : "삭제"
              }
              className="rounded-md border px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              {deletingId === account.id ? "삭제 중..." : "삭제"}
            </button>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-3 rounded-lg border bg-white p-4"
      >
        <p className="text-sm font-medium">새 계정 추가</p>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="아이디"
          disabled={!!warning}
          className="rounded-md border px-3 py-2 disabled:bg-neutral-100"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 (4자 이상)"
          disabled={!!warning}
          className="rounded-md border px-3 py-2 disabled:bg-neutral-100"
        />
        <button
          type="submit"
          disabled={adding || !!warning || !username.trim() || password.length < 4}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {adding ? "추가 중..." : "추가"}
        </button>
      </form>
    </div>
  );
}
