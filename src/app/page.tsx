"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Item } from "@/lib/types";
import type { LinksMap } from "@/lib/sheets";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import ItemCard from "@/components/ItemCard";
import DetailSidebar from "@/components/DetailSidebar";
import NoteTakingMode from "@/components/NoteTakingMode";
import StatsView from "@/components/StatsView";
import UnlockModal from "@/components/UnlockModal";

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [links, setLinks] = useState<LinksMap>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"items" | "stats">("items");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "rating">("newest");
  const [ratingFilter, setRatingFilter] = useState<null | "unrated" | 1 | 2 | 3>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);

  useEffect(() => {
    fetch("/api/items")
      .then((r) => r.json())
      .then((data) => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
    fetch("/api/links")
      .then((r) => r.json())
      .then((data) => setLinks(data || {}))
      .catch(() => {});
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setIsOwner(Boolean(data?.isOwner)))
      .catch(() => {});
  }, []);

  const activeItems = useMemo(() => items.filter((i) => !i.is_archived), [items]);

  const allTags = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of activeItems) {
      if (!item.tags) continue;
      for (const tag of item.tags.split(",").map((t) => t.trim()).filter(Boolean)) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [activeItems]);

  const allTypes = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of activeItems) {
      counts[item.type] = (counts[item.type] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [activeItems]);

  const threads = useMemo(() => {
    const set = new Set<string>();
    for (const item of activeItems) {
      if (item.thread) set.add(item.thread);
    }
    return Array.from(set).sort();
  }, [activeItems]);

  const filteredItems = useMemo(() => {
    let result = [...activeItems];

    if (showUnreadOnly) {
      result = result.filter((i) => !i.is_read);
    }

    if (selectedThread === "__none__") {
      result = result.filter((i) => !i.thread);
    } else if (selectedThread) {
      result = result.filter((i) => i.thread === selectedThread);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.summary.toLowerCase().includes(q) ||
          i.tags.toLowerCase().includes(q)
      );
    }

    if (selectedTags.length > 0) {
      result = result.filter((i) => {
        const itemTags = i.tags.split(",").map((t) => t.trim());
        return selectedTags.some((t) => itemTags.includes(t));
      });
    }

    if (selectedTypes.length > 0) {
      result = result.filter((i) => selectedTypes.includes(i.type));
    }

    if (dateRange) {
      result = result.filter((i) => {
        const d = i.created_at?.slice(0, 10);
        return d && d >= dateRange.from && d <= dateRange.to;
      });
    }

    if (ratingFilter !== null) {
      if (ratingFilter === "unrated") {
        result = result.filter((i) => (i.value_rating || 0) === 0);
      } else {
        result = result.filter((i) => (i.value_rating || 0) === ratingFilter);
      }
    }

    result.sort((a, b) => {
      const da = a.created_at || "";
      const db = b.created_at || "";
      if (sortOrder === "rating") {
        const diff = (b.value_rating || 0) - (a.value_rating || 0);
        if (diff !== 0) return diff;
        return db.localeCompare(da);
      }
      return sortOrder === "newest" ? db.localeCompare(da) : da.localeCompare(db);
    });

    return result;
  }, [activeItems, showUnreadOnly, selectedThread, searchQuery, selectedTags, selectedTypes, dateRange, sortOrder, ratingFilter]);

  const selectedItem = items.find((i) => i.id === selectedItemId) || null;

  const handleUpdate = useCallback(
    async (id: string, updates: Partial<Item>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
      try {
        await fetch(`/api/items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
      } catch {
        const res = await fetch("/api/items");
        const data = await res.json();
        setItems(data);
      }
    },
    []
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setSelectedItemId(null);
      try {
        await fetch(`/api/items/${id}`, { method: "DELETE" });
      } catch {
        const res = await fetch("/api/items");
        const data = await res.json();
        setItems(data);
      }
    },
    []
  );

  const hasActiveFilters = searchQuery || selectedTags.length > 0 || selectedTypes.length > 0 || dateRange || ratingFilter !== null;

  const listTitle = showUnreadOnly
    ? "안 읽은 자료"
    : selectedThread === "__none__"
    ? "미분류"
    : selectedThread
    ? selectedThread
    : hasActiveFilters
    ? "검색 자료"
    : "전체 자료";

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--secondary)]">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedTags={selectedTags}
        onTagsChange={setSelectedTags}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        allTags={allTags}
        ratingFilter={ratingFilter}
        onRatingFilterChange={setRatingFilter}
        onLogoClick={() => setShowUnlock(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          items={activeItems}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          selectedThread={selectedThread}
          onThreadSelect={setSelectedThread}
          showUnreadOnly={showUnreadOnly}
          onToggleUnread={setShowUnreadOnly}
          selectedTypes={selectedTypes}
          onTypesChange={setSelectedTypes}
          allTypes={allTypes}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === "items" ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xl font-semibold">
                  {listTitle}
                  <span className="text-sm font-normal text-[var(--secondary)] ml-2">
                    {filteredItems.length}건
                  </span>
                </div>
                <button
                  className="text-[13px] text-[var(--secondary)] border border-[var(--border)] px-3 py-1.5 rounded-md hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
                  onClick={() =>
                    setSortOrder(
                      sortOrder === "newest" ? "oldest" : sortOrder === "oldest" ? "rating" : "newest"
                    )
                  }
                >
                  &#8595; {sortOrder === "newest" ? "최신순" : sortOrder === "oldest" ? "오래된순" : "별점순"}
                </button>
              </div>
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {searchQuery && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
                      검색: &quot;{searchQuery}&quot;
                      <button
                        className="ml-0.5 hover:text-[var(--danger)] transition-colors"
                        onClick={() => setSearchQuery("")}
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200"
                    >
                      태그: {tag}
                      <button
                        className="ml-0.5 hover:text-[var(--danger)] transition-colors"
                        onClick={() => setSelectedTags(selectedTags.filter((t) => t !== tag))}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {selectedTypes.map((type) => (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-purple-50 text-purple-700 border border-purple-200"
                    >
                      유형: {type}
                      <button
                        className="ml-0.5 hover:text-[var(--danger)] transition-colors"
                        onClick={() => setSelectedTypes(selectedTypes.filter((t) => t !== type))}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {dateRange && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-green-50 text-green-700 border border-green-200">
                      기간: {dateRange.from} ~ {dateRange.to}
                      <button
                        className="ml-0.5 hover:text-[var(--danger)] transition-colors"
                        onClick={() => setDateRange(null)}
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {ratingFilter !== null && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200">
                      콘텐츠 가치: {ratingFilter === "unrated" ? "미평가" : "★".repeat(ratingFilter)}
                      <button
                        className="ml-0.5 hover:text-[var(--danger)] transition-colors"
                        onClick={() => setRatingFilter(null)}
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  <button
                    className="px-2.5 py-1 rounded-full text-xs text-[var(--secondary)] hover:text-[var(--danger)] hover:bg-red-50 transition-colors"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedTags([]);
                      setSelectedTypes([]);
                      setDateRange(null);
                      setRatingFilter(null);
                    }}
                  >
                    전체 해제
                  </button>
                </div>
              )}
              <div className="flex flex-col gap-2">
                {filteredItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    isSelected={selectedItemId === item.id}
                    onClick={() => setSelectedItemId(item.id)}
                  />
                ))}
                {filteredItems.length === 0 && (
                  <div className="text-center text-[var(--secondary)] py-12">
                    자료가 없습니다
                  </div>
                )}
              </div>
            </>
          ) : (
            <StatsView
              items={activeItems}
              onTagClick={(tag) => {
                setSelectedTags([tag]);
                setSelectedThread(null);
                setShowUnreadOnly(false);
                setActiveTab("items");
              }}
            />
          )}
        </main>
        {activeTab === "items" && selectedItem && (
          <DetailSidebar
            item={selectedItem}
            items={items}
            relatedLinks={links[selectedItem.id] ?? []}
            onSelectItem={setSelectedItemId}
            threads={threads}
            onClose={() => setSelectedItemId(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onEnterNoteMode={() => setNoteMode(true)}
            isOwner={isOwner}
          />
        )}
      </div>
      {noteMode && selectedItem && (
        <NoteTakingMode
          item={selectedItem}
          onClose={() => setNoteMode(false)}
          onUpdate={handleUpdate}
          isOwner={isOwner}
        />
      )}
      {showUnlock && (
        <UnlockModal
          isOwner={isOwner}
          onClose={() => setShowUnlock(false)}
          onChange={setIsOwner}
        />
      )}
    </div>
  );
}
