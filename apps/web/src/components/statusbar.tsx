"use client"

import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";

type ServerConfig = {
  maxFileSizeMB: number;
  storageLimitMB: number;
  storageUsedMB: number;
};

export function StatusBar() {
  const { data } = useQuery<ServerConfig>({
    queryKey: ["server-config"],
    queryFn: async () => {
      const r = await fetch(`${apiBaseUrl}/config/server`, { credentials: "include" });
      const d = await r.json();
      if (!d.success) throw new Error();
      return d.data;
    },
    staleTime: 30_000,
  });

  return (
    <footer className="flex items-center border-t px-4 py-1.5 text-xs text-muted-foreground justify-between">
      <span>Max file size: {data?.maxFileSizeMB ?? "—"} MB</span>
      {data && data.storageLimitMB > 0 && (
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <Progress value={Math.min((data.storageUsedMB / data.storageLimitMB) * 100, 100)} className="h-1.5" />
          <span className="whitespace-nowrap">{data.storageUsedMB} / {data.storageLimitMB} MB</span>
        </div>
      )}
    </footer>
  );
}
