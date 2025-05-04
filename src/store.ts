import { atomWithStorage } from 'jotai/utils'
import { ScribeControllerPosition } from './types';
import { atom } from 'jotai';
import { RefObject } from 'react';

export const microphoneAtom = atomWithStorage<string | null>("scribe-microphone", null);
export const controllerPositionAtom = atomWithStorage<ScribeControllerPosition>("scribe-controller-position", "bottom-right");
export const enableStatisticsAtom = atomWithStorage<boolean>("scribe-enable-statistics", false);
export const containerRefAtom = atom<RefObject<HTMLDivElement | null> | undefined>(undefined);