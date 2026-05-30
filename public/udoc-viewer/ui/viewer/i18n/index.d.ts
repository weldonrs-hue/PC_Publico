export type { TranslationKeys } from "./types.js";
export { en } from "./en.js";
type Params = Record<string, string | number>;
/**
 * Lightweight i18n instance for the viewer.
 *
 * Created once per viewer via `createI18n()` and passed to all components.
 */
export interface I18n {
    /** Translate a key, optionally interpolating `{param}` placeholders. */
    t(key: string, params?: Params): string;
    /** Active locale identifier. */
    locale: string;
}
/**
 * Create an i18n instance.
 *
 * Resolves the locale to a built-in translation pack (en, zh-CN, ja, ko, es,
 * fr, de, pt-BR, ar, ru, zh-TW). Optional overrides are merged on top.
 *
 * When `locale` is omitted, the browser's preferred language is used automatically.
 *
 * @param locale - Locale identifier (e.g. "en", "zh-CN"). Defaults to browser language.
 * @param overrides - Partial translation overrides. Merged on top of the resolved locale.
 */
export declare function createI18n(locale?: string, overrides?: Record<string, string>): I18n;
//# sourceMappingURL=index.d.ts.map