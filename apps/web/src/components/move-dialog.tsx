"use client"

import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Folder } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Button } from "./ui/button"
import { Label } from "./ui/label"
import { cn } from "@/lib/utils"
import type { TreeDataItem } from "./ui/tree-view"

type MoveDialogProps = {
  isOpen: boolean
  item: { id: string; name: string; path: string } | null
  treeData: TreeDataItem[] | undefined
  onClose: () => void
}

function flattenFolders(items: TreeDataItem[], prefix = ""): { name: string; path: string }[] {
  const result: { name: string; path: string }[] = []
  for (const item of items) {
    if (item.children) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      result.push({ name: item.name, path })
      result.push(...flattenFolders(item.children, path))
    }
  }
  return result
}

export function MoveDialog({ isOpen, item, treeData, onClose }: MoveDialogProps) {
  const queryClient = useQueryClient()
  const [targetFolder, setTargetFolder] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const folders = useMemo(() => {
    if (!treeData) return []
    return flattenFolders(treeData).filter((f) => f.path !== item?.path)
  }, [treeData, item?.path])

  useEffect(() => {
    if (item) {
      setTargetFolder("")
      setError("")
    }
  }, [item])

  useEffect(() => {
    if (!isOpen) document.body.style.pointerEvents = ""
  }, [isOpen])

  const close = () => {
    document.body.style.pointerEvents = ""
    onClose()
  }

  const handleSubmit = async () => {
    if (!item) return
    setError("")
    setIsSubmitting(true)
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ""
      const targetPath = targetFolder ? `${targetFolder}/${item.name}` : item.name

      const res = await fetch(`${apiBaseUrl}/storage/move`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePath: item.path, targetPath }),
        credentials: "include",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || data.message || "Failed to move")
      }

      await queryClient.invalidateQueries({ queryKey: ["storage-tree"] })
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen && !!item} onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent className="flex flex-col gap-0 p-0 max-w-2xl [&>button:last-child]:top-3.5">
        <DialogHeader className="contents space-y-0 text-left">
          <DialogTitle className="border-b px-6 py-4 text-base">Move to...</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4 space-y-4">
          {item && (
            <p className="text-xs text-muted-foreground">
              Moving: <code>{item.name}</code>
            </p>
          )}
          <div className="space-y-2">
            <Label>Destination folder</Label>
            {folders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No other folders available</p>
            ) : (
              <div className="max-h-48 overflow-y-auto border rounded-md p-1 space-y-0.5">
                <button
                  onClick={() => setTargetFolder("")}
                  className={cn(
                    "flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent",
                    targetFolder === "" && "bg-accent"
                  )}
                  type="button"
                >
                  <Folder className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">/ (root)</span>
                </button>
                {folders.map((f) => (
                  <button
                    key={f.path}
                    onClick={() => setTargetFolder(f.path)}
                    className={cn(
                      "flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent",
                      targetFolder === f.path && "bg-accent"
                    )}
                    type="button"
                  >
                    <Folder className="size-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{f.path}</span>
                  </button>
                ))}
              </div>
            )}
            {targetFolder && (
              <p className="text-xs text-muted-foreground">
                Will move to: <code>{targetFolder}/{item?.name}</code>
              </p>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Moving..." : "Move"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
