import type { OutlineItem, NavigationTarget, ScrollAlignment } from "./navigation";
import type { Annotation } from "./annotation";
import type { LayoutPage } from "../../worker/index.js";
import type { PageInfo, PageGroup } from "../../worker/index.js";
/** A single search match with its location and geometry. */
export interface SearchMatch {
    /** 0-based page index. */
    pageIndex: number;
    /** Character offset within the concatenated page text. */
    charOffset: number;
    /** Length of the matched text. */
    length: number;
    /** Bounding rectangles for this match (in PDF points, for highlight rendering). */
    rects: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        angle: number;
    }>;
    /** Context snippet: [before, match, after] text for display in result list. */
    context: [string, string, string];
}
export interface VisibilityGroup {
    id: string;
    name: string;
    visible: boolean;
    locked: boolean;
}
export type LeftPanelTab = "thumbnail" | "outline" | "bookmarks" | "layers" | "attachments" | "fonts";
export type RightPanelTab = "search" | "comments";
export type PanelTab = LeftPanelTab | RightPanelTab;
export declare function isLeftPanelTab(tab: PanelTab): tab is LeftPanelTab;
export type ViewMode = "paged" | "continuous";
export type ScrollMode = "spread" | "continuous";
export type LayoutMode = "single-page" | "double-page" | "double-page-odd-right" | "double-page-odd-left";
export type ZoomMode = "fit-spread-width" | "fit-spread-width-max" | "fit-spread-height" | "fit-spread" | "custom";
export type PageRotation = 0 | 90 | 180 | 270;
export type SpacingMode = "all" | "none" | "spread-only" | "page-only";
export type ThemeMode = "light" | "dark" | "system";
/** Top-level tool category — the discriminant of `ActiveTool` and the key for `disabledTools`. */
export type ToolKind = "pointer" | "hand" | "zoom" | "annotate" | "markup";
/** Individual annotation sub-tools */
export type AnnotateSubTool = "select" | "freehand" | "line" | "arrow" | "rectangle" | "ellipse" | "polygon" | "polyline";
/** Individual markup sub-tools */
export type MarkupSubTool = "select" | "highlight" | "underline" | "strikethrough" | "squiggly";
/** Any sub-tool — used as a key for `toolOptions`. */
export type SubTool = AnnotateSubTool | MarkupSubTool;
/**
 * The currently active tool, as a tagged union. Whether a variant has a `sub`
 * is itself the simple-vs-tool-set distinction — pointer/hand/zoom carry no
 * sub-tool, annotate/markup carry the sub for their family.
 */
