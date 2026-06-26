"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  FileAudio, FileImage, FileVideo, File, ArrowUpRight, Folder,
  CheckCircle, Circle, Trash2, Pencil,
} from "lucide-react";
import { useQueryState } from "nuqs";
import { useStorageTree } from "@/hooks/use-storage-tree";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { preloadMedia } from "@/hooks/use-preload-media";
import { VideoThumbnail } from "@/components/video-thumbnail";
import type { TreeDataItem } from "@/components/ui/tree-view";
import UploadButtonWithDialog from "./upload-button-with-dialog";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { RenameDialog } from "@/components/rename-dialog";
import { MoveDialog } from "@/components/move-dialog";
import { BatchRenameDialog } from "@/components/batch-rename-dialog";

type MediaFile = {
  id: string;
  name: string;
  path: string;
  type: "image" | "video" | "audio" | "other";
};

type FolderItem = {
  id: string;
  name: string;
  path: string;
};

function getFolderInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function getFolderImages(
  items: TreeDataItem[],
  folderPath: string[],
  limit = 4,
): string[] {
  let currentItems = items;
  for (const seg of folderPath) {
    const found = currentItems.find((i) => i.name === seg);
    if (!found?.children) return [];
    currentItems = found.children;
  }
  const images: string[] = [];
  for (const item of currentItems) {
    if (images.length >= limit) break;
    if (!item.children) {
      const lower = item.name.toLowerCase();
      const isImage = [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".gif",
        ".avif",
        ".psd",
      ].some((ext) => lower.endsWith(ext));
      if (isImage) {
        images.push(item.id);
      }
    }
  }
  return images;
}

// Find items in a specific folder path
function findItemsInPath(
  items: TreeDataItem[],
  targetPath: string[],
): { folders: FolderItem[]; files: MediaFile[] } {
  const folders: FolderItem[] = [];
  const files: MediaFile[] = [];

  // Navigate to the target folder
  let currentItems = items;
  for (const pathSegment of targetPath) {
    const found = currentItems.find((item) => item.name === pathSegment);
    if (!found || !found.children) {
      return { folders, files }; // Path doesn't exist
    }
    currentItems = found.children;
  }

  // Process items in the current folder
  for (const item of currentItems) {
    const lowerName = item.name.toLowerCase();
    const isFolder = !!item.children;

    if (isFolder) {
      const folderPath =
        targetPath.length > 0
          ? `${targetPath.join("/")}/${item.name}`
          : item.name;
      folders.push({
        id: item.id,
        name: item.name,
        path: folderPath,
      });
    } else {
      // Check if it's a media file
      const isImage =
        lowerName.endsWith(".jpg") ||
        lowerName.endsWith(".jpeg") ||
        lowerName.endsWith(".png") ||
        lowerName.endsWith(".webp") ||
        lowerName.endsWith(".gif") ||
        lowerName.endsWith(".avif") ||
        lowerName.endsWith(".psd");

      const isVideo =
        lowerName.endsWith(".mp4") ||
        lowerName.endsWith(".mov") ||
        lowerName.endsWith(".webm");

      const isAudio =
        lowerName.endsWith(".mp3") ||
        lowerName.endsWith(".wav") ||
        lowerName.endsWith(".ogg") ||
        lowerName.endsWith(".flac") ||
        lowerName.endsWith(".aac") ||
        lowerName.endsWith(".m4a");

      const isDoc =
        lowerName.endsWith(".zip") ||
        lowerName.endsWith(".pdf");

      if (isImage || isVideo || isAudio || isDoc) {
        files.push({
          id: item.id,
          name: item.name,
          path: item.id,
          type: isImage ? "image" : isVideo ? "video" : isAudio ? "audio" : "other",
        });
      }
    }
  }

  // Sort: folders first, then files
  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return { folders, files };
}

interface MediaGridProps {
  onMediaSelect: (media: MediaFile) => void;
  sidebarOpen?: boolean;
  onUploadClick?: () => void;
}

