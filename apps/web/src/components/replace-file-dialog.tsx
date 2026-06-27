"use client"

import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Button } from "./ui/button"

type ReplaceFileDialogProps = {
  isOpen: boolean
  item: { id: string; name: string; path: string } | null
  onClose: () => void
  onSuccess?: () => void
}

type Notify = { type: "uploading" | "done"; error?: string } | null

// ponytail: inline notification pill instead of a toast library, matches DnD upload pattern
export function ReplaceFileDialog({ isOpen, item, onClose, onSuccess }: ReplaceFileDialogProps) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [notify, setNotify] = useState<Notify>(null)

  useEffect(() => {
    if (isOpen) setNotify(null)
  }, [isOpen])

  const origExt = item ? `.${item.name.split(".").pop()}` : ""

  const close = () => {
    document.body.style.pointerEvents = ""
    onClose()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    if (f && origExt) {
      const newExt = `.${f.name.split(".").pop()?.toLowerCase()}`
      if (newExt !== origExt) {
        setError(`Format must match: ${origExt}`)
        setFile(null)
        if (inputRef.current) inputRef.current.value = ""
        return
      }
    }
    setFile(f)
    setError("")
  }

  const handleSubmit = async () => {
    if (!item || !file) return
    setError("")
    setIsSubmitting(true)
    setNotify({ type: "uploading" })
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ""
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch(`${apiBaseUrl}/storage/replace/${item.path}`, {
        method: "PUT",
        body: formData,
        credentials: "include",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || data.message || "Failed to replace file")
      }

      await queryClient.invalidateQueries({ queryKey: ["storage-tree"] }); queryClient.invalidateQueries({ queryKey: ["server-config"] })
      onSuccess?.()
      close()
      setNotify({ type: "done" })
      setTimeout(() => setNotify(null), 2000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      close()
      setNotify({ type: "done", error: msg })
      setTimeout(() => setNotify(null), 3000)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={isOpen && !!item} onOpenChange={(open) => { if (!open) close() }}>
        <DialogContent className="flex flex-col gap-0 p-0 max-w-2xl [&>button:last-child]:top-3.5">
          <DialogHeader className="contents space-y-0 text-left">
            <DialogTitle className="border-b px-6 py-4 text-base">Replace File</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            {item && (
              <p className="text-sm text-muted-foreground">
                Replacing: <code>{item.name}</code>
              </p>
            )}
            <div className="space-y-2">
              <input
                ref={inputRef}
                type="file"
                onChange={handleFileChange}
                accept={origExt}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={close}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || !file}>
                {isSubmitting ? "Replacing..." : "Replace"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {notify && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border bg-background text-sm animate-in slide-in-from-top-2">
          {notify.type === "uploading" ? (
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Replacing file…
            </span>
          ) : notify.error ? (
            <span className="flex items-center gap-2 text-destructive">✕ {notify.error}</span>
          ) : (
            <span className="flex items-center gap-2 text-green-600 dark:text-green-400">✓ File replaced</span>
          )}
        </div>
      )}
    </>
  )
}
