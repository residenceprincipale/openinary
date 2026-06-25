"use client";

import { Suspense, useEffect, useState } from "react";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, RefreshCw, Cloud } from "lucide-react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";

type LocalFile = { name: string; size: number; lastModified: number };
type CloudFile = { key: string; size: number; lastModified: string };
type CacheData = {
  local: { totalFiles: number; totalSize: number; maxSize: number; files: LocalFile[] };
  cloud: { enabled: boolean; totalFiles?: number; totalSize?: number; files?: CloudFile[] };
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString();
}

function CachePageContent() {
  const [data, setData] = useState<CacheData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [clearDays, setClearDays] = useState(7);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBaseUrl}/cache/stats`, { credentials: "include" });
      const d = await r.json();
      if (d.success) setData(d.data);
    } catch {
      setMessage("Failed to load cache stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats() }, []);

  const clearAll = async () => {
    if (!confirm("Delete all local and cloud cache?")) return;
    try {
      const r = await fetch(`${apiBaseUrl}/cache`, { method: "DELETE", credentials: "include" });
      const d = await r.json();
      if (d.success) {
        const parts = [`${d.data.localDeleted} local`]
        if (d.data.cloudDeleted > 0) parts.push(`${d.data.cloudDeleted} cloud`)
        setMessage(`Deleted ${parts.join(", ")} files`)
      } else {
        setMessage("Failed to clear cache")
      }
      fetchStats();
    } catch {
      setMessage("Failed to clear cache");
    }
  };

  const clearOld = async () => {
    const age = clearDays * 24 * 60 * 60 * 1000;
    if (!confirm(`Delete local cache older than ${clearDays} days?`)) return;
    try {
      const r = await fetch(`${apiBaseUrl}/cache/old?age=${age}`, { method: "DELETE", credentials: "include" });
      const d = await r.json();
      setMessage(d.success ? `Deleted ${d.data.deletedCount} old files` : "Failed to clear old cache");
      fetchStats();
    } catch {
      setMessage("Failed to clear old cache");
    }
  };

  if (loading) {
    return (
      <>
        <AppSidebar />
        <SidebarInset>
          <div className="flex min-h-screen items-center justify-center">
            <Spinner className="mx-auto" />
          </div>
        </SidebarInset>
      </>
    );
  }

  const local = data?.local
  const cloud = data?.cloud
  const localUsage = local?.maxSize ? Math.round((local.totalSize / local.maxSize) * 100) : 0

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Cache</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="px-6 py-8">
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold lg:text-4xl">Cache</h1>
                <p className="text-muted-foreground leading-relaxed">
                  Manage local and cloud transformation cache
                </p>
              </div>
              <Button variant="outline" size="icon" onClick={fetchStats} title="Refresh">
                <RefreshCw className="size-4" />
              </Button>
            </div>

            {message && (
              <div
                className={`rounded-md p-3 text-sm ${
                  message.startsWith("Failed")
                    ? "bg-destructive/15 text-destructive"
                    : "bg-green-500/15 text-green-600"
                }`}
              >
                {message}
              </div>
            )}

            {local && (
              <>
                <Card>
                  <CardHeader><CardTitle>Local Cache</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Files</p>
                        <p className="text-2xl font-bold">{local.totalFiles}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Size</p>
                        <p className="text-2xl font-bold">{formatBytes(local.totalSize)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Usage</p>
                        <p className="text-2xl font-bold">{localUsage}%</p>
                        <p className="text-xs text-muted-foreground">of {formatBytes(local.maxSize)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <Button variant="destructive" onClick={clearAll} disabled={local.totalFiles === 0 && (!cloud?.enabled || (cloud.totalFiles ?? 0) === 0)}>
                        <Trash2 className="size-4" />
                        Clear All Cache
                      </Button>
                      <div className="flex items-end gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="clearDays">Clear local older than (days)</Label>
                          <Input id="clearDays" type="number" min={1} className="w-20" value={clearDays} onChange={(e) => setClearDays(Math.max(1, +e.target.value))} />
                        </div>
                        <Button variant="outline" onClick={clearOld} disabled={local.totalFiles === 0}>Clear Old</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {local.files.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Local Cached Files</CardTitle>
                      <CardDescription>{local.files.length} files on disk</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-64 overflow-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 font-medium">Name</th>
                              <th className="pb-2 font-medium text-right">Size</th>
                              <th className="pb-2 font-medium text-right">Last Modified</th>
                            </tr>
                          </thead>
                          <tbody>
                            {local.files.map((f) => (
                              <tr key={f.name} className="border-b last:border-0">
                                <td className="py-1.5 pr-4 font-mono text-xs truncate max-w-[300px]">{f.name}</td>
                                <td className="py-1.5 text-right text-muted-foreground whitespace-nowrap">{formatBytes(f.size)}</td>
                                <td className="py-1.5 text-right text-muted-foreground whitespace-nowrap">{formatDate(f.lastModified)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {cloud?.enabled && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Cloud className="size-4" /> Cloud Cache
                      </CardTitle>
                      <CardDescription>{cloud.totalFiles ?? 0} files in S3-compatible storage</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 sm:grid-cols-2 mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Files</p>
                          <p className="text-2xl font-bold">{cloud.totalFiles}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Size</p>
                          <p className="text-2xl font-bold">{formatBytes(cloud.totalSize ?? 0)}</p>
                        </div>
                      </div>
                      {(cloud.files?.length ?? 0) > 0 && (
                        <div className="max-h-64 overflow-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-left text-muted-foreground">
                                <th className="pb-2 font-medium">Key</th>
                                <th className="pb-2 font-medium text-right">Size</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cloud.files?.map((f) => (
                                <tr key={f.key} className="border-b last:border-0">
                                  <td className="py-1.5 pr-4 font-mono text-xs truncate max-w-[400px]">{f.key}</td>
                                  <td className="py-1.5 text-right text-muted-foreground whitespace-nowrap">{formatBytes(f.size)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </SidebarInset>
    </>
  );
}

export default function CachePage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <CachePageContent />
    </Suspense>
  );
}
