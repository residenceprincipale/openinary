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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";

type TransformConfig = {
  image: { quality: number; format: string; crop: string; gravity: string };
  video: { quality: number; format: string; autoDownscale: boolean; autoDownscaleResolution: number };
};

function ConfigPageContent() {
  const [config, setConfig] = useState<TransformConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${apiBaseUrl}/config/transforms`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.success) setConfig(d.data); })
      .catch(() => setMessage("Failed to load config"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setMessage("");
    try {
      const r = await fetch(`${apiBaseUrl}/config/transforms`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const d = await r.json();
      if (d.success) {
        setMessage("Saved");
        setConfig(d.data);
      } else {
        setMessage(d.error || "Failed to save");
      }
    } catch {
      setMessage("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen w-screen items-center justify-center bg-background px-4">
        <Spinner className="mx-auto" />
      </div>
    );
  }

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
                  <BreadcrumbPage>Config</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="px-6 py-8">
          <div className="mx-auto max-w-2xl space-y-8">
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold lg:text-4xl">Config</h1>
              <p className="text-muted-foreground leading-relaxed">
                Default transformation parameters
              </p>
            </div>

            {message && (
              <div className={`rounded-md p-3 text-sm ${message === "Saved" ? "bg-green-500/15 text-green-600" : "bg-destructive/15 text-destructive"}`}>
                {message}
              </div>
            )}

            {config && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Image</CardTitle>
                    <CardDescription>Default image transformation parameters</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Quality (1-100)</Label>
                        <Input
                          type="number" min={1} max={100}
                          value={config.image.quality}
                          onChange={(e) => setConfig({ ...config, image: { ...config.image, quality: +e.target.value } })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Format</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={config.image.format}
                          onChange={(e) => setConfig({ ...config, image: { ...config.image, format: e.target.value } })}
                        >
                          <option value="auto">Auto</option>
                          <option value="avif">AVIF</option>
                          <option value="webp">WebP</option>
                          <option value="jpeg">JPEG</option>
                          <option value="png">PNG</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Crop Mode</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={config.image.crop}
                          onChange={(e) => setConfig({ ...config, image: { ...config.image, crop: e.target.value } })}
                        >
                          <option value="fill">Fill</option>
                          <option value="fit">Fit</option>
                          <option value="scale">Scale</option>
                          <option value="crop">Crop</option>
                          <option value="pad">Pad</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Gravity</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={config.image.gravity}
                          onChange={(e) => setConfig({ ...config, image: { ...config.image, gravity: e.target.value } })}
                        >
                          <option value="center">Center</option>
                          <option value="north">North</option>
                          <option value="south">South</option>
                          <option value="east">East</option>
                          <option value="west">West</option>
                          <option value="face">Face</option>
                          <option value="auto">Auto</option>
                        </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Video</CardTitle>
                    <CardDescription>Default video transformation parameters</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Quality (1-100)</Label>
                        <Input
                          type="number" min={1} max={100}
                          value={config.video.quality}
                          onChange={(e) => setConfig({ ...config, video: { ...config.video, quality: +e.target.value } })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Format</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={config.video.format}
                          onChange={(e) => setConfig({ ...config, video: { ...config.video, format: e.target.value } })}
                        >
                          <option value="mp4">MP4</option>
                          <option value="webm">WebM</option>
                          <option value="mov">MOV</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="autoDownscale"
                        className="h-4 w-4"
                        checked={config.video.autoDownscale}
                        onChange={(e) => setConfig({ ...config, video: { ...config.video, autoDownscale: e.target.checked } })}
                      />
                      <Label htmlFor="autoDownscale" className="flex items-center gap-1">
                        Auto-downscale
                        <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-64">
                            Automatically downscale videos to reduce processing load. This prevents high-resolution videos (4K, 5K, 8K) from overwhelming the system. Only applies if no explicit resize parameters are provided<br/><br/>
                            Uses 720p instead of 1080p for faster processing of very large videos (8K, 5K)<br/>
                            - 8K (7680x4320) {"->"} 720p = 98% pixel reduction (vs 94% to 1080p)<br/>
                            - Processing time reduced by ~50% compared to 1080p output                          </TooltipContent>
                        </Tooltip>
                        </TooltipProvider>
                      </Label>
                    </div>
                    {config.video.autoDownscale && (
                      <div className="flex items-center gap-2 ml-6">
                        <Label htmlFor="downscaleRes" className="text-sm text-muted-foreground">Max height (px):</Label>
                        <Input
                          id="downscaleRes"
                          type="number" min={240} max={2160} step={10}
                          className="w-24 h-8"
                          value={config.video.autoDownscaleResolution}
                          onChange={(e) => setConfig({ ...config, video: { ...config.video, autoDownscaleResolution: +e.target.value } })}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </>
            )}
          </div>
        </div>
      </SidebarInset>
    </>
  );
}

export default function ConfigPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <ConfigPageContent />
    </Suspense>
  );
}
