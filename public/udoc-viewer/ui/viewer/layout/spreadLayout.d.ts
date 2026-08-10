import { type LayoutMode, type PageRotation, type PageInfo } from "../state";
import type { PageGroup } from "../../../worker/index.js";
/**
 * Represents a page slot within a spread.
 * `null` means an empty slot (for unbalanced spreads).
 */
export type PageSlot = number | null;
/**
 * A spread contains one or two page slots.
 * In single-page mode: [pageNumber]
 * In double-page modes: [leftPage, rightPage] where either can be null
 */
export interface Spread {
    /** Index of this spread (0-based) */
    index: number;
    /** Page slots: single-page has 1 slot, double-page has 2 slots */
    slots: [PageSlot] | [PageSlot, PageSlot];
}
/**
 * Calculate the spread composition for a document.
 *
 * @param pageCount - Total number of pages in the document
 * @param layoutMode - The layout mode determining pages per spread
 * @returns Array of spreads with their page assignments
 */
export declare function calculateSpreads(pageCount: number, layoutMode: LayoutMode): Spread[];
/**
 * Find the spread index containing a specific page using O(1) arithmetic.
 * Since spread structure is fully deterministic from layout mode, we can compute
 * the index directly without any search.
 */
export declare function findSpreadForPage(spreads: Spread[], page: number): number;
/**
 * Get the primary page of a spread (first non-null slot).
 */
export declare function getSpreadPrimaryPage(spread: Spread): number;
/**
 * Calculated layout for a spread, including position and dimensions.
 */
export interface SpreadLayout {
    /** Spread index */
    index: number;
    /** Page slots */
    slots: [PageSlot] | [PageSlot, PageSlot];
    /** Y position from top of container (scaled) */
    top: number;
    /** Width of the spread (scaled) */
    width: number;
    /** Height of the spread (scaled) */
    height: number;
}
export interface SpreadLayoutResult {
    layouts: SpreadLayout[];
    contentWidth: number;
    contentHeight: number;
}
export interface SpreadDimensions {
    width: number;
    height: number;
}
interface Size {
    width: number;
    height: number;
}
/**
 * Calculate spread layouts with positions for virtual scrolling.
 *
 * @param spreads - Array of spreads from calculateSpreads()
 * @param pageInfos - Array of page sizes (0-indexed, in points)
 * @param scale - Zoom scale factor
 * @param pageSpacing - Horizontal spacing between pages in a spread
 * @param spreadSpacing - Vertical spacing between spreads
 * @param dpi - Display DPI for point-to-pixel conversion
 * @param rotation - Page rotation in degrees
 * @returns Layouts plus aggregated content size
 */
export declare function calculateSpreadLayouts(spreads: Spread[], pageInfos: readonly PageInfo[], scale: number, pageSpacing: number, spreadSpacing: number, dpi: number, rotation: PageRotation): SpreadLayoutResult;
/**
 * Calculate the dimensions of a spread based on its pages.
 * Returns dimensions in CSS pixels (accounting for DPI conversion).
 */
export declare function getSpreadDimensions(spread: Spread, pageInfos: readonly PageInfo[], scale: number, pageSpacing: number, dpi: number, rotation: PageRotation): SpreadDimensions;
/**
 * Calculate total content height including all spreads and spacing.
 */
export declare function calculateTotalHeight(layouts: SpreadLayout[], spreadSpacing: number): number;
/**
 * Find visible spread indices based on scroll position and viewport height.
 * Uses binary search for O(log n) complexity.
 *
 * @param layouts - Array of spread layouts
 * @param scrollTop - Current scroll position
 * @param viewportHeight - Height of the visible viewport
 * @param buffer - Number of extra spreads to include above/below (for smooth scrolling)
 * @returns Object with start and end indices (inclusive)
 */
export declare function findVisibleSpreadRange(layouts: SpreadLayout[], scrollTop: number, viewportHeight: number, buffer?: number): {
    start: number;
    end: number;
};
/**
 * Get the cropped content size for a page in continuous mode.
 * Uses contentRect if available, otherwise falls back to full page size.
 */
export declare function getCroppedPageSize(pageInfo: PageInfo, rotation: PageRotation): Size;
/**
 * Layout for a single row in the continuous grid.
 * Each row is one spread containing all pages in that row.
 */
export interface ContinuousRowLayout {
    /** Row index in the grid */
    row: number;
    /** Y position from top of container (CSS pixels) */
    top: number;
    /** Width of this row (CSS pixels) */
    width: number;
    /** Height of this row (CSS pixels) */
    height: number;
    /** Pages in this row, in column order */
    pages: Array<{
        pageIndex: number;
        col: number;
        left: number;
        width: number;
        height: number;
    }>;
}
export interface ContinuousLayoutResult {
    /** One SpreadLayout per page (for compatibility with existing Viewport) */
    layouts: SpreadLayout[];
    /** Row layouts for the continuous grid */
    rowLayouts: ContinuousRowLayout[];
    /** Total content width (CSS pixels) */
    contentWidth: number;
    /** Total content height (CSS pixels) */
    contentHeight: number;
    /** Column widths in CSS pixels (for consistent column alignment) */
    columnWidths: number[];
    /** Whether this is a grid layout (XLSX with tilePos) vs linear stitch (Word/PDF/PPTX) */
    isGridLayout: boolean;
}
/**
 * Calculate continuous mode layout.
 *
 * Two sub-modes are selected by the active group's stitching layout
 * (from the WASM engine, one group per XLSX sheet, one linear group otherwise):
 *
 * 1. **Linear stitch** (`linear` group — Word/PDF/PPTX): Full-width pages
 *    stacked vertically with zero spacing, centered. No content-rect cropping.
 * 2. **Grid stitch** (`tiled` group — XLSX sheet): Pages cropped to contentRect
 *    and arranged in a 2D grid whose dimensions come from the group layout.
 */
export declare function calculateContinuousLayout(spreads: Spread[], pageInfos: readonly PageInfo[], scale: number, dpi: number, rotation: PageRotation, activeGroup: PageGroup | null): ContinuousLayoutResult;
export {};
//# sourceMappingURL=spreadLayout.d.ts.map