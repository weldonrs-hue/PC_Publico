import type { Store } from "../../framework/store";
import type { ViewerState } from "../state";
import type { Action } from "../actions";
export declare function createSheetTabBar(): {
    el: HTMLDivElement;
    mount: (parent: HTMLElement, store: Store<ViewerState, Action>) => void;
    destroy: () => void;
};
//# sourceMappingURL=SheetTabBar.d.ts.map