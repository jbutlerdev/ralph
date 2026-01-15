/**
 * EventDispatcher - Simple pub/sub system for TUI updates
 *
 * Provides a lightweight event bus for communication between
 * different components of the Ralph TUI Orchestrator.
 */

/**
 * Event listener function type
 */
export type EventListener<T = unknown> = (data: T) => void | Promise<void>;

/**
 * EventDispatcher class for pub/sub event handling
 */
export class EventDispatcher {
  private listeners: Map<string, Set<EventListener>> = new Map();

  /**
   * Subscribe to an event
   * @param event - Event name to listen for
   * @param listener - Callback function to invoke when event is emitted
   * @returns Unsubscribe function
   */
  on<T = unknown>(event: string, listener: EventListener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.off(event, listener);
    };
  }

  /**
   * Unsubscribe from an event
   * @param event - Event name to stop listening for
   * @param listener - Callback function to remove
   */
  off<T = unknown>(event: string, listener: EventListener<T>): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
      // Clean up empty event sets
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   * @param event - Event name to emit
   * @param data - Data to pass to listeners
   */
  async emit<T = unknown>(event: string, data: T): Promise<void> {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) {
      return;
    }

    // Execute all listeners concurrently
    const promises = Array.from(eventListeners).map(async (listener) => {
      try {
        await listener(data);
      } catch (error) {
        // Log error but don't fail the entire emit
        console.error(`Error in event listener for "${event}":`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Subscribe to an event only once
   * @param event - Event name to listen for
   * @param listener - Callback function to invoke once
   * @returns Unsubscribe function (useful if called before event fires)
   */
  once<T = unknown>(event: string, listener: EventListener<T>): () => void {
    const unsubscribe = this.on<T>(event, async (data) => {
      unsubscribe();
      await listener(data);
    });
    return unsubscribe;
  }

  /**
   * Remove all listeners for a specific event
   * @param event - Event name to clear listeners for
   */
  removeAllListeners(event: string): void {
    this.listeners.delete(event);
  }

  /**
   * Remove all listeners for all events
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * Get the number of listeners for an event
   * @param event - Event name to check
   * @returns Number of listeners
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Get all registered event names
   * @returns Array of event names
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }
}

/**
 * Global event dispatcher instance
 */
export const events = new EventDispatcher();
