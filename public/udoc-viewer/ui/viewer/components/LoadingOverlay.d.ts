/**
 * Loading overlay component with progress bar for document download.
 */
import type { Store } from "../../framework/store";
import type { ViewerState } from "../state";
import type { Action } from "../actions";
import type { I18n } from "../i18n/index.js";
export declare function createLoadingOverlay(showAttribution?: boolean): {
    el: HTMLDivElement;
    mount: (container: HTMLElement, store: Store<ViewerState, Action>, i18n: I18n) => void;
    destroy: () => void;
};
//# sourceMappingURL=LoadingOverlay.d.ts.map