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

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--secondary)] mb-1">{title}</div>
  );
}

function FilterCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <span className="relative w-4 h-4 shrink-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer appearance-none w-4 h-4 m-0 rounded border border-gray-300 bg-white checked:bg-[var(--primary)] checked:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30 focus-visible:ring-offset-1 cursor-pointer"
      />
      {checked && (
        <svg className="absolute inset-0 pointer-events-none text-white" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m4 8.2 2.5 2.5L12 5.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
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
          <SectionHeader title="유형" />
          <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium cursor-pointer hover:bg-[var(--background)]">
            <FilterCheckbox
              checked={selectedTypes.length === allTypeNames.length}
              onChange={() => onTypesChange(selectedTypes.length === allTypeNames.length ? [] : allTypeNames)}
            />
            <span>전체</span>
          </label>
          <div className="ml-3 pl-3 border-l border-gray-100">
          {allTypes.map((type) => (
            <label key={type.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer hover:bg-[var(--background)]">
              <FilterCheckbox checked={selectedTypes.includes(type.name)} onChange={() => toggleValue(selectedTypes, type.name, onTypesChange)} />
              <span className="uppercase text-[13px] flex-1">{type.name}</span><Count value={type.count} />
            </label>
          ))}
          </div>
        </div>
      )}

      <div className="p-4 pt-0">
        <SectionHeader title="스레드" />
        <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium cursor-pointer hover:bg-[var(--background)]">
          <FilterCheckbox
            checked={availableThreads.length > 0 && selectedThreads.length === availableThreads.length}
            onChange={() => onThreadsChange(selectedThreads.length === availableThreads.length ? [] : availableThreads)}
          />
          <span>전체</span>
        </label>
        <div className="ml-3 pl-3 border-l border-gray-100">
        {threadOrder.map((name) => {
          const label = name === UNCLASSIFIED ? "미분류" : name;
          return (
            <div key={name} onDragOver={(event) => event.preventDefault()} onDrop={() => moveThread(name)} className={`flex items-center gap-1 rounded-lg hover:bg-[var(--background)] ${draggedThread === name ? "opacity-45" : ""}`}>
              <label className="min-w-0 flex-1 flex items-center gap-2 py-1.5 pl-2 text-sm cursor-pointer">
                <FilterCheckbox checked={selectedThreads.includes(name)} onChange={() => toggleValue(selectedThreads, name, onThreadsChange)} />
                <span className="truncate flex-1" title={label}>{label}</span><Count value={threadCounts[name]} />
              </label>
              <button
                type="button" draggable onDragStart={(event) => { setDraggedThread(name); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDraggedThread(null)}
                className="px-2 py-2 text-gray-300 hover:text-[var(--secondary)] cursor-grab active:cursor-grabbing shrink-0" aria-label={`${label} 순서 이동`} title="드래그해서 순서 변경"
              >
                <svg width="17" height="14" viewBox="0 0 17 14" fill="none" aria-hidden="true">
                  <path d="M1 3h15M1 7h15M1 11h15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          );
        })}
        </div>
      </div>
    </aside>
  );
}

function Count({ value }: { value: number }) {
  return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-[var(--secondary)]">{value}</span>;
}
