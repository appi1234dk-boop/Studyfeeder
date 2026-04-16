"use client";

import { useState, useEffect, useCallback } from "react";
import type { Item } from "@/lib/types";

function driveUrlToThumbnail(url: string): string {
  const m = url.match(/\/d\/([^/]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800`;
  return url;
}

interface DetailSidebarProps {
  item: Item | null;
  threads: string[];
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Item>) => void;
  onDelete: (id: string) => void;
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  return m ? m[1] : null;
}

function getInstagramEmbedUrl(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
  return m ? `https://www.instagram.com/p/${m[1]}/embed/` : null;
}

function getLinkedInEmbedUrl(url: string): string | null {
  // Pattern: linkedin.com/feed/update/urn:li:activity:123456
  const activityMatch = url.match(/linkedin\.com\/feed\/update\/(urn:li:(?:activity|share):\d+)/);
  if (activityMatch) return `https://www.linkedin.com/embed/feed/update/${activityMatch[1]}`;
  // Pattern: linkedin.com/posts/username_...-activity-123...- or -share-123...- or -ugcPost-123...-
  const postMatch = url.match(/linkedin\.com\/posts\/[^/]+-(activity|share|ugcPost)-(\d+)-/);
  if (postMatch) return `https://www.linkedin.com/embed/feed/update/urn:li:${postMatch[1]}:${postMatch[2]}`;
  return null;
}

function isLongBlackUrl(url: string): boolean {
  return /longblack\.co\/note\/\d+/.test(url);
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

export default function DetailSidebar({ item, threads, onClose, onUpdate, onDelete }: DetailSidebarProps) {
  const [title, setTitle] = useState("");
  const [ideas, setIdeas] = useState("");
  const [threadOpen, setThreadOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setIdeas(item.ideas);
      setThreadOpen(false);
      setShowDeleteConfirm(false);
      setTagInput("");
      setShowTagInput(false);
    }
  }, [item]);

  const saveField = useCallback(
    (field: string, value: string | boolean) => {
      if (!item) return;
      onUpdate(item.id, { [field]: value } as Partial<Item>);
    },
    [item, onUpdate]
  );

  if (!item) return null;

  const tags = item.tags ? item.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
  const imageUrls = item.images ? item.images.split(",").map((u) => driveUrlToThumbnail(u.trim())).filter(Boolean) : [];
  const youtubeId = item.type === "youtube" ? getYouTubeId(item.url) : null;
  const instagramEmbedUrl = item.url ? getInstagramEmbedUrl(item.url) : null;
  const linkedInUrl = item.url ? getLinkedInEmbedUrl(item.url) : null;
  const longBlack = item.url ? isLongBlackUrl(item.url) : false;

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

        {/* Images */}
        {imageUrls.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
              이미지 ({imageUrls.length}장)
            </label>
            <ImageGallery urls={imageUrls} />
          </div>
        )}

        {/* URL */}
        {item.url && (
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

        {/* Summary */}
        {item.summary && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
              요약
            </label>
            <div className="text-sm leading-relaxed whitespace-pre-wrap">{item.summary}</div>
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

        {/* Ideas */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--secondary)]">
            메모
          </label>
          <textarea
            className="w-full min-h-[120px] border border-[var(--border)] rounded-lg p-3 text-sm leading-relaxed outline-none resize-y focus:border-[var(--primary)] transition-colors"
            placeholder="아이디어나 메모를 입력하세요..."
            value={ideas}
            onChange={(e) => setIdeas(e.target.value)}
            onBlur={() => { if (ideas !== item.ideas) saveField("ideas", ideas); }}
          />
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
