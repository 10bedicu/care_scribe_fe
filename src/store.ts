import { atomWithStorage } from 'jotai/utils'
import { ScribeControllerPosition } from './types';

export const microphoneAtom = atomWithStorage<string | null>("scribe-microphone", null);
export const controllerPositionAtom = atomWithStorage<ScribeControllerPosition>("scribe-controller-position", "bottom-right");
export const enableStatisticsAtom = atomWithStorage<boolean>("scribe-enable-statistics", false);