export type ActiveTool = {
    kind: "pointer";
} | {
    kind: "hand";
} | {
    kind: "zoom";
} | {
    kind: "annotate";
    sub: AnnotateSubTool;
} | {
    kind: "markup";
    sub: MarkupSubTool;
};
/** Line dash style */
export type LineStyle = "solid" | "dashed" | "dotted";
/** Arrow head style */
export type ArrowHeadStyle = "none" | "open" | "closed";
/** Per-tool drawing options */
export interface ToolOptions {
    strokeColor: string;
    fillColor: string | null;
    strokeWidth: number;
    opacity: number;
    fontSize: number;
    lineStyle: LineStyle;
    arrowHeadStart: ArrowHeadStyle;
    arrowHeadEnd: ArrowHeadStyle;
}
/** Default tool options */
export declare const DEFAULT_TOOL_OPTIONS: ToolOptions;
/** Check if a tool kind has an associated sub-toolbar. */
export declare function isToolSetKind(kind: ToolKind): kind is "annotate" | "markup";
/** Document format as detected during loading */
export type DocumentFormat = "pdf" | "pptx" | "docx" | "xlsx" | "image";
/** Formats that support annotation editing */
export declare const ANNOTATION_FORMATS: ReadonlySet<DocumentFormat>;
/** Subset of view mode state that can be overridden per format */
export interface ViewModeDefaults {
    viewMode?: ViewMode;
    scrollMode?: ScrollMode;
    layoutMode?: LayoutMode;
    zoomMode?: ZoomMode;
    zoom?: number;
    effectiveZoom?: number | null;
    pageRotation?: PageRotation;
    spacingMode?: SpacingMode;
    pageSpacing?: number;
    spreadSpacing?: number;
}
/** Returns format-specific view mode defaults */
export declare function getFormatDefaults(format: DocumentFormat): ViewModeDefaults;
/** Default zoom steps for zoom in/out actions */
export declare const DEFAULT_ZOOM_STEPS: readonly [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5];
export type { PageInfo };
/** PDF points are defined at 72 DPI */
export declare const PDF_DPI = 72;
/** Default display DPI (CSS standard) */
export declare const DEFAULT_DPI = 96;
/** Scale factor to convert PDF points to pixels at 100% zoom */
export declare const POINTS_TO_PIXELS: number;
/** Calculate the scale factor for a given display DPI */
export declare function getPointsToPixels(dpi: number): number;
export interface ZoomAnchor {
    /** Click position relative to viewport (0-1 range) */
    viewX: number;
    viewY: number;
    /** Scroll position before zoom */
    scrollLeft: number;
    scrollTop: number;
    /** Scroll content dimensions before zoom */
    scrollWidth: number;
    scrollHeight: number;
}
export interface ViewerState {
    doc: {
        id: string;
    } | null;
    documentFormat: DocumentFormat | null;
    page: number;
    pageCount: number;
    pageInfos: readonly PageInfo[];
    /** Stitching groups (one per XLSX sheet, one `linear` group for other formats). */
    pageGroups: readonly PageGroup[];
    /** Index of the currently active group (used for multi-sheet XLSX). */
    activeGroupIndex: number;
    /** Whether the document requires a password to open */
    needsPassword: boolean;
    /** Error message when password authentication fails */
    passwordError: string | null;
    /** Whether authentication is currently in progress */
    isAuthenticating: boolean;
    /** Document outline/bookmarks (null = not loaded yet) */
    outline: OutlineItem[] | null;
    /** Whether outline is currently being loaded */
    outlineLoading: boolean;
    /** Visibility groups (null = not loaded yet) */
    visibilityGroups: VisibilityGroup[] | null;
    /** Whether visibility groups are currently being loaded */
    visibilityGroupsLoading: boolean;
    /** Annotations by page index (0-based). Undefined = not loaded, [] = loaded but empty */
    pageAnnotations: Map<number, Annotation[]>;
    /** Set of page indices currently being loaded */
    annotationsLoading: Set<number>;
    /** Page layouts by page index (0-based). Undefined = not loaded yet */
    pageText: Map<number, LayoutPage>;
    /** Set of page indices currently being loaded */
    textLoading: Set<number>;
    /** Set of page indices that failed to load (prevents retry loops) */
    textFailed: Set<number>;
    /** Target for navigation (null = no pending navigation) */
    navigationTarget: NavigationTarget | null;
    /** Default scroll alignment for navigation (outline, links, goToDestination) */
    navigationScrollAlignment: ScrollAlignment;
    /** Default scroll alignment for search result navigation */
    searchScrollAlignment: ScrollAlignment;
    viewMode: ViewMode;
    scrollMode: ScrollMode;
    layoutMode: LayoutMode;
    zoomMode: ZoomMode;
    zoom: number;
    /** Derived zoom for fit modes (null when not applicable). */
    effectiveZoom: number | null;
    zoomSteps: readonly number[];
    pageRotation: PageRotation;
    spacingMode: SpacingMode;
    dpi: number;
    pageSpacing: number;
    spreadSpacing: number;
    /** Width of thumbnail images in CSS pixels */
    thumbnailWidth: number;
    activePanel: PanelTab | null;
    /** Left panel width in pixels (null = use CSS default) */
    leftPanelWidth: number | null;
    /** Right panel width in pixels (null = use CSS default) */
    rightPanelWidth: number | null;
    /** Whether the top toolbar is visible */
    toolbarVisible: boolean;
    /** Whether the floating toolbar (page nav + zoom) is visible */
    floatingToolbarVisible: boolean;
    /** Whether the left panel area is visible */
    leftPanelVisible: boolean;
    /** Whether the right panel area is visible */
    rightPanelVisible: boolean;
    /** Set of panel tabs that are disabled (removed from the UI) */
    disabledPanels: ReadonlySet<PanelTab>;
    /** Whether the fullscreen button is visible in the toolbar */
    fullscreenButtonVisible: boolean;
    /** Whether the download button is visible in the toolbar */
    downloadButtonVisible: boolean;
    /** Whether the print button is visible in the toolbar */
    printButtonVisible: boolean;
    /** Current color theme mode */
    theme: ThemeMode;
    /** Whether the theme toggle button is hidden */
    themeSwitchingDisabled: boolean;
    /** Whether text selection is disabled */
    textSelectionDisabled: boolean;
    /** Whether slide transition animations are enabled (PPTX only) */
    transitionsEnabled: boolean;
    /** Minimum zoom level */
    minZoom: number;
    /** Maximum zoom level */
    maxZoom: number;
    /** Currently highlighted annotation (null = none) */
    highlightedAnnotation: {
        pageIndex: number;
        bounds: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
    } | null;
    /** Whether the viewer is in fullscreen mode */
    isFullscreen: boolean;
    /** Current search query string */
    searchQuery: string;
    /** Whether search is case-sensitive */
    searchCaseSensitive: boolean;
    /** Whether fuzzy matching is enabled (normalizes whitespace/control characters) */
    searchFuzzy: boolean;
    /** All search matches across all pages */
    searchMatches: SearchMatch[];
    /** Index of the currently active/focused match (-1 = none) */
    searchActiveIndex: number;
    /** Incremented each time the user explicitly navigates to a match. */
    searchNavGen: number;
    /** Per-call scroll alignment override for the current search navigation (cleared after use). */
    searchNavScrollAlignment: ScrollAlignment | null;
    /**
     * Optional page range to restrict search to (inclusive, 0-based).
     * When non-null, both text loading and match collection are limited to
     * pages in [start, end]. null means search all pages.
     */
    searchPageRange: {
        start: number;
        end: number;
    } | null;
    /** Whether all page text has been loaded for search */
    searchTextLoaded: boolean;
    /** Whether search text is currently being loaded */
    searchTextLoading: boolean;
    /** Whether document is currently being downloaded or print is being prepared */
    isDownloading: boolean;
    /** Download progress: loaded bytes */
    downloadLoaded: number;
    /** Download progress: total bytes (0 if unknown) */
    downloadTotal: number;
    /** Whether document is being processed (WASM load, page info extraction) after download */
    isProcessing: boolean;
    /** Whether print preparation is in progress */
    isPrinting: boolean;
    /** Print progress: current page being rendered (1-based) */
    printCurrentPage: number;
    /** Print progress: total pages to render */
    printTotalPages: number;
    /** Whether the print dialog is visible */
    showPrintDialog: boolean;
    /** When true, panel open/close should skip CSS transitions (reset automatically after one frame) */
    panelTransitionsDisabled: boolean;
    /** Set of page indices that have been modified by user annotation edits */
    annotationsDirtyPages: ReadonlySet<number>;
    /** Currently selected annotation for editing (null = none) */
    selectedAnnotation: {
        pageIndex: number;
        annotationIndex: number;
    } | null;
    /** Anchor data from zoom tool click, consumed by Viewport to scroll to click point */
    zoomAnchor: ZoomAnchor | null;
    /** Set of tool kinds that are disabled (hidden from the UI). */
    disabledTools: ReadonlySet<ToolKind>;
    /** Currently active tool — tagged union; sub is present iff kind is a tool set. */
    activeTool: ActiveTool;
    /** Remembers the last-used sub-tool per tool set */
    lastSubToolPerSet: {
        annotate: AnnotateSubTool;
        markup: MarkupSubTool;
    };
    /** Per-sub-tool persistent options */
    toolOptions: Record<string, ToolOptions>;
}
export declare const initialState: ViewerState;
//# sourceMappingURL=state.d.ts.map