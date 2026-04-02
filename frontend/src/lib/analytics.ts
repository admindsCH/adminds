import { apiPost } from "./api";

/**
 * Fire-and-forget event tracking. Never throws — failures are silently ignored
 * so analytics can never break the main app flow.
 */
export function trackEvent(eventType: string, metadata?: Record<string, unknown>): void {
  apiPost("/api/admin/analytics/track", {
    event_type: eventType,
    metadata: metadata ?? {},
  }).catch(() => {
    // silently ignore — analytics must never break the app
  });
}
