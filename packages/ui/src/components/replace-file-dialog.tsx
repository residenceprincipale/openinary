"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DefaultDialog } from "./default-dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { invalidateStorage } from "../hooks/use-storage-tree";
import { encodePath } from "../lib/utils";
import { useOpeninary } from "../provider/openinary-provider";

/** Swap a file's bytes in place, keeping its path and extension. */
export function ReplaceFileDialog({
  isOpen,
  item,
  onClose,
}: {
  isOpen: boolean;
  item: { path: string; name: string } | null;
  onClose: () => void;
}) {
  const { apiBaseUrl, fetch } = useOpeninary();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const expectedExt = item?.name.slice(item.name.lastIndexOf(".")).toLowerCase();

  const submit = async () => {
    const file = inputRef.current?.files?.[0];
    if (!file || !item) return;

    if (file.name.slice(file.name.lastIndexOf(".")).toLowerCase() !== expectedExt) {
      toast.error(`Expected a "${expectedExt}" file`);
      return;
    }

    setIsSubmitting(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(
        `${apiBaseUrl}/storage/replace/${encodePath(item.path)}`,
        { method: "PUT", body },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to replace file");
      }
      toast.success(`Replaced "${item.name}"`);
      invalidateStorage(queryClient);
      if (inputRef.current) inputRef.current.value = "";
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to replace file");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DefaultDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Replace "${item?.name ?? ""}"`}
      contentClassName="max-w-md"
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          The new file keeps the same path, so existing URLs keep working. Only{" "}
          {expectedExt} files are accepted.
        </p>
        <Input ref={inputRef} type="file" accept={expectedExt} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isSubmitting}>
            {isSubmitting ? "Replacing..." : "Replace"}
          </Button>
        </div>
      </div>
    </DefaultDialog>
  );
}
