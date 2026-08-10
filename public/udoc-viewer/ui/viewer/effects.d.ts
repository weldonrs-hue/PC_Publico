import type { Store } from "../framework/store";
import type { ViewerState } from "./state";
import type { Action } from "./actions";
import type { EngineAdapter } from "./shell";
export declare function createEffects(store: Store<ViewerState, Action>, engine: EngineAdapter): {
    destroy: () => void;
};
//# sourceMappingURL=effects.d.ts.map