export function MediaGrid({
  onMediaSelect,
  sidebarOpen = false,
}: MediaGridProps) {
  const { data: treeData, isLoading, error } = useStorageTree();
  const queryClient = useQueryClient();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [gridDragOver, setGridDragOver] = useState(false);
  const [folderPath, setFolderPath] = useQueryState("folder");
  const [renameItem, setRenameItem] = useState<{
    id: string
    name: string
    path: string
    isFolder: boolean
  } | null>(null);
  const [moveItem, setMoveItem] = useState<{
    id: string
    name: string
    path: string
  } | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [batchMoveItems, setBatchMoveItems] = useState<{id: string; name: string; path: string}[] | null>(null);
  const [batchRenameItems, setBatchRenameItems] = useState<{name: string; path: string}[] | null>(null);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [selectionBox, setSelectionBox] = useState<{left: number; top: number; width: number; height: number} | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{type: 'uploading' | 'done'; count: number; error?: string} | null>(null);

  const toggleSelection = useCallback((path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedPaths(new Set()), [])

  const selectedCount = selectedPaths.size

  const doBatchDelete = useCallback(async () => {
    const count = selectedPaths.size
    if (!count) return
    const msg = count === 1 ? "Delete this file?" : `Delete ${count} files?`
    if (!confirm(msg)) return
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ""
    await Promise.allSettled(
      [...selectedPaths].map((path) => {
        const encoded = path.split("/").map(encodeURIComponent).join("/")
        return fetch(`${apiBaseUrl}/storage/${encoded}`, {
          method: "DELETE", credentials: "include",
        })
      }),
    )
    await queryClient.invalidateQueries({ queryKey: ["storage-tree"] })
    clearSelection()
  }, [selectedPaths, queryClient, clearSelection])

  const doMove = async (sourcePath: string, targetFolder: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ""
    const name = sourcePath.split('/').pop()
    const targetPath = targetFolder ? `${targetFolder}/${name}` : name
    if (targetPath === sourcePath) return
    try {
      await fetch(`${baseUrl}/storage/move`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePath, targetPath }),
        credentials: "include",
      })
    } catch {}
    queryClient.invalidateQueries({ queryKey: ["storage-tree"] })
  }

  const getItemPath = (name: string): string => {
    return pathSegments.length > 0
      ? `${pathSegments.join("/")}/${name}`
      : name
  }

  // Parse folder path from URL - must be called before any conditional returns
  const pathSegments = useMemo(() => {
    return folderPath && folderPath.length > 0
      ? folderPath.split("/").filter(Boolean)
      : [];
  }, [folderPath]);

  // Get items in current folder - must be called before any conditional returns
  const { folders, files } = useMemo(() => {
    if (!treeData) return { folders: [], files: [] };
    return findItemsInPath(treeData, pathSegments);
  }, [treeData, pathSegments]);

  const allItems = useMemo(() => [
    ...folders.map(f => ({ path: f.path, name: f.name })),
    ...files.map(f => ({ path: getItemPath(f.name), name: f.name })),
  ], [folders, files])

  // ponytail: shift-click range, no ctrl+click toggle-on-main-click needed yet
  const selectRange = useCallback((fromIdx: number, toIdx: number) => {
    setSelectedPaths(prev => {
      const next = new Set(prev)
      const start = Math.min(fromIdx, toIdx)
      const end = Math.max(fromIdx, toIdx)
      for (let i = start; i <= end; i++) next.add(allItems[i].path)
      return next
    })
  }, [allItems])

  const handleItemClick = useCallback((item: { path: string; name: string }, index: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedIndex !== null) {
      e.preventDefault()
      selectRange(lastClickedIndex, index)
    } else if (e.metaKey || e.ctrlKey) {
      e.preventDefault()
      toggleSelection(item.path)
    } else {
      setSelectedPaths(new Set())
    }
    setLastClickedIndex(index)
  }, [lastClickedIndex, selectRange, toggleSelection])

  // ponytail: clears selection on folder nav — keeps UX simple
  useEffect(() => { clearSelection() }, [folderPath, clearSelection])

  // ponytail: Cmd+A selects all visible items, skips if input focused
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        setSelectedPaths(new Set(allItems.map(i => i.path)))
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [allItems])

  const uploadFiles = useCallback(async (files: File[], folder: string) => {
    const formData = new FormData()
    if (folder) formData.append("folder", folder)
    files.forEach(f => formData.append("files", f))
    setUploadStatus({ type: 'uploading', count: files.length })
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ""
      const r = await fetch(`${apiUrl}/upload`, { method: "POST", body: formData, credentials: "include" })
      const d = await r.json()
      if (d.success) {
        if (d.errors?.length) {
          const msgs = d.errors.map((e: {error: string}) => e.error).join('; ')
          setUploadStatus({ type: 'done', count: files.length, error: msgs })
        } else {
          setUploadStatus({ type: 'done', count: files.length })
        }
        queryClient.invalidateQueries({ queryKey: ["storage-tree"] })
      } else {
        const error = d.error || d.errors?.map((e: {error: string}) => e.error).join('; ') || 'Upload failed'
        setUploadStatus({ type: 'done', count: 0, error })
      }
    } catch (e) {
      setUploadStatus({ type: 'done', count: 0, error: 'Network error during upload' })
    }
    setTimeout(() => setUploadStatus(null), 3000)
  }, [queryClient])

  // Adjust grid columns based on sidebar state
  const gridColsClass = sidebarOpen
    ? "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

  if (isLoading) {
    return (
      <div className={`grid ${gridColsClass} gap-4`}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Failed to load media files. Please try again.</p>
      </div>
    );
  }

  if (!treeData || treeData.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileImage />
            </EmptyMedia>
            <EmptyTitle>No Media Files Yet</EmptyTitle>
            <EmptyDescription>
              You haven&apos;t uploaded any media files yet. Get started by
              uploading your first image, video, or audio file.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex gap-2">
              <UploadButtonWithDialog />
              <Button variant="outline" asChild>
                <a
                  href="https://docs.openinary.dev/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Docs
                </a>
              </Button>
            </div>
          </EmptyContent>
          <Button
            variant="link"
            asChild
            className="text-muted-foreground"
            size="sm"
          >
            <a
              href="https://docs.openinary.dev/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn More <ArrowUpRight className="h-4 w-4" />
            </a>
          </Button>
        </Empty>
      </div>
    );
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  // Use dedicated transform base URL (empty in Docker, falls back to apiBaseUrl without /api)
  const transformBaseUrl =
    process.env.NEXT_PUBLIC_TRANSFORM_BASE_URL !== undefined
      ? process.env.NEXT_PUBLIC_TRANSFORM_BASE_URL
      : apiBaseUrl.replace(/\/api$/, "");

  const handleFolderClick = (folderPath: string) => {
    setFolderPath(folderPath);
  };

  // Preload preview when hovering over a media item
  const handleMediaHover = (media: MediaFile) => {
    if (media.type === "audio" || media.type === "other") return;
    const previewUrl =
      media.type === "image"
        ? `${transformBaseUrl}/t/w_500,h_500,q_80/${media.path}`
        : `${transformBaseUrl}/t/${media.path}`;
    preloadMedia(previewUrl, media.type);
  };

  const currentFolder = pathSegments.join("/")

  const gridHandlers = {
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes("application/x-openinary-move") || e.dataTransfer.types.includes("Files")) {
        e.preventDefault()
        setGridDragOver(true)
      }
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setGridDragOver(false)
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setGridDragOver(false)
      // Handle file drops (direct upload)
      if (e.dataTransfer.files.length > 0) {
        uploadFiles(Array.from(e.dataTransfer.files), currentFolder)
        return
      }
      const src = e.dataTransfer.getData("application/x-openinary-move")
      if (src) doMove(src, currentFolder)
    },
  }

  // ponytail: rectangle drag-select, O(n) intersection on mouseup
  const gridMouseHandlers = {
    onMouseDown: (e: React.MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-item-path], button, a, [role="button"]')) {
        e.preventDefault()
        const container = e.currentTarget as HTMLElement
        const startX = e.clientX
        const startY = e.clientY

        const onMove = (e: MouseEvent) => {
          const rect = container.getBoundingClientRect()
          setSelectionBox({
            left: Math.min(startX, e.clientX) - rect.left,
            top: Math.min(startY, e.clientY) - rect.top,
            width: Math.abs(e.clientX - startX),
            height: Math.abs(e.clientY - startY),
          })
        }

        const onUp = (e: MouseEvent) => {
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
          setSelectionBox(null)

          if (Math.abs(e.clientX - startX) < 5 && Math.abs(e.clientY - startY) < 5) {
            clearSelection()
            return
          }

          const selLeft = Math.min(startX, e.clientX)
          const selTop = Math.min(startY, e.clientY)
          const selRight = Math.max(startX, e.clientX)
          const selBottom = Math.max(startY, e.clientY)

          const selected: string[] = []
          container.querySelectorAll('[data-item-path]').forEach((el) => {
            const r = el.getBoundingClientRect()
            if (selLeft < r.right && selRight > r.left && selTop < r.bottom && selBottom > r.top)
              selected.push(el.getAttribute('data-item-path')!)
          })

          setSelectedPaths(new Set(selected))
        }

        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
      }
    },
  }

  if (folders.length === 0 && files.length === 0) {
    return (
      <div className="relative" {...gridMouseHandlers} {...gridHandlers}>
      <div className={cn("flex flex-col items-center justify-center h-64 rounded-lg border-2 border-dashed transition-colors text-muted-foreground space-y-4 select-none", gridDragOver && "border-primary bg-accent/30 outline-dashed outline-2 outline-primary outline-offset-2")}>
        <FileAudio className="h-12 w-12 opacity-50" />
        <p>This folder is empty.</p>
      </div>
      {uploadStatus && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border bg-background text-sm animate-in slide-in-from-top-2">
          {uploadStatus.type === 'uploading' ? (
            <span className="flex items-center gap-2"><span className="size-3 rounded-full border-2 border-primary border-t-transparent animate-spin" /> Uploading {uploadStatus.count} file{uploadStatus.count > 1 ? 's' : ''}…</span>
          ) : uploadStatus.error ? (
            <span className="flex items-center gap-2 text-destructive">✕ {uploadStatus.error}</span>
          ) : (
            <span className="flex items-center gap-2 text-green-600 dark:text-green-400">✓ Uploaded {uploadStatus.count} file{uploadStatus.count > 1 ? 's' : ''}</span>
          )}
        </div>
      )}
      </div>
    );
  }

  return (
    <div className={cn("relative h-full", gridDragOver && "outline-dashed outline-2 outline-primary outline-offset-2 rounded-lg")} {...gridMouseHandlers} {...gridHandlers}>
    <div className={cn(`grid ${gridColsClass} gap-4 select-none`)} >
      {/* Render folders */}
      {folders.map((folder, i) => {
        const isHovered = hoveredId === folder.id;
        const isSelected = selectedPaths.has(folder.path)
        const folderImages = treeData
          ? getFolderImages(treeData, [...pathSegments, folder.name])
          : [];
        return (
          <ContextMenu key={folder.id}>
            <ContextMenuTrigger asChild>
              <div
                data-item-path={folder.path}
                className={cn(
                  "group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/50 cursor-pointer transition-all hover:border-primary/30 hover:shadow-md",
                   dragOverId === folder.id && "outline-dashed outline-2 outline-primary outline-offset-2",
                   isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                )}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey) {
                    handleItemClick({ path: folder.path, name: folder.name }, i, e)
                  } else {
                    handleFolderClick(folder.path)
                  }
                }}
                onMouseEnter={() => setHoveredId(folder.id)}
                onMouseLeave={() => setHoveredId(null)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-openinary-move", folder.path)
                  e.dataTransfer.effectAllowed = "move"
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes("application/x-openinary-move")) {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "move"
                    setDragOverId(folder.id)
                  }
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return
                  setDragOverId(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOverId(null)
                  const src = e.dataTransfer.getData("application/x-openinary-move")
                  if (src) doMove(src, folder.path)
                }}
              >
            {/* Folder selection checkbox */}
            <div
              className={cn(
                "absolute top-2 left-2 z-10 transition-opacity",
                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
              onClick={(e) => { e.stopPropagation(); toggleSelection(folder.path) }}
            >
              {isSelected ? (
                <CheckCircle className="size-5 text-primary" />
              ) : (
                <Circle className="size-5 text-white/80 drop-shadow-md" />
              )}
            </div>
            <div className="relative w-full h-full">
              {folderImages.length === 4 ? (
                <div className="grid grid-cols-2 gap-0.5 w-full h-full">
                  {folderImages.map((src, i) => (
                    <div key={i} className="overflow-hidden">
                      <img
                        src={`${transformBaseUrl}/t/w_250,h_250,q_70/${src}`}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              ) : folderImages.length === 3 ? (
                <div className="grid grid-cols-2 gap-0.5 w-full h-full">
                  <div className="overflow-hidden row-span-2">
                    <img
                      src={`${transformBaseUrl}/t/w_250,h_500,q_70/${folderImages[0]}`}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  {folderImages.slice(1).map((src, i) => (
                    <div key={i} className="overflow-hidden">
                      <img
                        src={`${transformBaseUrl}/t/w_250,h_250,q_70/${src}`}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              ) : folderImages.length === 2 ? (
                <div className="grid grid-cols-2 gap-0.5 w-full h-full">
                  {folderImages.map((src, i) => (
                    <div key={i} className="overflow-hidden">
                      <img
                        src={`${transformBaseUrl}/t/w_250,h_500,q_70/${src}`}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              ) : folderImages.length === 1 ? (
                <img
                  src={`${transformBaseUrl}/t/w_500,h_500,q_70/${folderImages[0]}`}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <span className="text-muted-foreground text-2xl font-bold tracking-wide">
                    {getFolderInitials(folder.name)}
                  </span>
                </div>
              )}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Folder className="w-16 h-16 text-white opacity-80" />
            </div>
            <div
              className={cn(
                "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 transition-opacity",
                isHovered ? "opacity-100" : "opacity-0",
              )}
            >
              <p className="text-white text-xs font-medium truncate">
                {folder.name}
              </p>
            </div>
          </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              onClick={() => {
                document.body.style.pointerEvents = ""
                setRenameItem({
                  id: folder.id,
                  name: folder.name,
                  path: folder.path,
                  isFolder: true,
                })
              }}
            >
              Rename
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                document.body.style.pointerEvents = ""
                setMoveItem({ id: folder.id, name: folder.name, path: folder.path })
              }}
            >
              Move to...
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={() => {
                const p = folder.path;
                if (confirm(`Delete folder "${folder.name}" and all contents?`)) {
                  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
                  const encoded = p.split("/").map(encodeURIComponent).join("/");
                  fetch(`${apiBaseUrl}/storage/${encoded}`, { method: "DELETE", credentials: "include" })
                    .then(() => queryClient.invalidateQueries({ queryKey: ["storage-tree"] }));
                }
              }}
            >
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );
    })}

    {/* Render media files */}
      {files.map((media, i) => {
        const thumbnailUrl =
          media.type === "image"
            ? `${transformBaseUrl}/t/w_500,h_500,q_80/${media.path}`
            : `${transformBaseUrl}/t/so_5,f_webp,w_500,h_500,c_fill,q_80/${media.path}`;
        const isHovered = hoveredId === media.id;
        const filePath = getItemPath(media.name)
        const isSelected = selectedPaths.has(filePath)
        return (
          <ContextMenu key={media.id}>
            <ContextMenuTrigger asChild>
              <div
                data-item-path={filePath}
                className={cn(
                  "group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/50 cursor-pointer transition-all hover:border-primary/30 hover:shadow-md",
                  isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                )}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey) {
                    handleItemClick({ path: filePath, name: media.name }, folders.length + i, e)
                  } else {
                    onMediaSelect(media)
                  }
                }}
                onMouseEnter={() => {
                  setHoveredId(media.id);
                  handleMediaHover(media);
                }}
                onMouseLeave={() => setHoveredId(null)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-openinary-move", filePath)
                  e.dataTransfer.effectAllowed = "move"
                }}
              >
                {/* Selection checkbox */}
                <div
                  className={cn(
                    "absolute top-2 left-2 z-10 transition-opacity",
                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                  onClick={(e) => { e.stopPropagation(); toggleSelection(filePath) }}
                >
                  {isSelected ? (
                    <CheckCircle className="size-5 text-primary" />
                  ) : (
                    <Circle className="size-5 text-white/80 drop-shadow-md" />
                  )}
                </div>
            {media.type === "image" ? (
              <img
                src={thumbnailUrl}
                alt={media.name}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            ) : media.type === "video" ? (
              <VideoThumbnail
                src={thumbnailUrl}
                alt={media.name}
                className="transition-transform group-hover:scale-105"
                loading="lazy"
              />
            ) : media.type === "audio" ? (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-600/20 to-green-800/20">
                <FileAudio className="w-16 h-16 text-green-500/60" />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-600/20 to-orange-800/20">
                <File className="w-16 h-16 text-orange-500/60" />
              </div>
            )}
            <div
              className={cn(
                "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 transition-opacity",
                isHovered ? "opacity-100" : "opacity-0",
              )}
            >
              <p className="text-white text-xs font-medium truncate">
                {media.name}
              </p>
            </div>
          </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              onClick={() => {
                document.body.style.pointerEvents = ""
                setRenameItem({
                  id: media.id,
                  name: media.name,
                  path: getItemPath(media.name),
                  isFolder: false,
                })
              }}
            >
              Rename
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                document.body.style.pointerEvents = ""
                setMoveItem({ id: media.id, name: media.name, path: getItemPath(media.name) })
              }}
            >
              Move to...
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={() => {
                const path = getItemPath(media.name);
                if (confirm(`Delete "${media.name}"?`)) {
                  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
                  const encoded = path.split("/").map(encodeURIComponent).join("/");
                  fetch(`${apiBaseUrl}/storage/${encoded}`, { method: "DELETE", credentials: "include" })
                    .then(() => queryClient.invalidateQueries({ queryKey: ["storage-tree"] }));
                }
              }}
            >
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );
    })}

      {/* Batch action bar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-popover border rounded-full shadow-lg px-5 py-3 text-sm">
          <span className="text-muted-foreground whitespace-nowrap">{selectedCount} selected</span>
          <div className="w-px h-5 bg-border" />
          <button
            onClick={() => {
              setBatchRenameItems(
                [...selectedPaths].map((p) => ({ name: p.split("/").pop()!, path: p }))
              )
            }}
            className="flex items-center gap-1.5 hover:text-foreground text-muted-foreground transition-colors"
          >
            <Pencil className="size-4" /> Rename
          </button>
          <button
            onClick={() => {
              setBatchMoveItems(
                [...selectedPaths].map((p) => {
                  const name = p.split("/").pop()!
                  return { id: name, name, path: p }
                })
              )
            }}
            className="flex items-center gap-1.5 hover:text-foreground text-muted-foreground transition-colors"
          >
            <Folder className="size-4" /> Move
          </button>
          <button
            onClick={doBatchDelete}
            className="flex items-center gap-1.5 text-destructive hover:text-destructive/80 transition-colors"
          >
            <Trash2 className="size-4" /> Delete
          </button>
          <div className="w-px h-5 bg-border" />
          <button onClick={clearSelection} className="hover:text-foreground text-muted-foreground transition-colors">
            Clear
          </button>
        </div>
      )}

    <RenameDialog
        isOpen={!!renameItem}
        item={renameItem ? { id: renameItem.id, name: renameItem.name, path: renameItem.path } : null}
        isFolder={renameItem?.isFolder ?? false}
        onClose={() => setRenameItem(null)}
      />
      <MoveDialog
        isOpen={!!moveItem || !!batchMoveItems}
        item={moveItem ? { id: moveItem.id, name: moveItem.name, path: moveItem.path } : null}
        treeData={treeData}
        onClose={() => { setMoveItem(null); setBatchMoveItems(null) }}
      />
      <BatchRenameDialog
        isOpen={!!batchRenameItems}
        items={batchRenameItems}
        onClose={() => setBatchRenameItems(null)}
      />

      {selectionBox && (
        <div
          className="absolute pointer-events-none z-10 border-2 border-primary bg-primary/10 rounded-sm"
          style={{
            left: selectionBox.left,
            top: selectionBox.top,
            width: selectionBox.width,
            height: selectionBox.height,
          }}
        />
      )}

      {uploadStatus && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border bg-background text-sm animate-in slide-in-from-top-2">
          {uploadStatus.type === 'uploading' ? (
            <span className="flex items-center gap-2"><span className="size-3 rounded-full border-2 border-primary border-t-transparent animate-spin" /> Uploading {uploadStatus.count} file{uploadStatus.count > 1 ? 's' : ''}…</span>
          ) : uploadStatus.error ? (
            <span className="flex items-center gap-2 text-destructive">✕ {uploadStatus.error}</span>
          ) : (
            <span className="flex items-center gap-2 text-green-600 dark:text-green-400">✓ Uploaded {uploadStatus.count} file{uploadStatus.count > 1 ? 's' : ''}</span>
          )}
        </div>
      )}
    </div>
    </div>
  );
}
