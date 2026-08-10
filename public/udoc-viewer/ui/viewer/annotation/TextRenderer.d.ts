/**
 * Renderer for text annotations: text (sticky note), freeText, stamp, caret.
 */
import type { TextAnnotation, FreeTextAnnotation, StampAnnotation, CaretAnnotation, MarkupMetadata } from "./types";
/** Callback for showing annotation popup. */
export type ShowPopupCallback = (anchor: HTMLElement, metadata: MarkupMetadata, color: string) => void;
/**
 * Render a text (sticky note) annotation.
 */
export declare function renderText(layer: HTMLElement, annotation: TextAnnotation, scale: number, onShowPopup?: ShowPopupCallback): HTMLElement;
/**
 * Render a free text annotation.
 */
export declare function renderFreeText(layer: HTMLElement, annotation: FreeTextAnnotation, scale: number): HTMLElement;
/**
 * Render a stamp annotation.
 */
export declare function renderStamp(layer: HTMLElement, annotation: StampAnnotation, scale: number): HTMLElement;
/**
 * Render a caret annotation.
 */
export declare function renderCaret(layer: HTMLElement, annotation: CaretAnnotation, scale: number): Element;
//# sourceMappingURL=TextRenderer.d.ts.map