import type { Store } from "../../framework/store";
import type { ViewerState } from "../state";
import type { Action } from "../actions";
import type { I18n } from "../i18n/index.js";
export declare function createViewModeMenu(): {
    el: HTMLDivElement;
    mount: (store: Store<ViewerState, Action>, i18n: I18n) => void;
    destroy: () => void;
};
//# sourceMappingURL=ViewModeMenu.d.ts.map