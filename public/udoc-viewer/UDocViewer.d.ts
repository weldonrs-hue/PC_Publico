/**
 * UDocViewer - Document viewer component.
 *
 * Binds to a loaded document and optionally provides UI.
 * Created via `client.createViewer()`.
 */
import type { WorkerClient, PageInfo, FontUsageEntry } from "./worker/index.js";
import type { ViewerOptions } from "./UDocClient.js";
import type { PrintDialogResult } from "./ui/viewer/components/PrintDialog.js";
import type { Destination, OutlineItem, ScrollAlignment } from "./ui/viewer/navigation.js";
import { type Annotation, type AnnotationPatch } from "./ui/viewer/annotation/index.js";
export type { Annotation, AnnotationPatch } from "./ui/viewer/annotation/index.js";
export type { SearchMatch } from "./ui/viewer/state.js";
import type { LayoutPage } from "./worker/index.js";
import { type ViewMode, type PanelTab, type ScrollMode, type LayoutMode, type ZoomMode, type PageRotation, type SpacingMode, type ThemeMode, type SearchMatch, type ActiveTool } from "./ui/viewer/state.js";
import { type IPerformanceCounter } from "./performance/index.js";
/**
 * Options for rendering a page.
 */
export interface RenderOptions {
    /**
     * Scale factor for rendering.
     * 1 = 72 DPI (1 point = 1 pixel)
     * 2 = 144 DPI (retina)
     * @default 1
     */
    scale?: number;
    /**
     * Output format.
     * @default 'image-data'
     */
    format?: "image-data" | "image-bitmap" | "blob" | "data-url";
    /**
     * Image type when format is 'blob' or 'data-url'.
     * @default 'image/png'
     */
    imageType?: "image/png" | "image/jpeg";
    /**
     * JPEG quality (0-1) when imageType is 'image/jpeg'.
     * @default 0.92
     */
    quality?: number;
    /**
     * Include annotations in render.
     * @default true
     */
    annotations?: boolean;
    /**
     * Skip all cache and queue, call worker directly.
     * Useful for one-off renders that shouldn't affect the render queue.
     * @default false
     */
    force?: boolean;
    /**
     * Boost render priority by calling boostRenderPage before rendering.
     * This prioritizes this page and nearby pages in the render queue.
     * @default false
     */
    boost?: boolean;
}
/**
 * Rendered page result.
 */
export type RenderedPage = ImageData | ImageBitmap | Blob | string;
/**
 * Document metadata.
 */
export interface DocumentMetadata {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
}
/**
 * Re-export navigation types for public API.
 */
export type { Destination, DestinationDisplay, OutlineItem, ScrollAlignment } from "./ui/viewer/navigation.js";
/**
 * Download progress information.
 */
export interface DownloadProgress {
    /** Bytes loaded so far. */
    loaded: number;
    /** Total bytes (may be 0 if Content-Length not available). */
    total: number;
    /** Progress percentage 0-100 (null if total unknown). */
    percent: number | null;
}
/**
 * UI component identifier for visibility events.
 */
export type UIComponent = "toolbar" | "floatingToolbar" | "leftPanel" | "rightPanel" | "fullscreen" | "download" | "print" | PanelTab;
/**
 * Event map for viewer events.
 */
