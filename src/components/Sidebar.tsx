"use client";

import type { Item } from "@/lib/types";

type RatingFilter = null | "unrated" | 1 | 2 | 3;

interface SidebarProps {
  items: Item[];
  activeTab: "items" | "stats";
  onTabChange: (tab: "items" | "stats") => void;
  selectedThread: string | null;
  onThreadSelect: (thread: string | null) => void;
  showUnreadOnly: boolean;
  onToggleUnread: (v: boolean) => void;
  ratingFilter: RatingFilter;
  onRatingFilterChange: (r: RatingFilter) => void;
  ratingCounts: { unrated: number; one: number; two: number; three: number };
}

export default function Sidebar({
  items,
  activeTab,
  onTabChange,
  selectedThread,
  onThreadSelect,
  showUnreadOnly,
  onToggleUnread,
  ratingFilter,
  onRatingFilterChange,
  ratingCounts,
}: SidebarProps) {
  const totalCount = items.length;
  const unreadCount = items.filter((i) => !i.is_read).length;

  const threadCounts: Record<string, number> = {};
  let unclassifiedCount = 0;
  for (const item of items) {
    if (item.thread) {
      threadCounts[item.thread] = (threadCounts[item.thread] || 0) + 1;
    } else {
      unclassifiedCount++;
    }
  }
  const threads = Object.entries(threadCounts).sort((a, b) => b[1] - a[1]);

  return (
    <aside className="w-[240px] bg-white border-r border-[var(--border)] flex flex-col shrink-0 overflow-y-auto">
      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]">
        <button
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "items"
              ? "text-[var(--primary)] border-[var(--primary)]"
              : "text-[var(--secondary)] border-transparent hover:text-[var(--foreground)]"
          }`}
          onClick={() => onTabChange("items")}
        >
          자료
        </button>
        <button
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "stats"
              ? "text-[var(--primary)] border-[var(--primary)]"
              : "text-[var(--secondary)] border-transparent hover:text-[var(--foreground)]"
          }`}
          onClick={() => onTabChange("stats")}
        >
          통계
        </button>
      </div>

      {/* All / Unread */}
      <div className="p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--secondary)] mb-2">
          전체
        </div>
        <button
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
            selectedThread === null && !showUnreadOnly
              ? "bg-[var(--primary-light)] text-[var(--primary)] font-medium"
              : "hover:bg-[var(--background)]"
          }`}
          onClick={() => { onThreadSelect(null); onToggleUnread(false); }}
        >
          <span>전체 자료</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            selectedThread === null && !showUnreadOnly
              ? "bg-[var(--primary)]/15 text-[var(--primary)]"
              : "bg-gray-100 text-[var(--secondary)]"
          }`}>
            {totalCount}
          </span>
        </button>
        <button
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
            showUnreadOnly
              ? "bg-[var(--primary-light)] text-[var(--primary)] font-medium"
              : "hover:bg-[var(--background)]"
          }`}
          onClick={() => { onThreadSelect(null); onToggleUnread(true); }}
        >
          <span>안 읽은 자료</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            showUnreadOnly
              ? "bg-[var(--primary)]/15 text-[var(--primary)]"
              : "bg-gray-100 text-[var(--secondary)]"
          }`}>
            {unreadCount}
          </span>
        </button>
      </div>

      {/* Rating */}
      <div className="p-4 pt-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--secondary)] mb-2">
          재가치
        </div>
        {([
          { key: 3 as const, label: "★★★ 자주 보기", count: ratingCounts.three },
          { key: 2 as const, label: "★★ 다시 보고 싶음", count: ratingCounts.two },
          { key: 1 as const, label: "★ 1회독", count: ratingCounts.one },
          { key: "unrated" as const, label: "미평가", count: ratingCounts.unrated },
        ]).map((opt) => {
          const active = ratingFilter === opt.key;
          return (
            <button
              key={String(opt.key)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-[var(--primary-light)] text-[var(--primary)] font-medium"
                  : "hover:bg-[var(--background)]"
              }`}
              onClick={() => onRatingFilterChange(active ? null : opt.key)}
            >
              <span className={opt.key === "unrated" ? "text-[var(--secondary)]" : "text-amber-600"}>
                {opt.label}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  active
                    ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                    : "bg-gray-100 text-[var(--secondary)]"
                }`}
              >
                {opt.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Threads */}
      <div className="p-4 pt-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--secondary)] mb-2">
          스레드
        </div>
        {threads.map(([name, count]) => (
          <button
            key={name}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedThread === name
                ? "bg-[var(--primary-light)] text-[var(--primary)] font-medium"
                : "hover:bg-[var(--background)]"
            }`}
            onClick={() => { onThreadSelect(name); onToggleUnread(false); }}
          >
            <span>{name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              selectedThread === name
                ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                : "bg-gray-100 text-[var(--secondary)]"
            }`}>
              {count}
            </span>
          </button>
        ))}
        {unclassifiedCount > 0 && (
          <button
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedThread === "__none__"
                ? "bg-[var(--primary-light)] text-[var(--primary)] font-medium"
                : "hover:bg-[var(--background)]"
            }`}
            onClick={() => { onThreadSelect("__none__"); onToggleUnread(false); }}
          >
            <span>미분류</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              selectedThread === "__none__"
                ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                : "bg-gray-100 text-[var(--secondary)]"
            }`}>
              {unclassifiedCount}
            </span>
          </button>
        )}
      </div>
    </aside>
  );
}
