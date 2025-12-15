import { Benchmark } from "@/pages/Benchmark";
import { ScribeControllerPosition } from "@/types";
import { useCallback, useEffect, useState } from "react";

export const storageDefaults = {
  "scribe-microphone": null as string | null,
  "scribe-controller-position": "bottom-right" as ScribeControllerPosition,
  "scribe-enable-dev-mode": false as boolean,
  "scribe-benchmarks": [] as Benchmark[],
} as const;

export type StorageKeys = keyof typeof storageDefaults;
export type StorageValues = typeof storageDefaults;

export function useStorage<K extends StorageKeys>(
  key: K,
): [
  StorageValues[K],
  (
    value: StorageValues[K] | ((prev: StorageValues[K]) => StorageValues[K]),
  ) => void,
] {
  const defaultValue = storageDefaults[key];

  const getStorage = useCallback((): StorageValues[K] => {
    const item = localStorage.getItem(key);
    return item ? (JSON.parse(item) as StorageValues[K]) : defaultValue;
  }, [key, defaultValue]);

  const [value, setValue] = useState<StorageValues[K]>(getStorage);

  const setStorage = useCallback(
    (
      newValueOrUpdater:
        | StorageValues[K]
        | ((prev: StorageValues[K]) => StorageValues[K]),
    ) => {
      setValue((prev) => {
        const newValue =
          typeof newValueOrUpdater === "function"
            ? (
                newValueOrUpdater as (
                  prev: StorageValues[K],
                ) => StorageValues[K]
              )(prev)
            : newValueOrUpdater;

        localStorage.setItem(key, JSON.stringify(newValue));
        // trigger same-tab listeners manually
        window.dispatchEvent(
          new StorageEvent("storage", {
            key,
            newValue: JSON.stringify(newValue),
          }),
        );

        return newValue;
      });
    },
    [key],
  );

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        try {
          setValue(JSON.parse(event.newValue));
        } catch {
          // ignore parse errors
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key]);

  return [value, setStorage];
}
