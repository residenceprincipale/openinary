"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DefaultDialog } from "./default-dialog";
import { Button } from "../ui/button";
import { useOpeninary } from "../provider/openinary-provider";

type SharedUser = {
  user_id: string;
  email: string | null;
  name: string | null;
  permission: string;
};

type ShareUser = { id: string; email: string; name: string };

const PERMISSIONS = [
  { value: "view", label: "Can view" },
  { value: "edit", label: "Can edit" },
  { value: "admin", label: "Can manage" },
];

/** Share one folder with non-admin users, read/write per folder. */
export function ShareFolderDialog({
  isOpen,
  folderPath,
  onClose,
}: {
  isOpen: boolean;
  folderPath: string | null;
  onClose: () => void;
}) {
  const { apiBaseUrl, fetch } = useOpeninary();
  const [shared, setShared] = useState<SharedUser[]>([]);
  const [users, setUsers] = useState<ShareUser[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [permission, setPermission] = useState("edit");
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (folderPath === null) return;
    setIsLoading(true);
    try {
      const [permissionsRes, usersRes] = await Promise.all([
        fetch(
          `${apiBaseUrl}/storage/permissions?path=${encodeURIComponent(folderPath)}`,
        ),
        fetch(`${apiBaseUrl}/users/list`),
      ]);
      const permissionsData = await permissionsRes.json().catch(() => null);
      const usersData = await usersRes.json().catch(() => null);
      setShared(permissionsData?.data ?? []);
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch {
      toast.error("Failed to load folder permissions");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, fetch, folderPath]);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  const share = async () => {
    if (!selectedUser || folderPath === null) return;
    try {
      const res = await fetch(`${apiBaseUrl}/storage/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath, userId: selectedUser, permission }),
      });
      if (!res.ok) throw new Error("Failed to share folder");
      setSelectedUser("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to share folder");
    }
  };

  const revoke = async (userId: string) => {
    if (folderPath === null) return;
    try {
      const res = await fetch(`${apiBaseUrl}/storage/permissions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath, userId }),
      });
      if (!res.ok) throw new Error("Failed to revoke access");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to revoke access",
      );
    }
  };

  const available = users.filter(
    (user) => !shared.some((entry) => entry.user_id === user.id),
  );

  return (
    <DefaultDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Share "${folderPath || "Root"}"`}
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-[13px]/5 font-medium">People with access</p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : shared.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Only admins can see this folder.
            </p>
          ) : (
            <ul className="divide-y rounded border">
              {shared.map((entry) => (
                <li
                  key={entry.user_id}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{entry.name || entry.email}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {PERMISSIONS.find((p) => p.value === entry.permission)?.label ??
                        entry.permission}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revoke(entry.user_id)}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-[13px]/5 font-medium">Add someone</p>
          <div className="flex gap-2">
            <select
              aria-label="User"
              value={selectedUser}
              onChange={(event) => setSelectedUser(event.target.value)}
              className="h-8 flex-1 rounded-[8px] border border-ds-border-strong bg-ds-field px-2 text-[13px] text-ds-text outline-none"
            >
              <option value="">Choose a user</option>
              {available.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
            <select
              aria-label="Permission"
              value={permission}
              onChange={(event) => setPermission(event.target.value)}
              className="h-8 w-36 rounded-[8px] border border-ds-border-strong bg-ds-field px-2 text-[13px] text-ds-text outline-none"
            >
              {PERMISSIONS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
            <Button onClick={share} disabled={!selectedUser}>
              Share
            </Button>
          </div>
        </div>
      </div>
    </DefaultDialog>
  );
}
