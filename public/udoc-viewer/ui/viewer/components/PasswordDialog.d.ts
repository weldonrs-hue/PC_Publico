/**
 * Password dialog component for encrypted PDF documents.
 */
import type { Store } from "../../framework/store";
import type { ViewerState } from "../state";
import type { Action } from "../actions";
import type { I18n } from "../i18n/index.js";
export interface PasswordDialogCallbacks {
    onSubmit: (password: string) => void;
}
export declare function createPasswordDialog(): {
    el: HTMLDivElement;
    mount: (container: HTMLElement, store: Store<ViewerState, Action>, i18n: I18n, cb: PasswordDialogCallbacks) => void;
    destroy: () => void;
};
//# sourceMappingURL=PasswordDialog.d.ts.map