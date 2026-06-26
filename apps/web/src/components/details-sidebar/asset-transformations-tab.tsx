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
  { value: "f_webm", label: "WebM" },
  { value: "f_mov", label: "MOV" },
  { value: "f_mp3", label: "MP3" },
  { value: "f_wav", label: "WAV" },
  { value: "f_ogg", label: "OGG" },
  { value: "f_flac", label: "FLAC" },
  { value: "f_aac", label: "AAC" },
  { value: "f_m4a", label: "M4A" },
]

const CROP_MODES = [
  { value: "", label: "None" },
  { value: "c_fill", label: "Fill" },
  { value: "c_fit", label: "Fit" },
  { value: "c_scale", label: "Scale" },
  { value: "c_crop", label: "Crop" },
  { value: "c_pad", label: "Pad" },
]

const GRAVITY_OPTIONS = [
  { value: "", label: "Default" },
  { value: "g_center", label: "Center" },
  { value: "g_north", label: "North" },
  { value: "g_south", label: "South" },
  { value: "g_east", label: "East" },
  { value: "g_west", label: "West" },
  { value: "g_face", label: "Face" },
  { value: "g_auto", label: "Auto" },
]

const CHANNEL_OPTIONS = [
  { value: "", label: "Default" },
  { value: "ch_mono", label: "Mono" },
  { value: "ch_stereo", label: "Stereo" },
]

