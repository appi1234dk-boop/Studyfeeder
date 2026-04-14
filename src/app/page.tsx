"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Item } from "@/lib/types";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import ItemCard from "@/components/ItemCard";
import DetailSidebar from "@/components/DetailSidebar";
import StatsView from "@/components/StatsView";

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"items" | "stats">("items");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  useEffect(() => {
    fetch("/api/items")
      .then((r) => r.json())
      .then((data) => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const allTags = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      if (!item.tags) continue;
      for (const tag of item.tags.split(",").map((t) => t.trim()).filter(Boolean)) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [items]);

  const allTypes = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.type] = (counts[item.type] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [items]);

  const threads = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.thread) set.add(item.thread);
    }
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;

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

    result.sort((a, b) => {
      const da = a.created_at || "";
      const db = b.created_at || "";
      return sortOrder === "newest" ? db.localeCompare(da) : da.localeCompare(db);
    });

    return result;
  }, [items, showUnreadOnly, selectedThread, searchQuery, selectedTags, selectedTypes, dateRange, sortOrder]);

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

  const listTitle = showUnreadOnly
    ? "안 읽은 자료"
    : selectedThread === "__none__"
    ? "미분류"
    : selectedThread || "전체 자료";

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
        selectedTypes={selectedTypes}
        onTypesChange={setSelectedTypes}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        allTags={allTags}
        allTypes={allTypes}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          items={items}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          selectedThread={selectedThread}
          onThreadSelect={setSelectedThread}
          showUnreadOnly={showUnreadOnly}
          onToggleUnread={setShowUnreadOnly}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === "items" ? (
            <>
              <div className="flex items-center justify-between mb-5">
                <div className="text-xl font-semibold">{listTitle}</div>
                <button
                  className="text-[13px] text-[var(--secondary)] border border-[var(--border)] px-3 py-1.5 rounded-md hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
                  onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
                >
                  &#8595; {sortOrder === "newest" ? "최신순" : "오래된순"}
                </button>
              </div>
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
            <StatsView items={items} />
          )}
        </main>
        {activeTab === "items" && selectedItem && (
          <DetailSidebar
            item={selectedItem}
            threads={threads}
            onClose={() => setSelectedItemId(null)}
            onUpdate={handleUpdate}
          />
        )}
      </div>
    </div>
  );
}
