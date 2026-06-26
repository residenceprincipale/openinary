"use client"

import type { MediaFile } from "./types"

interface AssetPreviewProps {
  asset: MediaFile
  previewUrl: string
  mediaUrl: string
  rawUrl: string
}

export function AssetPreview({ asset, previewUrl, mediaUrl, rawUrl }: AssetPreviewProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Preview</h3>
      <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-border bg-muted">
        {asset.type === "video" ? (
          <video
            src={mediaUrl}
            controls
            poster={previewUrl}
            className="w-full h-full object-contain"
          />
        ) : asset.type === "audio" ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-600/20 to-green-800/20">
            <audio src={mediaUrl} controls className="w-3/4" />
          </div>
        ) : asset.type === "other" ? (
          <iframe
            src={rawUrl}
            className="w-full h-full"
            title={asset.name}
          />
        ) : (
          <img
            src={previewUrl}
            alt={asset.name}
            className="w-full h-full object-contain"
            loading="eager"
          />
        )}
      </div>
    </div>
  )
}

