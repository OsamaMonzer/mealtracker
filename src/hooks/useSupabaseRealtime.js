'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '../lib/supabase/client';

/**
 * Subscribes to Supabase Realtime postgres_changes on the given tables.
 * Calls onChange when any INSERT/UPDATE/DELETE happens (no page refresh needed).
 */
export function useSupabaseRealtime(tables, onChange) {
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  const tableKey = Array.isArray(tables) ? tables.join(',') : '';

  useEffect(() => {
    const supabase = createClient();
    if (!supabase || !tableKey) return;

    const channel = supabase.channel(`meal-tracker-${tableKey}`);
    for (const table of tables) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => callbackRef.current()
      );
    }
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableKey, tables]);
}
