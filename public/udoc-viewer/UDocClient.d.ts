/**
 * UDocClient - SDK entry point for document viewing.
 *
 * Manages the WASM engine and provides document operations.
 */
import { WorkerClient } from "./worker/index.js";
import type { RenderCacheStats } from "./worker/index.js";
import type { Composition, ComposePick, ExtractedFont, ExtractedImage, FontEntry, FontInfo, SplitByOutlineResult } from "./worker/index.js";
import { UDocViewer } from "./UDocViewer.js";
import type { ScrollMode, LayoutMode, ZoomMode, PanelTab, ThemeMode, SpacingMode, PageRotation } from "./ui/viewer/state.js";
import type { ScrollAlignment } from "./ui/viewer/navigation.js";
import type { PerformanceLogCallback } from "./performance/index.js";
import type { CustomPageOverlayRenderer } from "./ui/viewer/components/Spread.js";
export type { CustomPageOverlayRenderer } from "./ui/viewer/components/Spread.js";
/**
 * License information for the client.
 */
export interface LicenseInfo {
    /**
     * Whether the license is valid.
     */
    valid: boolean;
    /**
     * License tier: "free" (no license) or "licensed" (valid license).
     */
    tier: "free" | "licensed";
    /**
     * Enabled feature flags.
     */
    features: string[];
    /**
     * Numeric limits (e.g., max_file_size_mb).
     */
    limits: Record<string, number>;
    /**
     * Organization name from the license.
     */
    organization?: string;
    /**
     * When the license expires (if applicable).
     */
    expiresAt?: Date;
    /**
     * Error message if license validation failed.
     */
    error?: string;
}
/**
 * Options for creating a UDocClient.
 */
export interface ClientOptions {
    /**
     * License key for commercial use.
     * Client runs in trial mode if not provided.
     */
    license?: string;
    /**
     * Base URL for loading worker and WASM files.
     *
     * By default, files are loaded relative to the package location.
     *
     * Expected files at baseUrl:
     * - `{baseUrl}/worker.js`
     * - `{baseUrl}/udoc_bg.wasm`
     */
    baseUrl?: string;
    /**
     * Locale for UI strings and date formatting.
     * @default 'en'
     */
    locale?: string;
    /**
     * Enable GPU-accelerated rendering via WebGPU.
     * Falls back to CPU if the browser doesn't support WebGPU.
     * @default false
     */
    __experimentalGpu?: boolean;
    /**
     * Enable Google Fonts for automatic font fetching.
     * When true, fonts not embedded in the document are fetched from Google Fonts
     * on-demand during rendering. Google Fonts are resolved after any URL fonts
     * registered via `fonts`.
     * @default true
     */
    googleFonts?: boolean;
    /**
     * Register font URLs for on-demand fetching during layout.
     * Call before loading documents. Registered fonts take priority over Google Fonts.
     *
     * @example
     * ```ts
     * const client = await UDocClient.create({
     *   fonts: [
     *     { typeface: "Roboto", bold: false, italic: false, url: "https://cdn.example.com/Roboto-Regular.woff2" },
     *     { typeface: "Roboto", bold: true, italic: false, url: "https://cdn.example.com/Roboto-Bold.woff2" },
     *   ],
     * });
     * ```
     */
    fonts?: FontEntry[];
    /**
     * Disable anonymous telemetry reporting.
     * Requires a valid license with the "no_telemetry" feature.
     * Ignored without a qualifying license.
     * @default false
     */
    disableTelemetry?: boolean;
    /**
     * Disable checking npm registry for a newer version on startup.
     * When enabled (default), a background check logs a console reminder
     * if a newer version is available. Never blocks initialization.
     * @default false
     */
    disableUpdateCheck?: boolean;
}
/**
 * Options for creating a viewer.
 */
