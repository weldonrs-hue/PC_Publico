/**
 * SearchPanel - Full-featured text search panel in the right panel.
 *
 * Features:
 * - Search input with debounced query dispatch
 * - Case sensitivity toggle
 * - Match count and active index display
 * - Previous/Next match navigation
 * - Result list with context snippets, grouped by page
 * - Keyboard shortcuts (Enter = next, Shift+Enter = prev)
 */
import type { Store } from "../../framework/store";
import type { ViewerState } from "../state";
import type { Action } from "../actions";
import type { I18n } from "../i18n/index.js";
export declare function createSearchPanel(): {
    el: HTMLDivElement;
    mount: (container: HTMLElement, store: Store<ViewerState, Action>, i18nArg: I18n) => void;
    destroy: () => void;
};
//# sourceMappingURL=SearchPanel.d.ts.map