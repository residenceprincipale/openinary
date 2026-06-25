"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

type BatchRenameDialogProps = {
  isOpen: boolean
  items: { name: string; path: string }[] | null
  onClose: () => void
}

export function BatchRenameDialog({ isOpen, items, onClose }: BatchRenameDialogProps) {
  const queryClient = useQueryClient()
  const [prefix, setPrefix] = useState("")
  const [startNum, setStartNum] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (items && items.length > 0) {
      setPrefix("")
      setStartNum(1)
      setError("")
    }
  }, [items])

  useEffect(() => {
    if (!isOpen) document.body.style.pointerEvents = ""
  }, [isOpen])

  const close = () => {
    document.body.style.pointerEvents = ""
    onClose()
  }

  const renameJobs = items?.map((item, i) => {
    const dot = item.name.lastIndexOf(".")
    const ext = dot > 0 ? item.name.slice(dot) : ""
    return {
      path: item.path,
      newName: `${prefix}_${String(startNum + i).padStart(3, "0")}${ext}`,
    }
  }) ?? []

  const handleSubmit = async () => {
    if (!items || items.length === 0 || !prefix.trim()) return
    setError("")
    setIsSubmitting(true)
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ""
      const results = await Promise.allSettled(
        renameJobs.map((job) => {
          const parentDir = job.path.includes("/")
            ? job.path.substring(0, job.path.lastIndexOf("/"))
            : ""
          const targetPath = parentDir ? `${parentDir}/${job.newName}` : job.newName
          return fetch(`${apiBaseUrl}/storage/move`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourcePath: job.path, targetPath }),
            credentials: "include",
          })
        }),
      )

      const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok))
      if (failed.length > 0) {
        throw new Error(`${failed.length} of ${items.length} renames failed`)
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
    <Dialog open={isOpen && !!items} onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent className="flex flex-col gap-0 p-0 max-w-2xl [&>button:last-child]:top-3.5">
        <DialogHeader className="contents space-y-0 text-left">
          <DialogTitle className="border-b px-6 py-4 text-base">Batch Rename</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4 space-y-4">
          {items && (
            <p className="text-xs text-muted-foreground">
              Renaming {items.length} file{items.length !== 1 ? "s" : ""}
            </p>
          )}
          <div className="flex gap-3 items-end">
            <div className="space-y-2 flex-1">
              <Label htmlFor="prefix">Name prefix</Label>
              <Input
                id="prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="e.g. Vacation"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                autoFocus
              />
            </div>
            <div className="space-y-2 w-24">
              <Label htmlFor="start-num">Start at</Label>
              <Input
                id="start-num"
                type="number"
                min={0}
                value={startNum}
                onChange={(e) => setStartNum(Number(e.target.value))}
              />
            </div>
          </div>
          {prefix.trim() && items && items.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto border rounded p-2">
              {renameJobs.slice(0, 20).map((job, i) => (
                <div key={i} className="truncate">
                  {job.path.split("/").pop()} → {job.newName}
                </div>
              ))}
              {renameJobs.length > 20 && (
                <div className="text-muted-foreground">...and {renameJobs.length - 20} more</div>
              )}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !prefix.trim()}>
              {isSubmitting ? "Renaming..." : "Rename"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
