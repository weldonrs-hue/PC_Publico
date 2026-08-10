import type { Spread as SpreadData } from "../layout/spreadLayout";
import { type WorkerClient } from "../../../worker/index.js";
import { type PageRotation, type PageInfo } from "../state";
import { type Annotation } from "../annotation";
import type { LayoutPage } from "../../../worker/index.js";
import type { SearchMatch } from "../state";
import type { I18n } from "../i18n/index.js";
export interface HighlightedAnnotation {
    pageIndex: number;
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
export interface SpreadRenderOptions {
    docId: string;
    scale: number;
    dpi: number;
}
/**
 * How to crop pages to contentRect in continuous view mode.
 * - "none": no cropping (paged mode)
 * - "vertical": crop top/bottom only, keep full page width (Word/PDF/PPTX continuous)
 * - "full": crop all four sides (XLSX grid continuous)
 */
export type CropMode = "none" | "vertical" | "full";
export interface SpreadLayoutOptions {
    pageInfos: readonly PageInfo[];
    scale: number;
    dpi: number;
    rotation: PageRotation;
    pageSpacing: number;
    /** How to crop pages to contentRect (continuous view mode) */
    cropMode?: CropMode;
}
/**
 * Render callback for the Custom Page Overlay layer.
 *
 * Invoked once per page slot lifetime, after the slot's layers have been
 * created. The host appends DOM into `container` (which sits above every
 * built-in layer — canvas, text, annotation, search highlight) and may
 * return a cleanup function that runs when the slot is destroyed (e.g.
 * when the page scrolls out of view in continuous mode).
 *
 * The layer is positioned and sized to match the page bounds, and rotates
 * with the page. It has `pointer-events: none` by default; opt individual
 * child elements into `pointer-events: auto` to receive input without
 * blocking text selection elsewhere on the page.
 *
 * @param pageIndex 0-based page index.
 * @param container The overlay layer element, sized to the page bounds.
 * @param scale CSS pixels per PDF point at the current zoom. Use this to
 *   place elements at PDF-point coordinates: `pixelX = pointX * scale`.
 *   For page-bounds-relative placement (top-right of the page, etc.), use
 *   plain CSS on `container` and ignore this argument.
 */
export type CustomPageOverlayRenderer = (pageIndex: number, container: HTMLElement, scale: number) => void | (() => void);
/**
 * Spread component - renders one or two pages side by side.
 * Empty slots render as blank placeholders that preserve layout.
 */
export declare function createSpread(data: SpreadData, showAttribution?: boolean, i18n?: I18n, customPageOverlay?: CustomPageOverlayRenderer): {
    el: HTMLDivElement;
    mount: (container: HTMLElement) => void;
    destroy: () => void;
    render: (workerClient: WorkerClient, options: SpreadRenderOptions) => Promise<void>;
    updateLayout: (options: SpreadLayoutOptions) => void;
    updateAnnotations: (annotations: Map<number, Annotation[]>, options: SpreadLayoutOptions, highlightedAnnotation?: HighlightedAnnotation | null) => void;
    updateTextLayer: (textContent: Map<number, LayoutPage>, options: SpreadLayoutOptions) => void;
    updateSearchHighlights: (matches: SearchMatch[], activeIndex: number, options: SpreadLayoutOptions) => void;
    updateCustomPageOverlay: (options: SpreadLayoutOptions) => void;
    resetRenderKeys: () => void;
    getElement: () => HTMLDivElement;
    getData: () => SpreadData;
};
export type SpreadComponent = ReturnType<typeof createSpread>;
//# sourceMappingURL=Spread.d.ts.map