"use client"

import { useState, useMemo } from "react"
import { Sparkles, Wrench } from "lucide-react"
import { CopyInput } from "@/components/ui/copy-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { MediaFile } from "./types"

interface AssetTransformationsTabProps {
  asset: MediaFile
  apiBaseUrl: string
  rawUrl: string
}

const FORMATS = [
  { value: "", label: "Auto" },
  { value: "f_webp", label: "WebP" },
  { value: "f_jpeg", label: "JPEG" },
  { value: "f_png", label: "PNG" },
  { value: "f_avif", label: "AVIF" },
  { value: "f_gif", label: "GIF" },
  { value: "f_mp4", label: "MP4" },
  { value: "f_mp3", label: "MP3" },
  { value: "f_wav", label: "WAV" },
  { value: "f_ogg", label: "OGG" },
]

const CROP_MODES = [
  { value: "", label: "None" },
  { value: "c_fill", label: "Fill" },
  { value: "c_fit", label: "Fit" },
  { value: "c_scale", label: "Scale" },
  { value: "c_thumb", label: "Thumbnail" },
  { value: "c_pad", label: "Pad" },
]

export function AssetTransformationsTab({
  asset,
  apiBaseUrl,
  rawUrl,
}: AssetTransformationsTabProps) {
  const [width, setWidth] = useState("")
  const [height, setHeight] = useState("")
  const [format, setFormat] = useState("")
  const [crop, setCrop] = useState("")
  const [quality, setQuality] = useState("")
  const [customParams, setCustomParams] = useState("")

  const builderParams = useMemo(() => {
    const parts: string[] = []
    if (crop) parts.push(crop)
    if (width) parts.push(`w_${width}`)
    if (height) parts.push(`h_${height}`)
    if (quality) parts.push(`q_${quality}`)
    if (format) parts.push(format)
    return parts.join(",")
  }, [crop, width, height, quality, format])

  const builderUrl = builderParams
    ? `${apiBaseUrl}/t/${builderParams}/${asset.path}`
    : ""

  const customUrl = customParams
    ? `${apiBaseUrl}/t/${customParams}/${asset.path}`
    : ""

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Common Transformations
        </h3>
        <CopyInput label="Original (no transform)" value={rawUrl} />
        <div className="space-y-2">
          {asset.type === "audio" ? (
            <>
              <CopyInput label="Convert to MP3" value={`${apiBaseUrl}/t/f_mp3/${asset.path}`} />
              <CopyInput label="Convert to WAV" value={`${apiBaseUrl}/t/f_wav/${asset.path}`} />
              <CopyInput label="Convert to OGG" value={`${apiBaseUrl}/t/f_ogg/${asset.path}`} />
              <CopyInput label="Trim (30s to 120s)" value={`${apiBaseUrl}/t/so_30,eo_120/${asset.path}`} />
              <CopyInput label="Quality 320kbps" value={`${apiBaseUrl}/t/q_320/${asset.path}`} />
              <CopyInput label="Sample Rate 44100Hz" value={`${apiBaseUrl}/t/sr_44100/${asset.path}`} />
              <CopyInput label="Volume 50%" value={`${apiBaseUrl}/t/v_50/${asset.path}`} />
              <CopyInput label="Mono" value={`${apiBaseUrl}/t/ch_mono/${asset.path}`} />
            </>
          ) : (
            <>
              <CopyInput label="Thumbnail (300x300)" value={`${apiBaseUrl}/t/w_300,h_300/${asset.path}`} />
              <CopyInput label="Medium (800x800)" value={`${apiBaseUrl}/t/w_800,h_800/${asset.path}`} />
              <CopyInput label="Large (1920x1080)" value={`${apiBaseUrl}/t/w_1920,h_1080/${asset.path}`} />
              <CopyInput label="WebP Format" value={`${apiBaseUrl}/t/f_webp/${asset.path}`} />
              <CopyInput label="Quality 80" value={`${apiBaseUrl}/t/q_80/${asset.path}`} />
            </>
          )}
        </div>

        <div className="space-y-3 pt-2 border-t">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            URL Builder
          </h3>

          {asset.type !== "audio" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Width</Label>
                <Input type="number" min={1} placeholder="e.g. 800" value={width} onChange={(e) => setWidth(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Height</Label>
                <Input type="number" min={1} placeholder="e.g. 600" value={height} onChange={(e) => setHeight(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {asset.type !== "audio" && (
              <div className="space-y-1">
                <Label className="text-xs">Crop</Label>
                <select value={crop} onChange={(e) => setCrop(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  {CROP_MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Format</Label>
              <select value={format} onChange={(e) => setFormat(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Quality</Label>
            <Input type="number" min={1} max={100} placeholder="e.g. 80" value={quality} onChange={(e) => setQuality(e.target.value)} className="h-8 text-xs" />
          </div>

          {builderUrl && <CopyInput label="Built URL" value={builderUrl} />}
        </div>
      </div>
    </div>
  )
}
