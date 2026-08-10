/**
 * Framework store: central event loop for state + subscriptions.
 *
 * Rules:
 * - Reducers must be pure and synchronous.
 * - Render subscribers update DOM only (no effects).
 * - Effect subscribers may do async work and may dispatch.
 * - Store does not know about viewer-specific state.
 *
 * Usage:
 * ```ts
 * const store = createStore(reducer, initialState, { batched: true });
 * const off = store.subscribeRender((_prev, next) => render(next));
 * store.dispatch({ type: "SET_PAGE", page: 2 });
 * off();
 * ```
 */
export type Reducer<S, A> = (state: S, action: A) => S;
export type Subscriber<S> = (prev: S, next: S) => void;
export type ActionListener<S, A> = (action: A, prev: S, next: S) => void;
export interface Store<S, A> {
    /** Current state snapshot. */
    getState(): S;
    /** Dispatch an action to transition state via the reducer. */
    dispatch(action: A): void;
    /** Render-phase subscription (DOM only). */
    subscribeRender(fn: Subscriber<S>): () => void;
    /** Effect-phase subscription (async allowed). */
    subscribeEffect(fn: Subscriber<S>): () => void;
    /**
     * Action-phase subscription: invoked synchronously after each dispatch
     * that actually changed state, with the action plus prev/next snapshots.
     * Use for emitting external events keyed to specific action types.
     */
    subscribeAction(fn: ActionListener<S, A>): () => void;
}
/**
 * Create a store with optional microtask batching for subscriber notifications.
 * Batching groups multiple dispatches into a single notify cycle.
 */
export declare function createStore<S, A>(reducer: Reducer<S, A>, initialState: S, options?: {
    batched?: boolean;
}): Store<S, A>;
//# sourceMappingURL=store.d.ts.map