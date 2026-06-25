"use client"

import { Sparkles } from "lucide-react"
import { CopyInput } from "@/components/ui/copy-input"
import type { MediaFile } from "./types"

interface AssetTransformationsTabProps {
  asset: MediaFile
  apiBaseUrl: string
}

export function AssetTransformationsTab({
  asset,
  apiBaseUrl,
}: AssetTransformationsTabProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Common Transformations
        </h3>
        <div className="space-y-2">
          {asset.type === "audio" ? (
            <>
              <CopyInput
                label="Convert to MP3"
                value={`${apiBaseUrl}/t/f_mp3/${asset.path}`}
              />
              <CopyInput
                label="Convert to WAV"
                value={`${apiBaseUrl}/t/f_wav/${asset.path}`}
              />
              <CopyInput
                label="Convert to OGG"
                value={`${apiBaseUrl}/t/f_ogg/${asset.path}`}
              />
              <CopyInput
                label="Trim (30s to 120s)"
                value={`${apiBaseUrl}/t/so_30,eo_120/${asset.path}`}
              />
              <CopyInput
                label="Quality 320kbps"
                value={`${apiBaseUrl}/t/q_320/${asset.path}`}
              />
              <CopyInput
                label="Sample Rate 44100Hz"
                value={`${apiBaseUrl}/t/sr_44100/${asset.path}`}
              />
              <CopyInput
                label="Volume 50%"
                value={`${apiBaseUrl}/t/v_50/${asset.path}`}
              />
              <CopyInput
                label="Mono"
                value={`${apiBaseUrl}/t/ch_mono/${asset.path}`}
              />
            </>
          ) : (
            <>
              <CopyInput
                label="Thumbnail (300x300)"
                value={`${apiBaseUrl}/t/w_300,h_300/${asset.path}`}
              />
              <CopyInput
                label="Medium (800x800)"
                value={`${apiBaseUrl}/t/w_800,h_800/${asset.path}`}
              />
              <CopyInput
                label="Large (1920x1080)"
                value={`${apiBaseUrl}/t/w_1920,h_1080/${asset.path}`}
              />
              <CopyInput
                label="WebP Format"
                value={`${apiBaseUrl}/t/f_webp/${asset.path}`}
              />
              <CopyInput
                label="Quality 80"
                value={`${apiBaseUrl}/t/q_80/${asset.path}`}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

