/**
 * Renderer for markup annotations: highlight, underline, strikeOut, squiggly.
 */
import type { HighlightAnnotation, UnderlineAnnotation, StrikeOutAnnotation, SquigglyAnnotation } from "./types";
/**
 * Render a highlight annotation.
 */
export declare function renderHighlight(layer: HTMLElement, annotation: HighlightAnnotation, scale: number): HTMLElement;
/**
 * Render an underline annotation.
 */
export declare function renderUnderline(layer: HTMLElement, annotation: UnderlineAnnotation, scale: number): HTMLElement;
/**
 * Render a strikeout annotation.
 */
export declare function renderStrikeOut(layer: HTMLElement, annotation: StrikeOutAnnotation, scale: number): HTMLElement;
/**
 * Render a squiggly annotation.
 */
export declare function renderSquiggly(layer: HTMLElement, annotation: SquigglyAnnotation, scale: number): HTMLElement;
//# sourceMappingURL=MarkupRenderer.d.ts.map