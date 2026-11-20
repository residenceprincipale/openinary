"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useOpeninary } from "@openinary/ui";

type Branding = { title: string; logoUrl: string };

const DEFAULTS: Branding = { title: "Openinary", logoUrl: "" };
const BrandingContext = createContext<Branding>(DEFAULTS);

export function useBranding() {
  return useContext(BrandingContext);
}

/** Applies the instance's branding from the transform config. */
export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { apiBaseUrl, fetch } = useOpeninary();
  const [branding, setBranding] = useState<Branding>(DEFAULTS);

  useEffect(() => {
    fetch(`${apiBaseUrl}/config/transforms`)
      .then((res) => res.json())
      .then((json) => {
        const next = json.data?.branding;
        if (!next) return;
        setBranding({ title: next.title || DEFAULTS.title, logoUrl: next.logoUrl || "" });
        if (next.title) document.title = next.title;
      })
      .catch(() => {});
  }, [apiBaseUrl, fetch]);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}
