import type { I18n } from "../i18n/index.js";
export declare function createBookmarksPanel(): {
    el: HTMLDivElement;
    mount: (container: HTMLElement, i18n: I18n) => void;
    destroy: () => void;
};
export type BookmarksPanelComponent = ReturnType<typeof createBookmarksPanel>;
//# sourceMappingURL=BookmarksPanel.d.ts.map