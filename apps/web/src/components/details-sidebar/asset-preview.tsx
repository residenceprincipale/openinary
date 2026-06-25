"use client"

import { useState, useEffect } from "react"
import { FileAudio } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { VideoThumbnail } from "@/components/video-thumbnail"
import type { MediaFile } from "./types"

interface AssetPreviewProps {
  asset: MediaFile
  previewUrl: string
  mediaUrl: string
}

export function AssetPreview({ asset, previewUrl, mediaUrl }: AssetPreviewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Reset loading state when previewUrl changes
  useEffect(() => {
    setIsLoading(true)
    setHasError(false)
  }, [previewUrl])

  const handleLoad = () => {
    setIsLoading(false)
  }

  const handleError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Preview</h3>
      <button className="relative w-full aspect-square rounded-lg overflow-hidden border border-border bg-muted cursor-pointer text-left" onClick={() => window.open(mediaUrl, '_blank')}>
        {asset.type === "video" ? (
          <VideoThumbnail
            src={previewUrl}
            alt={asset.name}
            loading="eager"
          />
        ) : asset.type === "audio" ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-600/20 to-green-800/20">
            <FileAudio className="w-24 h-24 text-green-500/40" />
          </div>
        ) : (
          <>
            {isLoading && (
              <Skeleton className="absolute inset-0 w-full h-full" />
            )}
            <img
              src={previewUrl}
              alt={asset.name}
              className={`w-full h-full object-contain transition-opacity duration-200 ${
                isLoading ? "opacity-0" : "opacity-100"
              }`}
              onLoad={handleLoad}
              onError={handleError}
              loading="eager"
            />
            {hasError && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <p className="text-sm">Failed to load preview</p>
              </div>
            )}
          </>
        )}
      </button>
    </div>
  )
}

