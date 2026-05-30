import type { Store } from "../../framework/store";
import type { ViewerState } from "../state";
import type { Action } from "../actions";
import type { WorkerClient } from "../../../worker/index.js";
import type { I18n } from "../i18n/index.js";
export declare function createThumbnailPanel(): {
    el: HTMLDivElement;
    mount: (container: HTMLElement, store: Store<ViewerState, Action>, rm: WorkerClient, i18n: I18n) => void;
    destroy: () => void;
};
export type ThumbnailPanelComponent = ReturnType<typeof createThumbnailPanel>;
//# sourceMappingURL=ThumbnailPanel.d.ts.map