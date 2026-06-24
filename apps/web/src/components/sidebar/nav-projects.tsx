"use client"

import { useState, useEffect } from "react"
import { TreeView } from "@/components/ui/tree-view"
import { Skeleton } from "@/components/ui/skeleton"
import { useStorageTree } from "@/hooks/use-storage-tree"
import {
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar"
import { RenameDialog } from "@/components/rename-dialog"
import { MoveDialog } from "@/components/move-dialog"
import type { TreeDataItem } from "@/components/ui/tree-view"

type MediaFile = {
  id: string
  name: string
  path: string
  type: "image" | "video"
}

type ContextMenuState = {
  item: TreeDataItem
  isFolder: boolean
  x: number
  y: number
}

function TreeSkeleton() {
  return (
    <div className="space-y-1 px-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex items-center gap-2 pl-4">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex items-center gap-2 pl-4">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex items-center gap-2 pl-4">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-36" />
      </div>
    </div>
  )
}

interface NavProjectsProps {
  onMediaSelect?: (media: MediaFile) => void
}

export function NavProjects({ onMediaSelect }: NavProjectsProps) {
  const { data, isLoading, error } = useStorageTree()
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [renameItem, setRenameItem] = useState<ContextMenuState | null>(null)
  const [moveItem, setMoveItem] = useState<ContextMenuState | null>(null)

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    document.addEventListener("click", close)
    return () => document.removeEventListener("click", close)
  }, [contextMenu])

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Assets</SidebarGroupLabel>
      {isLoading && <TreeSkeleton />}
      {error && (
        <p className="text-sm text-red-600 px-2">
          {error instanceof Error ? error.message : "Failed to load storage"}
        </p>
      )}
      {!isLoading && !error && data && (
        <TreeView
          data={data}
          expandAll
          onMediaSelect={onMediaSelect}
          onContextMenu={(item, e) => {
            e.preventDefault()
            setContextMenu({ item, isFolder: !!item.children, x: e.clientX, y: e.clientY })
          }}
        />
      )}

      {contextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null) }}
        >
          <div
            className="absolute bg-popover text-popover-foreground rounded-md border p-1 shadow-md min-w-[8rem]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => { document.body.style.pointerEvents = ""; setRenameItem(contextMenu); setContextMenu(null) }}
            >
              Rename
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => { document.body.style.pointerEvents = ""; setMoveItem(contextMenu); setContextMenu(null) }}
            >
              Move to...
            </button>
          </div>
        </div>
      )}

      <RenameDialog
        isOpen={!!renameItem}
        item={renameItem ? { id: renameItem.item.id, name: renameItem.item.name, path: renameItem.item.id } : null}
        isFolder={renameItem?.isFolder ?? false}
        onClose={() => setRenameItem(null)}
      />
      <MoveDialog
        isOpen={!!moveItem}
        item={moveItem ? { id: moveItem.item.id, name: moveItem.item.name, path: moveItem.item.id } : null}
        treeData={data}
        onClose={() => setMoveItem(null)}
      />
    </SidebarGroup>
  )
}
