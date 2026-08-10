/**
 * Reusable number input with dropdown panel containing a slider and text input.
 * Used for stroke width, opacity, font size, etc.
 */
export interface NumberInputConfig {
    min: number;
    max: number;
    step: number;
    value: number;
    /** Format number for display (e.g. v => `${v}pt`) */
    formatValue: (v: number) => string;
    /** Parse user text back to number, return null if invalid */
    parseValue: (s: string) => number | null;
    label: string;
    /** Optional SVG icon shown before the value */
    icon?: string;
    onChange: (value: number) => void;
}
export interface NumberInputInstance {
    /** Trigger button — place in the subtoolbar */
    el: HTMLElement;
    /** Floating panel — mount to subtoolbar-slot container */
    panel: HTMLElement;
    /** Update displayed value without firing onChange */
    update(value: number): void;
    isOpen(): boolean;
    open(anchorRect: DOMRect, containerRect: DOMRect): void;
    close(): void;
    destroy(): void;
}
export declare function createNumberInput(config: NumberInputConfig): NumberInputInstance;
//# sourceMappingURL=NumberInput.d.ts.map