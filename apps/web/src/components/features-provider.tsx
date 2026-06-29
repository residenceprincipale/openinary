"use client";

import { createContext, useContext } from "react";

type Features = {
  disableTransforms: boolean;
};

const FeaturesContext = createContext<Features>({ disableTransforms: false });

export function useFeatures() {
  return useContext(FeaturesContext);
}

export function FeaturesProvider({
  disableTransforms,
  children,
}: Features & { children: React.ReactNode }) {
  return (
    <FeaturesContext.Provider value={{ disableTransforms }}>
      {children}
    </FeaturesContext.Provider>
  );
}
