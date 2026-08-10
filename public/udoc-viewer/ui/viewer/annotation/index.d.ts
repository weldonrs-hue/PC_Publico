/**
 * Annotation module - types, utilities, and renderers.
 */
export type { Annotation, AnnotationPatch, AnnotationType, Rect, Point, Quad, AnnotationColor, MarkupMetadata, Destination, DestinationDisplay, LinkAction, LinkAnnotation, HighlightAnnotation, UnderlineAnnotation, StrikeOutAnnotation, SquigglyAnnotation, TextAnnotation, FreeTextAnnotation, StampAnnotation, CaretAnnotation, LineAnnotation, SquareAnnotation, CircleAnnotation, PolygonAnnotation, PolyLineAnnotation, InkAnnotation, RedactAnnotation, TextAnnotationIcon, TextJustification, CaretSymbol, LineEnding, BorderStyle, } from "./types";
export { colorToRgba, colorToRgb, scalePoint, scaleBounds, applyBoundsStyle, createSvgOverlay, createSvgElement, boundsMatch, offsetAnnotation, resizeAnnotation, applyAnnotationPatch, } from "./utils";
export { renderAnnotation, renderAnnotationsToLayer, closeAnnotationPopup, showAnnotationPopup } from "./render";
export type { ShowPopupCallback } from "./render";
export { parseHexColor, annotationColorToHex, toLineEnding, fromLineEnding, toBorderStyle, fromBorderStyle, annotationToToolOptions, applyToolOptionsToAnnotation, getEditableOptionsForAnnotation, } from "./propertyUtils";
//# sourceMappingURL=index.d.ts.map