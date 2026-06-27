"use client"

import { useEffect, useState, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Tabs, TabsList, TabsTab, TabsContent } from "./ui/tabs"

type BatchRenameDialogProps = {
  isOpen: boolean
  items: { name: string; path: string }[] | null
  onClose: () => void
}

type Mode = "format" | "replace" | "add"

export function BatchRenameDialog({ isOpen, items, onClose }: BatchRenameDialogProps) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<Mode>("format")
  const [prefix, setPrefix] = useState("")
  const [startNum, setStartNum] = useState(1)
  const [digits, setDigits] = useState(3)
  const [findText, setFindText] = useState("")
  const [replaceText, setReplaceText] = useState("")
  const [addText, setAddText] = useState("")
  const [addBefore, setAddBefore] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (items && items.length > 0) {
      setPrefix("")
      setStartNum(1)
      setDigits(3)
      setFindText("")
      setReplaceText("")
      setAddText("")
      setAddBefore(true)
      setMode("format")
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

  const renameJobs = useMemo(() => {
    if (!items) return []
    return items.map((item, i) => {
      const dot = item.name.lastIndexOf(".")
      const base = dot > 0 ? item.name.slice(0, dot) : item.name
      const ext = dot > 0 ? item.name.slice(dot) : ""
      let newName
      if (mode === "format") {
        newName = `${prefix}${prefix ? "_" : ""}${String(startNum + i).padStart(digits, "0")}${ext}`
      } else if (mode === "replace") {
        newName = findText ? `${base.split(findText).join(replaceText)}${ext}` : item.name
      } else {
        newName = addBefore ? `${addText}${base}${ext}` : `${base}${addText}${ext}`
      }
      return { path: item.path, newName }
    })
  }, [items, mode, prefix, startNum, digits, findText, replaceText, addText, addBefore])

  const handleSubmit = async () => {
    if (!items || items.length === 0) return
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
      await queryClient.invalidateQueries({ queryKey: ["storage-tree"] }); queryClient.invalidateQueries({ queryKey: ["server-config"] })
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  const isValid =
    mode === "format" ? !!prefix.trim() :
    mode === "replace" ? !!findText :
    !!addText

  return (
    <Dialog open={isOpen && !!items} onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent className="flex flex-col gap-0 p-0 max-w-2xl [&>button:last-child]:top-3.5">
        <DialogHeader className="contents space-y-0 text-left">
          <DialogTitle className="border-b px-6 py-4 text-base">Batch Rename</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {items?.length ?? 0} file{items?.length !== 1 ? "s" : ""}
            </p>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList variant="underline">
              <TabsTab value="format">Format</TabsTab>
              <TabsTab value="replace">Replace</TabsTab>
              <TabsTab value="add">Add Text</TabsTab>
            </TabsList>

            <TabsContent value="format" className="space-y-4 mt-2">
              <div className="flex gap-3 items-end">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="prefix">Prefix</Label>
                  <Input id="prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g. Vacation" autoFocus={mode === "format"} />
                </div>
                <div className="space-y-2 w-24">
                  <Label htmlFor="start-num">Start</Label>
                  <Input id="start-num" type="number" min={0} value={startNum} onChange={(e) => setStartNum(Number(e.target.value))} />
                </div>
                <div className="space-y-2 w-24">
                  <Label htmlFor="digits">Digits</Label>
                  <Input id="digits" type="number" min={1} max={6} value={digits} onChange={(e) => setDigits(Math.max(1, Math.min(6, Number(e.target.value))))} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="replace" className="space-y-4 mt-2">
              <div className="flex gap-3 items-end">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="find">Find</Label>
                  <Input id="find" value={findText} onChange={(e) => setFindText(e.target.value)} placeholder="Text to find" autoFocus={mode === "replace"} />
                </div>
                <div className="space-y-2 flex-1">
                  <Label htmlFor="replace">Replace</Label>
                  <Input id="replace" value={replaceText} onChange={(e) => setReplaceText(e.target.value)} placeholder="(leave empty to remove)" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="add" className="space-y-4 mt-2">
              <div className="flex gap-3 items-end">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="add-text">Text to add</Label>
                  <Input id="add-text" value={addText} onChange={(e) => setAddText(e.target.value)} placeholder="e.g. Draft_" autoFocus={mode === "add"} />
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <div className="flex h-9">
                    <Button type="button" variant={addBefore ? "default" : "outline"} size="sm" className="rounded-r-none" onClick={() => setAddBefore(true)}>Before</Button>
                    <Button type="button" variant={!addBefore ? "default" : "outline"} size="sm" className="rounded-l-none" onClick={() => setAddBefore(false)}>After</Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {isValid && items && items.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto border rounded p-2">
              {renameJobs.slice(0, 20).map((job, i) => (
                <div key={i} className="truncate">{job.path.split("/").pop()} → {job.newName}</div>
              ))}
              {renameJobs.length > 20 && <div className="text-muted-foreground">...and {renameJobs.length - 20} more</div>}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !isValid}>
              {isSubmitting ? "Renaming..." : "Rename"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
