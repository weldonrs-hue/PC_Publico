/**
 * Event helpers.
 *
 * Rules:
 * - Events represent intent; handlers should dispatch actions.
 * - Avoid direct state mutation in event handlers.
 *
 * Usage:
 * ```ts
 * const off = on(buttonEl, "click", () => store.dispatch({ type: "NEXT_PAGE" }));
 * emit(viewerEl, "udoc:page-change", { page: 2 });
 * off();
 * ```
 */
export declare function emit<T>(el: Element, name: string, detail?: T): void;
/** Add a DOM listener and return a cleanup function. */
export declare function on<K extends keyof HTMLElementEventMap>(el: Element, type: K, handler: (ev: HTMLElementEventMap[K]) => void): () => void;
//# sourceMappingURL=events.d.ts.map