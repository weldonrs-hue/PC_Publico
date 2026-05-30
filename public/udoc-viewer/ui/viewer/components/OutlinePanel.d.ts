import type { Store } from "../../framework/store";
import type { ViewerState } from "../state";
import type { Action } from "../actions";
import type { I18n } from "../i18n/index.js";
export declare function createOutlinePanel(): {
    el: HTMLDivElement;
    mount: (container: HTMLElement, store: Store<ViewerState, Action>, i18n: I18n) => void;
    destroy: () => void;
};
export type OutlinePanelComponent = ReturnType<typeof createOutlinePanel>;
//# sourceMappingURL=OutlinePanel.d.ts.map