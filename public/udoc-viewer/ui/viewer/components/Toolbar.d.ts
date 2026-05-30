import type { Store } from "../../framework/store";
import type { I18n } from "../i18n/index.js";
import type { ViewerState } from "../state";
import type { Action } from "../actions";
export declare function createToolbar(): {
    el: HTMLDivElement;
    mount: (container: HTMLElement, store: Store<ViewerState, Action>, i18n: I18n) => void;
    destroy: () => void;
    setOnDownload: (callback: (() => void) | null) => void;
    setOnPrint: (callback: (() => void) | null) => void;
};
//# sourceMappingURL=Toolbar.d.ts.map