/**
 * "Powered by docMentis" branding component.
 *
 * Hardened against host-page CSS injection that tries to suppress the mark:
 *
 *   - Visual content lives inside a closed shadow root, so external CSS
 *     (including `!important` rules) cannot select anything visible.
 *   - The light-DOM host wrapper carries a per-instance random class name,
 *     so attacker stylesheets cannot statically target it.
 *   - The literal docmentis.com URL is not rendered in any `href` attribute;
 *     a click handler decodes it from a base64 `data-h` attribute at runtime,
 *     defeating `a[href*="docmentis.com"]` selectors.
 *   - A MutationObserver re-inserts the host if it is removed from its parent.
 *   - For the persistent `viewport-corner` variant, a runtime visibility check
 *     (IntersectionObserver + ~2s setInterval inspection of getBoundingClientRect
 *     and getComputedStyle) trips a `udoc:branding-suppressed` CustomEvent and
 *     invokes the caller's onSuppressed hook so a watermark fallback can engage.
 *
 * Defense-in-depth, not silver bullets: a determined attacker with arbitrary
 * JS access to the page can still tamper. The shadow root blocks CSS attacks;
 * the visibility tripwire converts any successful suppression into a signal
 * that downstream code (e.g. a rasterized watermark) can react to.
 */
export type BrandingVariant = 
/** Persistent corner badge in the viewport. Tripwire-monitored. */
"viewport-corner"
/** Block shown under the loading-overlay progress bar. */
 | "loading-block"
/** Logo-only mark for the in-page "rendering" indicator (positioning and
 *  slot-state visibility are handled by the caller). */
 | "spread-indicator";
export interface BrandingOptions {
    variant: BrandingVariant;
    /** Invoked the first time suppression is detected. Only fires for variants
     * that run a visibility tripwire. */
    onSuppressed?: (detail: {
        reason: string;
    }) => void;
}
export interface BrandingHandle {
    /** Light-DOM host element to append where the branding should appear. */
    el: HTMLElement;
    /** Call after the host is in the document to start protection. */
    start(): void;
    /** Stop observers/intervals and remove the host. */
    destroy(): void;
}
export declare function createBranding(opts: BrandingOptions): BrandingHandle;
//# sourceMappingURL=Branding.d.ts.map