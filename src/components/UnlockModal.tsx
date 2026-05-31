"use client";

import { useState } from "react";

interface UnlockModalProps {
  isOwner: boolean;
  onClose: () => void;
  onChange: (isOwner: boolean) => void;
}

export default function UnlockModal({ isOwner, onClose, onChange }: UnlockModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        onChange(true);
        onClose();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const lock = async () => {
    setBusy(true);
    try {
      await fetch("/api/unlock", { method: "DELETE" });
      onChange(false);
      onClose();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/40 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-[320px] bg-white rounded-xl shadow-xl p-5 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {isOwner ? (
          <>
            <div className="text-sm font-semibold">편집 권한이 있습니다</div>
            <button
              className="px-3 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
              onClick={lock}
              disabled={busy}
            >
              읽기 전용으로 잠그기
            </button>
          </>
        ) : (
          <>
            <div className="text-sm font-semibold">비밀번호를 입력해주세요</div>
            <input
              type="password"
              autoFocus
              className={`h-9 px-3 border rounded-lg text-sm outline-none transition-colors ${
                error ? "border-[var(--danger)]" : "border-[var(--border)] focus:border-[var(--primary)]"
              }`}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
            {error && (
              <div className="text-[12px] text-[var(--danger)]">비밀번호가 올바르지 않습니다</div>
            )}
            <button
              className="px-3 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-40"
              onClick={submit}
              disabled={busy || !password}
            >
              확인
            </button>
          </>
        )}
      </div>
    </div>
  );
}
