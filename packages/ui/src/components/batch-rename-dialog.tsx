"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DefaultDialog } from "./default-dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../ui/tabs";
import { invalidateStorage } from "../hooks/use-storage-tree";
import { encodePath } from "../lib/utils";
import { useOpeninary } from "../provider/openinary-provider";

type Mode = "format" | "replace" | "add";

export interface BatchRenameItem {
  name: string;
  path: string;
}

/**
 * Renames a selection in one go: numbered series, find/replace, or a fixed
 * prefix/suffix. Extensions are kept.
 */
export function BatchRenameDialog({
  isOpen,
  items,
  onClose,
}: {
  isOpen: boolean;
  items: BatchRenameItem[] | null;
  onClose: () => void;
}) {
  const { apiBaseUrl, fetch } = useOpeninary();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("format");
  const [prefix, setPrefix] = useState("");
  const [startNum, setStartNum] = useState(1);
  const [digits, setDigits] = useState(3);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [addText, setAddText] = useState("");
  const [addBefore, setAddBefore] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (items && items.length > 0) {
      setPrefix("");
      setStartNum(1);
      setDigits(3);
      setFindText("");
      setReplaceText("");
      setAddText("");
      setAddBefore(true);
      setMode("format");
    }
  }, [items]);

  const renameJobs = useMemo(() => {
    if (!items) return [];
    return items.map((item, index) => {
      const dot = item.name.lastIndexOf(".");
      const base = dot > 0 ? item.name.slice(0, dot) : item.name;
      const ext = dot > 0 ? item.name.slice(dot) : "";
      let newName = item.name;
      if (mode === "format") {
        newName = `${prefix}${prefix ? "_" : ""}${String(startNum + index).padStart(digits, "0")}${ext}`;
      } else if (mode === "replace") {
        newName = findText
          ? `${base.split(findText).join(replaceText)}${ext}`
          : item.name;
      } else {
        newName = addBefore
          ? `${addText}${base}${ext}`
          : `${base}${addText}${ext}`;
      }
      return { path: item.path, newName };
    });
  }, [items, mode, prefix, startNum, digits, findText, replaceText, addText, addBefore]);

  const isValid =
    mode === "format"
      ? !!prefix.trim()
      : mode === "replace"
        ? !!findText
        : !!addText;

  const submit = async () => {
    if (!items?.length) return;
    setIsSubmitting(true);
    try {
      const results = await Promise.allSettled(
        renameJobs.map(async (job) => {
          const encoded = encodePath(job.path);
          const res = await fetch(`${apiBaseUrl}/storage/${encoded}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: job.newName }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.message || `Failed to rename "${job.path}"`);
          }
        }),
      );
      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length > 0) {
        throw new Error(`${failed.length} of ${items.length} renames failed`);
      }
      toast.success(`Renamed ${items.length} item(s)`);
      invalidateStorage(queryClient);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Batch rename failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DefaultDialog
      isOpen={isOpen && !!items}
      onClose={onClose}
      title={`Batch rename ${items?.length ?? 0} item(s)`}
    >
      <div className="space-y-4">
        <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
          <TabsList variant="underline">
            <TabsTab value="format">Numbered</TabsTab>
            <TabsTab value="replace">Find / replace</TabsTab>
            <TabsTab value="add">Add text</TabsTab>
          </TabsList>

          <TabsPanel value="format" className="mt-3">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="batch-prefix">Prefix</Label>
                <Input
                  id="batch-prefix"
                  value={prefix}
                  onChange={(event) => setPrefix(event.target.value)}
                  placeholder="e.g. Vacation"
                />
              </div>
              <div className="w-24 space-y-1.5">
                <Label htmlFor="batch-start">Start</Label>
                <Input
                  id="batch-start"
                  type="number"
                  min={0}
                  value={startNum}
                  onChange={(event) => setStartNum(Number(event.target.value))}
                />
              </div>
              <div className="w-24 space-y-1.5">
                <Label htmlFor="batch-digits">Digits</Label>
                <Input
                  id="batch-digits"
                  type="number"
                  min={1}
                  max={6}
                  value={digits}
                  onChange={(event) =>
                    setDigits(Math.max(1, Math.min(6, Number(event.target.value))))
                  }
                />
              </div>
            </div>
          </TabsPanel>

          <TabsPanel value="replace" className="mt-3">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="batch-find">Find</Label>
                <Input
                  id="batch-find"
                  value={findText}
                  onChange={(event) => setFindText(event.target.value)}
                  placeholder="Text to find"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="batch-replace">Replace</Label>
                <Input
                  id="batch-replace"
                  value={replaceText}
                  onChange={(event) => setReplaceText(event.target.value)}
                  placeholder="(leave empty to remove)"
                />
              </div>
            </div>
          </TabsPanel>

          <TabsPanel value="add" className="mt-3">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="batch-add">Text to add</Label>
                <Input
                  id="batch-add"
                  value={addText}
                  onChange={(event) => setAddText(event.target.value)}
                  placeholder="e.g. Draft_"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Position</Label>
                <div className="flex">
                  <Button
                    type="button"
                    size="sm"
                    variant={addBefore ? "default" : "outline"}
                    className="rounded-r-none"
                    onClick={() => setAddBefore(true)}
                  >
                    Before
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={!addBefore ? "default" : "outline"}
                    className="rounded-l-none"
                    onClick={() => setAddBefore(false)}
                  >
                    After
                  </Button>
                </div>
              </div>
            </div>
          </TabsPanel>
        </Tabs>

        {isValid && renameJobs.length > 0 && (
          <div className="max-h-32 space-y-0.5 overflow-y-auto rounded border p-2 text-xs text-muted-foreground">
            {renameJobs.slice(0, 20).map((job) => (
              <div key={job.path} className="truncate">
                {job.path.split("/").pop()} → {job.newName}
              </div>
            ))}
            {renameJobs.length > 20 && (
              <div>...and {renameJobs.length - 20} more</div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isSubmitting || !isValid}>
            {isSubmitting ? "Renaming..." : "Rename"}
          </Button>
        </div>
      </div>
    </DefaultDialog>
  );
}
