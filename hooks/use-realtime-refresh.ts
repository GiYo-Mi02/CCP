'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';

export type RealtimeTableSubscription = {
  table: string;
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  filter?: string;
};

interface UseRealtimeRefreshOptions {
  channelName: string;
  tables: RealtimeTableSubscription[];
  enabled?: boolean;
  throttleMs?: number;
  fallbackPollingMs?: number;
}

/**
 * Subscribes to Supabase Realtime table changes and refreshes the current route.
 *
 * Uses refs for `router` and timing values to keep the effect dependency list
 * stable and prevent subscribe/unsubscribe loops that flood the terminal.
 */
export function useRealtimeRefresh({
  channelName,
  tables,
  enabled = true,
  throttleMs = 800,
  fallbackPollingMs = 30000,
}: UseRealtimeRefreshOptions) {
  const router = useRouter();

  // Keep router in a ref so it never causes effect re-runs.
  const routerRef = useRef(router);
  routerRef.current = router;

  // Keep timing values in refs to avoid effect churn.
  const throttleMsRef = useRef(throttleMs);
  throttleMsRef.current = throttleMs;

  const fallbackPollingMsRef = useRef(fallbackPollingMs);
  fallbackPollingMsRef.current = fallbackPollingMs;

  // Build a stable JSON signature from the tables config.
  // Even though `tables` is a new array reference each render, the
  // stringified output will be identical so the effect won't re-fire.
  const signature = useMemo(() => {
    const normalized = tables
      .filter((s) => s.table)
      .map((s) => ({
        table: s.table,
        event: s.event ?? '*',
        filter: s.filter ?? null,
      }));
    return JSON.stringify(normalized);
  }, [tables]);

  useEffect(() => {
    const subscriptions = JSON.parse(signature) as Array<{
      table: string;
      event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
      filter: string | null;
    }>;

    if (!enabled || subscriptions.length === 0) {
      return;
    }

    const supabase = createBrowserSupabase();
    const channel = supabase.channel(channelName);
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;
    let subscribeWatchdog: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimeout) return;

      refreshTimeout = setTimeout(() => {
        refreshTimeout = null;
        routerRef.current.refresh();
      }, throttleMsRef.current);
    };

    const startFallbackPolling = () => {
      const ms = fallbackPollingMsRef.current;
      if (ms <= 0 || fallbackInterval) return;

      fallbackInterval = setInterval(() => {
        routerRef.current.refresh();
      }, ms);
    };

    const stopFallbackPolling = () => {
      if (!fallbackInterval) return;
      clearInterval(fallbackInterval);
      fallbackInterval = null;
    };

    for (const subscription of subscriptions) {
      channel.on(
        'postgres_changes',
        {
          event: subscription.event,
          schema: 'public',
          table: subscription.table,
          filter: subscription.filter ?? undefined,
        },
        scheduleRefresh
      );
    }

    // If the channel does not subscribe in time, enable fallback polling.
    subscribeWatchdog = setTimeout(() => {
      startFallbackPolling();
    }, 5000);

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (subscribeWatchdog) {
          clearTimeout(subscribeWatchdog);
          subscribeWatchdog = null;
        }
        stopFallbackPolling();
      }

      if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        startFallbackPolling();
      }
    });

    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      if (subscribeWatchdog) {
        clearTimeout(subscribeWatchdog);
      }
      stopFallbackPolling();
      void supabase.removeChannel(channel);
    };
    // Only re-subscribe when the channel name, enabled flag, or table
    // configuration actually changes — NOT on every render.
  }, [channelName, enabled, signature]);
}

