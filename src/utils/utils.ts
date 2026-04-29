import { ScribeDeseriliazedValue } from "../types";
import clsx, { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { AI_MODELS } from "./constants";
import STRUCTURES from "./structures";
import { ReactNode } from "react";

export const renderCamelCase = (str: string) => {
  // replace all underscores with spaces
  return str.replace(/_/g, " ");
};

export const renderFieldValue = (
  values: {
    value: ScribeDeseriliazedValue;
    newValue?: ScribeDeseriliazedValue;
    structure?: (typeof STRUCTURES)[keyof typeof STRUCTURES];
  },
  useNewValue?: boolean,
) => {
  const val = useNewValue ? values.newValue : values.value;

  let humanValue: ReactNode = "";
  if (values.structure) {
    humanValue = values.structure.toPrompt(val as any);
  } else {
    // convert from snake case to human readable text
    humanValue =
      (typeof val === "boolean"
        ? val
          ? "yes"
          : "no"
        : typeof val === "string"
          ? renderCamelCase(val)
          : Array.isArray(val)
            ? val.map((val) => renderCamelCase(String(val))).join(", ")
            : JSON.stringify(val)
      )?.toLocaleLowerCase() || "";
  }

  return humanValue;
};

export const sleep = async (seconds: number) => {
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, seconds);
  });
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function debounce<T extends unknown[], U>(
  callback: (...args: T) => PromiseLike<U> | U,
  wait: number,
) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: T): Promise<U> => {
    clearTimeout(timer);
    return new Promise((resolve) => {
      timer = setTimeout(() => resolve(callback(...args)), wait);
    });
  };
}

export const calculateCost = (
  inputTokens: number,
  audioInputTokens: number,
  outputTokens: number,
  cachedTokens: number,
  audioCachedTokens: number,
  model: string,
) => {
  const modelData = AI_MODELS[model as keyof typeof AI_MODELS];
  if (!modelData) {
    console.warn(`Model ${model} not found in AI_MODELS`);
    return 0;
  }
  const { input, output, cached } = modelData.cost;
  let audio_input: number = input;
  let audio_cached: number = cached;
  if ("audio_input" in modelData.cost) {
    audio_input = modelData.cost.audio_input;
  }
  if ("audio_cached" in modelData.cost) {
    audio_cached = modelData.cost.audio_cached;
  }

  const nonCachedTokens = inputTokens - cachedTokens;
  const textNonCachedTokens = nonCachedTokens - audioInputTokens;
  const textCachedTokens = cachedTokens - audioCachedTokens;

  // costs are stored per million tokens
  const inputCost = (textNonCachedTokens / 1000000) * input;
  const outputCost = (outputTokens / 1000000) * output;
  const cachedCost = (textCachedTokens / 1000000) * cached;
  const audioInputCost = (audioInputTokens / 1000000) * audio_input;
  const audioCachedCost = (audioCachedTokens / 1000000) * audio_cached;

  return inputCost + outputCost + cachedCost + audioCachedCost + audioInputCost;
};
