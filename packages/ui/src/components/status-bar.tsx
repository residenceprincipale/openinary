"use client";

import { useQuery } from "@tanstack/react-query";
import { useOpeninary } from "../provider/openinary-provider";
import { Progress } from "../ui/progress";

type ServerConfig = {
  maxFileSizeMB: number;
  storageLimitMB: number;
  storageUsedMB: number;
  transformsDisabled?: boolean;
};

/** The dashboard's bottom line: upload cap, storage usage, transforms state. */
export function StatusBar() {
  const { apiBaseUrl, fetch } = useOpeninary();
  const { data } = useQuery<ServerConfig>({
    queryKey: ["openinary", "server-config", apiBaseUrl],
    queryFn: async () => {
      const res = await fetch(`${apiBaseUrl}/config/server`);
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      return (await res.json()).data;
    },
    staleTime: 30_000,
  });

  const percent =
    data && data.storageLimitMB > 0
      ? Math.min((data.storageUsedMB / data.storageLimitMB) * 100, 100)
      : 0;

  return (
    <footer className="flex h-8 shrink-0 items-center justify-between gap-3 border-t border-ds-divider px-3 text-[11.5px]/4 text-ds-faint">
      <span className="shrink-0 tabular-nums">
        Max file size: {data ? `${data.maxFileSizeMB} MB` : "—"}
      </span>
      <div className="flex min-w-0 items-center gap-3">
        {data && data.storageLimitMB > 0 && (
          <div className="flex min-w-0 items-center gap-2">
            <Progress value={percent} className="h-1 w-24" />
            <span className="whitespace-nowrap tabular-nums">
              {data.storageUsedMB} / {data.storageLimitMB} MB
            </span>
          </div>
        )}
        {data?.transformsDisabled && (
          <span className="shrink-0 rounded-full border border-ds-border-strong px-2 py-0.5">
            Transforms off
          </span>
        )}
      </div>
    </footer>
  );
}
