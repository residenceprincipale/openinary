"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Button } from "./ui/button"
import { X } from "lucide-react"

type Permission = { user_id: string; user_email: string | null; user_name: string | null }

type UserOption = { id: string; name: string; email: string }

type ShareDialogProps = {
  isOpen: boolean
  folderPath: string
  onClose: () => void
}

export function ShareDialog({ isOpen, folderPath, onClose }: ShareDialogProps) {
  const queryClient = useQueryClient()
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isOpen) { document.body.style.pointerEvents = ""; return }
    setSelectedUserId(""); setError("")
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ""
    setLoading(true)
    Promise.all([
      fetch(`${apiBaseUrl}/storage/permissions?path=${encodeURIComponent(folderPath)}`, { credentials: "include" }).then(r => r.json()),
      fetch(`${apiBaseUrl}/users/list`, { credentials: "include" }).then(r => r.json()),
    ])
      .then(([permData, userData]) => {
        setPermissions(permData.data || [])
        setUsers(Array.isArray(userData) ? userData : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isOpen, folderPath])

  const close = () => { document.body.style.pointerEvents = ""; onClose() }

  const addPermission = async () => {
    if (!selectedUserId) return
    setError("")
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ""
    try {
      const res = await fetch(`${apiBaseUrl}/storage/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath, userId: selectedUserId }),
        credentials: "include",
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Failed to add permission")
      }
      setSelectedUserId("")
      const updated = await fetch(`${apiBaseUrl}/storage/permissions?path=${encodeURIComponent(folderPath)}`, { credentials: "include" }).then(r => r.json())
      setPermissions(updated.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    }
  }

  const removePermission = async (userId: string) => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ""
    try {
      await fetch(`${apiBaseUrl}/storage/permissions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath, userId }),
        credentials: "include",
      })
      setPermissions((prev) => prev.filter((p) => p.user_id !== userId))
    } catch {}
  }

  const availableUsers = users.filter(
    u => !permissions.some(p => p.user_id === u.id)
  )

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent className="flex flex-col gap-0 p-0 max-w-md [&>button:last-child]:top-3.5">
        <DialogHeader className="contents space-y-0 text-left">
          <DialogTitle className="border-b px-6 py-4 text-base">Share &quot;{folderPath.split("/").pop()}&quot;</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4 space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-auto">
              {permissions.length === 0 && (
                <p className="text-sm text-muted-foreground">No permissions set.</p>
              )}
              {permissions.map((p) => (
                <div key={p.user_id} className="flex items-center justify-between gap-2 py-1">
                  <div className="text-sm truncate flex-1">
                    <span>{p.user_email || p.user_name || p.user_id}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => removePermission(p.user_id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium">Add user</p>
            <div className="flex gap-2">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select a user...</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
              <Button onClick={addPermission} disabled={!selectedUserId}>Add</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
