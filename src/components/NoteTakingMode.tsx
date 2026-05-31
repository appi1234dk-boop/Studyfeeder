"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Item } from "@/lib/types";
import { getYouTubeId, getInstagramEmbedUrl, getLinkedInEmbedUrl } from "@/lib/embeds";
import { useDebouncedSave } from "@/lib/useDebouncedSave";

interface NoteTakingModeProps {
  item: Item;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Item>) => void;
  isOwner?: boolean;
}

export default function NoteTakingMode({ item, onClose, onUpdate, isOwner = false }: NoteTakingModeProps) {
  const [ideas, setIdeas] = useState(item.ideas);
  const [ratingSuggestion, setRatingSuggestion] = useState<{ rating: number; reason: string } | null>(null);
  const [localRating, setLocalRating] = useState(item.value_rating);
  const lastSuggestedForRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const youtubeId = getYouTubeId(item.url);
  const instagramEmbedUrl = getInstagramEmbedUrl(item.url);
  const linkedInUrl = getLinkedInEmbedUrl(item.url);

  const requestRatingSuggestion = useCallback(async (memo: string) => {
    if (localRating > 0) return;
    const trimmed = memo.trim();
    if (trimmed.length < 10) return;
    if (lastSuggestedForRef.current === trimmed) return;
    lastSuggestedForRef.current = trimmed;
    try {
      const res = await fetch(`/api/items/${item.id}/suggest-rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideas: trimmed, title: item.title, summary: item.summary }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof data.rating === "number" && data.rating >= 1 && data.rating <= 3) {
        setRatingSuggestion({ rating: data.rating, reason: data.reason || "" });
      }
    } catch {
      // ignore
    }
  }, [item.id, item.title, item.summary, localRating]);

  const saveIdeas = useCallback(async (value: string) => {
    onUpdate(item.id, { ideas: value });
    await requestRatingSuggestion(value);
  }, [item.id, onUpdate, requestRatingSuggestion]);

  const { status, flush } = useDebouncedSave(ideas, saveIdeas, 1200);

  const applyRating = useCallback((rating: number) => {
    setLocalRating(rating);
    onUpdate(item.id, { value_rating: rating });
    setRatingSuggestion(null);
  }, [item.id, onUpdate]);

  const handleClose = useCallback(async () => {
    await flush();
    onClose();
  }, [flush, onClose]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void handleClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const initialItemIdRef = useRef(item.id);
  useEffect(() => {
    if (item.id !== initialItemIdRef.current) {
      onClose();
    }
  }, [item.id, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const renderEmbed = () => {
    if (youtubeId) {
      return (
        <div className="w-full max-w-[1100px] aspect-video rounded-lg overflow-hidden bg-black">
          <iframe
            key={item.id}
            src={`https://www.youtube.com/embed/${youtubeId}`}
            className="w-full h-full border-none"
            allowFullScreen
          />
        </div>
      );
    }
    if (instagramEmbedUrl) {
      return (
        <div className="w-full max-w-[540px] rounded-lg overflow-hidden border border-[var(--border)] bg-white">
          <iframe
            key={item.id}
            src={instagramEmbedUrl}
            className="w-full border-none"
            style={{ minHeight: "720px" }}
            allowFullScreen
          />
        </div>
      );
    }
    if (linkedInUrl) {
      return (
        <div className="w-full max-w-[720px] rounded-lg overflow-hidden border border-[var(--border)] bg-white">
          <iframe
            key={item.id}
            src={linkedInUrl}
            className="w-full border-none"
            style={{ minHeight: "720px" }}
            allowFullScreen
          />
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-[var(--background)] flex flex-col">
      <div className="flex items-center gap-3 px-5 h-[52px] border-b border-[var(--border)] bg-white">
        <h2 className="text-sm font-semibold truncate flex-1" title={item.title}>
          {item.title}
        </h2>
        <span
          className={`text-[12px] transition-opacity ${
            status === "idle" ? "opacity-0" : "opacity-100"
          } ${
            status === "saving" ? "text-[var(--secondary)]" :
            status === "saved" ? "text-emerald-600" :
            status === "error" ? "text-red-600" : ""
          }`}
        >
          {status === "saving" && "저장중…"}
          {status === "saved" && "저장됨 ✓"}
          {status === "error" && "저장 실패"}
        </span>
        <button
          className="text-[13px] px-3 py-1.5 rounded-md border border-[var(--border)] hover:bg-gray-50 transition-colors"
          onClick={() => void handleClose()}
          aria-label="노트 모드 닫기"
        >
          닫기 ✕
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="basis-[60%] min-w-[480px] flex items-center justify-center p-6 border-r border-[var(--border)] bg-gray-50">
          {renderEmbed()}
        </div>

        <div className="basis-[40%] min-w-[360px] flex flex-col p-5 gap-3">
          {ratingSuggestion && localRating === 0 && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-md text-[12px]">
              <span className="text-amber-700">
                🤖 AI 추천: {"★".repeat(ratingSuggestion.rating)}{"☆".repeat(3 - ratingSuggestion.rating)}
                {ratingSuggestion.reason && (
                  <span className="text-[var(--secondary)] ml-1">· {ratingSuggestion.reason}</span>
                )}
              </span>
              <button
                className="ml-auto px-2 py-0.5 text-[11px] bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors"
                onClick={() => applyRating(ratingSuggestion.rating)}
              >
                적용
              </button>
              <button
                className="text-[11px] text-[var(--secondary)] hover:text-gray-700"
                onClick={() => setRatingSuggestion(null)}
                aria-label="추천 닫기"
              >
                ✕
              </button>
            </div>
          )}

          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
            💡 내 메모
          </label>
          <textarea
            ref={textareaRef}
            readOnly={!isOwner}
            className="flex-1 w-full border border-[var(--border)] rounded-lg p-3 text-sm leading-relaxed outline-none resize-none focus:border-[var(--primary)] transition-colors"
            placeholder="영상을 보면서 떠오른 생각을 자유롭게 적어보세요…"
            value={ideas}
            onChange={(e) => { if (isOwner) setIdeas(e.target.value); }}
          />
        </div>
      </div>
    </div>
  );
}
