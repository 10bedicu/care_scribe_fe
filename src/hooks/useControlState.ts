import {
  Dispatch,
  SetStateAction,
  useCallback,
  useSyncExternalStore,
} from "react";

interface ControlStore<T = unknown> {
  value: T;
  listeners: Set<() => void>;
}

type StoreRegistry = Map<string, ControlStore>;

declare global {
  interface Window {
    __CARE_CONTROL_STORES__: StoreRegistry;
  }
}

function getRegistry(): StoreRegistry {
  if (!window.__CARE_CONTROL_STORES__) {
    window.__CARE_CONTROL_STORES__ = new Map();
  }
  return window.__CARE_CONTROL_STORES__;
}

function getOrCreateStore<T>(key: string, initialValue: T): ControlStore<T> {
  const registry = getRegistry();
  if (!registry.has(key)) {
    registry.set(key, { value: initialValue, listeners: new Set() });
  }
  return registry.get(key) as ControlStore<T>;
}

/**
 * A shared state hook that reads/writes state from a global registry
 * shared with the host app (care_fe) via `window.__CARE_CONTROL_STORES__`.
 *
 * @param key - A unique key identifying this piece of shared state.
 * @param initialValue - The initial value (used only if the store doesn't exist yet).
 */
export function useControlState<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const store = getOrCreateStore(key, initialValue);

  const subscribe = useCallback(
    (listener: () => void) => {
      store.listeners.add(listener);
      return () => {
        store.listeners.delete(listener);
      };
    },
    [store],
  );

  const getSnapshot = useCallback(() => store.value, [store]);

  const value = useSyncExternalStore(subscribe, getSnapshot);

  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (action) => {
      const nextValue =
        typeof action === "function"
          ? (action as (prev: T) => T)(store.value)
          : action;
      if (!Object.is(nextValue, store.value)) {
        store.value = nextValue;
        store.listeners.forEach((l) => l());
      }
    },
    [store],
  );

  return [value, setValue];
}

/**
 * Write-only variant of `useControlState`. Returns only the setter without
 * subscribing to value changes — the component won't re-render when the
 * store value changes.
 */
export function useControlStateSetter<T>(
  key: string,
  initialValue: T,
): Dispatch<SetStateAction<T>> {
  const store = getOrCreateStore(key, initialValue);

  return useCallback(
    (action) => {
      const nextValue =
        typeof action === "function"
          ? (action as (prev: T) => T)(store.value)
          : action;
      if (!Object.is(nextValue, store.value)) {
        store.value = nextValue;
        store.listeners.forEach((l) => l());
      }
    },
    [store],
  );
}
