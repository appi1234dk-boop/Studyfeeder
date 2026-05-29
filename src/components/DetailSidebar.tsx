"use client";

import { useState, useEffect, useCallback } from "react";
import type { Item } from "@/lib/types";
import type { RelatedLink } from "@/lib/sheets";
import { getYouTubeId, getInstagramEmbedUrl, getLinkedInEmbedUrl } from "@/lib/embeds";

function driveUrlToThumbnail(url: string): string {
  const m = url.match(/\/d\/([^/]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800`;
  return url;
}

// **bold** 인라인 처리
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((p, i) =>
    i % 2 === 1
      ? <strong key={`${keyPrefix}-${i}`}>{p}</strong>
      : <span key={`${keyPrefix}-${i}`}>{p}</span>
  );
}

// 책 요약(구조화 마크다운) 경량 렌더러 — ## 헤딩 / - 불릿 / > 인용 / **굵게**
function BookSummary({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length) {
      const items = [...listItems];
      const k = key++;
      blocks.push(
        <ul key={`ul-${k}`} className="list-disc pl-5 flex flex-col gap-1 my-0.5">
          {items.map((it, i) => <li key={i}>{renderInline(it, `li-${k}-${i}`)}</li>)}
        </ul>
      );
      listItems = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#{1,6}\s+/.test(line)) {
      flushList();
      blocks.push(
        <h4 key={`h-${key++}`} className="text-[12px] font-bold uppercase tracking-wide text-[var(--primary)] mt-3 first:mt-0">
          {line.replace(/^#{1,6}\s+/, "")}
        </h4>
      );
    } else if (/^>\s?/.test(line)) {
      flushList();
      blocks.push(
        <blockquote key={`q-${key}`} className="border-l-2 border-amber-300 pl-3 py-0.5 text-[var(--secondary)] italic">
          {renderInline(line.replace(/^>\s?/, ""), `q-${key++}`)}
        </blockquote>
      );
    } else if (/^[-*]\s+/.test(line)) {
      listItems.push(line.replace(/^[-*]\s+/, ""));
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      blocks.push(
        <p key={`p-${key}`} className="leading-relaxed">{renderInline(line, `p-${key++}`)}</p>
      );
    }
  }
  flushList();

  return <div className="text-sm flex flex-col gap-1.5">{blocks}</div>;
}

// 관련 자료 썸네일 (ItemCard 로직 간소화 버전)
function relatedThumbnail(item: Item): string | null {
  if (item.images) {
    const first = item.images.split(",")[0].trim();
    if (first) {
      const m = first.match(/\/d\/([^/]+)/);
      return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w120` : first;
    }
  }
  const yt = item.url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg`;
  return null;
}

interface DetailSidebarProps {
  item: Item | null;
  items?: Item[];
  relatedLinks?: RelatedLink[];
  onSelectItem?: (id: string) => void;
  threads: string[];
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Item>) => void;
  onDelete: (id: string) => void;
  onEnterNoteMode?: () => void;
}

function isLongBlackUrl(url: string): boolean {
  return /longblack\.co\/note\/\d+/.test(url);
}

function isYouTubePostUrl(url: string): boolean {
  return /youtube\.com\/post\//.test(url);
}

function LongBlackPreview({ url, title, summary }: { url: string; title: string; summary: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
        롱블랙
      </label>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg border border-[var(--border)] overflow-hidden hover:border-[var(--primary)] transition-colors group"
      >
        <div className="bg-[#1a1a1a] px-4 py-3 flex items-center gap-2">
          <span className="text-white font-bold text-sm tracking-tight">LONGBLACK</span>
          <span className="text-gray-400 text-xs">·</span>
          <span className="text-gray-400 text-xs">노트</span>
        </div>
        <div className="px-4 py-3 bg-white">
          <h4 className="text-sm font-semibold leading-snug mb-1.5 group-hover:text-[var(--primary)] transition-colors line-clamp-2">
            {title}
          </h4>
          {summary && (
            <p className="text-xs text-[var(--secondary)] leading-relaxed line-clamp-3">
              {summary}
            </p>
          )}
          <div className="mt-2 text-[11px] text-gray-400 flex items-center gap-1">
            <span>↗</span>
            <span>롱블랙에서 읽기</span>
          </div>
        </div>
      </a>
    </div>
  );
}

function YouTubePostPreview({ url, title, summary }: { url: string; title: string; summary: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
        YouTube 커뮤니티
      </label>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg border border-[var(--border)] overflow-hidden hover:border-[var(--primary)] transition-colors group"
      >
        <div className="bg-[#FF0000] px-4 py-3 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 bg-white rounded-sm">
            <span className="text-[#FF0000] text-[10px] leading-none">&#9654;</span>
          </span>
          <span className="text-white font-bold text-sm tracking-tight">YouTube</span>
          <span className="text-white/70 text-xs">·</span>
          <span className="text-white/90 text-xs">커뮤니티 포스트</span>
        </div>
        <div className="px-4 py-3 bg-white">
          <h4 className="text-sm font-semibold leading-snug mb-1.5 group-hover:text-[var(--primary)] transition-colors line-clamp-2">
            {title}
          </h4>
          {summary && (
            <p className="text-xs text-[var(--secondary)] leading-relaxed line-clamp-3">
              {summary}
            </p>
          )}
          <div className="mt-2 text-[11px] text-gray-400 flex items-center gap-1">
            <span>↗</span>
            <span>YouTube에서 열기</span>
          </div>
        </div>
      </a>
    </div>
  );
}

function ImageGallery({ urls }: { urls: string[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (lightboxIndex === null) return;
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") setLightboxIndex((lightboxIndex - 1 + urls.length) % urls.length);
      if (e.key === "ArrowRight") setLightboxIndex((lightboxIndex + 1) % urls.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, urls.length]);

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {urls.map((url, i) => (
          <img
            key={i}
            src={url}
            className="w-full aspect-[4/3] object-cover rounded-lg border border-[var(--border)] cursor-pointer hover:opacity-85 transition-opacity"
            onClick={() => setLightboxIndex(i)}
            alt=""
          />
        ))}
      </div>
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 bg-black/85 z-[1000] flex items-center justify-center cursor-zoom-out"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute top-5 right-6 w-10 h-10 bg-white/15 hover:bg-white/25 text-white text-2xl rounded-lg flex items-center justify-center"
            onClick={() => setLightboxIndex(null)}
          >
            &times;
          </button>
          {urls.length > 1 && (
            <>
              <button
                className="absolute left-5 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/15 hover:bg-white/25 text-white text-xl rounded-lg flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + urls.length) % urls.length); }}
              >
                &#8249;
              </button>
              <button
                className="absolute right-5 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/15 hover:bg-white/25 text-white text-xl rounded-lg flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % urls.length); }}
              >
                &#8250;
              </button>
            </>
          )}
          <img
            src={urls[lightboxIndex]}
            className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            alt=""
          />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            {lightboxIndex + 1} / {urls.length}
          </div>
        </div>
      )}
    </>
  );
}

export default function DetailSidebar({ item, items = [], relatedLinks = [], onSelectItem, threads, onClose, onUpdate, onDelete, onEnterNoteMode }: DetailSidebarProps) {
  const [title, setTitle] = useState("");
  const [ideas, setIdeas] = useState("");
  const [threadOpen, setThreadOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [ratingSuggestion, setRatingSuggestion] = useState<{ rating: number; reason: string } | null>(null);
  const [showOriginal, setShowOriginal] = useState(true);
  const [sessionInitialIdeas, setSessionInitialIdeas] = useState("");
  const [lastSentMemo, setLastSentMemo] = useState<string | null>(null);
  const [obsidianStatus, setObsidianStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setIdeas(item.ideas);
      setThreadOpen(false);
      setShowDeleteConfirm(false);
      setTagInput("");
      setShowTagInput(false);
      setRatingSuggestion(null);
      setShowOriginal(true);
    }
  }, [item]);

  // 자료가 바뀔 때만(같은 자료의 다른 필드 변경에는 영향 X) 옵시디언 세션 상태 초기화
  useEffect(() => {
    if (item) {
      setSessionInitialIdeas(item.ideas);
      setLastSentMemo(null);
      setObsidianStatus("idle");
    }
  }, [item?.id]);

  const saveField = useCallback(
    (field: string, value: string | boolean | number) => {
      if (!item) return;
      onUpdate(item.id, { [field]: value } as Partial<Item>);
    },
    [item, onUpdate]
  );

  const requestRatingSuggestion = useCallback(async () => {
    if (!item) return;
    if (item.value_rating > 0) return;
    const memo = ideas.trim();
    if (memo.length < 10) return;
    if (memo === (item.ideas || "").trim()) {
      // 변경 없으면 호출하지 않음
      // but if no suggestion yet shown for this memo, allow once
    }
    try {
      const res = await fetch(`/api/items/${item.id}/suggest-rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideas: memo, title: item.title, summary: item.summary }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof data.rating === "number" && data.rating >= 1 && data.rating <= 3) {
        setRatingSuggestion({ rating: data.rating, reason: data.reason || "" });
      }
    } catch {
      // ignore
    }
  }, [item, ideas]);

  const pushToObsidian = useCallback(async () => {
    if (!item) return;
    const memo = ideas.trim();
    if (!memo) return;
    setObsidianStatus("sending");
    try {
      const res = await fetch(`/api/items/${item.id}/obsidian`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setLastSentMemo(ideas);
      setObsidianStatus("sent");
    } catch {
      setObsidianStatus("error");
    }
  }, [item, ideas]);

  if (!item) return null;

  const hasMemo = Boolean((item.ideas || "").trim());
  const trimmedIdeas = ideas.trim();
  const obsidianEnabled =
    !!trimmedIdeas &&
    ideas !== sessionInitialIdeas &&
    ideas !== lastSentMemo &&
    obsidianStatus !== "sending";

  const renderObsidianButton = () => (
    <div className="flex items-center gap-2">
      <button
        className="px-3 py-1.5 text-[13px] rounded-md border border-[var(--border)] bg-white hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--border)] disabled:hover:text-inherit"
        disabled={!obsidianEnabled}
        onClick={pushToObsidian}
      >
        {obsidianStatus === "sending" ? "보내는 중..." : "옵시디언 Inbox에 추가"}
      </button>
      {obsidianStatus === "sent" && (
        <span className="text-[12px] text-green-600">옵시디언에 보냈습니다</span>
      )}
      {obsidianStatus === "error" && (
        <span className="text-[12px] text-red-600">전송 실패</span>
      )}
    </div>
  );
  const tags = item.tags ? item.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
  const imageUrls = item.images ? item.images.split(",").map((u) => driveUrlToThumbnail(u.trim())).filter(Boolean) : [];
  const youtubeId = item.type === "youtube" ? getYouTubeId(item.url) : null;
  const instagramEmbedUrl = item.url ? getInstagramEmbedUrl(item.url) : null;
  const linkedInUrl = item.url ? getLinkedInEmbedUrl(item.url) : null;
  const canEnterNoteMode = !!(onEnterNoteMode && (youtubeId || instagramEmbedUrl || linkedInUrl));

  const noteModeButton = canEnterNoteMode ? (
    <button
      className="inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1 rounded-md bg-[var(--primary)] text-white hover:bg-blue-600 transition-colors shadow-sm"
      onClick={onEnterNoteMode}
      title="좌우 분할 화면으로 영상 보면서 메모하기"
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
      노트 모드
    </button>
  ) : null;
  const longBlack = item.url ? isLongBlackUrl(item.url) : false;
  const youtubePost = item.url ? isYouTubePostUrl(item.url) : false;
  const isBook = item.type === "book";
  const relatedResolved = relatedLinks
    .map((l) => {
      const it = items.find((i) => i.id === l.related_id);
      return it && !it.is_archived ? { item: it, reason: l.reason } : null;
    })
    .filter((x): x is { item: Item; reason: string } => x !== null);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    const newTags = [...tags, trimmed].join(", ");
    onUpdate(item.id, { tags: newTags } as Partial<Item>);
    setTagInput("");
    setShowTagInput(false);
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = tags.filter((t) => t !== tagToRemove).join(", ");
    onUpdate(item.id, { tags: newTags } as Partial<Item>);
  };

  return (
    <div className="w-[600px] bg-white border-l border-[var(--border)] shrink-0 overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <button
          className={`px-3 py-1 rounded-xl text-[13px] font-medium border transition-colors ${
            item.is_read
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-[var(--primary-light)] text-[var(--primary)] border-blue-200"
          }`}
          onClick={() => saveField("is_read", !item.is_read)}
        >
          {item.is_read ? "읽음" : "안 읽음"}
        </button>
        <button
          className="w-8 h-8 bg-[var(--background)] rounded-md flex items-center justify-center text-[var(--secondary)] text-base hover:bg-gray-200 transition-colors"
          onClick={onClose}
        >
          &times;
        </button>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col gap-5">
        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
            제목
          </label>
          <input
            className="text-lg font-semibold border border-transparent rounded-md px-2 py-1.5 outline-none hover:border-[var(--border)] focus:border-[var(--primary)] focus:bg-[var(--primary-light)] transition-colors leading-snug"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { if (title !== item.title) saveField("title", title); }}
          />
        </div>

        {/* Rating */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
            콘텐츠 가치
          </label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((n) => {
                const active = item.value_rating >= n;
                return (
                  <button
                    key={n}
                    className={`w-8 h-8 rounded-md flex items-center justify-center text-lg transition-colors ${
                      active
                        ? "text-amber-500 hover:text-amber-600"
                        : "text-gray-300 hover:text-amber-400"
                    }`}
                    onClick={() => {
                      const next = item.value_rating === n ? 0 : n;
                      saveField("value_rating", next);
                      setRatingSuggestion(null);
                    }}
                    title={`${n}점`}
                  >
                    {active ? "★" : "☆"}
                  </button>
                );
              })}
            </div>
            <span className="text-[12px] text-[var(--secondary)]">
              {item.value_rating === 0 && "미평가"}
              {item.value_rating === 1 && "1회독으로 충분"}
              {item.value_rating === 2 && "다시 보고 싶음"}
              {item.value_rating === 3 && "자주 보기"}
            </span>
          </div>
          {ratingSuggestion && item.value_rating === 0 && (
            <div className="flex items-center gap-2 mt-1 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-md text-[12px]">
              <span className="text-amber-700">
                🤖 AI 추천: {"★".repeat(ratingSuggestion.rating)}{"☆".repeat(3 - ratingSuggestion.rating)}
                {ratingSuggestion.reason && <span className="text-[var(--secondary)] ml-1">· {ratingSuggestion.reason}</span>}
              </span>
              <button
                className="ml-auto px-2 py-0.5 text-[11px] bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors"
                onClick={() => { saveField("value_rating", ratingSuggestion.rating); setRatingSuggestion(null); }}
              >
                적용
              </button>
              <button
                className="text-[11px] text-[var(--secondary)] hover:text-gray-700"
                onClick={() => setRatingSuggestion(null)}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Ideas — only when memo exists (placed before content) */}
        {hasMemo && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
                💡 내 메모
              </label>
              {noteModeButton}
            </div>
            <textarea
              className="w-full min-h-[200px] border border-[var(--border)] rounded-lg p-3 text-sm leading-relaxed outline-none resize-y focus:border-[var(--primary)] transition-colors"
              placeholder="이 자료를 보고 느낀 점, 떠오른 아이디어, 적용할 곳을 적어보세요..."
              value={ideas}
              onChange={(e) => {
                setIdeas(e.target.value);
                if (obsidianStatus !== "idle") setObsidianStatus("idle");
              }}
              onBlur={() => {
                if (ideas !== item.ideas) {
                  saveField("ideas", ideas);
                  requestRatingSuggestion();
                }
              }}
            />
            {renderObsidianButton()}
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
            태그
          </label>
          <div className="flex gap-1.5 flex-wrap items-center">
            {tags.map((tag) => (
              <span key={tag} className="group text-[13px] px-2.5 py-1 rounded-md bg-gray-100 text-[var(--secondary)] flex items-center gap-1">
                {tag}
                <button
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all text-xs ml-0.5"
                  onClick={() => removeTag(tag)}
                  title="태그 삭제"
                >
                  &times;
                </button>
              </span>
            ))}
            {showTagInput ? (
              <input
                className="text-[13px] px-2 py-1 border border-[var(--primary)] rounded-md outline-none w-28 bg-white"
                placeholder="태그 입력"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTag(tagInput);
                  if (e.key === "Escape") { setShowTagInput(false); setTagInput(""); }
                }}
                onBlur={() => { if (tagInput.trim()) addTag(tagInput); else setShowTagInput(false); }}
                autoFocus
              />
            ) : (
              <button
                className="text-[13px] px-2 py-1 rounded-md border border-dashed border-gray-300 text-[var(--secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
                onClick={() => setShowTagInput(true)}
              >
                + 추가
              </button>
            )}
          </div>
        </div>

        {/* Thread */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
            스레드
          </label>
          <div className="relative">
            <button
              className="w-full flex items-center justify-between px-3 py-2 border border-[var(--border)] rounded-lg text-sm hover:border-[var(--primary)] transition-colors"
              onClick={() => setThreadOpen(!threadOpen)}
            >
              <span>{item.thread || "미분류"}</span>
              <span className="text-[10px] text-[var(--secondary)]">&#9660;</span>
            </button>
            {threadOpen && (
              <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-[var(--border)] rounded-lg shadow-lg z-50 overflow-hidden">
                <button
                  className={`w-full px-3 py-2.5 text-sm text-left hover:bg-[var(--background)] transition-colors ${
                    !item.thread ? "bg-[var(--primary-light)] text-[var(--primary)] font-medium" : ""
                  }`}
                  onClick={() => { saveField("thread", ""); setThreadOpen(false); }}
                >
                  미분류
                </button>
                {threads.map((t) => (
                  <button
                    key={t}
                    className={`w-full px-3 py-2.5 text-sm text-left hover:bg-[var(--background)] transition-colors ${
                      item.thread === t ? "bg-[var(--primary-light)] text-[var(--primary)] font-medium" : ""
                    }`}
                    onClick={() => { saveField("thread", t); setThreadOpen(false); }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 관련 자료 */}
        {relatedResolved.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
              🔗 관련 자료
            </label>
            <div className="flex flex-col gap-1.5">
              {relatedResolved.map(({ item: rel, reason }) => {
                const thumb = relatedThumbnail(rel);
                return (
                  <button
                    key={rel.id}
                    className="w-full text-left flex items-start gap-2.5 p-2 rounded-lg border border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary-light)] transition-colors"
                    onClick={() => onSelectItem?.(rel.id)}
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="w-12 h-12 object-cover rounded shrink-0 border border-[var(--border)] bg-gray-50"
                        loading="lazy"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <span className="w-12 h-12 rounded shrink-0 bg-gray-100 flex items-center justify-center text-[10px] uppercase text-[var(--secondary)]">
                        {rel.type}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium leading-snug line-clamp-2">{rel.title || "(제목 없음)"}</div>
                      {reason && (
                        <div className="text-[11px] text-[var(--secondary)] leading-relaxed mt-0.5 line-clamp-2">
                          {reason}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Original content — collapsible only when memo exists */}
        {hasMemo && (
          <div className="pt-4 border-t border-[var(--border)]">
            <button
              className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[var(--secondary)] hover:text-[var(--foreground)] transition-colors"
              onClick={() => setShowOriginal(!showOriginal)}
            >
              <span>원본 다시보기</span>
              <span className="text-[10px]">{showOriginal ? "▲ 접기" : "▼ 펼치기"}</span>
            </button>
          </div>
        )}

        {(!hasMemo || showOriginal) && (
          <>
            {/* 책: Notion 전체 보기 CTA */}
            {isBook && item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-[13px] font-medium hover:bg-amber-100 transition-colors"
              >
                📖 Notion에서 전체 보기 ↗
              </a>
            )}

            {/* YouTube embed */}
            {youtubeId && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
                  영상
                </label>
                <div className="w-full aspect-video rounded-lg overflow-hidden bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    className="w-full h-full border-none"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            {/* Instagram embed */}
            {instagramEmbedUrl && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
                  인스타그램
                </label>
                <div className="w-full rounded-lg overflow-hidden border border-[var(--border)]">
                  <iframe
                    src={instagramEmbedUrl}
                    className="w-full border-none"
                    style={{ minHeight: "480px" }}
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            {/* LinkedIn embed */}
            {linkedInUrl && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
                  링크드인
                </label>
                <div className="w-full rounded-lg overflow-hidden border border-[var(--border)]">
                  <iframe
                    src={linkedInUrl}
                    className="w-full border-none"
                    style={{ minHeight: "480px" }}
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            {/* Long Black preview */}
            {longBlack && (
              <LongBlackPreview url={item.url} title={item.title} summary={item.summary} />
            )}

            {/* YouTube 커뮤니티 포스트 preview */}
            {youtubePost && (
              <YouTubePostPreview url={item.url} title={item.title} summary={item.summary} />
            )}

            {/* Images */}
            {imageUrls.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
                  이미지 ({imageUrls.length}장)
                </label>
                <ImageGallery urls={imageUrls} />
              </div>
            )}

            {/* Summary */}
            {item.summary && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
                  {isBook ? "독서 노트" : "요약"}
                </label>
                {isBook ? (
                  <BookSummary markdown={item.summary} />
                ) : (
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{item.summary}</div>
                )}
              </div>
            )}

            {/* URL — 책은 위의 Notion CTA로 대체 */}
            {item.url && !isBook && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
                  원본 링크
                </label>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--primary)] hover:underline truncate block"
                  title={item.url}
                >
                  {item.url}
                </a>
              </div>
            )}
          </>
        )}

        {/* Ideas — placed AFTER content when no memo, to encourage writing */}
        {!hasMemo && (
          <div className="flex flex-col gap-1.5 pt-4 border-t border-[var(--border)]">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
                💡 메모 작성하기
              </label>
              {noteModeButton}
            </div>
            <textarea
              className="w-full min-h-[160px] border border-[var(--border)] rounded-lg p-3 text-sm leading-relaxed outline-none resize-y focus:border-[var(--primary)] transition-colors"
              placeholder="이 자료를 보고 느낀 점, 떠오른 아이디어, 적용할 곳을 적어보세요..."
              value={ideas}
              onChange={(e) => {
                setIdeas(e.target.value);
                if (obsidianStatus !== "idle") setObsidianStatus("idle");
              }}
              onBlur={() => {
                if (ideas !== item.ideas) {
                  saveField("ideas", ideas);
                  requestRatingSuggestion();
                }
              }}
            />
            {renderObsidianButton()}
          </div>
        )}

        {/* Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
            저장일
          </label>
          <div className="text-[13px] text-[var(--secondary)]">{item.created_at}</div>
        </div>

        {/* Delete */}
        <div className="pt-4 border-t border-[var(--border)]">
          {showDeleteConfirm ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-red-600">정말 이 자료를 삭제하시겠습니까?</p>
              <div className="flex gap-2">
                <button
                  className="flex-1 px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  onClick={() => onDelete(item.id)}
                >
                  삭제
                </button>
                <button
                  className="flex-1 px-3 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button
              className="w-full px-3 py-2 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              onClick={() => setShowDeleteConfirm(true)}
            >
              자료 삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
