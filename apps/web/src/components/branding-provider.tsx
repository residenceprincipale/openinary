"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Branding = {
  title: string;
  logoUrl: string;
};

const defaults: Branding = {
  title: "Openinary",
  logoUrl: "",
};

const BrandingContext = createContext<Branding>(defaults);

export function useBranding() {
  return useContext(BrandingContext);
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<Branding>(defaults);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";
    fetch(`${apiBase}/config/transforms`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.branding) {
          setBranding(d.data.branding);
          if (d.data.branding.title) {
            document.title = d.data.branding.title;
          }
        }
      })
      .catch(() => {});
  }, []);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}
