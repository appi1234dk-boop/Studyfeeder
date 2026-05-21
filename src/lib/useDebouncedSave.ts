"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseDebouncedSaveResult {
  status: SaveStatus;
  flush: () => Promise<void>;
  retry: () => Promise<void>;
}

export function useDebouncedSave<T>(
  value: T,
  onSave: (v: T) => Promise<void> | void,
  delay = 1200,
  enabled = true
): UseDebouncedSaveResult {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<T>(value);
  const onSaveRef = useRef(onSave);
  const valueRef = useRef<T>(value);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const run = useCallback(async (v: T) => {
    if (savedFadeRef.current) {
      clearTimeout(savedFadeRef.current);
      savedFadeRef.current = null;
    }
    setStatus("saving");
    try {
      await onSaveRef.current(v);
      lastSavedRef.current = v;
      setStatus("saved");
      savedFadeRef.current = setTimeout(() => {
        setStatus((s) => (s === "saved" ? "idle" : s));
      }, 2000);
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (value === lastSavedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void run(valueRef.current);
    }, delay);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [value, enabled, delay, run]);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (valueRef.current !== lastSavedRef.current) {
      await run(valueRef.current);
    }
  }, [run]);

  const retry = useCallback(async () => {
    await run(valueRef.current);
  }, [run]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        if (valueRef.current !== lastSavedRef.current) {
          try {
            void onSaveRef.current(valueRef.current);
          } catch {
            // best-effort
          }
        }
      }
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
    };
  }, []);

  return { status, flush, retry };
}
