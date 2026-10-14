'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '../utils/supabase/client';

/**
 * Subscribes to Supabase Realtime postgres_changes on the given tables and calls
 * onChange on any INSERT/UPDATE/DELETE. Uses the logged-in browser client so
 * RLS applies and you only get events for your own rows.
 */
export function useSupabaseRealtime(tables, onChange) {
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  const tableKey = Array.isArray(tables) ? tables.join(',') : '';

  useEffect(() => {
    if (!tableKey || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const supabase = createClient();

    const channel = supabase.channel(`meal-tracker-${tableKey}`);
    for (const table of tableKey.split(',')) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => callbackRef.current());
    }
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableKey]);
}
