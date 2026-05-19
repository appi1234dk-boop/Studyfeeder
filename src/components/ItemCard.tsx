"use client";

import type { Item } from "@/lib/types";

const TYPE_STYLES: Record<string, string> = {
  youtube: "bg-red-50 text-red-600",
  blog: "bg-orange-50 text-orange-600",
  article: "bg-blue-50 text-blue-600",
  image: "bg-purple-50 text-purple-600",
  linkedin: "bg-sky-50 text-sky-700",
  instagram: "bg-pink-50 text-pink-600",
};

interface ItemCardProps {
  item: Item;
  isSelected: boolean;
  onClick: () => void;
}

function getDisplayType(item: Item): string {
  if (item.url && /linkedin\.com/i.test(item.url)) return "linkedin";
  if (item.url && /instagram\.com/i.test(item.url)) return "instagram";
  return item.type;
}

function RatingStars({ rating }: { rating: number }) {
  if (!rating || rating < 1) return null;
  return (
    <span className="text-[12px] text-amber-500 leading-none" aria-label={`재가치 ${rating}점`}>
      {"★".repeat(Math.min(3, rating))}
    </span>
  );
}

export default function ItemCard({ item, isSelected, onClick }: ItemCardProps) {
  const displayType = getDisplayType(item);
  const tags = item.tags ? item.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
  const memoLines = item.ideas ? item.ideas.split("\n").map((s) => s.trim()).filter(Boolean) : [];
  const hasMemo = memoLines.length > 0;
  const memoPreview = memoLines.join(" · ");
  const imageCount = item.images ? item.images.split(",").filter(Boolean).length : 0;

  return (
    <button
      className={`w-full text-left bg-white border rounded-xl px-5 py-4 flex items-start gap-4 transition-all ${
        isSelected
          ? "border-[var(--primary)] bg-[var(--primary-light)]"
          : "border-[var(--border)] hover:border-[var(--primary)] hover:shadow-sm"
      }`}
      onClick={onClick}
    >
      <div
        className={`w-2 h-2 rounded-full mt-[7px] shrink-0 ${
          item.is_read ? "bg-[var(--border)]" : "bg-[var(--primary)]"
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[11px] font-semibold uppercase px-1.5 py-0.5 rounded ${TYPE_STYLES[displayType] || "bg-gray-100 text-gray-500"}`}>
            {displayType}
          </span>
          <RatingStars rating={item.value_rating} />
          {!hasMemo && (
            <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">메모 없음</span>
          )}
          <span className="text-xs text-[var(--secondary)] ml-auto">
            {item.created_at?.slice(0, 10)}
          </span>
        </div>
        <div className="text-[15px] font-medium mb-1 leading-snug">{item.title || "(제목 없음)"}</div>

        {hasMemo ? (
          <>
            <div className="text-[13px] text-[var(--foreground)] leading-relaxed line-clamp-2 flex items-start gap-1.5">
              <span className="text-amber-500 shrink-0">&#128161;</span>
              <span className="flex-1">{memoPreview}</span>
            </div>
            {item.summary && (
              <div className="text-[11px] text-[var(--secondary)] mt-1 line-clamp-1 opacity-70">
                {item.summary}
              </div>
            )}
          </>
        ) : (
          <div className="text-[13px] text-[var(--secondary)] leading-relaxed line-clamp-2">
            {item.summary}
          </div>
        )}

        {tags.length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-[var(--secondary)]">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 mt-2">
          {item.thread && (
            <span className="text-[11px] text-[var(--secondary)] flex items-center gap-1">
              &#128206; {item.thread}
            </span>
          )}
          {imageCount > 0 && (
            <span className="text-[11px] text-[var(--secondary)] flex items-center gap-1">
              &#128444; 이미지 {imageCount}장
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
