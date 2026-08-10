/**
 * Shared utilities for annotation rendering.
 */
import type { Annotation, AnnotationColor, AnnotationPatch, Point, Rect } from "./types";
/**
 * Convert annotation color to CSS rgba() string.
 */
export declare function colorToRgba(color: AnnotationColor | undefined, opacity: number, defaultColor?: string): string;
/**
 * Convert annotation color to CSS rgb() string.
 */
export declare function colorToRgb(color: AnnotationColor | undefined, defaultColor?: string): string;
/**
 * Scale a point from page coordinates to screen pixels.
 */
export declare function scalePoint(point: Point, scale: number): Point;
/**
 * Scale bounds from page coordinates to screen pixels.
 */
export declare function scaleBounds(bounds: Rect, scale: number): Rect;
/**
 * Apply bounds as inline styles to an element.
 */
export declare function applyBoundsStyle(el: HTMLElement, bounds: Rect, scale: number): void;
/**
 * Create an SVG element sized to cover the annotation layer.
 *
 * Hit-testing for these overlays is owned by the package stylesheet: the
 * <svg> root gets `pointer-events: none` and each painted child gets
 * `pointer-events: visiblePainted`, so empty SVG space passes through to
 * text/canvas underneath while painted geometry still fires hover/click.
 * The rules live in CSS (not inline here) so host apps can override them
 * with a normal selector — no `!important` needed.
 */
export declare function createSvgOverlay(): SVGSVGElement;
/**
 * Create SVG namespace element helper.
 */
export declare function createSvgElement<K extends keyof SVGElementTagNameMap>(tagName: K): SVGElementTagNameMap[K];
/**
 * Check if two bounds are approximately equal (for highlight matching).
 */
export declare function boundsMatch(a: Rect, b: Rect, epsilon?: number): boolean;
/** Effective page rotation, in degrees, as applied by Spread's CSS transform. */
export type EffectiveRotation = 0 | 90 | 180 | 270;
/**
 * Inverse of the CSS `rotate(rotation deg)` applied to the annotation layer.
 *
 * Annotation bounds are stored in unrotated MediaBox space; the layer is then
 * rotated by the viewer. Pointer events arrive in displayed (rotated) space,
 * so deltas/points must be inverse-rotated before being written into the
 * annotation model. Operates on screen-frame coordinates (y-down).
 */
export declare function invertPageRotation(dx: number, dy: number, rotation: EffectiveRotation): Point;
/**
 * Return a new annotation with all geometry scaled to fit newBounds.
 * Points are remapped proportionally from the old bounds to the new bounds.
 */
export declare function resizeAnnotation(annotation: Annotation, newBounds: Rect): Annotation;
/**
 * Return a new annotation with all geometry offset by (dx, dy) in page coordinates.
 */
export declare function offsetAnnotation(annotation: Annotation, dx: number, dy: number): Annotation;
/**
 * Apply a partial patch to an annotation, returning a new annotation.
 *
 * - `type` and `name` in the patch are silently ignored (the existing values
 *   are preserved) so callers can spread an annotation in without surprises.
 * - `metadata` is shallow-merged one level so patching one field doesn't
 *   wipe the others.
 * - `undefined` values are skipped — they are not treated as "clear this
 *   field". Use `updatePageAnnotation` for full replacement semantics.
 */
export declare function applyAnnotationPatch(existing: Annotation, patch: AnnotationPatch): Annotation;
//# sourceMappingURL=utils.d.ts.map