/**
 * DOM patch helpers.
 *
 * Rules:
 * - Use in render subscribers only.
 * - Avoid redundant writes for performance.
 *
 * Usage:
 * ```ts
 * setText(titleEl, state.title);
 * toggleClass(panelEl, "is-open", state.open);
 * ```
 */
export declare function setText(el: Element, text: string): void;
/** Set or remove attribute with change detection. */
export declare function setAttr(el: Element, name: string, value: string | null): void;
/** Toggle class with optional explicit boolean. */
export declare function toggleClass(el: Element, className: string, force?: boolean): void;
//# sourceMappingURL=dom.d.ts.map