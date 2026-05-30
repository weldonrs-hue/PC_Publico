/**
 * Shared accessibility utilities for the viewer UI.
 */
/**
 * Traps keyboard focus inside a container element (for modal dialogs).
 * Returns a cleanup function to remove the event listener.
 */
export declare function trapFocus(container: HTMLElement): () => void;
/**
 * Creates a visually-hidden live region for screen reader announcements.
 */
export declare function createLiveRegion(): {
    announce: (msg: string) => void;
    el: HTMLElement;
    destroy: () => void;
};
/**
 * Sets up roving tabindex on a toolbar or group of items.
 * Only one item has tabindex="0" at a time; arrow keys move between items.
 * Call `refresh()` after showing/hiding items so the active index stays valid.
 */
export declare function setupRovingTabindex(container: HTMLElement, itemSelector: string, direction?: "horizontal" | "vertical"): {
    refresh: () => void;
    destroy: () => void;
};
//# sourceMappingURL=a11y.d.ts.map