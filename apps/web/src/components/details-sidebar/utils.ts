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

    const isText =
      lowerName.endsWith(".pdf")

    if ((isImage || isVideo || isAudio || isText) && item.id === assetId) {
      return {
        id: item.id,
        name: item.name,
        path: item.id,
        type: isImage ? "image" : isVideo ? "video" : isAudio ? "audio" : "other",
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
  const label = asset.type === "image" ? "Image" : asset.type === "video" ? "Video" : asset.type === "audio" ? "Audio" : "Document"
  return `${ext} ${label}`
}

export function encodeAssetPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/")
}

/** Resolve a relative public media URL to an absolute URL using the current origin. */
export function toAbsolutePublicUrl(url: string): string {
  if (!url) return url
  if (/^https?:\/\//i.test(url)) return url
  if (typeof window === "undefined") return url
  return `${window.location.origin}${url.startsWith("/") ? url : `/${url}`}`
}

/** Public URL for the original file (GET /download/{path} on API, or /api/download/{path} via nginx). */
export function buildDownloadUrl(
  apiBaseUrl: string,
  transformBaseUrl: string,
  path: string,
  suffix = "",
): string {
  const encoded = encodeAssetPath(path)
  // Docker full-stack: dashboard uses /api prefix, nginx proxies /api/download → API
  if (apiBaseUrl.endsWith("/api")) {
    return `${apiBaseUrl}/download/${encoded}${suffix}`
  }
  const base = transformBaseUrl || apiBaseUrl.replace(/\/api$/, "")
  return `${base}/download/${encoded}${suffix}`
}

/** Inline view URL via the transform endpoint (GET /t/{path}). */
export function buildViewUrl(transformBaseUrl: string, path: string, suffix = ""): string {
  return `${transformBaseUrl}/t/${path}${suffix}`
}

/** Fetch original file and trigger a browser download (works reliably same-origin). */
export async function downloadOriginalFile(url: string, filename: string): Promise<void> {
  const absoluteUrl = toAbsolutePublicUrl(url)
  const response = await fetch(absoluteUrl, { credentials: "include" })
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`)
  }
  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(blobUrl)
}

