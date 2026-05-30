/**
 * Reusable color select component with a trigger button and floating panel.
 * Supports "stroke" variant (outlined rings) and "fill" variant (solid discs).
 */
export interface ColorSelectConfig {
    variant: "stroke" | "fill";
    label: string;
    noneLabel: string;
    onChange: (color: string | null) => void;
    /** Called when a color is selected (to close external panel state, etc.) */
    onSelect?: () => void;
}
export interface ColorSelectInstance {
    /** Trigger button — place in the subtoolbar */
    el: HTMLButtonElement;
    /** Floating panel — mount to subtoolbar-slot container */
    panel: HTMLElement;
    /** Update displayed color without firing onChange */
    update(color: string | null): void;
    open(anchorRect: DOMRect, containerRect: DOMRect): void;
    close(): void;
    isOpen(): boolean;
    destroy(): void;
}
export declare function createColorSelect(config: ColorSelectConfig): ColorSelectInstance;
//# sourceMappingURL=ColorSelect.d.ts.map