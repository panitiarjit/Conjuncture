'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'conjuncture_bookmarks';

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setBookmarks(new Set(JSON.parse(raw) as string[]));
    } catch {}
  }, []);

  const toggle = useCallback((id: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);

  const isBookmarked = useCallback((id: string) => bookmarks.has(id), [bookmarks]);

  return { bookmarks, toggle, isBookmarked };
}