export interface ViewerEventMap {
    "document:load": {
        pageCount: number;
    };
    "document:close": Record<string, never>;
    "download:progress": DownloadProgress;
    error: {
        error: Error;
        phase: "fetch" | "parse" | "render";
    };
    "page:change": {
        page: number;
        previousPage: number;
    };
    "ui:visibilityChange": {
        component: UIComponent;
        visible: boolean;
    };
    "panel:change": {
        panel: PanelTab | null;
        previousPanel: PanelTab | null;
    };
    "font:usageChange": {
        entries: FontUsageEntry[];
    };
    "search:change": {
        matches: SearchMatch[];
        activeIndex: number;
    };
    "annotation:add": {
        pageIndex: number;
        annotation: Annotation;
    };
    "annotation:update": {
        pageIndex: number;
        annotation: Annotation;
    };
    "annotation:remove": {
        pageIndex: number;
        annotation: Annotation;
    };
    "annotation:select": {
        pageIndex: number;
        annotation: Annotation;
    } | null;
    /**
     * Fires when the pointer enters or leaves an annotation element on a
     * rendered page. Always emitted regardless of the active tool — including
     * during normal viewing. Payload is `null` when the pointer leaves the
     * currently hovered annotation without entering another. `clientX`/
     * `clientY` are the pointer's browser-viewport coordinates at the moment
     * of the hover change (rotation- and zoom-invariant; suitable for placing
     * a tooltip in screen space).
     */
    "annotation:hover": {
        pageIndex: number;
        annotation: Annotation;
        clientX: number;
        clientY: number;
    } | null;
    /**
     * Fires when the user clicks an annotation on a rendered page. Always
     * emitted regardless of the active tool, in addition to (and before) any
     * built-in click handling such as link navigation or sticky-note popups.
     * `clientX`/`clientY` are the pointer's browser-viewport coordinates at
     * the click (rotation- and zoom-invariant; suitable for anchoring a
     * context menu or popover in screen space).
     */
    "annotation:click": {
        pageIndex: number;
        annotation: Annotation;
        clientX: number;
        clientY: number;
    };
    /**
     * Fires when the user's view of the document changes — scroll position,
     * zoom, layout, or scroll-mode changes that affect which pages are
     * visible. Throttled to once per animation frame, and de-duped so
     * adjacent identical payloads are coalesced.
     */
    "viewport:change": {
        /** First page index (0-based) at least partially visible. */
        firstVisiblePage: number;
        /** Last page index (0-based) at least partially visible. */
        lastVisiblePage: number;
        /** Current zoom factor (1 = 100%). */
        zoom: number;
        /** Vertical scroll offset of the viewport in CSS pixels. */
        scrollTop: number;
    };
}
type EventHandler<K extends keyof ViewerEventMap> = (payload: ViewerEventMap[K]) => void;
/**
 * Document viewer component.
 *
 * Supports both UI mode (with container) and headless mode (without container).
 * Use `client.createViewer()` to create instances.
 */
