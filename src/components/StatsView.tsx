"use client";

import { useState, useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import type { Item } from "@/lib/types";

interface StatsViewProps {
  items: Item[];
  onTagClick?: (tag: string) => void;
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

function getMonthRange(offset: number): { from: Date; to: Date; label: string; suffix: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + offset;
  const from = new Date(year, month, 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date(year, month + 1, 0);
  to.setHours(23, 59, 59, 999);

  const suffix = offset === 0 ? "(이번 달)" : offset === -1 ? "(지난 달)" : "";
  return { from, to, label: `${from.getFullYear()}년 ${from.getMonth() + 1}월`, suffix };
}

export default function StatsView({ items, onTagClick }: StatsViewProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const totalCount = items.length;
  const readCount = items.filter((i) => i.is_read).length;
  const unreadCount = totalCount - readCount;

  // Monthly tag cloud
  const monthRange = getMonthRange(monthOffset);
  const monthlyTagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      if (!item.created_at || !item.tags) continue;
      const d = new Date(item.created_at.replace(/(\d{4})-(\d{2})-(\d{2})/, "$1-$2-$3"));
      if (d >= monthRange.from && d <= monthRange.to) {
        for (const tag of item.tags.split(",").map((t) => t.trim()).filter(Boolean)) {
          counts[tag] = (counts[tag] || 0) + 1;
        }
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [items, monthRange.from, monthRange.to]);

  const shuffledTagCloud = useMemo(() => {
    const COLORS = ["#e64980", "#be4bdb", "#7950f2", "#4c6ef5", "#15aabf", "#12b886", "#fab005", "#fd7e14"];
    const top3 = new Set(monthlyTagCounts.slice(0, 3).map(([tag]) => tag));
    const maxCount = monthlyTagCounts.length > 0 ? monthlyTagCounts[0][1] : 1;
    const minSize = 14;
    const maxSize = 36;

    const tags = monthlyTagCounts.map(([value, count], i) => {
      const size = maxCount === 1
        ? (minSize + maxSize) / 2
        : minSize + ((count - 1) / (maxCount - 1)) * (maxSize - minSize);
      return { value, count, size, isTop3: top3.has(value), color: COLORS[i % COLORS.length] };
    });

    // Fisher-Yates shuffle
    for (let i = tags.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tags[i], tags[j]] = [tags[j], tags[i]];
    }
    return tags;
  }, [monthlyTagCounts]);

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

      {/* Tag Cloud */}
      <div className="bg-white border border-[var(--border)] rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[15px] font-semibold">이달의 관심사</div>
          <div className="flex items-center gap-3">
            <button
              className="w-7 h-7 border border-[var(--border)] rounded-md flex items-center justify-center text-[var(--secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
              onClick={() => setMonthOffset(monthOffset - 1)}
            >
              &#8249;
            </button>
            <span className="text-[13px] font-medium min-w-[120px] text-center">
              {monthRange.label} {monthRange.suffix}
            </span>
            <button
              className="w-7 h-7 border border-[var(--border)] rounded-md flex items-center justify-center text-[var(--secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors disabled:opacity-30 disabled:cursor-default"
              onClick={() => setMonthOffset(monthOffset + 1)}
              disabled={monthOffset >= 0}
            >
              &#8250;
            </button>
          </div>
        </div>
        {shuffledTagCloud.length > 0 ? (
          <div className="tag-cloud-container flex flex-wrap items-center justify-center gap-x-2 gap-y-1 py-4 min-h-[150px]">
            {shuffledTagCloud.map((tag) => (
              <span
                key={tag.value}
                className="tag-cloud-word"
                data-count={`${tag.count}건`}
                style={{
                  fontSize: `${tag.size}px`,
                  fontWeight: tag.isTop3 ? 700 : 400,
                  color: tag.isTop3 ? "var(--primary)" : tag.color,
                  padding: "2px 6px",
                  lineHeight: 1.4,
                }}
                onClick={() => onTagClick?.(tag.value)}
              >
                {tag.value}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-sm text-[var(--secondary)] text-center py-8">
            이 달에 저장된 자료가 없습니다
          </div>
        )}
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

        {/* Line Graph */}
        {(() => {
          const chartData = days.map((day, i) => ({
            day,
            저장: weeklyData.saved[i],
            읽음: weeklyData.read[i],
          }));

          return (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 13, fill: "var(--secondary)" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--secondary)" }} />
                <Tooltip
                  contentStyle={{ fontSize: 13, borderRadius: 8, borderColor: "var(--border)" }}
                />
                <Legend
                  verticalAlign="top"
                  align="left"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 13, paddingBottom: 8 }}
                  formatter={(value) => {
                    const total = value === "저장" ? savedTotal : readTotal;
                    return `${value} (${total})`;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="저장"
                  stroke="#4c6ef5"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="읽음"
                  stroke="#12b886"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          );
        })()}
      </div>
    </div>
  );
}
