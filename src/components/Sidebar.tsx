"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  onThreadCatalogChange?: (threads: string[]) => void;
  onThreadRename?: (oldName: string, newName: string) => void;
}

const UNCLASSIFIED = "__none__";
const COLLAPSED_STORAGE_KEY = "studyfeeder-collapsed-thread-folders";
type DragItem = { kind: "folder" | "thread"; id: string };
type DropTarget = { kind: "line" | "folder" | "root"; id: string };
type ContextMenu = { entry: ThreadStructureEntry; x: number; y: number };

function FilterCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return <span className="relative w-4 h-4 shrink-0"><input type="checkbox" checked={checked} onChange={onChange} className="appearance-none w-4 h-4 m-0 rounded border border-gray-300 bg-white checked:bg-[var(--primary)] checked:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30 cursor-pointer" />{checked && <svg className="absolute inset-0 pointer-events-none text-white" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 8.2 2.5 2.5L12 5.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>;
}

function Count({ value }: { value: number }) {
  return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-[var(--secondary)]">{value}</span>;
}

function DragHandle({ label, onStart, onEnd }: { label: string; onStart: () => void; onEnd: () => void }) {
  return <button type="button" draggable onDragStart={(event) => {
    onStart(); event.dataTransfer.effectAllowed = "move";
    const row = event.currentTarget.closest("[data-drag-row]") as HTMLElement | null;
    if (row) {
      const ghost = row.cloneNode(true) as HTMLElement;
      const rect = row.getBoundingClientRect();
      ghost.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${rect.width}px;opacity:.72;background:white;border:1px solid #93c5fd;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.18);`;
      document.body.appendChild(ghost);
      event.dataTransfer.setDragImage(ghost, Math.min(event.nativeEvent.offsetX, rect.width - 8), rect.height / 2);
      setTimeout(() => ghost.remove(), 0);
    }
  }} onDragEnd={onEnd} className="px-2 py-2 text-gray-300 hover:text-[var(--secondary)] cursor-grab active:cursor-grabbing shrink-0" aria-label={`${label} 순서 이동`} title="드래그해서 순서 변경"><svg width="17" height="14" viewBox="0 0 17 14" fill="none" aria-hidden="true"><path d="M1 3h15M1 7h15M1 11h15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></button>;
}

