import type { Store } from "../../framework/store";
import { type ViewerState } from "../state";
import type { Action } from "../actions";
import { type Annotation } from "../annotation";
import type { WorkerClient } from "../../../worker/index.js";
import type { I18n } from "../i18n/index.js";
import { type CustomPageOverlayRenderer } from "./Spread";
export declare function createViewport(showAttribution?: boolean, customPageOverlay?: CustomPageOverlayRenderer): {
    el: HTMLDivElement;
    mount: (parent: HTMLElement, store: Store<ViewerState, Action>, wc: WorkerClient, i18n?: I18n, onViewportChange?: (payload: {
        firstVisiblePage: number;
        lastVisiblePage: number;
        zoom: number;
        scrollTop: number;
    }) => void, onAnnotationHover?: (payload: {
        pageIndex: number;
        annotation: Annotation;
        clientX: number;
        clientY: number;
    } | null) => void, onAnnotationClick?: (payload: {
        pageIndex: number;
        annotation: Annotation;
        clientX: number;
        clientY: number;
    }) => void) => void;
    destroy: () => void;
};
//# sourceMappingURL=Viewport.d.ts.map