import type { I18n } from "../i18n/index.js";
export declare function createAttachmentsPanel(): {
    el: HTMLDivElement;
    mount: (container: HTMLElement, i18n: I18n) => void;
    destroy: () => void;
};
export type AttachmentsPanelComponent = ReturnType<typeof createAttachmentsPanel>;
//# sourceMappingURL=AttachmentsPanel.d.ts.map