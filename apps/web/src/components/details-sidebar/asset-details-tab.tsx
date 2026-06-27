"use client"

import { useState } from "react"
import {
  FileType,
  HardDrive,
  Calendar,
  ExternalLink,
  Copy,
  Check,
  Download,
  Trash2,
  Pencil,
  Upload,
  Zap,
  AlertCircle,
} from "lucide-react"
import { CopyInput } from "@/components/ui/copy-input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { MediaFile } from "./types"
import type { VideoStatus } from "@/hooks/use-video-status"
import { formatFileSize, formatDate, getFileType } from "./utils"
import { Spinner } from "@/components/ui/spinner"

interface AssetDetailsTabProps {
  asset: MediaFile
  fileSize: number | null
  optimizedSize: number | null
  createdAt: Date | null
  rawUrl: string
  isDeleting: boolean
  videoStatus?: VideoStatus
  videoProgress?: number
  onCopyUrl: () => void
  onDownload: () => void
  onOpenInNewTab: () => void
  onRename: () => void
  onReplace: () => void
  onDelete: () => void
}

export function AssetDetailsTab({
  asset,
  fileSize,
  optimizedSize,
  createdAt,
  rawUrl,
  isDeleting,
  videoStatus,
  videoProgress = 0,
  onCopyUrl,
  onDownload,
  onOpenInNewTab,
  onRename,
  onReplace,
  onDelete,
}: AssetDetailsTabProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyUrl = () => {
    onCopyUrl()
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Asset Path
          </label>
          <CopyInput value={`/${asset.path}`} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            {asset.type === "video" ? "Original Size" : "Asset Size"}
          </label>
          <div className="text-sm text-muted-foreground">
            {formatFileSize(fileSize)}
          </div>
        </div>

        {asset.type === "video" && (
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Optimized Size (default transformation)
            </label>
            <div className={cn(
              "text-sm flex items-center gap-2",
              optimizedSize && fileSize && optimizedSize > fileSize
                ? "text-destructive"
                : "text-muted-foreground"
            )}>
              {!videoStatus || videoStatus === "unknown" ? (
                <span className="opacity-50">Checking...</span>
              ) : videoStatus === "processing" ? (
                <>
                  <Spinner size={16} className="text-primary" />
                  {videoProgress > 0 ? `${Math.round(videoProgress)}%` : "Processing..."}
                </>
              ) : videoStatus === "ready" && optimizedSize ? (
                formatFileSize(optimizedSize)
              ) : videoStatus === "error" ? (
                <>
                  <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                  <span>Failed</span>
                </>
              ) : (
                "—"
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <FileType className="h-4 w-4" />
            Asset Type
          </label>
          <div className="text-sm text-muted-foreground">
            {getFileType(asset)}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Created At
          </label>
          <div className="text-sm text-muted-foreground">
            {formatDate(createdAt)}
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRename}
            className="gap-2"
          >
            <Pencil className="h-4 w-4" />
            Rename
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onReplace}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Replace
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyUrl}
            className="gap-2"
            disabled={copied}
          >
            {copied ? <Check className="h-4 w-4 stroke-emerald-500" /> : <Copy className="h-4 w-4" />}
            Copy URL
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenInNewTab}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Open
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDownload}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting}
            className="gap-2 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  )
}