export declare class UDocViewer {
    private workerClient;
    private container;
    private uiShell;
    private documentId;
    private _pageCount;
    private _pageInfo;
    private destroyed;
    private eventHandlers;
    private _performanceCounter;
    private viewOverrides;
    private currentFormat;
    private sourceFilename;
    private storeUnsub;
    private actionUnsub;
    private fontUsageUnsub;
    private sdkVersion;
    /**
     * @internal
     * Use `client.createViewer()` instead.
     */
    constructor(workerClient: WorkerClient, options?: ViewerOptions, showAttribution?: boolean, showLoadingOverlay?: boolean, sdkVersion?: string);
    /**
     * Performance counter for tracking operation timings.
     * Only records data when `enablePerformanceCounter` is true.
     */
    get performanceCounter(): IPerformanceCounter;
    private buildStateOverrides;
    private buildViewModeOverrides;
    private computeViewDefaults;
    /**
     * Load a document.
     *
     * @param source - URL string, File object, or raw bytes
     */
    load(source: string | File | Uint8Array): Promise<void>;
    /**
     * Close the current document.
     * Viewer returns to empty state.
     */
    close(): void;
    /**
     * Whether a document is currently loaded.
     */
    get isLoaded(): boolean;
    /**
     * Check if the loaded document requires a password to open.
     * @returns True if the document needs authentication before pages can be accessed.
     */
    needsPassword(): Promise<boolean>;
    /**
     * Authenticate with a password to unlock an encrypted document.
     *
     * After successful authentication, page info is reloaded and the document
     * becomes fully accessible.
     *
     * @param password - The password to try
     * @returns True if authentication succeeded, false if the password was incorrect.
     */
    authenticate(password: string): Promise<boolean>;
    /**
     * Handle password submission from the UI dialog.
     * @internal
     */
    private handlePasswordSubmit;
    /**
     * Total number of pages.
     * Returns 0 if no document is loaded.
     */
    get pageCount(): number;
    /**
     * Document metadata (title, author, etc.).
     * Returns null if no document is loaded.
     */
    get metadata(): DocumentMetadata | null;
    /**
     * Get document outline (table of contents / bookmarks).
     */
    getOutline(): Promise<OutlineItem[]>;
    /**
     * Get font usage information for the loaded document.
     *
     * Returns how each font spec in the document was resolved,
     * including primary resolution and any glyph-fallback fonts.
     * This information is populated during rendering — call after
     * at least one page has been rendered for results.
     */
    getFontUsage(): Promise<FontUsageEntry[]>;
    /**
     * Get page dimensions in points (1 point = 1/72 inch).
     * @param page - Page index (0-based)
     */
    getPageInfo(page: number): Promise<PageInfo>;
    /**
     * Get annotations on a specific page.
     *
     * Returns the in-memory state if the page has been edited in this
     * session; otherwise reads from the worker.
     *
     * Returned `bounds` (and every other geometry field) are in the page's
     * unrotated MediaBox coordinate space — origin top-left, units in PDF
     * points, +y downward — regardless of the page's `/Rotate` value.
     * See {@link Rect} for the full coordinate convention.
     *
     * @param page - Page index (0-based)
     */
    getPageAnnotations(page: number): Promise<Annotation[]>;
    /**
     * Add a new annotation to a page.
     *
     * If `annotation.name` is omitted, a UUID is generated and assigned. The
     * returned value is the annotation as inserted (with `name` populated),
     * which is the same identifier the engine will write to the PDF's NM
     * entry on save.
     *
     * Pass `ephemeral: true` to create a viewer-only annotation that renders
     * but is excluded from saved PDF bytes and from print output. The same
     * `updatePageAnnotation` / `removePageAnnotation` calls work for both kinds, and
     * `updatePageAnnotation` can flip the `ephemeral` flag to promote a preview
     * into a saved annotation (or demote a saved one to viewer-only).
     *
     * **Coordinate space:** `annotation.bounds` and all per-type geometry
     * (line endpoints, polygon vertices, ink strokes, quads, callout lines,
     * …) must be in the page's **unrotated MediaBox** coordinate space —
     * origin top-left, PDF points, +y downward — *not* the displayed/rotated
     * orientation. The viewer applies `/Rotate` (and the user's rotation
     * toggle) as a display transform on top of MediaBox-space bounds. See
     * {@link Rect} for the full convention. The {@link getPageAnnotations}
     * round-trip uses the same space, so a value read out and added back is
     * always in the right frame.
     *
     * Annotation editing currently requires UI mode (a `container` was passed
     * to `client.createViewer`) and is supported on PDF documents only.
     *
     * @param page - Page index (0-based)
     * @returns The inserted annotation (with `name` populated).
     */
    addPageAnnotation(page: number, annotation: Annotation): Promise<Annotation>;
    /**
     * Add multiple annotations to a page in a single batch.
     *
     * Equivalent to calling {@link addPageAnnotation} once per item, but
     * applied as a single store update — one render and one dirty-flag flip
     * per page instead of N. Use this when importing or restoring many
     * annotations on the same page.
     *
     * Each annotation gets a generated `name` (UUID) if one is not provided.
     * The returned array preserves input order with `name` populated.
     *
     * `annotation:add` still fires once per annotation, in input order, so
     * existing single-event listeners just work.
     *
     * Geometry coordinate space matches {@link addPageAnnotation} — unrotated
     * MediaBox, origin top-left, PDF points, +y downward. See {@link Rect}.
     *
     * @param page - Page index (0-based)
     * @param annotations - Annotations to insert (may mix ephemeral and saved)
     * @returns The inserted annotations (each with `name` populated).
     */
    addPageAnnotations(page: number, annotations: Annotation[]): Promise<Annotation[]>;
    /**
     * Update an existing annotation, identified by its `name` (NM).
     *
     * Looks up the annotation on the given page by `name` and replaces it
     * with the supplied value. The replacement keeps the same `name` even
     * if a different one is passed in `annotation.name`.
     *
     * Geometry on the replacement must be in unrotated MediaBox coordinates
     * — see {@link Rect}.
     *
     * @param page - Page index (0-based)
     * @param name - The annotation's `name` (NM).
     * @param annotation - The replacement annotation.
     * @returns The updated annotation.
     * @throws If no annotation with the given `name` is found on the page.
     */
    updatePageAnnotation(page: number, name: string, annotation: Annotation): Promise<Annotation>;
    /**
     * Update multiple annotations on a page in a single batch.
     *
     * Equivalent to calling {@link updatePageAnnotation} once per item, but
     * applied as a single store update — one render and one dirty-flag flip
     * per page instead of N. Each entry's existing `name` is preserved even
     * if a different one is set on its `annotation`.
     *
     * `annotation:update` still fires once per entry, in input order.
     *
     * Validation is atomic: if any `name` cannot be found on the page, the
     * call throws *before* any annotation is updated.
     *
     * @param page - Page index (0-based)
     * @param updates - Pairs of `{ name, annotation }` to replace.
     * @returns The updated annotations, in input order.
     * @throws If any `name` is not found on the page.
     */
    updatePageAnnotations(page: number, updates: Array<{
        name: string;
        annotation: Annotation;
    }>): Promise<Annotation[]>;
    /**
     * Patch an existing annotation, identified by its `name` (NM).
     *
     * Unlike {@link updatePageAnnotation}, which replaces the entire
     * annotation, this only overwrites the fields present in `patch`.
     * Everything else (geometry, other style fields, contents, etc.) is
     * preserved. Use this when you want to tweak one or two properties —
     * for example, change a highlight's color — without round-tripping the
     * full annotation.
     *
     * Semantics:
     * - `type` and `name` in the patch are silently ignored.
     * - `metadata` is shallow-merged one level deep, so patching
     *   `{ metadata: { contents } }` keeps the existing `author`/`subject`.
     * - `undefined` values are skipped, not treated as "clear this field".
     *   Use `updatePageAnnotation` for full replacement when you need to
     *   clear fields by omission.
     *
     * @param page - Page index (0-based)
     * @param name - The annotation's `name` (NM).
     * @param patch - Fields to merge into the existing annotation.
     * @returns The patched annotation.
     * @throws If no annotation with the given `name` is found on the page.
     */
    patchPageAnnotation(page: number, name: string, patch: AnnotationPatch): Promise<Annotation>;
    /**
     * Patch multiple annotations on a page in a single batch.
     *
     * Equivalent to calling {@link patchPageAnnotation} once per item, but
     * applied as a single store update — one render and one dirty-flag flip
     * per page instead of N. Patches are resolved against the *current*
     * annotation state (not against each other in sequence); patching the
     * same `name` twice in one call applies both, with the second winning.
     *
     * `annotation:update` still fires once per entry, in input order.
     *
     * Validation is atomic: if any `name` cannot be found on the page, the
     * call throws *before* any annotation is patched.
     *
     * @param page - Page index (0-based)
     * @param patches - Pairs of `{ name, patch }` to apply.
     * @returns The patched annotations, in input order.
     * @throws If any `name` is not found on the page.
     */
    patchPageAnnotations(page: number, patches: Array<{
        name: string;
        patch: AnnotationPatch;
    }>): Promise<Annotation[]>;
    /**
     * Remove an annotation, identified by its `name` (NM).
     *
     * @param page - Page index (0-based)
     * @param name - The annotation's `name` (NM).
     * @throws If no annotation with the given `name` is found on the page.
     */
    removePageAnnotation(page: number, name: string): Promise<void>;
    /**
     * Ensure pageAnnotations is populated for a page so that mutator actions
     * have a baseline list to operate on. The reducer's ADD path tolerates a
     * missing page, but UPDATE/REMOVE need the existing annotations loaded
     * so we don't silently lose what the worker has.
     */
    private ensurePageAnnotationsLoaded;
    private findAnnotationIndex;
    /**
     * Synchronous variant of `findAnnotationIndex` for callers that have
     * already awaited `ensurePageAnnotationsLoaded` — used by the batch
     * mutators so all per-item lookups happen against a stable, loaded list.
     */
    private requireAnnotationIndex;
    /**
     * Get the layout structure for a specific page.
     * Returns frames, parcels, lines, runs, glyphs, tables, and grids
     * without building the full display list.
     * All coordinates are in points (1/72 inch).
     * @param page - Page index (0-based)
     */
    getLayoutPage(page: number): Promise<LayoutPage>;
    /**
     * Get the plain text of a page, matching exactly what the search engine sees.
     *
     * Text is extracted from the layout model: glyph runs are concatenated in
     * visual order, with spaces/tabs rendered as " ", paragraph ends and line
     * breaks as "\n", and inline drawings as U+FFFC (object replacement char).
     *
     * @param page - Page index (0-based)
     */
    getPageText(page: number): Promise<string>;
    /**
     * Get the current page number (1-based).
     */
    get currentPage(): number;
    /**
     * Navigate to a specific page.
     * @param page - Page number (1-based)
     */
    goToPage(page: number): void;
    /**
     * Navigate to a destination (page + position + zoom).
     * @param destination - Full destination object with page index and display mode
     * @param options - Optional navigation options
     * @param options.scrollAlignment - How to align the target in the viewport:
     *   "top" (default), "center", "bottom", or "nearest" (minimal scroll to fit in view)
     */
    goToDestination(destination: Destination, options?: {
        scrollAlignment?: ScrollAlignment;
    }): void;
    /**
     * Navigate to the next page.
     */
    nextPage(): void;
    /**
     * Navigate to the previous page.
     */
    previousPage(): void;
    /**
     * Current zoom level (1 = 100%).
     */
    get zoom(): number;
    /**
     * Current zoom mode.
     */
    get zoomMode(): ZoomMode;
    /**
     * Zoom in to the next zoom step.
     */
    zoomIn(): void;
    /**
     * Zoom out to the previous zoom step.
     */
    zoomOut(): void;
    /**
     * Set zoom to a specific level (1 = 100%). Switches to custom zoom mode.
     */
    setZoom(zoom: number): void;
    /**
     * Set zoom mode.
     */
    setZoomMode(mode: ZoomMode): void;
    /** Current scroll mode. */
    get scrollMode(): ScrollMode;
    /** Current layout mode. */
    get layoutMode(): LayoutMode;
    /** Current page rotation in degrees. */
    get pageRotation(): PageRotation;
    /** Current spacing mode. */
    get spacingMode(): SpacingMode;
    /** Whether the viewer is in fullscreen mode. */
    get isFullscreen(): boolean;
    /** Current view mode. */
    get viewMode(): ViewMode;
    /**
     * Set view mode (paged or continuous).
     */
    setViewMode(mode: ViewMode): void;
    /**
     * Get the current view mode.
     */
    getViewMode(): ViewMode;
    /**
     * Set scroll mode.
     */
    setScrollMode(mode: ScrollMode): void;
    /** Default scroll alignment for navigation (outline, links, goToDestination). */
    get navigationScrollAlignment(): ScrollAlignment;
    /** Default scroll alignment for search result navigation. */
    get searchScrollAlignment(): ScrollAlignment;
    /**
     * Set the default scroll alignment for navigation (outline, links, goToDestination).
     */
    setNavigationScrollAlignment(alignment: ScrollAlignment): void;
    /**
     * Set the default scroll alignment for search result navigation.
     */
    setSearchScrollAlignment(alignment: ScrollAlignment): void;
    /**
     * Set page layout mode.
     */
    setLayoutMode(mode: LayoutMode): void;
    /**
     * Set page rotation.
     */
    setPageRotation(rotation: PageRotation): void;
    /**
     * Set spacing mode.
     */
    setSpacingMode(mode: SpacingMode): void;
    /**
     * Enter or exit fullscreen mode.
     */
    setFullscreen(fullscreen: boolean): void;
    /**
     * Show or hide the top toolbar.
     */
    setToolbarVisible(visible: boolean): void;
    /**
     * Show or hide the floating toolbar (page navigation, zoom, view mode controls).
     */
    setFloatingToolbarVisible(visible: boolean): void;
    /**
     * Currently active tool, as a tagged union. The `kind` is one of `"pointer"`,
     * `"hand"`, `"zoom"`, `"annotate"`, `"markup"`; for `"annotate"` and `"markup"`
     * a `sub` field carries the active sub-tool (`"freehand"`, `"highlight"`, etc.).
     */
    get activeTool(): ActiveTool;
    /**
     * Switch the currently active tool. Tool-set kinds (`"annotate"`, `"markup"`)
     * require a `sub`, e.g. `{ kind: "annotate", sub: "freehand" }`. Calling
     * this with the same tool-set kind that's already active toggles back to
     * the pointer tool, matching the toolbar UI.
     */
    setActiveTool(tool: ActiveTool): void;
    /**
     * Enable or disable the fullscreen button.
     */
    setFullscreenEnabled(enabled: boolean): void;
    /**
     * Enable or disable the download button.
     */
    setDownloadEnabled(enabled: boolean): void;
    /**
     * Enable or disable the print button.
     */
    setPrintEnabled(enabled: boolean): void;
    /** Current theme mode. */
    get theme(): ThemeMode;
    /**
     * Set the viewer color theme.
     * @param theme - 'light', 'dark', or 'system'
     */
    setTheme(theme: ThemeMode): void;
    /**
     * Enable or disable the theme toggle button in the toolbar.
     */
    setThemeSwitchingEnabled(enabled: boolean): void;
    /**
     * Enable or disable text selection in the viewer.
     */
    setTextSelectionEnabled(enabled: boolean): void;
    /**
     * Set the minimum zoom level.
     */
    setMinZoom(zoom: number): void;
    /**
     * Set the maximum zoom level.
     */
    setMaxZoom(zoom: number): void;
    /**
     * Enable or disable the entire left panel area.
     * When disabled, the left panel is hidden and all left panel tabs are inaccessible.
     */
    setLeftPanelEnabled(enabled: boolean): void;
    /**
     * Enable or disable the entire right panel area.
     * When disabled, the right panel is hidden and all right panel tabs are inaccessible.
     */
    setRightPanelEnabled(enabled: boolean): void;
    /**
     * Enable or disable a specific panel tab.
     * Disabled panels are removed from the UI and cannot be opened.
     * If the panel is currently open and being disabled, it will be closed.
     */
    setPanelEnabled(panel: PanelTab, enabled: boolean): void;
    /**
     * Open a specific panel.
     * Has no effect if the panel is disabled via `setPanelEnabled()` or a `disable*` option.
     */
    openPanel(panel: PanelTab): void;
    /**
     * Close the currently open panel.
     */
    closePanel(): void;
    /**
     * Search for text in the document.
     * Returns a promise that resolves with the final search matches once all page text
     * has been loaded and the search completes. Highlight overlays are rendered automatically.
     *
     * Results are also available via the `search:change` event (fires for intermediate
     * results as pages load) and the `searchMatches` getter.
     *
     * @param query - The text to search for
     * @param options - Search options
     * @param options.caseSensitive - Whether to match case (overrides current default)
     * @param options.fuzzy - Enable fuzzy matching. When true, all whitespace, control
     *   characters, pipes (`|`), and zero-width characters are stripped from both the
     *   query and the document text before comparison. This allows AI-generated citations
     *   to match even when spacing or separators differ from the original document
     *   (e.g. `"cell A | cell B"` will match `"cell A\ncell B"`).
     * @param options.pageRange - Inclusive 0-based page range `[start, end]` to restrict
     *   search to. Both text loading and match collection are limited to this range.
     *   Omit to search the entire document. Each `search()` call is self-contained —
     *   the range is reset to "all pages" unless explicitly provided.
     * @returns Promise resolving with the search matches
     */
    search(query: string, options?: {
        caseSensitive?: boolean;
        fuzzy?: boolean;
        pageRange?: [number, number] | null;
    }): Promise<SearchMatch[]>;
    /**
     * Navigate to the next search match.
     * @param options - Optional overrides for this navigation
     * @param options.scrollAlignment - Override scroll alignment for this call only
     */
    searchNext(options?: {
        scrollAlignment?: ScrollAlignment;
    }): void;
    /**
     * Navigate to the previous search match.
     * @param options - Optional overrides for this navigation
     * @param options.scrollAlignment - Override scroll alignment for this call only
     */
    searchPrev(options?: {
        scrollAlignment?: ScrollAlignment;
    }): void;
    /**
     * Clear the current search query and results.
     */
    clearSearch(): void;
    /**
     * Get the current search matches.
     */
    get searchMatches(): SearchMatch[];
    /**
     * Get the index of the currently active search match (-1 if none).
     */
    get searchActiveIndex(): number;
    /**
     * Set the active search match by index. Navigates the viewport to the match.
     *
     * @param index - 0-based index into `searchMatches`
     * @param options - Optional overrides for this navigation
     * @param options.scrollAlignment - Override scroll alignment for this call only
     */
    setSearchActiveIndex(index: number, options?: {
        scrollAlignment?: ScrollAlignment;
    }): void;
    /**
     * Render a page to an image.
     *
     * @param page - Page index (0-based)
     * @param options - Render options (scale, format, etc.)
     */
    renderPage(page: number, options?: RenderOptions): Promise<RenderedPage>;
    /**
     * Render a thumbnail of a page.
     *
     * Similar to renderPage but uses lower priority in the render queue,
     * making it suitable for generating thumbnails without blocking main page renders.
     *
     * @param page - Page index (0-based)
     * @param options - Render options (scale, format, etc.)
     */
    renderThumbnail(page: number, options?: RenderOptions): Promise<RenderedPage>;
    /**
     * Render a rectangular sub-region of a page.
     *
     * The rect is expressed in **page points** (1 point = 1/72 inch), with the
     * origin at the top-left of the page — the same coordinate space as
     * `getPageInfo(page).width` / `.height`.
     *
     * Output pixel size is `rect.width * scale` × `rect.height * scale`.
     *
     * Internally this renders the full page at the requested scale (sharing the
     * render cache with `renderPage`) and crops the result, so the underlying
     * full-page render is bounded by the engine's max-render limits.
     *
     * @param page - Page index (0-based)
     * @param rect - Region to render, in page points (top-left origin)
     * @param options - Render options. `scale` controls resolution; `format`,
     *   `imageType`, `quality`, `force`, and `boost` behave as in `renderPage`.
     */
    renderRegion(page: number, rect: {
        x: number;
        y: number;
        width: number;
        height: number;
    }, options?: RenderOptions): Promise<RenderedPage>;
    /**
     * Internal method to render a page with a specific render type.
     */
    private renderWithType;
    /**
     * Convert an ImageBitmap to the requested output format.
     */
    private convertBitmapToFormat;
    /**
     * Export document as bytes.
     * If annotations have been edited, saves them into the PDF before returning.
     */
    toBytes(): Promise<Uint8Array>;
    /**
     * Download document to user's device.
     * @param filename - Filename for download (defaults to original source filename)
     */
    download(filename?: string): Promise<void>;
    /**
     * Print the document.
     * Shows the print dialog when called without options (from public API).
     * When called with options (from the dialog), renders selected pages and opens the browser print dialog.
     */
    print(options?: PrintDialogResult): Promise<void>;
    /**
     * Resolve a PrintPageRange into an array of 0-based page indices.
     * @internal
     */
    private resolvePageIndices;
    /**
     * Print PDF by loading original bytes into an iframe — vector quality, no rendering needed.
     * @internal
     */
    private printPdfNative;
    /** Map quality preset to DPI scale factor. */
    private static qualityToDpiScale;
    /**
     * Print by rendering selected pages to images.
     * @internal
     */
    private printRendered;
    /** Returns the MIME type for the current document format. */
    private getMimeType;
    /** Returns a default filename based on the source or format. */
    private getDefaultFilename;
    /**
     * Subscribe to an event.
     * @returns Unsubscribe function
     */
    on<K extends keyof ViewerEventMap>(event: K, handler: EventHandler<K>): () => void;
    /**
     * Unsubscribe from an event.
     */
    off<K extends keyof ViewerEventMap>(event: K, handler: EventHandler<K>): void;
    /**
     * Destroy the viewer and release resources.
     */
    destroy(): void;
    /**
     * Get the document ID (for internal use).
     * @internal
     */
    getDocumentId(): string | null;
    /**
     * Initialize the viewer with an already-loaded document ID.
     * Used by UDocClient.compose() to create viewers for composed documents.
     * @internal
     */
    initializeFromDocId(docId: string): Promise<void>;
    private resolveContainer;
    private resolveSourceWithFilename;
    private fetchWithProgress;
    private emit;
    private createEngineAdapter;
    private ensureNotDestroyed;
    private ensureLoaded;
    private ensureUiMode;
}
//# sourceMappingURL=UDocViewer.d.ts.map