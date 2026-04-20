'use client';

import { useEffect, useMemo } from 'react';
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
 */
export function useRealtimeRefresh({
  channelName,
  tables,
  enabled = true,
  throttleMs = 400,
  fallbackPollingMs = 12000,
}: UseRealtimeRefreshOptions) {
  const router = useRouter();

  const normalized = useMemo(
    () =>
      tables
        .filter((subscription) => subscription.table)
        .map((subscription) => ({
          table: subscription.table,
          event: subscription.event ?? '*',
          filter: subscription.filter ?? null,
        })),
    [tables]
  );

  const signature = useMemo(() => JSON.stringify(normalized), [normalized]);

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
        router.refresh();
      }, throttleMs);
    };

    const startFallbackPolling = () => {
      if (fallbackPollingMs <= 0 || fallbackInterval) return;

      fallbackInterval = setInterval(() => {
        router.refresh();
      }, fallbackPollingMs);
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
  }, [channelName, enabled, router, signature, throttleMs, fallbackPollingMs]);
}
