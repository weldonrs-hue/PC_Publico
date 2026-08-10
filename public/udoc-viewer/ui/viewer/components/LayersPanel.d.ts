import type { Store } from "../../framework/store";
import type { ViewerState } from "../state";
import type { Action } from "../actions";
import type { WorkerClient } from "../../../worker/index.js";
import type { I18n } from "../i18n/index.js";
export declare function createLayersPanel(): {
    el: HTMLDivElement;
    mount: (container: HTMLElement, store: Store<ViewerState, Action>, workerClient: WorkerClient, i18n: I18n) => void;
    destroy: () => void;
};
export type LayersPanelComponent = ReturnType<typeof createLayersPanel>;
//# sourceMappingURL=LayersPanel.d.ts.map