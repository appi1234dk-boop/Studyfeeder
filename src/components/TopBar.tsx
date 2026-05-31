"use client";

import { useState, useRef, useEffect } from "react";

type RatingFilter = null | "unrated" | 1 | 2 | 3;

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  dateRange: { from: string; to: string } | null;
  onDateRangeChange: (range: { from: string; to: string } | null) => void;
  allTags: { name: string; count: number }[];
  ratingFilter: RatingFilter;
  onRatingFilterChange: (r: RatingFilter) => void;
  onLogoClick?: () => void;
}

function FilterDropdown({
  label,
  isOpen,
  onToggle,
  children,
  hasSelection,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  hasSelection: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (isOpen) onToggle();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onToggle]);

  return (
    <div className="relative" ref={ref}>
      <button
        className={`h-9 px-3 border rounded-lg text-[13px] flex items-center gap-1 transition-colors ${
          hasSelection
            ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
            : "border-[var(--border)] text-[var(--secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
        }`}
        onClick={onToggle}
      >
        <span className="text-[10px]">&#9660;</span> {label}
      </button>
      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-0 min-w-[200px] bg-white border border-[var(--border)] rounded-xl shadow-lg p-2 z-50">
          {children}
        </div>
      )}
    </div>
  );
}

function CheckOption({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-[13px] hover:bg-[var(--background)] transition-colors"
      onClick={onClick}
    >
      <div
        className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors ${
          selected
            ? "bg-[var(--primary)] border-[var(--primary)] text-white"
            : "border-[var(--border)]"
        }`}
      >
        {selected && "✓"}
      </div>
      <span className="flex-1 text-left">{label}</span>
      <span className="text-xs text-[var(--secondary)]">{count}</span>
    </button>
  );
}

export default function TopBar({
  searchQuery,
  onSearchChange,
  selectedTags,
  onTagsChange,
  dateRange,
  onDateRangeChange,
  allTags,
  ratingFilter,
  onRatingFilterChange,
  onLogoClick,
}: TopBarProps) {
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(dateRange?.from || "");
  const [dateTo, setDateTo] = useState(dateRange?.to || "");

  function toggleTag(tag: string) {
    onTagsChange(
      selectedTags.includes(tag)
        ? selectedTags.filter((t) => t !== tag)
        : [...selectedTags, tag]
    );
  }

  function applyPreset(days: number) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    const f = from.toISOString().slice(0, 10);
    const t = to.toISOString().slice(0, 10);
    setDateFrom(f);
    setDateTo(t);
    onDateRangeChange({ from: f, to: t });
  }

  function applyCustomDate() {
    if (dateFrom && dateTo) {
      onDateRangeChange({ from: dateFrom, to: dateTo });
    }
  }

  return (
    <header className="h-14 bg-white border-b border-[var(--border)] flex items-center px-6 gap-4 shrink-0">
      <div
        className="text-base font-bold text-[var(--primary)] mr-6 whitespace-nowrap select-none"
        onClick={onLogoClick}
      >
        Studyfeeder
      </div>
      <div className="flex-1 max-w-[480px] relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--secondary)] text-sm">
          &#128269;
        </span>
        <input
          type="text"
          placeholder="제목, 요약, 태그 검색..."
          className="w-full h-9 border border-[var(--border)] rounded-lg pl-9 pr-3 text-sm outline-none focus:border-[var(--primary)] transition-colors"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="flex gap-2 items-center">
        <FilterDropdown
          label="태그"
          isOpen={openFilter === "tag"}
          onToggle={() => setOpenFilter(openFilter === "tag" ? null : "tag")}
          hasSelection={selectedTags.length > 0}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--secondary)] px-2 py-1">
            태그 선택
          </div>
          {allTags.map((t) => (
            <CheckOption
              key={t.name}
              label={t.name}
              count={t.count}
              selected={selectedTags.includes(t.name)}
              onClick={() => toggleTag(t.name)}
            />
          ))}
        </FilterDropdown>

        <FilterDropdown
          label="날짜"
          isOpen={openFilter === "date"}
          onToggle={() => setOpenFilter(openFilter === "date" ? null : "date")}
          hasSelection={dateRange !== null}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--secondary)] px-2 py-1">
            기간 선택
          </div>
          <div className="flex flex-wrap gap-1.5 px-2 py-1">
            {[
              { label: "오늘", days: 0 },
              { label: "최근 7일", days: 7 },
              { label: "최근 30일", days: 30 },
              { label: "최근 3개월", days: 90 },
            ].map((p) => (
              <button
                key={p.label}
                className="px-2.5 py-1 rounded-md text-xs border border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] transition-colors"
                onClick={() => applyPreset(p.days)}
              >
                {p.label}
              </button>
            ))}
            {dateRange && (
              <button
                className="px-2.5 py-1 rounded-md text-xs border border-[var(--danger)] text-[var(--danger)] hover:bg-red-50 transition-colors"
                onClick={() => { onDateRangeChange(null); setDateFrom(""); setDateTo(""); }}
              >
                초기화
              </button>
            )}
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--secondary)] px-2 py-1 mt-1">
            직접 입력
          </div>
          <div className="flex gap-2 px-2 py-1 items-center">
            <input
              type="date"
              className="flex-1 h-8 border border-[var(--border)] rounded-md px-2 text-[13px] outline-none focus:border-[var(--primary)]"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              onBlur={applyCustomDate}
            />
            <span className="text-[var(--secondary)] text-[13px]">~</span>
            <input
              type="date"
              className="flex-1 h-8 border border-[var(--border)] rounded-md px-2 text-[13px] outline-none focus:border-[var(--primary)]"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              onBlur={applyCustomDate}
            />
          </div>
        </FilterDropdown>

        <div className="flex items-center gap-1 border border-[var(--border)] rounded-lg h-9 px-1">
          {([
            { key: null, label: "전체" },
            { key: 1 as const, label: "★" },
            { key: 2 as const, label: "★★" },
            { key: 3 as const, label: "★★★" },
          ]).map((opt) => {
            const active = ratingFilter === opt.key;
            return (
              <button
                key={String(opt.key)}
                className={`px-2 h-7 rounded-md text-[12px] transition-colors ${
                  active
                    ? "bg-amber-100 text-amber-700 font-medium"
                    : "text-[var(--secondary)] hover:text-[var(--foreground)]"
                }`}
                onClick={() => onRatingFilterChange(opt.key)}
                title={opt.key === null ? "별점 필터 해제" : `${opt.label}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
