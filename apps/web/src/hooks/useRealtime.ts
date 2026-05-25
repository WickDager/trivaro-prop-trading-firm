'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtime<T extends Record<string, unknown>>(
  table: string,
  filter?: { column: string; value: string },
  initial?: T[],
) {
  const [data, setData] = useState<T[]>(initial ?? []);
  const supabase = createBrowserClient();

  useEffect(() => {
    let channel: RealtimeChannel;

    if (filter) {
      channel = supabase
        .channel(`${table}-changes`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `${filter.column}=eq.${filter.value}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setData((prev) => [...prev, payload.new as T]);
            } else if (payload.eventType === 'UPDATE') {
              setData((prev) =>
                prev.map((item) =>
                  (item as any).id === (payload.new as any).id ? (payload.new as T) : item,
                ),
              );
            } else if (payload.eventType === 'DELETE') {
              setData((prev) =>
                prev.filter((item) => (item as any).id !== (payload.old as any).id),
              );
            }
          },
        )
        .subscribe();
    } else {
      channel = supabase
        .channel(`${table}-changes`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setData((prev) => [...prev, payload.new as T]);
            } else if (payload.eventType === 'UPDATE') {
              setData((prev) =>
                prev.map((item) =>
                  (item as any).id === (payload.new as any).id ? (payload.new as T) : item,
                ),
              );
            } else if (payload.eventType === 'DELETE') {
              setData((prev) =>
                prev.filter((item) => (item as any).id !== (payload.old as any).id),
              );
            }
          },
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter?.column, filter?.value, supabase]);

  const updateData = useCallback((newData: T[]) => setData(newData), []);
  return { data, updateData };
}
