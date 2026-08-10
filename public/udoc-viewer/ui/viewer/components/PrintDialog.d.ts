/**
 * Print dialog component for selecting page range and quality.
 */
import type { Store } from "../../framework/store";
import type { ViewerState } from "../state";
import type { Action } from "../actions";
import type { I18n } from "../i18n/index.js";
export type PrintPageRange = {
    kind: "all";
} | {
    kind: "current";
} | {
    kind: "fromTo";
    from: number;
    to: number;
} | {
    kind: "custom";
    pages: number[];
};
export type PrintQuality = "draft" | "standard" | "high";
export interface PrintDialogResult {
    pageRange: PrintPageRange;
    quality: PrintQuality;
}
export interface PrintDialogCallbacks {
    onPrint: (result: PrintDialogResult) => void;
    onCancel: () => void;
}
export declare function createPrintDialog(): {
    el: HTMLDivElement;
    mount: (container: HTMLElement, store: Store<ViewerState, Action>, i18n: I18n, cb: PrintDialogCallbacks) => void;
    destroy: () => void;
};
//# sourceMappingURL=PrintDialog.d.ts.map