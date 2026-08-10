/**
 * Text search algorithm for document viewer.
 *
 * Walks the LayoutPage hierarchy to extract text and glyph positions,
 * then searches across all loaded pages and returns matches with
 * pre-computed bounding rectangles for highlight rendering.
 */
import type { LayoutPage } from "../../../worker/index.js";
import type { SearchMatch } from "../state";
/**
 * Extract the flat text of a page, matching exactly what search sees.
 */
export declare function extractPageText(layout: LayoutPage): string;
/**
 * Execute text search across loaded pages.
 *
 * @param query - Search string
 * @param caseSensitive - Whether to match case
 * @param pageLayouts - Map of page index to LayoutPage
 * @param pageCount - Total number of pages
 * @param pageRange - Optional inclusive range to restrict search to (null = all pages)
 * @param fuzzy - When true, normalize whitespace/control characters before matching
 *   so that e.g. AI-generated citations match the original document text even when
 *   whitespace or special characters differ.
 * @returns Array of search matches with pre-computed highlight rects
 */
export declare function executeSearch(query: string, caseSensitive: boolean, pageLayouts: Map<number, LayoutPage>, pageCount: number, pageRange?: {
    start: number;
    end: number;
} | null, fuzzy?: boolean): SearchMatch[];
//# sourceMappingURL=search.d.ts.map