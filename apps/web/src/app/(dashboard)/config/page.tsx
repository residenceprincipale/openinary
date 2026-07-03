"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
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
import { useFeatures } from "@/components/features-provider";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";

type ImageDefaults = {
  quality: number; format: string; crop: string; gravity: string;
  background: string | null; radius: number | null; aspect: string | null;
  rotate: number | null; width: number | null; height: number | null;
};

type VideoDefaults = {
  quality: number; format: string; autoDownscale: boolean; autoDownscaleResolution: number;
  volume: number | null; crop: string | null; gravity: string | null; resize: string | null;
  width: number | null; height: number | null; startOffset: number | null; endOffset: number | null;
};

type TransformConfig = {
  image: ImageDefaults;
  video: VideoDefaults;
  audio: { quality: number; format: string; sampleRate: string; channels: string };
  branding: { title: string; logoUrl: string };
};

type ParamDef = {
  key: string; label: string; type: "number" | "text" | "select";
  min?: number; max?: number; step?: number; placeholder?: string;
  options?: { value: string; label: string }[];
};

function ParamField({
  def, value, onChange,
}: {
  def: ParamDef; value: unknown; onChange: (v: unknown) => void;
}) {
  const displayVal = value === null || value === undefined ? "" : String(value);
  if (def.type === "select" && def.options) {
    return (
      <div className="space-y-2">
        <Label>{def.label}</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={displayVal}
          onChange={(e) => onChange(e.target.value)}
        >
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Label>{def.label}</Label>
      <Input
        type={def.type}
        min={def.min} max={def.max} step={def.step}
        placeholder={def.placeholder}
        value={displayVal}
        onChange={(e) => {
          const raw = e.target.value;
          if (def.type === "number") {
            onChange(raw === "" ? null : Number(raw));
          } else {
            onChange(raw);
          }
        }}
      />
    </div>
  );
}

const IMAGE_PARAMS: ParamDef[] = [
  { key: "quality", label: "Quality (1-100)", type: "number", min: 1, max: 100, placeholder: "e.g. 80" },
  { key: "format", label: "Format", type: "select", options: [
    { value: "auto", label: "Auto" }, { value: "avif", label: "AVIF" },
    { value: "webp", label: "WebP" }, { value: "jpeg", label: "JPEG" },
    { value: "png", label: "PNG" },
  ]},
  { key: "crop", label: "Crop Mode", type: "select", options: [
    { value: "fill", label: "Fill" }, { value: "fit", label: "Fit" },
    { value: "scale", label: "Scale" }, { value: "crop", label: "Crop" },
    { value: "pad", label: "Pad" },
  ]},
  { key: "gravity", label: "Gravity", type: "select", options: [
    { value: "center", label: "Center" }, { value: "north", label: "North" },
    { value: "south", label: "South" }, { value: "east", label: "East" },
    { value: "west", label: "West" }, { value: "face", label: "Face" },
    { value: "auto", label: "Auto" },
  ]},
  { key: "background", label: "Background", type: "text", placeholder: "e.g. transparent, #ffffff" },
  { key: "radius", label: "Radius (px)", type: "number", min: 0, placeholder: "e.g. 10" },
  { key: "aspect", label: "Aspect Ratio", type: "text", placeholder: "e.g. 16:9" },
  { key: "rotate", label: "Rotation Angle (deg)", type: "number", placeholder: "e.g. 90" },
  { key: "width", label: "Width (px)", type: "number", min: 1, placeholder: "e.g. 800" },
  { key: "height", label: "Height (px)", type: "number", min: 1, placeholder: "e.g. 600" },
];

const VIDEO_PARAMS: ParamDef[] = [
  { key: "quality", label: "Quality (1-100)", type: "number", min: 1, max: 100 },
  { key: "format", label: "Format", type: "select", options: [
    { value: "mp4", label: "MP4" }, { value: "webm", label: "WebM" },
    { value: "mov", label: "MOV" },
  ]},
  { key: "crop", label: "Crop Mode", type: "select", options: [
    { value: "fill", label: "Fill" }, { value: "fit", label: "Fit" },
    { value: "scale", label: "Scale" }, { value: "crop", label: "Crop" },
    { value: "pad", label: "Pad" },
  ]},
  { key: "gravity", label: "Gravity", type: "select", options: [
    { value: "center", label: "Center" }, { value: "north", label: "North" },
    { value: "south", label: "South" }, { value: "east", label: "East" },
    { value: "west", label: "West" }, { value: "auto", label: "Auto" },
  ]},
  { key: "volume", label: "Volume (0-100)", type: "number", min: 0, max: 100, placeholder: "e.g. 80" },
  { key: "width", label: "Width (px)", type: "number", min: 1 ,placeholder: "e.g. 1280"},
  { key: "height", label: "Height (px)", type: "number", min: 1, placeholder: "e.g. 720"},
  { key: "startOffset", label: "Start Offset (sec)", type: "number", min: 0, placeholder: "e.g. 5" },
  { key: "endOffset", label: "End Offset (sec)", type: "number", min: 0 , placeholder: "e.g. 10" },
];

function ConfigPageContent() {
  const { disableTransforms } = useFeatures();
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

  const updateSection = useCallback(<T,>(section: keyof TransformConfig, key: string, value: T) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return { ...prev, [section]: { ...prev[section], [key]: value } };
    });
  }, []);

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
            <div className="space-y-1 flex justify-between">
              <h1 className="text-3xl font-semibold lg:text-4xl">Config</h1>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
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
                    <CardTitle>Branding</CardTitle>
                    <CardDescription>White-label the interface</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={config.branding.title}
                        onChange={(e) => updateSection("branding", "title", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Logo URL (optional)</Label>
                      <Input
                        placeholder="/openinary.svg"
                        value={config.branding.logoUrl}
                        onChange={(e) => updateSection("branding", "logoUrl", e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {!disableTransforms && <Card>
                  <CardHeader>
                    <CardTitle>Image</CardTitle>
                    <CardDescription>Default image transformation parameters</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {IMAGE_PARAMS.map((def) => (
                        <ParamField
                          key={def.key}
                          def={def}
                          value={(config.image as Record<string, unknown>)[def.key]}
                          onChange={(v) => updateSection("image", def.key, v)}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>}

                {!disableTransforms && <Card>
                  <CardHeader>
                    <CardTitle>Video</CardTitle>
                    <CardDescription>Default video transformation parameters</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {VIDEO_PARAMS.map((def) => (
                        <ParamField
                          key={def.key}
                          def={def}
                          value={(config.video as Record<string, unknown>)[def.key]}
                          onChange={(v) => updateSection("video", def.key, v)}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="autoDownscale"
                        className="h-4 w-4"
                        checked={config.video.autoDownscale}
                        onChange={(e) => updateSection("video", "autoDownscale", e.target.checked)}
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
                            - Processing time reduced by ~50% compared to 1080p output
                          </TooltipContent>
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
                          onChange={(e) => updateSection("video", "autoDownscaleResolution", +e.target.value)}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>}

                {!disableTransforms && <Card>
                  <CardHeader>
                    <CardTitle>Audio</CardTitle>
                    <CardDescription>Default audio transformation parameters</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Bitrate (kbps, 32-320)</Label>
                        <Input
                          type="number" min={32} max={320} step={32}
                          value={config.audio.quality}
                          onChange={(e) => updateSection("audio", "quality", +e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Format</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={config.audio.format}
                          onChange={(e) => updateSection("audio", "format", e.target.value)}
                        >
                          <option value="mp3">MP3</option>
                          <option value="aac">AAC</option>
                          <option value="ogg">OGG</option>
                          <option value="wav">WAV</option>
                          <option value="flac">FLAC</option>
                          <option value="m4a">M4A</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Sample Rate (Hz)</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={config.audio.sampleRate}
                          onChange={(e) => updateSection("audio", "sampleRate", e.target.value)}
                        >
                          <option value="8000">8000</option>
                          <option value="11025">11025</option>
                          <option value="16000">16000</option>
                          <option value="22050">22050</option>
                          <option value="44100">44100</option>
                          <option value="48000">48000</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Channels</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={config.audio.channels}
                          onChange={(e) => updateSection("audio", "channels", e.target.value)}
                        >
                          <option value="stereo">Stereo</option>
                          <option value="mono">Mono</option>
                        </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>}
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