export default function Sidebar({ items, activeTab, onTabChange, selectedThreads, onThreadsChange, showUnreadOnly, onToggleUnread, selectedTypes, onTypesChange, allTypes, isOwner = false, onThreadCatalogChange, onThreadRename }: SidebarProps) {
  const [entries, setEntries] = useState<ThreadStructureEntry[]>([]);
  const [dragged, setDragged] = useState<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createKind, setCreateKind] = useState<"thread" | "folder">("thread");
  const [newEntryName, setNewEntryName] = useState("");
  const [renameTarget, setRenameTarget] = useState<ThreadStructureEntry | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const [collapsed, setCollapsed] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) || "[]"); } catch { return []; }
  });

  const threadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) counts[item.thread || UNCLASSIFIED] = (counts[item.thread || UNCLASSIFIED] || 0) + 1;
    return counts;
  }, [items]);
  const itemThreads = useMemo(() => Object.keys(threadCounts), [threadCounts]);
  const availableThreads = useMemo(() => Array.from(new Set([
    ...entries.filter((entry) => entry.kind === "thread").map((entry) => entry.name),
    ...itemThreads,
  ])), [entries, itemThreads]);
  const signature = itemThreads.slice().sort().join("\u0000");

  useEffect(() => {
    fetch("/api/thread-structure", { cache: "no-store" }).then((response) => response.json()).then((data) => {
      if (!Array.isArray(data)) return;
      const loaded = data as ThreadStructureEntry[];
      const configured = new Set(loaded.filter((entry) => entry.kind === "thread").map((entry) => entry.name));
      const nextOrder = Math.max(-1, ...loaded.filter((entry) => !entry.parent_id).map((entry) => entry.sort_order)) + 1;
      const missing = itemThreads.filter((name) => !configured.has(name)).map((name, index): ThreadStructureEntry => ({ kind: "thread", id: `thread:${name}`, name, parent_id: "", sort_order: nextOrder + index }));
      setEntries([...loaded, ...missing]);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setEntries((current) => {
      const folders = current.filter((entry) => entry.kind === "folder");
      const knownThreads = current.filter((entry) => entry.kind === "thread");
      const knownNames = new Set(knownThreads.map((entry) => entry.name));
      const nextOrder = Math.max(-1, ...current.filter((entry) => !entry.parent_id).map((entry) => entry.sort_order)) + 1;
      const additions = itemThreads.filter((name) => !knownNames.has(name)).map((name, index): ThreadStructureEntry => ({ kind: "thread", id: `thread:${name}`, name, parent_id: "", sort_order: nextOrder + index }));
      return [...folders, ...knownThreads, ...additions];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    onThreadCatalogChange?.(availableThreads.filter((name) => name !== UNCLASSIFIED));
  }, [availableThreads, onThreadCatalogChange]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  const rootItems = entries.filter((entry) => !entry.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  const allTypeNames = allTypes.map((type) => type.name);
  const allSelected = !showUnreadOnly && selectedTypes.length === allTypeNames.length && selectedThreads.length === availableThreads.length;

  function persist(next: ThreadStructureEntry[]) {
    setEntries(next);
    const body = JSON.stringify({ entries: next });
    saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
      const response = await fetch("/api/thread-structure", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
        cache: "no-store",
        keepalive: true,
      });
      if (!response.ok) throw new Error(`Failed to save thread structure: ${response.status}`);
    });
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
    setDropTarget(null);
  }

  function toggleValue(values: string[], value: string, onChange: (next: string[]) => void) {
    onChange(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]);
  }

  function toggleFolder(id: string) {
    const next = collapsed.includes(id) ? collapsed.filter((entry) => entry !== id) : [...collapsed, id];
    setCollapsed(next);
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(next));
  }

  function createEntry() {
    const name = newEntryName.trim();
    if (!name || entries.some((entry) => entry.kind === createKind && entry.name === name)) return;
    const next = [...entries, { kind: createKind, id: `${createKind}:${crypto.randomUUID()}`, name, parent_id: "", sort_order: rootItems.length } as ThreadStructureEntry];
    persist(next); setNewEntryName(""); setShowCreateModal(false);
  }

  function openRename(entry: ThreadStructureEntry) {
    setContextMenu(null); setRenameTarget(entry); setRenameName(entry.name); setRenameError("");
  }

  function openContextMenu(event: React.MouseEvent, entry: ThreadStructureEntry) {
    if (!isOwner || entry.name === UNCLASSIFIED) return;
    event.preventDefault(); event.stopPropagation();
    setContextMenu({ entry, x: Math.min(event.clientX, window.innerWidth - 170), y: Math.min(event.clientY, window.innerHeight - 60) });
  }

  async function renameEntry() {
    if (!renameTarget || renaming) return;
    const name = renameName.trim();
    if (!name || name === renameTarget.name) { setRenameTarget(null); return; }
    if (entries.some((entry) => entry.id !== renameTarget.id && entry.kind === renameTarget.kind && entry.name === name)) {
      setRenameError("같은 이름이 이미 있습니다."); return;
    }
    setRenaming(true); setRenameError("");
    try {
      await saveQueue.current.catch(() => {});
      const response = await fetch("/api/thread-structure", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: renameTarget.id, name }), cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 409 ? "같은 이름이 이미 있습니다." : "이름을 변경하지 못했습니다.");
      const oldName = renameTarget.name;
      setEntries((current) => current.map((entry) => entry.id === renameTarget.id ? { ...entry, name } : entry));
      if (renameTarget.kind === "thread") onThreadRename?.(oldName, name);
      setRenameTarget(null); setRenameName("");
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : "이름을 변경하지 못했습니다.");
    } finally {
      setRenaming(false);
    }
  }

  function renderThread(entry: ThreadStructureEntry, nested = false) {
    const label = entry.name === UNCLASSIFIED ? "미분류" : entry.name;
    return <div data-drag-row key={entry.id} onContextMenu={(event) => openContextMenu(event, entry)} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); setDropTarget({ kind: "line", id: entry.id }); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null); }} onDrop={(event) => { event.stopPropagation(); moveEntry(entry.parent_id, entry.id); }} className={`relative flex items-center gap-1 rounded-lg hover:bg-[var(--background)] ${nested ? "ml-5" : ""} ${dragged?.id === entry.id ? "opacity-45" : ""}`}>
      {dropTarget?.kind === "line" && dropTarget.id === entry.id && <span className="absolute -top-[2px] left-1 right-1 h-0.5 rounded-full bg-blue-500 shadow-[0_0_0_1px_rgba(255,255,255,.8)]" />}
      <label className="min-w-0 flex-1 flex items-center gap-2 py-1.5 pl-2 text-sm cursor-pointer"><FilterCheckbox checked={selectedThreads.includes(entry.name)} onChange={() => toggleValue(selectedThreads, entry.name, onThreadsChange)} /><span className="truncate flex-1" title={label}>{label}</span><Count value={threadCounts[entry.name] || 0} /></label>
      {isOwner && <DragHandle label={label} onStart={() => setDragged({ kind: "thread", id: entry.id })} onEnd={() => { setDragged(null); setDropTarget(null); }} />}
    </div>;
  }

  return <aside className="w-[260px] bg-white border-r border-[var(--border)] flex flex-col shrink-0 overflow-y-auto">
    <div className="flex border-b border-[var(--border)]">{(["items", "stats"] as const).map((tab) => <button key={tab} className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === tab ? "text-[var(--primary)] border-[var(--primary)]" : "text-[var(--secondary)] border-transparent"}`} onClick={() => onTabChange(tab)}>{tab === "items" ? "자료" : "통계"}</button>)}</div>
    <div className="p-4"><div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--secondary)] mb-2">전체</div><button className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${allSelected ? "bg-[var(--primary-light)] text-[var(--primary)] font-medium" : "hover:bg-[var(--background)]"}`} onClick={() => { onTypesChange(allTypeNames); onThreadsChange(availableThreads); onToggleUnread(false); }}><span>전체 자료</span><Count value={items.length} /></button><button className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${showUnreadOnly ? "bg-[var(--primary-light)] text-[var(--primary)] font-medium" : "hover:bg-[var(--background)]"}`} onClick={() => onToggleUnread(!showUnreadOnly)}><span>안 읽은 자료</span><Count value={items.filter((item) => !item.is_read).length} /></button></div>
    {allTypes.length > 0 && <div className="p-4 pt-0"><div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--secondary)] mb-1">유형</div><label className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium cursor-pointer"><FilterCheckbox checked={selectedTypes.length === allTypeNames.length} onChange={() => onTypesChange(selectedTypes.length === allTypeNames.length ? [] : allTypeNames)} /><span>전체</span></label><div className="ml-3 pl-3 border-l border-gray-100">{allTypes.map((type) => <label key={type.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer hover:bg-[var(--background)]"><FilterCheckbox checked={selectedTypes.includes(type.name)} onChange={() => toggleValue(selectedTypes, type.name, onTypesChange)} /><span className="uppercase text-[13px] flex-1">{type.name}</span><Count value={type.count} /></label>)}</div></div>}
    <div className="p-4 pt-0"><div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--secondary)] mb-1">스레드</div><div className={`flex items-center rounded-lg border transition-colors ${dropTarget?.kind === "root" ? "border-blue-400 bg-blue-50" : "border-transparent"}`} onDragOver={(event) => { event.preventDefault(); setDropTarget({ kind: "root", id: "root" }); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null); }} onDrop={() => moveEntry("")}><label className="flex-1 flex items-center gap-2 px-2 py-1.5 text-sm font-medium cursor-pointer"><FilterCheckbox checked={availableThreads.length > 0 && selectedThreads.length === availableThreads.length} onChange={() => onThreadsChange(selectedThreads.length === availableThreads.length ? [] : availableThreads)} /><span>전체</span></label>{isOwner && <button className="w-7 h-7 rounded-md text-lg text-[var(--primary)] hover:bg-[var(--primary-light)]" onClick={() => { setCreateKind("thread"); setShowCreateModal(true); }} title="스레드 또는 폴더 추가" aria-label="스레드 또는 폴더 추가">+</button>}</div>
      <div className="ml-3 pl-3 border-l border-gray-100">{rootItems.map((entry) => entry.kind === "thread" ? renderThread(entry) : <div key={entry.id} onDragOver={(event) => { event.preventDefault(); setDropTarget({ kind: dragged?.kind === "thread" ? "folder" : "line", id: entry.id }); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null); }} onDrop={() => { if (dragged?.kind === "thread") moveEntry(entry.id); else moveEntry("", entry.id); }} className={`relative ${dragged?.id === entry.id ? "opacity-45" : ""}`}>{dropTarget?.kind === "line" && dropTarget.id === entry.id && <span className="absolute -top-[2px] left-1 right-1 z-10 h-0.5 rounded-full bg-blue-500" />}<div data-drag-row onContextMenu={(event) => openContextMenu(event, entry)} className={`flex items-center gap-1 rounded-lg border transition-all ${dropTarget?.kind === "folder" && dropTarget.id === entry.id ? "border-blue-400 bg-blue-100 shadow-sm" : "border-transparent hover:bg-[var(--background)]"}`}><button className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-left" onClick={() => toggleFolder(entry.id)}><svg className="w-[18px] h-[18px] shrink-0 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 6.5h6l2 2h9a1.5 1.5 0 0 1 1.5 1.5v8.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-10a2 2 0 0 1 1.5-2Z" /><path d="M2.5 10h19" /></svg><span className="truncate flex-1">{entry.name}</span><svg className="w-4 h-4 shrink-0 text-[var(--secondary)]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={collapsed.includes(entry.id) ? "m5.5 7.5 4.5 4.5 4.5-4.5" : "m5.5 12.5 4.5-4.5 4.5 4.5"} /></svg></button>{isOwner && <DragHandle label={entry.name} onStart={() => setDragged({ kind: "folder", id: entry.id })} onEnd={() => { setDragged(null); setDropTarget(null); }} />}</div>{!collapsed.includes(entry.id) && entries.filter((child) => child.kind === "thread" && child.parent_id === entry.id).sort((a, b) => a.sort_order - b.sort_order).map((child) => renderThread(child, true))}</div>)}</div>
    </div>
    {showCreateModal && <div className="fixed inset-0 z-[1100] bg-black/30 flex items-center justify-center" onClick={() => setShowCreateModal(false)}><div className="w-[340px] bg-white rounded-xl p-5 shadow-xl" onClick={(event) => event.stopPropagation()}><h3 className="font-semibold mb-3">새로 만들기</h3><div className="grid grid-cols-2 gap-1 p-1 mb-3 rounded-lg bg-gray-100"><button className={`py-1.5 rounded-md text-sm ${createKind === "thread" ? "bg-white text-[var(--primary)] font-medium shadow-sm" : "text-[var(--secondary)]"}`} onClick={() => setCreateKind("thread")}>스레드</button><button className={`py-1.5 rounded-md text-sm ${createKind === "folder" ? "bg-white text-[var(--primary)] font-medium shadow-sm" : "text-[var(--secondary)]"}`} onClick={() => setCreateKind("folder")}>폴더</button></div><input autoFocus value={newEntryName} onChange={(event) => setNewEntryName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createEntry(); }} placeholder={createKind === "thread" ? "스레드명" : "폴더명"} className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" /><p className="mt-2 text-xs text-[var(--secondary)]">{createKind === "thread" ? "자료가 없어도 목록에 유지되며, 상세 화면에서 자료를 옮길 수 있어요." : "만든 뒤 스레드를 드래그해 폴더에 넣을 수 있어요."}</p><div className="flex justify-end gap-2 mt-4"><button className="px-3 py-1.5 text-sm" onClick={() => setShowCreateModal(false)}>취소</button><button className="px-3 py-1.5 text-sm rounded-md bg-[var(--primary)] text-white" onClick={createEntry}>만들기</button></div></div></div>}
    {renameTarget && <div className="fixed inset-0 z-[1100] bg-black/30 flex items-center justify-center" onClick={() => !renaming && setRenameTarget(null)}><div className="w-[340px] bg-white rounded-xl p-5 shadow-xl" onClick={(event) => event.stopPropagation()}><h3 className="font-semibold mb-1">{renameTarget.kind === "thread" ? "스레드" : "폴더"} 이름 변경</h3>{renameTarget.kind === "thread" && <p className="mb-3 text-xs text-[var(--secondary)]">연결된 모든 자료에도 새 이름이 적용됩니다.</p>}<input autoFocus value={renameName} onChange={(event) => { setRenameName(event.target.value); setRenameError(""); }} onKeyDown={(event) => { if (event.key === "Enter") renameEntry(); }} className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" />{renameError && <p className="mt-2 text-xs text-red-600">{renameError}</p>}<div className="flex justify-end gap-2 mt-4"><button disabled={renaming} className="px-3 py-1.5 text-sm disabled:opacity-50" onClick={() => setRenameTarget(null)}>취소</button><button disabled={renaming || !renameName.trim()} className="px-3 py-1.5 text-sm rounded-md bg-[var(--primary)] text-white disabled:opacity-50" onClick={renameEntry}>{renaming ? "변경 중…" : "변경"}</button></div></div></div>}
    {contextMenu && <div className="fixed z-[1200] w-40 rounded-lg border border-[var(--border)] bg-white p-1 shadow-lg" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()} role="menu"><button className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left hover:bg-[var(--background)]" onClick={() => openRename(contextMenu.entry)} role="menuitem"><svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13.8 3.2a2.1 2.1 0 0 1 3 3L7 16l-4 .9.9-4Z" /><path d="m12.5 4.5 3 3" /></svg>이름 변경</button></div>}
  </aside>;
}
