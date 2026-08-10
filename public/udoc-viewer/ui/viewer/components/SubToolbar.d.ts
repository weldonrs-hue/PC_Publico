import type { Store } from "../../framework/store";
import type { I18n } from "../i18n/index.js";
import type { ViewerState } from "../state";
import type { Action } from "../actions";
import type { AnnotationUndoManager } from "../tools/AnnotationUndoManager";
export declare function createSubToolbar(): {
    el: HTMLDivElement;
    mount: (container: HTMLElement, store: Store<ViewerState, Action>, i18n: I18n, undoManager?: AnnotationUndoManager) => void;
    destroy: () => void;
};
//# sourceMappingURL=SubToolbar.d.ts.map