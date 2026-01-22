'use client';

import type { WSConnectionState } from '@/lib/ralph/useWebSocket';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';
import { forwardRef, HTMLAttributes } from 'react';

export interface ConnectionStatusProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Current WebSocket connection state
   */
  connectionState: WSConnectionState;
  /**
   * Whether using HTTP polling fallback
   */
  usingFallback?: boolean;
  /**
   * Whether to show text label alongside the icon
   * @default true
   */
  showLabel?: boolean;
  /**
   * Whether to show in compact mode (smaller size)
   * @default false
   */
  compact?: boolean;
}

/**
 * Connection status indicator component
 *
 * Displays the current WebSocket connection status with:
 * - Visual indicator (icon + color)
 * - Optional text label
 *
 * States:
 * - connected: Green check with "Live" label
 * - connecting: Spinning loader with "Connecting..." label
 * - disconnected: Gray wifi-off with "Offline" label
 * - error: Red alert with "Connection Error" label
 *
 * Note: This component is a pure display component. The parent component
 * should use useWebSocket to manage the connection and pass the state here.
 */
export const ConnectionStatus = forwardRef<HTMLDivElement, ConnectionStatusProps>(
  ({ connectionState, usingFallback = false, showLabel = true, compact = false, className, ...props }, ref) => {

    const getStatusConfig = () => {
      switch (connectionState) {
        case 'connected':
          return {
            icon: Wifi,
            label: usingFallback ? 'Polling' : 'Live',
            colorClass: usingFallback
              ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20'
              : 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20',
            dotClass: usingFallback ? 'bg-yellow-500' : 'bg-green-500',
            title: usingFallback
              ? 'Using HTTP polling fallback'
              : 'WebSocket connected - real-time updates',
          };
        case 'connecting':
          return {
            icon: Loader2,
            label: 'Connecting...',
            colorClass: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20',
            dotClass: 'bg-blue-500 animate-pulse',
            title: 'Connecting to WebSocket server...',
          };
        case 'disconnected':
          return {
            icon: WifiOff,
            label: 'Offline',
            colorClass: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20',
            dotClass: 'bg-gray-400',
            title: 'Disconnected - updates paused',
          };
        case 'error':
          return {
            icon: AlertCircle,
            label: 'Error',
            colorClass: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20',
            dotClass: 'bg-red-500',
            title: 'Connection error - check console for details',
          };
        default:
          return {
            icon: WifiOff,
            label: 'Unknown',
            colorClass: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20',
            dotClass: 'bg-gray-400',
            title: 'Unknown connection state',
          };
      }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
          config.colorClass,
          compact && 'px-1.5 py-0.5 text-[10px]',
          className
        )}
        title={config.title}
        {...props}
      >
        <div className="relative flex h-4 w-4 items-center justify-center">
          <Icon className={cn('h-3 w-3', connectionState === 'connecting' && 'animate-spin')} />
          <div
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-white dark:border-gray-900',
              config.dotClass
            )}
          />
        </div>
        {showLabel && <span>{config.label}</span>}
      </div>
    );
  }
);

ConnectionStatus.displayName = 'ConnectionStatus';
