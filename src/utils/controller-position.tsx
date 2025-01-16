// Import React and other necessary hooks
import React, { createContext, useContext, useState, useEffect } from "react";

// Define the type
export type ScribeControllerPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

// Define the context interface
type ScribePositionContextType = [
  ScribeControllerPosition,
  (newPosition: ScribeControllerPosition) => void,
];

// Create the context
const ScribePositionContext = createContext<
  ScribePositionContextType | undefined
>(undefined);

// Local storage key
const LOCAL_STORAGE_KEY = "scribe-controller-position";

// Create the provider component
export const ScribePositionProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [position, setPosition] =
    useState<ScribeControllerPosition>("bottom-right");

  // Load the initial position from local storage
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

// Create a custom hook for consuming the context
export const useScribePosition = (): ScribePositionContextType => {
  const context = useContext(ScribePositionContext);
  if (!context) {
    throw new Error(
      "useScribePosition must be used within a ScribePositionProvider",
    );
  }
  return context;
};
