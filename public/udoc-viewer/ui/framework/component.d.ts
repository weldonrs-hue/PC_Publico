/**
 * Optional base class for complex stateful components.
 *
 * Rules:
 * - Root element is stable after mount.
 * - render() patches DOM inside the root only.
 * - destroy() must remove listeners and subscriptions.
 *
 * Usage:
 * ```ts
 * class Toolbar extends Component<{ store: Store<ViewerState, Action> }, State> {
 *     constructor(props: { store: Store<ViewerState, Action> }) {
 *         super(props, { page: 1 }, document.createElement("div"));
 *         this.el.className = "udoc-toolbar";
 *     }
 *     render(): void {
 *         this.el.textContent = String(this.state.page);
 *     }
 *     protected onMount(): void {
 *         this.props.store.dispatch({ type: "SET_PAGE", page: 1 });
 *     }
 * }
 * ```
 *
 * Alternative (preferred) factory pattern:
 * ```ts
 * export function createToolbar() {
 *     const el = document.createElement("div");
 *     el.className = "udoc-toolbar";
 *
 *     let unsubRender: (() => void) | null = null;
 *     function mount(container: HTMLElement, store: Store<ViewerState, Action>): void {
 *         container.appendChild(el);
 *         unsubRender = store.subscribeRender((_prev, next) => {
 *             el.textContent = String(next.page);
 *         });
 *     }
 *
 *     function destroy(): void {
 *         if (unsubRender) unsubRender();
 *         el.remove();
 *     }
 *
 *     return { el, mount, destroy };
 * }
 * ```
 */
export declare abstract class Component<P = {}, S = {}> {
    protected props: P;
    protected state: S;
    protected el: HTMLElement;
    private cleanups;
    constructor(props: P, initialState: S, root: HTMLElement);
    /** Patch DOM inside the stable root element. */
    abstract render(): void;
    /** Mount into a container and run initial render. */
    mount(container: HTMLElement): void;
    /** Clean up listeners/subscriptions and remove root. */
    destroy(): void;
    protected onMount(): void;
    protected onUnmount(): void;
    protected onUpdate(_prevProps: P, _prevState: S): void;
    /** Local state update; triggers render. */
    protected setState(partial: Partial<S>): void;
    /** Register a cleanup for destroy(). */
    protected track(cleanup: () => void): void;
}
//# sourceMappingURL=component.d.ts.map