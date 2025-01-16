import React, { createContext, useContext, useState, useEffect } from "react";

export type ScribeControllerPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

type ScribePositionContextType = [
  ScribeControllerPosition,
  (newPosition: ScribeControllerPosition) => void,
];

const ScribePositionContext = createContext<
  ScribePositionContextType | undefined
>(undefined);

const LOCAL_STORAGE_KEY = "scribe-controller-position";

export const ScribePositionProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [position, setPosition] =
    useState<ScribeControllerPosition>("bottom-right");

  useEffect(() => {
    const storedPosition = localStorage.getItem(
      LOCAL_STORAGE_KEY,
    ) as ScribeControllerPosition | null;
    if (storedPosition) {
      setPosition(storedPosition);
    }
  }, []);

  useEffect(() => {
    if (!position) return;
    localStorage.setItem(LOCAL_STORAGE_KEY, position);
  }, [position]);

  return (
    <ScribePositionContext.Provider value={[position, setPosition]}>
      {children}
    </ScribePositionContext.Provider>
  );
};

export const useScribePosition = (): ScribePositionContextType => {
  const context = useContext(ScribePositionContext);
  if (!context) {
    throw new Error(
      "useScribePosition must be used within a ScribePositionProvider",
    );
  }
  return context;
};
