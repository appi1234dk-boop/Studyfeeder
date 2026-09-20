"use client";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ open, title, description, confirmLabel = "삭제", busy = false, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;
  return <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/35 px-4" role="presentation" onMouseDown={() => !busy && onCancel()}>
    <div className="w-full max-w-[360px] rounded-xl bg-white p-5 shadow-xl" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" onMouseDown={(event) => event.stopPropagation()}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6.5 7l.8 13h9.4l.8-13M10 11v5M14 11v5" /></svg></div>
      <h2 id="confirm-dialog-title" className="text-base font-semibold">{title}</h2>
      <p id="confirm-dialog-description" className="mt-2 text-sm leading-relaxed text-[var(--secondary)]">{description}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button disabled={busy} className="rounded-md px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50" onClick={onCancel}>취소</button>
        <button disabled={busy} className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50" onClick={onConfirm}>{busy ? "삭제 중…" : confirmLabel}</button>
      </div>
    </div>
  </div>;
}