export interface ViewerOptions {
    /**
     * Container element or CSS selector.
     * If not provided, viewer runs in headless mode (no UI).
     */
    container?: string | HTMLElement;
    /**
     * Scroll mode for page navigation.
     * @default ScrollMode.Continuous
     */
    scrollMode?: ScrollMode;
    /**
     * Page layout mode.
     * @default LayoutMode.SinglePage
     */
    layoutMode?: LayoutMode;
    /**
     * Zoom mode for automatic scaling.
     * @default ZoomMode.FitSpreadWidth
     */
    zoomMode?: ZoomMode;
    /**
     * Initial zoom level (when zoomMode is Custom).
     * @default 1
     */
    zoom?: number;
    /**
     * Custom zoom steps for zoom in/out.
     * @default DEFAULT_ZOOM_STEPS
     */
    zoomSteps?: readonly number[];
    /**
     * Spacing between pages in pixels.
     * @default 10
     */
    pageSpacing?: number;
    /**
     * Spacing between spreads in pixels.
     * @default 20
     */
    spreadSpacing?: number;
    /**
     * Default scroll alignment when navigating to a destination (outline, links, goToDestination).
     * @default "top"
     */
    navigationScrollAlignment?: ScrollAlignment;
    /**
     * Default scroll alignment when navigating to search results.
     * @default "nearest"
     */
    searchScrollAlignment?: ScrollAlignment;
    /**
     * Width of thumbnail images in the thumbnail panel, in CSS pixels.
     * Height is derived automatically from the page aspect ratio.
     * @default 150
     */
    thumbnailWidth?: number;
    /**
     * Initially active panel, or null for no panel.
     * @default null
     */
    activePanel?: PanelTab | null;
    /**
     * Target display DPI for rendering.
     * PDF points are 72 DPI; this setting determines the CSS pixel ratio.
     * Most displays use 96 DPI (CSS standard).
     * @default 96
     */
    dpi?: number;
    /**
     * Enable performance tracking for debugging and analytics.
     * When enabled, records timing for all major operations.
     * @default false
     */
    enablePerformanceCounter?: boolean;
    /**
     * Callback for performance log entries.
     * Called for each operation start/end when enablePerformanceCounter is true.
     */
    onPerformanceLog?: PerformanceLogCallback;
    /**
     * Hide the "Powered by docMentis" attribution link.
     * Requires a valid license with the "no_attribution" feature.
     * Ignored without a qualifying license.
     * @default false
     */
    hideAttribution?: boolean;
    /**
     * Hide the loading overlay shown during document download and processing.
     * Requires a valid license with the "no_attribution" feature.
     * Ignored without a qualifying license.
     * @default false
     */
    hideLoadingOverlay?: boolean;
    /**
     * Hide the top toolbar.
     * @default false
     */
    hideToolbar?: boolean;
    /**
     * Hide the floating toolbar (page navigation, zoom, view mode controls).
     * When hidden and the top toolbar is visible, the controls are moved into the top toolbar.
     * @default false
     */
    hideFloatingToolbar?: boolean;
    /**
     * Disable the fullscreen button.
     * @default false
     */
    disableFullscreen?: boolean;
    /**
     * Disable the entire left panel area (thumbnails, outline, bookmarks, layers, attachments).
     * @default false
     */
    disableLeftPanel?: boolean;
    /**
     * Disable the entire right panel area (search, comments).
     * @default false
     */
    disableRightPanel?: boolean;
    /**
     * Disable the thumbnail panel tab.
     * Disabled panels are removed from the UI and cannot be opened.
     * @default false
     */
    disableThumbnails?: boolean;
    /**
     * Disable the outline (table of contents) panel tab.
     * @default false
     */
    disableOutline?: boolean;
    /**
     * Disable the bookmarks panel tab.
     * @default false
     */
    disableBookmarks?: boolean;
    /**
     * Disable the layers panel tab.
     * @default false
     */
    disableLayers?: boolean;
    /**
     * Disable the attachments panel tab.
     * @default false
     */
    disableAttachments?: boolean;
    /**
     * Disable the fonts panel tab.
     * @default false
     */
    disableFonts?: boolean;
    /**
     * Disable the search panel tab.
     * @default false
     */
    disableSearch?: boolean;
    /**
     * Disable the comments panel tab.
     * @default false
     */
    disableComments?: boolean;
    /**
     * Color theme for the viewer UI.
     * - 'light': Light theme (default)
     * - 'dark': Dark theme
     * - 'system': Follow operating system preference
     * @default 'light'
     */
    theme?: ThemeMode;
    /**
     * Disable the theme toggle button in the toolbar.
     * The theme can still be changed programmatically via setTheme().
     * @default false
     */
    disableThemeSwitching?: boolean;
    /**
     * Disable text selection in the viewer.
     * When true, users cannot select or copy text from rendered documents.
     * @default false
     */
    disableTextSelection?: boolean;
    /**
     * Disable the download button in the toolbar.
     * The download() method can still be called programmatically.
     * @default false
     */
    disableDownload?: boolean;
    /**
     * Disable the print button in the toolbar.
     * The print() method can still be called programmatically.
     * @default false
     */
    disablePrint?: boolean;
    /**
     * Initial page rotation in degrees.
     * @default 0
     */
    pageRotation?: PageRotation;
    /**
     * Initial spacing mode between pages and spreads.
     * @default 'all'
     */
    spacingMode?: SpacingMode;
    /**
     * Minimum zoom level.
     * @default 0.1
     */
    minZoom?: number;
    /**
     * Maximum zoom level.
     * @default 5
     */
    maxZoom?: number;
    /**
     * Disable the view tools (pointer, hand, zoom) in the toolbar.
     * @default false
     */
    disableViewTools?: boolean;
    /**
     * Disable the annotation tool set (freehand, line, arrow, shapes, text box).
     * @default false
     */
    disableAnnotateTools?: boolean;
    /**
     * Disable the markup tool set (highlight, underline, strikethrough, squiggly).
     * @default true
     */
    __experimentalDisableMarkupTools?: boolean;
    /**
     * Enable slide transition animations for PPTX documents.
     * When true, transitions defined in the presentation will play
     * when navigating between slides in spread (single-page) mode.
     * @default false
     */
    enableTransitions?: boolean;
    /**
     * Locale for UI strings.
     *
     * Built-in locales: `en`, `zh-CN`, `zh-TW`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ar`, `ru`.
     * Falls back to English for unrecognized locales.
     * @default browser language (navigator.language)
     */
    locale?: string;
    /**
     * Override individual translation strings on top of the resolved locale.
     * Keys are dot-separated (e.g. "toolbar.search", "print.title").
     * See `TranslationKeys` for the full list.
     */
    translations?: Record<string, string>;
    /**
     * Render a Custom Page Overlay above every built-in page layer (canvas,
     * text, annotations, search highlights).
     *
     * Invoked once per page slot when the slot mounts. The callback receives
     * the 0-based page index, an overlay container element sized and rotated
     * to match the page, and the current points-to-CSS-pixels scale. Append
     * any DOM (buttons, floating toolbars, badges, …) to the container and
     * optionally return a cleanup function — it runs when the slot is
     * destroyed (e.g. when the page scrolls out of view in continuous mode).
     *
     * The container is `pointer-events: none` by default so it never blocks
     * text selection or annotation interaction underneath. Set
     * `pointer-events: auto` on individual children that need to receive
     * input.
     *
     * @example
     * ```ts
     * customPageOverlay: (pageIndex, container) => {
     *   const btn = document.createElement("button");
     *   btn.textContent = "Comment";
     *   btn.style.cssText = "position:absolute;top:8px;right:-40px;pointer-events:auto;";
     *   btn.onclick = () => console.log("comment on page", pageIndex);
     *   container.appendChild(btn);
     *   return () => btn.remove();
     * }
     * ```
     */
    customPageOverlay?: CustomPageOverlayRenderer;
}
/**
 * A document source can be:
 * - URL string
 * - File object
 * - Raw bytes
 * - An existing viewer (uses its loaded document)
 */
