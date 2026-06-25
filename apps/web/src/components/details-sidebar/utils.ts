import type { TreeDataItem } from "@/components/ui/tree-view"
import type { MediaFile } from "./types"

export function findAssetInTree(
  items: TreeDataItem[],
  assetId: string,
): MediaFile | null {
  for (const item of items) {
    const lowerName = item.name.toLowerCase()

    const isImage =
      lowerName.endsWith(".jpg") ||
      lowerName.endsWith(".jpeg") ||
      lowerName.endsWith(".png") ||
      lowerName.endsWith(".webp") ||
      lowerName.endsWith(".gif") ||
      lowerName.endsWith(".avif") ||
      lowerName.endsWith(".psd")

    const isVideo =
      lowerName.endsWith(".mp4") ||
      lowerName.endsWith(".mov") ||
      lowerName.endsWith(".webm")

    const isAudio =
      lowerName.endsWith(".mp3") ||
      lowerName.endsWith(".wav") ||
      lowerName.endsWith(".ogg") ||
      lowerName.endsWith(".flac") ||
      lowerName.endsWith(".aac") ||
      lowerName.endsWith(".m4a")

    if ((isImage || isVideo || isAudio) && item.id === assetId) {
      return {
        id: item.id,
        name: item.name,
        path: item.id,
        type: isImage ? "image" : isVideo ? "video" : "audio",
      }
    }

    if (item.children && item.children.length > 0) {
      const found = findAssetInTree(item.children, assetId)
      if (found) return found
    }
  }
  return null
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function formatDate(date: Date | null): string {
  if (!date) return "Unknown"
  return date.toLocaleString()
}

export function getFileType(asset: MediaFile | null): string {
  if (!asset) return "Unknown"
  const ext = asset.name.split(".").pop()?.toUpperCase() || ""
  const label = asset.type === "image" ? "Image" : asset.type === "video" ? "Video" : "Audio"
  return `${ext} ${label}`
}