const isImage = (t: string) => t === "image"
const isVideo = (t: string) => t === "video"
const isAudio = (t: string) => t === "audio"

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
  const [gravity, setGravity] = useState("")
  const [aspectRatio, setAspectRatio] = useState("")
  const [rotation, setRotation] = useState("")
  const [roundCorners, setRoundCorners] = useState("")
  const [background, setBackground] = useState("")
  const [startOffset, setStartOffset] = useState("")
  const [endOffset, setEndOffset] = useState("")
  const [sampleRate, setSampleRate] = useState("")
  const [volume, setVolume] = useState("")
  const [channels, setChannels] = useState("")

  const builderParams = useMemo(() => {
    const parts: string[] = []
    if (crop) parts.push(crop)
    if (gravity) parts.push(gravity)
    if (width) parts.push(`w_${width}`)
    if (height) parts.push(`h_${height}`)
    if (aspectRatio) parts.push(`ar_${aspectRatio}`)
    if (rotation) parts.push(`a_${rotation}`)
    if (roundCorners) parts.push(`r_${roundCorners}`)
    if (background) parts.push(`b_${background}`)
    if (quality) parts.push(`q_${quality}`)
    if (format) parts.push(format)
    if (startOffset) parts.push(`so_${startOffset}`)
    if (endOffset) parts.push(`eo_${endOffset}`)
    if (sampleRate) parts.push(`sr_${sampleRate}`)
    if (volume) parts.push(`v_${volume}`)
    if (channels) parts.push(channels)
    return parts.join(",")
  }, [crop, gravity, width, height, aspectRatio, rotation, roundCorners, background, quality, format, startOffset, endOffset, sampleRate, volume, channels])

  const builderUrl = builderParams
    ? `${apiBaseUrl}/t/${builderParams}/${asset.path}`
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
              <CopyInput label="Width/Height (800x800)" value={`${apiBaseUrl}/t/w_800,h_800/${asset.path}`} />
              <CopyInput label="WebP Format" value={`${apiBaseUrl}/t/f_webp/${asset.path}`} />
              <CopyInput label="Quality 80" value={`${apiBaseUrl}/t/q_80/${asset.path}`} />
            </>
          )}
        </div>

        <div className="space-y-3 pt-2 border-t">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            URL Builder
            <button onClick={() => { setWidth(""); setHeight(""); setFormat(""); setCrop(""); setQuality(""); setGravity(""); setAspectRatio(""); setRotation(""); setRoundCorners(""); setBackground(""); setStartOffset(""); setEndOffset(""); setSampleRate(""); setVolume(""); setChannels(""); }} className="ml-auto text-xs text-muted-foreground hover:text-foreground underline">Reset</button>
          </h3>

          {!isAudio(asset.type) && (
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
            {!isAudio(asset.type) && (
              <div className="space-y-1">
                <Label className="text-xs">Crop</Label>
                <select value={crop} onChange={(e) => setCrop(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  {CROP_MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}
            {!isAudio(asset.type) && (
              <div className="space-y-1">
                <Label className="text-xs">Gravity</Label>
                <select value={gravity} onChange={(e) => setGravity(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  {GRAVITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}
            {isAudio(asset.type) && (
              <div className="space-y-1">
                <Label className="text-xs">Format</Label>
                <select value={format} onChange={(e) => setFormat(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  {FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {!isAudio(asset.type) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Format</Label>
                <select value={format} onChange={(e) => setFormat(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  {FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              {isImage(asset.type) && (
                <div className="space-y-1">
                  <Label className="text-xs">Aspect Ratio</Label>
                  <Input placeholder="e.g. 16:9" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="h-8 text-xs" />
                </div>
              )}
              {isVideo(asset.type) && (
                <div className="space-y-1">
                  <Label className="text-xs">Start Offset (s)</Label>
                  <Input type="number" min={0} step={0.1} placeholder="e.g. 10" value={startOffset} onChange={(e) => setStartOffset(e.target.value)} className="h-8 text-xs" />
                </div>
              )}
            </div>
          )}

          {!isAudio(asset.type) && (
            <div className="grid grid-cols-2 gap-3">
              {isImage(asset.type) && (
                <div className="space-y-1">
                  <Label className="text-xs">Rotation</Label>
                  <Input type="number" placeholder="e.g. 90" value={rotation} onChange={(e) => setRotation(e.target.value)} className="h-8 text-xs" />
                </div>
              )}
              {isImage(asset.type) && (
                <div className="space-y-1">
                  <Label className="text-xs">Round Corners</Label>
                  <Input placeholder="px or max" value={roundCorners} onChange={(e) => setRoundCorners(e.target.value)} className="h-8 text-xs" />
                </div>
              )}
              {isVideo(asset.type) && (
                <div className="space-y-1">
                  <Label className="text-xs">End Offset (s)</Label>
                  <Input type="number" min={0} step={0.1} placeholder="e.g. 30" value={endOffset} onChange={(e) => setEndOffset(e.target.value)} className="h-8 text-xs" />
                </div>
              )}
            </div>
          )}

          {isImage(asset.type) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Background</Label>
                <Input placeholder="transparent, #fff, rgb:FF5733" value={background} onChange={(e) => setBackground(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Quality</Label>
                <Input type="number" min={1} max={100} placeholder="e.g. 80" value={quality} onChange={(e) => setQuality(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
          )}

          {isVideo(asset.type) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Quality</Label>
                <Input type="number" min={0} max={100} placeholder="e.g. 80" value={quality} onChange={(e) => setQuality(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Gravity</Label>
                <select value={gravity} onChange={(e) => setGravity(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  {GRAVITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {isAudio(asset.type) && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Start Offset (s)</Label>
                  <Input type="number" min={0} step={0.1} placeholder="e.g. 10" value={startOffset} onChange={(e) => setStartOffset(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End Offset (s)</Label>
                  <Input type="number" min={0} step={0.1} placeholder="e.g. 30" value={endOffset} onChange={(e) => setEndOffset(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Bitrate (kbps)</Label>
                  <Input type="number" min={1} max={320} placeholder="e.g. 320" value={quality} onChange={(e) => setQuality(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sample Rate (Hz)</Label>
                  <Input type="number" placeholder="e.g. 44100" value={sampleRate} onChange={(e) => setSampleRate(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Volume (%)</Label>
                  <Input type="number" placeholder="e.g. 50" value={volume} onChange={(e) => setVolume(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Channels</Label>
                  <select value={channels} onChange={(e) => setChannels(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    {CHANNEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {!isAudio(asset.type) && builderUrl && <CopyInput label="Built URL" value={builderUrl} />}
          {isAudio(asset.type) && builderUrl && <CopyInput label="Built URL" value={builderUrl} />}
        </div>
      </div>
    </div>
  )
}
