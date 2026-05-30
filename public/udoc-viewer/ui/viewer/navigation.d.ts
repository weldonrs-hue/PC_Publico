/**
 * How a page should be displayed when navigating to a destination.
 * Matches PDF destination display types and WASM JsDestinationDisplay.
 */
export type DestinationDisplay = {
    type: "xyz";
    left?: number;
    top?: number;
    zoom?: number;
} | {
    type: "fit";
} | {
    type: "fitH";
    top?: number;
} | {
    type: "fitV";
    left?: number;
} | {
    type: "fitR";
    left: number;
    top: number;
    right: number;
    bottom: number;
} | {
    type: "fitB";
} | {
    type: "fitBH";
    top?: number;
} | {
    type: "fitBV";
    left?: number;
};
/**
 * A navigation destination (page + display mode).
 * Matches WASM JsDestination.
 */
export interface Destination {
    /** Target page index (0-based, from WASM) */
    pageIndex: number;
    /** How the page should be displayed */
    display: DestinationDisplay;
}
/**
 * An outline (table of contents) item.
 * Matches WASM JsOutlineItem.
 */
export interface OutlineItem {
    /** Display title */
    title: string;
    /** Navigation destination (optional - some items are structural only) */
    destination?: Destination;
    /** Child items */
    children: OutlineItem[];
    /** Whether the item should be initially collapsed in UI */
    initiallyCollapsed: boolean;
}
/**
 * How the target should be aligned within the viewport when navigating.
 * - "top": align target to viewport top edge (default)
 * - "center": align target to viewport center
 * - "bottom": align target to viewport bottom edge
 * - "nearest": scroll minimally to fit target into viewport (no scroll if already visible)
 */
export type ScrollAlignment = "top" | "center" | "bottom" | "nearest";
/**
 * Internal navigation target for the viewer.
 * Converted from Destination for use in viewer state.
 */
export interface NavigationTarget {
    /** Target page (1-based for UI consistency) */
    page: number;
    /** Optional scroll position within page (in PDF points, relative to page top-left) */
    scrollTo?: {
        x?: number;
        y?: number;
        height?: number;
    };
    /** Optional zoom level (undefined = keep current) */
    zoom?: number;
    /** How to align the target in the viewport (default: "top") */
    scrollAlignment?: ScrollAlignment;
}
/**
 * Convert a WASM destination to an internal navigation target.
 *
 * @param dest - The destination from WASM
 * @param pageCount - Total number of pages (for clamping)
 * @returns NavigationTarget for internal use
 */
export declare function destinationToNavigationTarget(dest: Destination, pageCount: number): NavigationTarget;
//# sourceMappingURL=navigation.d.ts.map