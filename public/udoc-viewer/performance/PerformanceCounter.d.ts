/**
 * Performance counter for tracking viewer operations.
 *
 * Logs both START and END events to show the sequence and overlap of operations.
 */
/**
 * Types of operations that can be tracked.
 */
export type PerformanceEventType = "download" | "load" | "loadPdf" | "loadImage" | "loadPptx" | "loadDocx" | "getPageCount" | "getPageInfo" | "getAllPageInfo" | "getOutline" | "getAllAnnotations" | "getPageAnnotations" | "getLayoutPage" | "renderPage" | "renderPreview" | "renderThumbnail" | "getFontUsage" | "initUiShell";
/**
 * Context for page-specific operations.
 */
export interface PerformanceEventContext {
    pageIndex?: number;
    scale?: number;
}
/**
 * A log entry for a performance event.
 */
export interface PerformanceLogEntry {
    /** Whether this is a start or end event */
    phase: "start" | "end";
    /** The type of operation */
    type: PerformanceEventType;
    /** Timestamp relative to load() start (ms) */
    timestamp: number;
    /** Optional context (e.g., page index) */
    context?: PerformanceEventContext;
    /** Duration in ms (only for "end" phase) */
    duration?: number;
    /** Whether the operation succeeded (only for "end" phase) */
    success?: boolean;
    /** Error message if failed (only for "end" phase) */
    error?: string;
}
/**
 * Callback for performance log entries.
 */
export type PerformanceLogCallback = (entry: PerformanceLogEntry) => void;
/**
 * Summary statistics for a single event type.
 */
export interface PerformanceEventStats {
    count: number;
    totalDuration: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
}
/**
 * Summary of all performance data.
 */
export interface PerformanceCounterSummary {
    /** Breakdown by operation type */
    breakdown: Partial<Record<PerformanceEventType, PerformanceEventStats>>;
}
/**
 * Interface for performance counter (enables no-op implementation).
 */
export interface IPerformanceCounter {
    /** Whether performance tracking is enabled */
    readonly enabled: boolean;
    /** All logged entries in order */
    readonly entries: readonly PerformanceLogEntry[];
    /**
     * Set the load start time. Should be called at the beginning of load().
     * All timestamps will be relative to this time.
     */
    setLoadStartTime(): void;
    /**
     * Mark the start of an operation.
     * @returns Event ID to use with markEnd()
     */
    markStart(type: PerformanceEventType, context?: PerformanceEventContext): string;
    /**
     * Mark the end of an operation.
     * @param eventId - The ID returned from markStart()
     * @param success - Whether the operation succeeded (default: true)
     * @param error - Error message if failed
     */
    markEnd(eventId: string, success?: boolean, error?: string): void;
    /**
     * Subscribe to log entries.
     * @returns Unsubscribe function
     */
    onLog(callback: PerformanceLogCallback): () => void;
    /**
     * Get summary statistics.
     */
    getSummary(): PerformanceCounterSummary;
    /**
     * Reset all recorded entries and start time.
     */
    reset(): void;
}
/**
 * Performance counter implementation.
 */
export declare class PerformanceCounter implements IPerformanceCounter {
    readonly enabled = true;
    private _entries;
    private _pendingEvents;
    private _listeners;
    private _eventIdCounter;
    private _loadStartTime;
    get entries(): readonly PerformanceLogEntry[];
    /**
     * Set the load start time. Called at the beginning of load().
     */
    setLoadStartTime(): void;
    markStart(type: PerformanceEventType, context?: PerformanceEventContext): string;
    markEnd(eventId: string, success?: boolean, error?: string): void;
    onLog(callback: PerformanceLogCallback): () => void;
    getSummary(): PerformanceCounterSummary;
    reset(): void;
    private _notifyListeners;
}
/**
 * No-op implementation for when performance tracking is disabled.
 * All methods are no-ops with minimal overhead.
 */
export declare class NoOpPerformanceCounter implements IPerformanceCounter {
    readonly enabled = false;
    readonly entries: readonly PerformanceLogEntry[];
    setLoadStartTime(): void;
    markStart(): string;
    markEnd(): void;
    onLog(): () => void;
    getSummary(): PerformanceCounterSummary;
    reset(): void;
}
//# sourceMappingURL=PerformanceCounter.d.ts.map