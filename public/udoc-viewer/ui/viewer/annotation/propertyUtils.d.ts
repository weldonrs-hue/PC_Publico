/**
 * Conversion utilities between ToolOptions (UI) and Annotation properties (data model).
 *
 * Shared by AnnotationDrawController (creating annotations) and SubToolbar (editing existing ones).
 */
import type { AnnotationColor, Annotation, BorderStyle, LineEnding } from "./types";
import type { ToolOptions, LineStyle, ArrowHeadStyle } from "../state";
/** Parse hex color (#rrggbb) to AnnotationColor (0-1 range). */
export declare function parseHexColor(hex: string): AnnotationColor;
/** Convert AnnotationColor (0-1 range) to hex string (#rrggbb). */
export declare function annotationColorToHex(color: AnnotationColor): string;
/** Map ArrowHeadStyle (UI) to PDF LineEnding. */
export declare function toLineEnding(style: ArrowHeadStyle): LineEnding;
/** Map PDF LineEnding to ArrowHeadStyle (UI). */
export declare function fromLineEnding(ending: LineEnding | undefined): ArrowHeadStyle;
/** Map tool LineStyle (UI) to PDF BorderStyle. */
export declare function toBorderStyle(lineStyle: LineStyle): BorderStyle;
/** Map PDF BorderStyle to tool LineStyle (UI). */
export declare function fromBorderStyle(borderStyle: BorderStyle | undefined): LineStyle;
/** Which ToolOptions keys are editable for each annotation type. */
type ToolOptionKey = "strokeColor" | "fillColor" | "strokeWidth" | "opacity" | "lineStyle" | "arrowHead";
/** Get the list of editable option keys for an annotation, or null if not editable. */
export declare function getEditableOptionsForAnnotation(annotation: Annotation): ToolOptionKey[] | null;
/** Extract ToolOptions from an existing annotation (for display in SubToolbar). */
export declare function annotationToToolOptions(annotation: Annotation): ToolOptions;
/** Apply a partial set of ToolOptions changes to an annotation, returning a new annotation. */
export declare function applyToolOptionsToAnnotation(annotation: Annotation, changed: Partial<ToolOptions>): Annotation;
export {};
//# sourceMappingURL=propertyUtils.d.ts.map