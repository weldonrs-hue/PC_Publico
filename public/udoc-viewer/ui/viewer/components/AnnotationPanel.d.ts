/**
 * AnnotationPanel - Displays annotations grouped by page in the right panel.
 *
 * Features:
 * - Groups annotations by page
 * - Collapsible page sections
 * - Shows author, status, and content
 * - Collapsible reply threads
 * - Click to navigate to page
 */
import type { Store } from "../../framework/store";
import type { ViewerState } from "../state";
import type { Action } from "../actions";
import type { I18n } from "../i18n/index.js";
export declare function createAnnotationPanel(): {
    el: HTMLDivElement;
    mount: (container: HTMLElement, store: Store<ViewerState, Action>, i18n: I18n) => void;
    destroy: () => void;
};
//# sourceMappingURL=AnnotationPanel.d.ts.map