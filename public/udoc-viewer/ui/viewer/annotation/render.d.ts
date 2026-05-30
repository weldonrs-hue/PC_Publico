/**
 * Main annotation rendering module.
 *
 * Coordinates all specialized renderers and provides a unified API.
 */
import type { Annotation, Rect, MarkupMetadata } from "./types";
import * as TextRenderer from "./TextRenderer";
export type { ShowPopupCallback } from "./TextRenderer";
/**
 * Render a single annotation element.
 */
export declare function renderAnnotation(layer: HTMLElement, annotation: Annotation, scale: number, onShowPopup?: TextRenderer.ShowPopupCallback): Element | null;
/**
 * Render all annotations into an annotation layer element.
 */
export declare function renderAnnotationsToLayer(layer: HTMLDivElement, annotations: Annotation[], scale: number, highlightBounds?: Rect | null, onShowPopup?: TextRenderer.ShowPopupCallback): void;
/** Close the currently active popup. */
export declare function closeAnnotationPopup(): void;
/** Show popup for an annotation. */
export declare function showAnnotationPopup(annotation: {
    metadata?: MarkupMetadata;
    contents?: string;
}, anchorEl: HTMLElement, container: HTMLElement): void;
//# sourceMappingURL=render.d.ts.map