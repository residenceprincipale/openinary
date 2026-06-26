import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { cn } from "@/lib/utils";
import CreateFolderButtonWithDialog from "./create-folder-button-with-dialog";
import DeleteFolderButton from "./delete-folder-button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { Separator } from "./ui/separator";
import { SidebarTrigger } from "./ui/sidebar";
import UploadButtonWithDialog from "./upload-button-with-dialog";

const MOVE_TYPE = "application/x-openinary-move"

function DroppableBreadcrumbLink({
  targetPath,
  segment,
  onNavigate,
}: {
  targetPath: string | null
  segment: string
  onNavigate: () => void
}) {
  const queryClient = useQueryClient()
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const src = e.dataTransfer.getData(MOVE_TYPE)
    if (!src) return
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ""
    const name = src.split('/').pop()
    const dest = targetPath ? `${targetPath}/${name}` : name
    if (dest === src) return
    fetch(`${baseUrl}/storage/move`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourcePath: src, targetPath: dest }),
      credentials: "include",
    }).finally(() => queryClient.invalidateQueries({ queryKey: ["storage-tree"] }))
  }

  return (
    <BreadcrumbLink
      onClick={onNavigate}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(MOVE_TYPE)) {
          e.preventDefault()
          setIsDragOver(true)
        }
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn("cursor-pointer px-1", isDragOver && "text-primary font-semibold outline-dashed outline-1 outline-primary rounded")}
    >
      {segment}
    </BreadcrumbLink>
  )
}

export default function HeaderBar() {
  const [folderPath, setFolderPath] = useQueryState("folder");

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center justify-between w-full px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <DroppableBreadcrumbLink
                  targetPath={null}
                  segment="Assets"
                  onNavigate={() => setFolderPath(null)}
                />
              </BreadcrumbItem>
              {folderPath &&
                folderPath
                  .split("/")
                  .filter(Boolean)
                  .map((segment, index, segments) => {
                    const pathToSegment = segments
                      .slice(0, index + 1)
                      .join("/");
                    const isLast = index === segments.length - 1;
                    return (
                      <div
                        key={pathToSegment}
                        className="flex items-center gap-1.5"
                      >
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          {isLast ? (
                            <BreadcrumbPage>{segment}</BreadcrumbPage>
                          ) : (
                            <DroppableBreadcrumbLink
                              targetPath={pathToSegment}
                              segment={segment}
                              onNavigate={() => setFolderPath(pathToSegment)}
                            />
                          )}
                        </BreadcrumbItem>
                      </div>
                    );
                  })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex items-center gap-2">
          {folderPath && (
            <DeleteFolderButton
              folderPath={folderPath}
              onSuccessfulDelete={(v) =>
                setFolderPath(v.includes("/") ? v.replace(/\/\w+$/i, "") : "")
              }
            />
          )}
          <CreateFolderButtonWithDialog
            uploadToFolder={folderPath || undefined}
          />
          <UploadButtonWithDialog uploadToFolder={folderPath || undefined} />
        </div>
      </div>
    </header>
  );
}
