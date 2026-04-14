"use client";

import { useState, useMemo } from "react";
import type { Item } from "@/lib/types";

interface StatsViewProps {
  items: Item[];
}

function getWeekRange(offset: number): { from: Date; to: Date; label: string; suffix: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  const suffix = offset === 0 ? "(이번 주)" : offset === -1 ? "(지난 주)" : "";
  return { from: monday, to: sunday, label: `${fmt(monday)} ~ ${fmt(sunday)}`, suffix };
}

function getDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function StatsView({ items }: StatsViewProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const totalCount = items.length;
  const readCount = items.filter((i) => i.is_read).length;
  const unreadCount = totalCount - readCount;

  // Tag distribution
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      if (!item.tags) continue;
      for (const tag of item.tags.split(",").map((t) => t.trim()).filter(Boolean)) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const maxTagCount = tagCounts.length > 0 ? tagCounts[0][1] : 1;

  // Weekly data
  const week = getWeekRange(weekOffset);
  const weeklyData = useMemo(() => {
    const saved = [0, 0, 0, 0, 0, 0, 0];
    const read = [0, 0, 0, 0, 0, 0, 0];

    for (const item of items) {
      if (item.created_at) {
        const d = new Date(item.created_at.replace(/(\d{4})-(\d{2})-(\d{2})/, "$1-$2-$3"));
        if (d >= week.from && d <= week.to) {
          const day = d.getDay();
          const idx = day === 0 ? 6 : day - 1;
          saved[idx]++;
        }
      }
      if (item.read_at) {
        const d = new Date(item.read_at.replace(/(\d{4})-(\d{2})-(\d{2})/, "$1-$2-$3"));
        if (d >= week.from && d <= week.to) {
          const day = d.getDay();
          const idx = day === 0 ? 6 : day - 1;
          read[idx]++;
        }
      }
    }
    return { saved, read };
  }, [items, week.from, week.to]);

  const savedTotal = weeklyData.saved.reduce((a, b) => a + b, 0);
  const readTotal = weeklyData.read.reduce((a, b) => a + b, 0);
  const savedMax = Math.max(...weeklyData.saved);
  const readMax = Math.max(...weeklyData.read);

  // This week saved count for stat card
  const thisWeek = getWeekRange(0);
  const thisWeekSaved = items.filter((item) => {
    if (!item.created_at) return false;
    const d = new Date(item.created_at.replace(/(\d{4})-(\d{2})-(\d{2})/, "$1-$2-$3"));
    return d >= thisWeek.from && d <= thisWeek.to;
  }).length;

  const days = ["월", "화", "수", "목", "금", "토", "일"];

  return (
    <div>
      <div className="text-xl font-semibold mb-5">통계</div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-[var(--border)] rounded-xl p-5">
          <div className="text-[13px] text-[var(--secondary)] mb-2">총 자료</div>
          <div className="text-[32px] font-bold">{totalCount}</div>
          <div className="text-xs text-[var(--secondary)] mt-1">이번 주 +{thisWeekSaved}</div>
        </div>
        <div className="bg-white border border-[var(--border)] rounded-xl p-5">
          <div className="text-[13px] text-[var(--secondary)] mb-2">읽음</div>
          <div className="text-[32px] font-bold">{readCount}</div>
          <div className="text-xs text-[var(--secondary)] mt-1">
            {totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0}%
          </div>
        </div>
        <div className="bg-white border border-[var(--border)] rounded-xl p-5">
          <div className="text-[13px] text-[var(--secondary)] mb-2">안 읽음</div>
          <div className="text-[32px] font-bold text-[var(--danger)]">{unreadCount}</div>
          <div className="text-xs text-[var(--secondary)] mt-1">
            {totalCount > 0 ? Math.round((unreadCount / totalCount) * 100) : 0}%
          </div>
        </div>
      </div>

      {/* Tag Distribution */}
      <div className="bg-white border border-[var(--border)] rounded-xl p-5 mb-4">
        <div className="text-[15px] font-semibold mb-4">태그별 자료 분포</div>
        <div className="flex flex-col gap-2.5">
          {tagCounts.slice(0, 10).map(([tag, count], i) => (
            <div key={tag} className="flex items-center gap-3">
              <div className="text-[13px] w-[100px] text-right text-[var(--secondary)] shrink-0">
                {tag}
              </div>
              <div className="flex-1 h-6 bg-[var(--background)] rounded-md overflow-hidden">
                <div
                  className={`h-full rounded-md flex items-center pl-2 text-xs text-white font-medium ${
                    i === 0 ? "bg-[var(--primary)]" : "bg-[#adb5bd]"
                  }`}
                  style={{ width: `${(count / maxTagCount) * 100}%`, minWidth: "28px" }}
                >
                  {count}
                </div>
              </div>
            </div>
          ))}
          {tagCounts.length === 0 && (
            <div className="text-sm text-[var(--secondary)] text-center py-4">태그가 없습니다</div>
          )}
        </div>
      </div>

      {/* Weekly Activity */}
      <div className="bg-white border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[15px] font-semibold">주간 활동</div>
          <div className="flex items-center gap-3">
            <button
              className="w-7 h-7 border border-[var(--border)] rounded-md flex items-center justify-center text-[var(--secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
              onClick={() => setWeekOffset(weekOffset - 1)}
            >
              &#8249;
            </button>
            <span className="text-[13px] font-medium min-w-[160px] text-center">
              {week.label} {week.suffix}
            </span>
            <button
              className="w-7 h-7 border border-[var(--border)] rounded-md flex items-center justify-center text-[var(--secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors disabled:opacity-30 disabled:cursor-default"
              onClick={() => setWeekOffset(weekOffset + 1)}
              disabled={weekOffset >= 0}
            >
              &#8250;
            </button>
          </div>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-xs font-medium text-[var(--secondary)] py-2 px-3 text-left border-b border-[var(--border)]" />
              {days.map((d) => (
                <th key={d} className="text-xs font-medium text-[var(--secondary)] py-2 px-3 text-center border-b border-[var(--border)]">
                  {d}
                </th>
              ))}
              <th className="text-xs font-medium text-[var(--secondary)] py-2 px-3 text-center border-b border-[var(--border)]">
                합계
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-[13px] text-[var(--secondary)] py-2.5 px-3">저장</td>
              {weeklyData.saved.map((v, i) => (
                <td
                  key={i}
                  className={`text-sm text-center py-2.5 px-3 ${
                    v > 0 && v === savedMax ? "font-semibold text-[var(--primary)]" : ""
                  }`}
                >
                  {v}
                </td>
              ))}
              <td className="text-sm text-center py-2.5 px-3 font-semibold border-l border-[var(--border)]">
                {savedTotal}
              </td>
            </tr>
            <tr>
              <td className="text-[13px] text-[var(--secondary)] py-2.5 px-3 border-t border-[var(--background)]">읽음</td>
              {weeklyData.read.map((v, i) => (
                <td
                  key={i}
                  className={`text-sm text-center py-2.5 px-3 border-t border-[var(--background)] ${
                    v > 0 && v === readMax ? "font-semibold text-[var(--primary)]" : ""
                  }`}
                >
                  {v}
                </td>
              ))}
              <td className="text-sm text-center py-2.5 px-3 font-semibold border-l border-[var(--border)] border-t border-t-[var(--background)]">
                {readTotal}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
