"use client";

import { useEffect, useMemo, useState } from "react";
import type { Item } from "@/lib/types";

interface SidebarProps {
  items: Item[];
  activeTab: "items" | "stats";
  onTabChange: (tab: "items" | "stats") => void;
  selectedThreads: string[];
  onThreadsChange: (threads: string[]) => void;
  showUnreadOnly: boolean;
  onToggleUnread: (v: boolean) => void;
  selectedTypes: string[];
  onTypesChange: (types: string[]) => void;
  allTypes: { name: string; count: number }[];
}

const THREAD_ORDER_STORAGE_KEY = "studyfeeder-thread-order";
const UNCLASSIFIED = "__none__";

function SectionHeader({ title, onSelectAll, onClear }: { title: string; onSelectAll: () => void; onClear: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--secondary)]">{title}</div>
      <div className="flex items-center gap-1 text-[10px]">
        <button className="text-[var(--primary)] hover:underline" onClick={onSelectAll}>전체선택</button>
        <span className="text-gray-300">·</span>
        <button className="text-[var(--secondary)] hover:text-[var(--danger)] hover:underline" onClick={onClear}>선택해제</button>
      </div>
    </div>
  );
}

export default function Sidebar({
  items, activeTab, onTabChange, selectedThreads, onThreadsChange,
  showUnreadOnly, onToggleUnread, selectedTypes, onTypesChange, allTypes,
}: SidebarProps) {
  const totalCount = items.length;
  const unreadCount = items.filter((item) => !item.is_read).length;
  const [draggedThread, setDraggedThread] = useState<string | null>(null);
  const [threadOrder, setThreadOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = JSON.parse(window.localStorage.getItem(THREAD_ORDER_STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter((value): value is string => typeof value === "string") : [];
    } catch {
      return [];
    }
  });

  const threadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const key = item.thread || UNCLASSIFIED;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [items]);
  const availableThreads = useMemo(
    () => Object.keys(threadCounts).sort((a, b) => threadCounts[b] - threadCounts[a]),
    [threadCounts]
  );
  const availableThreadSignature = availableThreads.join("\u0000");

  useEffect(() => {
    setThreadOrder((current) => {
      const retained = current.filter((name) => availableThreads.includes(name));
      const added = availableThreads.filter((name) => !retained.includes(name));
      const next = [...retained, ...added];
      window.localStorage.setItem(THREAD_ORDER_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableThreadSignature]);

  const allTypeNames = allTypes.map((type) => type.name);
  const allSelected = !showUnreadOnly && selectedTypes.length === allTypeNames.length && selectedThreads.length === availableThreads.length;

  function toggleValue(values: string[], value: string, onChange: (next: string[]) => void) {
    onChange(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]);
  }

  function moveThread(target: string) {
    if (!draggedThread || draggedThread === target) return;
    setThreadOrder((current) => {
      const next = current.filter((name) => name !== draggedThread);
      const targetIndex = next.indexOf(target);
      next.splice(targetIndex < 0 ? next.length : targetIndex, 0, draggedThread);
      window.localStorage.setItem(THREAD_ORDER_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setDraggedThread(null);
  }

  return (
    <aside className="w-[260px] bg-white border-r border-[var(--border)] flex flex-col shrink-0 overflow-y-auto">
      <div className="flex border-b border-[var(--border)]">
        {(["items", "stats"] as const).map((tab) => (
          <button
            key={tab}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? "text-[var(--primary)] border-[var(--primary)]" : "text-[var(--secondary)] border-transparent hover:text-[var(--foreground)]"}`}
            onClick={() => onTabChange(tab)}
          >
            {tab === "items" ? "자료" : "통계"}
          </button>
        ))}
      </div>

      <div className="p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--secondary)] mb-2">전체</div>
        <button
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${allSelected ? "bg-[var(--primary-light)] text-[var(--primary)] font-medium" : "hover:bg-[var(--background)]"}`}
          onClick={() => { onTypesChange(allTypeNames); onThreadsChange(availableThreads); onToggleUnread(false); }}
        >
          <span>전체 자료</span><Count value={totalCount} />
        </button>
        <button
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${showUnreadOnly ? "bg-[var(--primary-light)] text-[var(--primary)] font-medium" : "hover:bg-[var(--background)]"}`}
          onClick={() => onToggleUnread(!showUnreadOnly)}
        >
          <span>안 읽은 자료</span><Count value={unreadCount} />
        </button>
      </div>

      {allTypes.length > 0 && (
        <div className="p-4 pt-0">
          <SectionHeader title="유형" onSelectAll={() => onTypesChange(allTypeNames)} onClear={() => onTypesChange([])} />
          {allTypes.map((type) => (
            <label key={type.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer hover:bg-[var(--background)]">
              <input type="checkbox" checked={selectedTypes.includes(type.name)} onChange={() => toggleValue(selectedTypes, type.name, onTypesChange)} className="w-4 h-4 rounded accent-[var(--primary)]" />
              <span className="uppercase text-[13px] flex-1">{type.name}</span><Count value={type.count} />
            </label>
          ))}
        </div>
      )}

      <div className="p-4 pt-0">
        <SectionHeader title="스레드" onSelectAll={() => onThreadsChange(availableThreads)} onClear={() => onThreadsChange([])} />
        {threadOrder.map((name) => {
          const label = name === UNCLASSIFIED ? "미분류" : name;
          return (
            <div key={name} onDragOver={(event) => event.preventDefault()} onDrop={() => moveThread(name)} className={`flex items-center gap-1 rounded-lg hover:bg-[var(--background)] ${draggedThread === name ? "opacity-45" : ""}`}>
              <button
                type="button" draggable onDragStart={(event) => { setDraggedThread(name); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDraggedThread(null)}
                className="px-1.5 py-2 text-gray-300 hover:text-[var(--secondary)] cursor-grab active:cursor-grabbing" aria-label={`${label} 순서 이동`} title="드래그해서 순서 변경"
              >⋮⋮</button>
              <label className="min-w-0 flex-1 flex items-center gap-2 py-1.5 pr-2 text-sm cursor-pointer">
                <input type="checkbox" checked={selectedThreads.includes(name)} onChange={() => toggleValue(selectedThreads, name, onThreadsChange)} className="w-4 h-4 rounded accent-[var(--primary)] shrink-0" />
                <span className="truncate flex-1" title={label}>{label}</span><Count value={threadCounts[name]} />
              </label>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function Count({ value }: { value: number }) {
  return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-[var(--secondary)]">{value}</span>;
}
