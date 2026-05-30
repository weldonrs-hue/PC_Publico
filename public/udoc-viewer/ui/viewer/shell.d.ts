import type { Store } from "../framework/store";
import type { ViewerState, PageInfo, VisibilityGroup } from "./state";
import type { Action } from "./actions";
import type { OutlineItem } from "./navigation";
import type { Annotation } from "./annotation";
import type { LayoutPage } from "../../worker/index.js";
import type { WorkerClient } from "../../worker/index.js";
import type { CustomPageOverlayRenderer } from "./components/Spread";
import type { PrintDialogResult } from "./components/PrintDialog";
export interface EngineAdapter {
    getPageInfo(doc: {
        id: string;
    }, page: number): Promise<PageInfo>;
    getOutline(doc: {
        id: string;
    }): Promise<OutlineItem[]>;
    getPageAnnotations(doc: {
        id: string;
    }, pageIndex: number): Promise<Annotation[]>;
    getLayoutPage(doc: {
        id: string;
    }, pageIndex: number): Promise<LayoutPage>;
    getVisibilityGroups(doc: {
        id: string;
    }): Promise<VisibilityGroup[]>;
    setVisibilityGroupVisible(doc: {
        id: string;
    }, groupId: string, visible: boolean): Promise<boolean>;
}
export interface ViewportChangePayload {
    firstVisiblePage: number;
    lastVisiblePage: number;
    zoom: number;
    scrollTop: number;
}
export type AnnotationHoverPayload = {
    pageIndex: number;
    annotation: Annotation;
    clientX: number;
    clientY: number;
} | null;
export type AnnotationClickPayload = {
    pageIndex: number;
    annotation: Annotation;
    clientX: number;
    clientY: number;
};
export interface ViewerShellCallbacks {
    onPasswordSubmit?: (password: string) => void;
    onDownload?: () => void;
    onPrint?: (options: PrintDialogResult) => void;
    onViewportChange?: (payload: ViewportChangePayload) => void;
    onAnnotationHover?: (payload: AnnotationHoverPayload) => void;
    onAnnotationClick?: (payload: AnnotationClickPayload) => void;
}
export interface ViewerShell {
    store: Store<ViewerState, Action>;
    dispatch: (action: Action) => void;
    getState: () => ViewerState;
    setCallbacks: (callbacks: ViewerShellCallbacks) => void;
    destroy: () => void;
}
export type InitialStateOverrides = Partial<Omit<ViewerState, "doc" | "page" | "pageCount">>;
export declare function mountViewerShell(root: HTMLElement, engine: EngineAdapter, workerClient: WorkerClient, overrides?: InitialStateOverrides, showAttribution?: boolean, showLoadingOverlay?: boolean, locale?: string, translations?: Record<string, string>, customPageOverlay?: CustomPageOverlayRenderer): ViewerShell;
//# sourceMappingURL=shell.d.ts.map