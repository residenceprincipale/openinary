"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  DeleteConfirmDialog,
  formatFileSize,
  SettingsList,
  SettingsRow,
  SettingsSection,
  useOpeninary,
} from "@openinary/ui";
import { toast } from "sonner";

type CacheFile = { name?: string; key?: string; size: number; lastModified: string | number };
type CacheStats = {
  local: { totalFiles: number; totalSize: number; files: CacheFile[] };
  cloud: {
    enabled: boolean;
    totalFiles: number;
    totalSize: number;
    files: CacheFile[];
  };
};

export function CachePage() {
  const { apiBaseUrl, fetch } = useOpeninary();
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/cache/stats`);
      if (!res.ok) throw new Error("Failed to load cache");
      const json = await res.json();
      setStats(json.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load cache");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, fetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (file: CacheFile) => {
    try {
      const target = file.name
        ? `${apiBaseUrl}/cache/${encodeURIComponent(file.name)}`
        : `${apiBaseUrl}/cache/cloud/${(file.key ?? "").split("/").map(encodeURIComponent).join("/")}`;
      const res = await fetch(target, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete cache entry");
      toast.success("Cache entry deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  const clearAll = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/cache`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear cache");
      toast.success("Cache cleared");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear");
    }
    setConfirmClear(false);
  };

  const table = (files: CacheFile[], cloud: boolean) =>
    files.length === 0 ? (
      <p className="px-4 py-3 text-sm text-muted-foreground">Empty.</p>
    ) : (
      <ul className="max-h-80 divide-y overflow-y-auto">
        {files.map((file) => {
          const id = file.name ?? file.key ?? "";
          return (
            <li
              key={id}
              className="flex items-center justify-between gap-3 px-4 py-2"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs" title={id}>
                {id}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatFileSize(file.size)}
              </span>
              <Button variant="ghost" size="sm" onClick={() => remove(file)}>
                Delete
              </Button>
            </li>
          );
        })}
      </ul>
    );

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Cache"
        description="Transformed derivatives. Deleting them is safe: the next request rebuilds them, slower the first time."
        action={
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => setConfirmClear(true)}
          >
            Clear all
          </Button>
        }
      >
        <SettingsList>
          <SettingsRow label="Local cache">
            <span className="font-medium tabular-nums">
              {isLoading ? "…" : formatFileSize(stats?.local.totalSize ?? 0)}
            </span>
            <span className="ml-2 text-muted-foreground tabular-nums">
              {stats?.local.totalFiles ?? 0} files
            </span>
          </SettingsRow>
          {stats?.cloud.enabled && (
            <SettingsRow label="Cloud cache">
              <span className="font-medium tabular-nums">
                {formatFileSize(stats.cloud.totalSize)}
              </span>
              <span className="ml-2 text-muted-foreground tabular-nums">
                {stats.cloud.totalFiles} files
              </span>
            </SettingsRow>
          )}
        </SettingsList>
      </SettingsSection>

      <SettingsSection title="Local files">
        {table(stats?.local.files ?? [], false)}
      </SettingsSection>

      {stats?.cloud.enabled && (
        <SettingsSection title="Cloud files">
          {table(stats.cloud.files, true)}
        </SettingsSection>
      )}

      <DeleteConfirmDialog
        isOpen={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear cache"
        description="Delete every local and cloud cached transformation? They rebuild on demand."
        confirmLabel="Clear cache"
        onConfirm={clearAll}
      />
    </div>
  );
}
