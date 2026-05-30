/**
 * Renderer for shape annotations: line, square, circle, polygon, polyLine, ink, redact.
 */
import type { LineAnnotation, SquareAnnotation, CircleAnnotation, PolygonAnnotation, PolyLineAnnotation, InkAnnotation, RedactAnnotation } from "./types";
/**
 * Render a line annotation with optional line endings.
 */
export declare function renderLine(layer: HTMLElement, annotation: LineAnnotation, scale: number): Element;
/**
 * Render a square/rectangle annotation.
 */
export declare function renderSquare(layer: HTMLElement, annotation: SquareAnnotation, scale: number): Element;
/**
 * Render a circle/ellipse annotation.
 */
export declare function renderCircle(layer: HTMLElement, annotation: CircleAnnotation, scale: number): Element;
/**
 * Render a polygon annotation (closed shape).
 */
export declare function renderPolygon(layer: HTMLElement, annotation: PolygonAnnotation, scale: number): Element;
/**
 * Render a polyline annotation (open path).
 */
export declare function renderPolyLine(layer: HTMLElement, annotation: PolyLineAnnotation, scale: number): Element;
/**
 * Render an ink (freehand) annotation.
 */
export declare function renderInk(layer: HTMLElement, annotation: InkAnnotation, scale: number): Element;
/**
 * Render a redact annotation (marks content for removal).
 */
export declare function renderRedact(layer: HTMLElement, annotation: RedactAnnotation, scale: number): Element;
//# sourceMappingURL=ShapeRenderer.d.ts.map