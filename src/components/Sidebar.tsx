"use client";

import { useEffect, useMemo, useState } from "react";
import type { Item } from "@/lib/types";
import type { ThreadStructureEntry } from "@/lib/sheets";

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
  isOwner?: boolean;
}

const UNCLASSIFIED = "__none__";
const COLLAPSED_STORAGE_KEY = "studyfeeder-collapsed-thread-folders";
type DragItem = { kind: "folder" | "thread"; id: string };

function FilterCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return <span className="relative w-4 h-4 shrink-0"><input type="checkbox" checked={checked} onChange={onChange} className="appearance-none w-4 h-4 m-0 rounded border border-gray-300 bg-white checked:bg-[var(--primary)] checked:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30 cursor-pointer" />{checked && <svg className="absolute inset-0 pointer-events-none text-white" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 8.2 2.5 2.5L12 5.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>;
}

function Count({ value }: { value: number }) {
  return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-[var(--secondary)]">{value}</span>;
}

function DragHandle({ label, onStart, onEnd }: { label: string; onStart: () => void; onEnd: () => void }) {
  return <button type="button" draggable onDragStart={(event) => { onStart(); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={onEnd} className="px-2 py-2 text-gray-300 hover:text-[var(--secondary)] cursor-grab active:cursor-grabbing shrink-0" aria-label={`${label} 순서 이동`} title="드래그해서 순서 변경"><svg width="17" height="14" viewBox="0 0 17 14" fill="none" aria-hidden="true"><path d="M1 3h15M1 7h15M1 11h15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></button>;
}

export default function Sidebar({ items, activeTab, onTabChange, selectedThreads, onThreadsChange, showUnreadOnly, onToggleUnread, selectedTypes, onTypesChange, allTypes, isOwner = false }: SidebarProps) {
  const [entries, setEntries] = useState<ThreadStructureEntry[]>([]);
  const [dragged, setDragged] = useState<DragItem | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) || "[]"); } catch { return []; }
  });

  const threadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) counts[item.thread || UNCLASSIFIED] = (counts[item.thread || UNCLASSIFIED] || 0) + 1;
    return counts;
  }, [items]);
  const availableThreads = useMemo(() => Object.keys(threadCounts), [threadCounts]);
  const signature = availableThreads.slice().sort().join("\u0000");

  useEffect(() => {
    fetch("/api/thread-structure").then((response) => response.json()).then((data) => {
      if (!Array.isArray(data)) return;
      const loaded = data as ThreadStructureEntry[];
      const configured = new Set(loaded.filter((entry) => entry.kind === "thread").map((entry) => entry.name));
      const nextOrder = Math.max(-1, ...loaded.filter((entry) => !entry.parent_id).map((entry) => entry.sort_order)) + 1;
      const missing = availableThreads.filter((name) => !configured.has(name)).map((name, index): ThreadStructureEntry => ({ kind: "thread", id: `thread:${name}`, name, parent_id: "", sort_order: nextOrder + index }));
      setEntries([...loaded, ...missing]);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setEntries((current) => {
      const folders = current.filter((entry) => entry.kind === "folder");
      const knownThreads = current.filter((entry) => entry.kind === "thread" && availableThreads.includes(entry.name));
      const knownNames = new Set(knownThreads.map((entry) => entry.name));
      const nextOrder = Math.max(-1, ...current.filter((entry) => !entry.parent_id).map((entry) => entry.sort_order)) + 1;
      const additions = availableThreads.filter((name) => !knownNames.has(name)).map((name, index): ThreadStructureEntry => ({ kind: "thread", id: `thread:${name}`, name, parent_id: "", sort_order: nextOrder + index }));
      return [...folders, ...knownThreads, ...additions];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const folders = entries.filter((entry) => entry.kind === "folder").sort((a, b) => a.sort_order - b.sort_order);
  const rootItems = entries.filter((entry) => !entry.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  const allTypeNames = allTypes.map((type) => type.name);
  const allSelected = !showUnreadOnly && selectedTypes.length === allTypeNames.length && selectedThreads.length === availableThreads.length;

  function persist(next: ThreadStructureEntry[]) {
    setEntries(next);
    fetch("/api/thread-structure", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries: next }) }).catch(() => {});
  }

  function moveEntry(targetParent: string, beforeId?: string) {
    if (!dragged || !isOwner) return;
    const moving = entries.find((entry) => entry.id === dragged.id);
    if (!moving) return;
    if (moving.kind === "folder") targetParent = "";
    const siblings = entries.filter((entry) => entry.id !== moving.id && entry.parent_id === targetParent).sort((a, b) => a.sort_order - b.sort_order);
    const index = beforeId ? siblings.findIndex((entry) => entry.id === beforeId) : siblings.length;
    siblings.splice(index < 0 ? siblings.length : index, 0, { ...moving, parent_id: targetParent });
    const changed = new Map(siblings.map((entry, order) => [entry.id, { ...entry, sort_order: order }]));
    persist(entries.map((entry) => changed.get(entry.id) || entry));
    setDragged(null);
  }

  function toggleValue(values: string[], value: string, onChange: (next: string[]) => void) {
    onChange(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]);
  }

  function toggleFolder(id: string) {
    const next = collapsed.includes(id) ? collapsed.filter((entry) => entry !== id) : [...collapsed, id];
    setCollapsed(next);
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(next));
  }

  function createFolder() {
    const name = folderName.trim();
    if (!name || folders.some((folder) => folder.name === name)) return;
    const next = [...entries, { kind: "folder", id: `folder:${crypto.randomUUID()}`, name, parent_id: "", sort_order: rootItems.length } as ThreadStructureEntry];
    persist(next); setFolderName(""); setShowFolderModal(false);
  }

  function renderThread(entry: ThreadStructureEntry, nested = false) {
    const label = entry.name === UNCLASSIFIED ? "미분류" : entry.name;
    return <div key={entry.id} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }} onDrop={(event) => { event.stopPropagation(); moveEntry(entry.parent_id, entry.id); }} className={`flex items-center gap-1 rounded-lg hover:bg-[var(--background)] ${nested ? "ml-5" : ""} ${dragged?.id === entry.id ? "opacity-45" : ""}`}>
      <label className="min-w-0 flex-1 flex items-center gap-2 py-1.5 pl-2 text-sm cursor-pointer"><FilterCheckbox checked={selectedThreads.includes(entry.name)} onChange={() => toggleValue(selectedThreads, entry.name, onThreadsChange)} /><span className="truncate flex-1" title={label}>{label}</span><Count value={threadCounts[entry.name] || 0} /></label>
      {isOwner && <DragHandle label={label} onStart={() => setDragged({ kind: "thread", id: entry.id })} onEnd={() => setDragged(null)} />}
    </div>;
  }

  return <aside className="w-[260px] bg-white border-r border-[var(--border)] flex flex-col shrink-0 overflow-y-auto">
    <div className="flex border-b border-[var(--border)]">{(["items", "stats"] as const).map((tab) => <button key={tab} className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === tab ? "text-[var(--primary)] border-[var(--primary)]" : "text-[var(--secondary)] border-transparent"}`} onClick={() => onTabChange(tab)}>{tab === "items" ? "자료" : "통계"}</button>)}</div>
    <div className="p-4"><div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--secondary)] mb-2">전체</div><button className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${allSelected ? "bg-[var(--primary-light)] text-[var(--primary)] font-medium" : "hover:bg-[var(--background)]"}`} onClick={() => { onTypesChange(allTypeNames); onThreadsChange(availableThreads); onToggleUnread(false); }}><span>전체 자료</span><Count value={items.length} /></button><button className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${showUnreadOnly ? "bg-[var(--primary-light)] text-[var(--primary)] font-medium" : "hover:bg-[var(--background)]"}`} onClick={() => onToggleUnread(!showUnreadOnly)}><span>안 읽은 자료</span><Count value={items.filter((item) => !item.is_read).length} /></button></div>
    {allTypes.length > 0 && <div className="p-4 pt-0"><div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--secondary)] mb-1">유형</div><label className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium cursor-pointer"><FilterCheckbox checked={selectedTypes.length === allTypeNames.length} onChange={() => onTypesChange(selectedTypes.length === allTypeNames.length ? [] : allTypeNames)} /><span>전체</span></label><div className="ml-3 pl-3 border-l border-gray-100">{allTypes.map((type) => <label key={type.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer hover:bg-[var(--background)]"><FilterCheckbox checked={selectedTypes.includes(type.name)} onChange={() => toggleValue(selectedTypes, type.name, onTypesChange)} /><span className="uppercase text-[13px] flex-1">{type.name}</span><Count value={type.count} /></label>)}</div></div>}
    <div className="p-4 pt-0"><div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--secondary)] mb-1">스레드</div><div className="flex items-center rounded-lg" onDragOver={(event) => event.preventDefault()} onDrop={() => moveEntry("")}><label className="flex-1 flex items-center gap-2 px-2 py-1.5 text-sm font-medium cursor-pointer"><FilterCheckbox checked={availableThreads.length > 0 && selectedThreads.length === availableThreads.length} onChange={() => onThreadsChange(selectedThreads.length === availableThreads.length ? [] : availableThreads)} /><span>전체</span></label>{isOwner && <button className="w-7 h-7 rounded-md text-lg text-[var(--primary)] hover:bg-[var(--primary-light)]" onClick={() => setShowFolderModal(true)} title="폴더 추가" aria-label="스레드 폴더 추가">+</button>}</div>
      <div className="ml-3 pl-3 border-l border-gray-100">{rootItems.map((entry) => entry.kind === "thread" ? renderThread(entry) : <div key={entry.id} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged?.kind === "thread") moveEntry(entry.id); else moveEntry("", entry.id); }} className={dragged?.id === entry.id ? "opacity-45" : ""}><div className="flex items-center gap-1 rounded-lg hover:bg-[var(--background)]"><button className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-left" onClick={() => toggleFolder(entry.id)}><span className="text-amber-500">&#128193;</span><span className="truncate flex-1">{entry.name}</span><span className="text-[11px] text-[var(--secondary)]">{collapsed.includes(entry.id) ? "▾" : "▴"}</span></button>{isOwner && <DragHandle label={entry.name} onStart={() => setDragged({ kind: "folder", id: entry.id })} onEnd={() => setDragged(null)} />}</div>{!collapsed.includes(entry.id) && entries.filter((child) => child.kind === "thread" && child.parent_id === entry.id).sort((a, b) => a.sort_order - b.sort_order).map((child) => renderThread(child, true))}</div>)}</div>
    </div>
    {showFolderModal && <div className="fixed inset-0 z-[1100] bg-black/30 flex items-center justify-center" onClick={() => setShowFolderModal(false)}><div className="w-[340px] bg-white rounded-xl p-5 shadow-xl" onClick={(event) => event.stopPropagation()}><h3 className="font-semibold mb-3">새 스레드 폴더</h3><input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createFolder(); }} placeholder="폴더명" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" /><div className="flex justify-end gap-2 mt-4"><button className="px-3 py-1.5 text-sm" onClick={() => setShowFolderModal(false)}>취소</button><button className="px-3 py-1.5 text-sm rounded-md bg-[var(--primary)] text-white" onClick={createFolder}>만들기</button></div></div></div>}
  </aside>;
}
