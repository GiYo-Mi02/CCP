'use client';

import {
  useRealtimeRefresh,
  type RealtimeTableSubscription,
} from '@/hooks/use-realtime-refresh';

interface RealtimeRefreshProps {
  channelName: string;
  tables: RealtimeTableSubscription[];
  enabled?: boolean;
  throttleMs?: number;
}

export function RealtimeRefresh({
  channelName,
  tables,
  enabled = true,
  throttleMs,
}: RealtimeRefreshProps) {
  useRealtimeRefresh({ channelName, tables, enabled, throttleMs });
  return null;
}
