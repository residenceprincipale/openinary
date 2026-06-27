"use client";

import { Folder, Pencil, Trash2, FileImage, FileVideo, FileAudio, File, CheckCircle, Circle, Upload } from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import type { QueryClient } from "@tanstack/react-query";

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

interface ListViewProps {
  folders: FolderItem[]
  files: MediaFile[]
  selectedPaths: Set<string>
  hoveredId: string | null
  dragOverId: string | null
  fileMeta: Record<string, { size: number; createdAt: string }>
  visibleFolderCount: number
  queryClient: QueryClient
  onToggleSelection: (path: string) => void
  onHoveredIdChange: (id: string | null) => void
  onDragOverIdChange: (id: string | null) => void
  onItemClick: (item: { path: string; name: string }, index: number, e: React.MouseEvent) => void
  onFolderClick: (path: string) => void
  onMediaSelect: (media: MediaFile) => void
  onMediaHover: (media: MediaFile) => void
  onRename: (item: { id: string; name: string; path: string; isFolder: boolean }) => void
  onMove: (item: { id: string; name: string; path: string }) => void
  onReplace: (item: { id: string; name: string; path: string }) => void
  onMoveFile: (sourcePath: string, targetFolder: string) => void
  getItemPath: (name: string) => string
}

export function ListView({
  folders, files, selectedPaths, hoveredId, dragOverId, fileMeta,
  visibleFolderCount, queryClient, onToggleSelection, onHoveredIdChange,
  onDragOverIdChange, onItemClick, onFolderClick, onMediaSelect, onMediaHover,
  onRename, onMove, onReplace, onMoveFile, getItemPath,
}: ListViewProps) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";

  return (
    <table className="w-full select-none">
      <thead>
        <tr className="text-left text-xs text-muted-foreground border-b">
          <th className="pb-2 font-medium">Name</th>
          <th className="pb-2 font-medium">Type</th>
          <th className="pb-2 font-medium">Size</th>
          <th className="pb-2 font-medium">Date</th>
          <th className="pb-2 font-medium w-20">Actions</th>
        </tr>
      </thead>
      <tbody>
        {folders.map((folder, i) => {
          const isSelected = selectedPaths.has(folder.path);
          return (
            <ContextMenu key={folder.id}>
              <ContextMenuTrigger asChild>
                <tr
                  data-item-path={folder.path}
                  className={cn(
                    "group cursor-pointer transition-colors hover:bg-accent/50 border-b border-border/50",
                    dragOverId === folder.id && "outline-dashed outline-2 outline-primary outline-offset-2",
                    isSelected && "bg-accent",
                  )}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey) {
                      onItemClick({ path: folder.path, name: folder.name }, i, e);
                    } else {
                      onFolderClick(folder.path);
                    }
                  }}
                  onMouseEnter={() => onHoveredIdChange(folder.id)}
                  onMouseLeave={() => onHoveredIdChange(null)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-openinary-move", folder.path);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes("application/x-openinary-move")) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      onDragOverIdChange(folder.id);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    onDragOverIdChange(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    onDragOverIdChange(null);
                    const src = e.dataTransfer.getData("application/x-openinary-move");
                    if (src) onMoveFile(src, folder.path);
                  }}
                >
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-3">
                      <div onClick={(e) => { e.stopPropagation(); onToggleSelection(folder.path); }}>
                        {isSelected ? (
                          <CheckCircle className="size-4 text-primary" />
                        ) : (
                          <Circle className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        )}
                      </div>
                      <Folder className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm">{folder.name}</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-sm text-muted-foreground">folder</td>
                  <td className="py-2 px-3 text-sm text-muted-foreground">—</td>
                  <td className="py-2 px-3 text-sm text-muted-foreground">—</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); document.body.style.pointerEvents = ""; onRename({ id: folder.id, name: folder.name, path: folder.path, isFolder: true }); }} className="p-1 hover:text-foreground text-muted-foreground"><Pencil className="size-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); const p = folder.path; if (confirm(`Delete folder "${folder.name}" and all contents?`)) { const encoded = p.split("/").map(encodeURIComponent).join("/"); fetch(`${apiBaseUrl}/storage/${encoded}`, { method: "DELETE", credentials: "include" }).then(() => { queryClient.invalidateQueries({ queryKey: ["storage-tree"] }); queryClient.invalidateQueries({ queryKey: ["server-config"] }); }); } }} className="p-1 hover:text-destructive text-muted-foreground"><Trash2 className="size-3.5" /></button>
                    </div>
                  </td>
                </tr>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => { document.body.style.pointerEvents = ""; onRename({ id: folder.id, name: folder.name, path: folder.path, isFolder: true }); }}>
                  <Pencil className="mr-2 h-4 w-4" /> Rename
                </ContextMenuItem>
                <ContextMenuItem onClick={() => { document.body.style.pointerEvents = ""; onMove({ id: folder.id, name: folder.name, path: folder.path }); }}>
                  <Folder className="mr-2 h-4 w-4" /> Move to...
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem variant="destructive" onClick={() => { const p = folder.path; if (confirm(`Delete folder "${folder.name}" and all contents?`)) { const encoded = p.split("/").map(encodeURIComponent).join("/"); fetch(`${apiBaseUrl}/storage/${encoded}`, { method: "DELETE", credentials: "include" }).then(() => { queryClient.invalidateQueries({ queryKey: ["storage-tree"] }); queryClient.invalidateQueries({ queryKey: ["server-config"] }); }); } }}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
        {files.map((media, i) => {
          const filePath = getItemPath(media.name);
          const isSelected = selectedPaths.has(filePath);
          const Icon = media.type === "image" ? FileImage : media.type === "video" ? FileVideo : media.type === "audio" ? FileAudio : File;
          const typeLabels: Record<string, string> = { image: "image", video: "video", audio: "audio" };
          return (
            <ContextMenu key={media.id}>
              <ContextMenuTrigger asChild>
                <tr
                  data-item-path={filePath}
                  className={cn(
                    "group cursor-pointer transition-colors hover:bg-accent/50 border-b border-border/50",
                    isSelected && "bg-accent",
                  )}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey) {
                      onItemClick({ path: filePath, name: media.name }, visibleFolderCount + i, e);
                    } else {
                      onMediaSelect(media);
                    }
                  }}
                  onMouseEnter={() => { onHoveredIdChange(media.id); onMediaHover(media); }}
                  onMouseLeave={() => onHoveredIdChange(null)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-openinary-move", filePath);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                >
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-3">
                      <div onClick={(e) => { e.stopPropagation(); onToggleSelection(filePath); }}>
                        {isSelected ? (
                          <CheckCircle className="size-4 text-primary" />
                        ) : (
                          <Circle className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        )}
                      </div>
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm">{media.name}</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-sm text-muted-foreground capitalize">{typeLabels[media.type] || "other"}</td>
                  <td className="py-2 px-3 text-sm text-muted-foreground">{fileMeta[filePath] ? `${(fileMeta[filePath].size / 1024).toFixed(1)} KB` : "—"}</td>
                  <td className="py-2 px-3 text-sm text-muted-foreground">{fileMeta[filePath] ? new Date(fileMeta[filePath].createdAt).toLocaleDateString() : "—"}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); document.body.style.pointerEvents = ""; onRename({ id: media.id, name: media.name, path: getItemPath(media.name), isFolder: false }); }} className="p-1 hover:text-foreground text-muted-foreground"><Pencil className="size-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); const path = getItemPath(media.name); if (confirm(`Delete "${media.name}"?`)) { const encoded = path.split("/").map(encodeURIComponent).join("/"); fetch(`${apiBaseUrl}/storage/${encoded}`, { method: "DELETE", credentials: "include" }).then(() => { queryClient.invalidateQueries({ queryKey: ["storage-tree"] }); queryClient.invalidateQueries({ queryKey: ["server-config"] }); }); } }} className="p-1 hover:text-destructive text-muted-foreground"><Trash2 className="size-3.5" /></button>
                    </div>
                  </td>
                </tr>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => { document.body.style.pointerEvents = ""; onRename({ id: media.id, name: media.name, path: getItemPath(media.name), isFolder: false }); }}>
                  <Pencil className="mr-2 h-4 w-4" /> Rename
                </ContextMenuItem>
                <ContextMenuItem onClick={() => { document.body.style.pointerEvents = ""; onMove({ id: media.id, name: media.name, path: getItemPath(media.name) }); }}>
                  <Folder className="mr-2 h-4 w-4" /> Move to...
                </ContextMenuItem>
                <ContextMenuItem onClick={() => { document.body.style.pointerEvents = ""; onReplace({ id: media.id, name: media.name, path: getItemPath(media.name) }); }}>
                  <Upload className="mr-2 h-4 w-4" /> Replace
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem variant="destructive" onClick={() => { const path = getItemPath(media.name); if (confirm(`Delete "${media.name}"?`)) { const encoded = path.split("/").map(encodeURIComponent).join("/"); fetch(`${apiBaseUrl}/storage/${encoded}`, { method: "DELETE", credentials: "include" }).then(() => { queryClient.invalidateQueries({ queryKey: ["storage-tree"] }); queryClient.invalidateQueries({ queryKey: ["server-config"] }); }); } }}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </tbody>
    </table>
  );
}
