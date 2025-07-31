import { atomWithStorage } from "jotai/utils";
import { ScribeControllerPosition } from "./types";
import { atom } from "jotai";
import { RefObject } from "react";
import { Benchmark } from "./pages/Benchmark";

export const microphoneAtom = atomWithStorage<string | null>(
  "scribe-microphone",
  null,
);
export const controllerPositionAtom = atomWithStorage<ScribeControllerPosition>(
  "scribe-controller-position",
  "bottom-right",
);
export const devModeAtom = atomWithStorage<boolean>(
  "scribe-enable-dev-mode",
  false,
);
export const containerRefAtom = atom<
  RefObject<HTMLDivElement | null> | undefined
>(undefined);

export const benchmarkAtom = atomWithStorage<Benchmark[]>(
  "scribe-benchmarks",
  [],
);

export const historyPins = atomWithStorage<string[]>("scribe-history-pins", []);