export type DocumentSource = string | File | Uint8Array | UDocViewer;
/**
 * A pick specifies which pages to take from which document.
 */
export interface Pick {
    /**
     * Document source (viewer, URL, File, or bytes).
     */
    doc: DocumentSource;
    /**
     * Page range to pick. Can be:
     * - A string like "0-2,4" (0-based page indices)
     * - A single page index
     * - An array of page indices
     */
    pages: string | number | number[];
    /**
     * Optional rotation to apply to the picked pages.
     * Value in degrees: 0, 90, 180, or 270.
     */
    rotation?: 0 | 90 | 180 | 270;
}
/**
 * Re-export low-level types for advanced usage.
 */
export type { Composition, ComposePick, ExtractedFont, ExtractedImage, FontEntry, FontInfo, SplitByOutlineResult };
/**
 * SDK entry point for document viewing.
 *
 * Manages the WASM engine, creates viewers, and provides document operations.
 */
export declare class UDocClient {
    /**
     * SDK version string (replaced at build time).
     */
    static readonly version: string;
    private workerClient;
    private options;
    private viewers;
    private destroyed;
    private licenseInfo;
    private constructor();
    /**
     * Create and initialize a client instance.
     * Loads the WASM engine.
     */
    static create(options?: ClientOptions): Promise<UDocClient>;
    /**
     * Get current license information.
     */
    get license(): LicenseInfo;
    /**
     * Check if a feature is available with the current license.
     * @param feature - Feature name (e.g., "merge")
     */
    hasFeature(feature: string): boolean;
    /**
     * Register custom font URLs for on-demand fetching during layout.
     *
     * Fonts are fetched when the engine needs them during rendering.
     * Registered fonts take priority over Google Fonts.
     * Call before loading documents. Supports OTF, TTF, WOFF, and WOFF2 formats.
     *
     * @param fonts - Array of font entries with typeface, style, and URL
     *
     * @example
     * ```ts
     * await client.registerFonts([
     *   { typeface: "Roboto", bold: false, italic: false, url: "https://cdn.example.com/Roboto-Regular.woff2" },
     *   { typeface: "Roboto", bold: true, italic: false, url: "https://cdn.example.com/Roboto-Bold.woff2" },
     * ]);
     * ```
     */
    registerFonts(fonts: FontEntry[]): Promise<void>;
    /**
     * Enable Google Fonts for automatic font fetching.
     *
     * When enabled, fonts not embedded in the document are fetched from
     * Google Fonts on-demand during rendering. Google Fonts are resolved
     * after any fonts registered via `registerFonts`.
     *
     * Call before loading documents. Enabled by default unless
     * `googleFonts: false` is passed to `create()`.
     */
    enableGoogleFonts(): Promise<void>;
    /**
     * Create a viewer instance.
     *
     * - With container: Full UI mode
     * - Without container: Headless mode (same API, no UI)
     */
    createViewer(options?: ViewerOptions): Promise<UDocViewer>;
    /**
     * Compose new documents by cherry-picking pages from source documents.
     *
     * This is a powerful method that allows creating new documents by selecting
     * specific pages from multiple source documents in any order. Pages can
     * optionally be rotated during composition.
     *
     * @param compositions - Array of compositions. Each composition creates one output document.
     *   Each composition is an array of picks specifying which pages from which documents.
     * @returns Array of viewers containing the composed documents
     *
     * @example
     * ```ts
     * // Create a document with pages 1-3 from viewer A and page 5 from viewer B
     * const [newDoc] = await client.compose([
     *   [
     *     { doc: viewerA, pages: "1-3" },
     *     { doc: viewerB, pages: "5" }
     *   ]
     * ]);
     *
     * // Create multiple documents at once
     * const [doc1, doc2] = await client.compose([
     *   [{ doc: viewerA, pages: "1" }],           // doc1: page 1 from A
     *   [{ doc: viewerA, pages: "2" }, { doc: viewerB, pages: "1" }]  // doc2: page 2 from A + page 1 from B
     * ]);
     *
     * // Rotate pages during composition
     * const [rotated] = await client.compose([
     *   [
     *     { doc: viewerA, pages: "1", rotation: 90 },   // rotate page 1 by 90 degrees
     *     { doc: viewerA, pages: "2", rotation: 180 }   // rotate page 2 by 180 degrees
     *   ]
     * ]);
     * ```
     */
    compose(compositions: Pick[][]): Promise<UDocViewer[]>;
    /**
     * Split a document by its outline (bookmarks) structure.
     *
     * Creates multiple documents, one for each outline section at the specified level.
     * The original document remains unchanged.
     *
     * @param source - Document source (viewer, URL, File, or bytes)
     * @param options - Split options
     * @param options.maxLevel - Maximum outline level to consider (1 = top level only, default: 1)
     * @param options.splitMidPage - When true, filters page content when sections share a page (default: false)
     * @returns Object with viewers array and sections metadata
     *
     * @example
     * ```ts
     * // Split a document by top-level bookmarks
     * const result = await client.splitByOutline(viewer);
     * console.log(`Split into ${result.viewers.length} documents`);
     * result.sections.forEach((section, i) => {
     *   console.log(`Document ${i}: ${section.title}`);
     * });
     *
     * // Split with mid-page content filtering
     * const result = await client.splitByOutline(viewer, { maxLevel: 2, splitMidPage: true });
     * ```
     */
    splitByOutline(source: DocumentSource, options?: {
        maxLevel?: number;
        splitMidPage?: boolean;
    }): Promise<{
        viewers: UDocViewer[];
        sections: {
            title: string;
            index: number;
        }[];
    }>;
    /**
     * Extract all embedded images from a document.
     *
     * @param source - Document source (viewer, URL, File, or bytes)
     * @param options - Extract options
     * @param options.convertRawToPng - When true, converts raw pixel data to PNG format (default: false)
     * @returns Array of extracted images with metadata and data
     *
     * @example
     * ```ts
     * const images = await client.extractImages(viewer);
     * for (const image of images) {
     *   console.log(`${image.name}: ${image.format} (${image.width}x${image.height})`);
     *   // image.data contains the raw image bytes
     * }
     *
     * // Convert raw images to PNG for easier viewing
     * const pngImages = await client.extractImages(viewer, { convertRawToPng: true });
     * ```
     */
    extractImages(source: DocumentSource, options?: {
        convertRawToPng?: boolean;
    }): Promise<ExtractedImage[]>;
    /**
     * Extract all embedded fonts from a document.
     *
     * @param source - Document source (viewer, URL, File, or bytes)
     * @returns Array of extracted fonts with metadata and data
     *
     * @example
     * ```ts
     * const fonts = await client.extractFonts(viewer);
     * for (const font of fonts) {
     *   console.log(`${font.name}: ${font.fontType} (.${font.extension})`);
     *   // font.data contains the raw font bytes
     * }
     * ```
     */
    extractFonts(source: DocumentSource): Promise<ExtractedFont[]>;
    /**
     * Parse font information from raw font binary data.
     *
     * Extracts the typeface name, bold, and italic properties from a font file.
     * Useful for building a font registry before calling {@link registerFonts}.
     *
     * @param data - Raw font binary data (e.g., .ttf, .otf, .woff2)
     * @returns Font information including typeface, bold, and italic
     *
     * @example
     * ```ts
     * const fontBytes = new Uint8Array(await fetch("Roboto-Bold.woff2").then(r => r.arrayBuffer()));
     * const info = await client.parseFontInfo(fontBytes);
     * // info = { typeface: "Roboto", bold: true, italic: false }
     *
     * // Use the info to register fonts:
     * await client.registerFonts([
     *     { typeface: info.typeface, bold: info.bold, italic: info.italic, url: "https://..." },
     * ]);
     * ```
     */
    parseFontInfo(data: Uint8Array): Promise<FontInfo>;
    /**
     * Compress a document.
     *
     * Saves the document with full compression options enabled:
     * - Compress stream data using FlateDecode
     * - Pack objects into compressed object streams (PDF 1.5+)
     * - Use compressed xref streams (PDF 1.5+)
     * - Remove unreferenced objects
     *
     * @param source - Document source (viewer, URL, File, or bytes)
     * @returns Compressed PDF data as Uint8Array
     *
     * @example
     * ```ts
     * const compressedBytes = await client.compress(viewer);
     * // Save to file or download
     * const blob = new Blob([compressedBytes], { type: 'application/pdf' });
     * ```
     */
    compress(source: DocumentSource): Promise<Uint8Array>;
    /**
     * Decompress a document.
     *
     * Removes all filter encodings from streams, resulting in raw,
     * uncompressed stream data. Useful for debugging or inspection.
     *
     * @param source - Document source (viewer, URL, File, or bytes)
     * @returns Decompressed PDF data as Uint8Array
     *
     * @example
     * ```ts
     * const decompressedBytes = await client.decompress(viewer);
     * // Save to file for inspection
     * const blob = new Blob([decompressedBytes], { type: 'application/pdf' });
     * ```
     */
    decompress(source: DocumentSource): Promise<Uint8Array>;
    /**
     * Load a document source and return its ID.
     * Note: This is only used for PDF operations (compose, split, etc.)
     */
    private loadSource;
    /**
     * Normalize page specification to a string format.
     */
    private normalizePages;
    /**
     * Destroy the client and release all resources.
     * All viewers created by this client become invalid.
     */
    destroy(): void;
    /**
     * Get the underlying worker client (for internal use).
     * @internal
     */
    getWorkerClient(): WorkerClient;
    /**
     * Snapshot of rendered bitmap caches. Use for debug overlays / memory
     * pressure monitoring on mobile.
     */
    getRenderCacheStats(): RenderCacheStats;
    /**
     * Current WASM linear-memory size in bytes for the worker's engine.
     * Rises when the Rust allocator grows; never shrinks.
     */
    getWasmMemoryBytes(): Promise<number>;
    /**
     * Subscribe to render OOM events. Fires after the client has cleared its
     * bitmap caches to reclaim memory.
     */
    onOOM(callback: (error: Error) => void): () => void;
    private ensureNotDestroyed;
}
//# sourceMappingURL=UDocClient.d.ts.map