"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

type RenameDialogProps = {
  isOpen: boolean
  item: { id: string; name: string; path: string } | null
  isFolder: boolean
  onClose: () => void
}

export function RenameDialog({ isOpen, item, isFolder, onClose }: RenameDialogProps) {
  const queryClient = useQueryClient()
  const nameWithoutExt = item && !isFolder ? item.name.replace(/\.[^.]+$/, "") : ""
  const ext = item && !isFolder ? item.name.slice(nameWithoutExt.length) : ""
  const [newName, setNewName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (item) {
      setNewName(isFolder ? item.name : item.name.replace(/\.[^.]+$/, ""))
      setError("")
    }
  }, [item, isFolder])

  useEffect(() => {
    if (!isOpen) document.body.style.pointerEvents = ""
  }, [isOpen])

  const close = () => {
    document.body.style.pointerEvents = ""
    onClose()
  }

  const handleSubmit = async () => {
    if (!item || !newName.trim()) return
    setError("")
    setIsSubmitting(true)
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ""
      const parentDir = item.path.includes("/")
        ? item.path.substring(0, item.path.lastIndexOf("/"))
        : ""
      const newFullName = isFolder ? newName.trim() : `${newName.trim()}${ext}`
      const targetPath = parentDir ? `${parentDir}/${newFullName}` : newFullName

      const res = await fetch(`${apiBaseUrl}/storage/move`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePath: item.path, targetPath }),
        credentials: "include",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || data.message || "Failed to rename")
      }

      await queryClient.invalidateQueries({ queryKey: ["storage-tree"] }); queryClient.invalidateQueries({ queryKey: ["server-config"] })
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
          <DialogTitle className="border-b px-6 py-4 text-base">Rename</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4 space-y-4">

          <div className="space-y-2">
            <Label htmlFor="rename-input">
              {isFolder ? "Folder name" : "File name"}
            </Label>
            <Input
              id="rename-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!isFolder && (
            <p className="text-xs text-muted-foreground">
              Extension: <code>{ext}</code>
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !newName.trim()}>
              {isSubmitting ? "Renaming..." : "Rename"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
