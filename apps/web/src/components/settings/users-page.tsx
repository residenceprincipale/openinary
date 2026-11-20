"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  DefaultDialog,
  DeleteConfirmDialog,
  Input,
  SettingsField,
  SettingsFields,
  SettingsSection,
  useOpeninary,
} from "@openinary/ui";
import { toast } from "sonner";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: number;
};

const FIELD =
  "h-8 w-full rounded-[8px] border border-ds-border-strong bg-ds-field px-2.5 text-[13px] text-ds-text outline-none";

export function UsersPage() {
  const { apiBaseUrl, fetch } = useOpeninary();
  const [users, setUsers] = useState<User[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/users`);
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) throw new Error("Failed to load users");
      setUsers(await res.json());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load users");
    }
  }, [apiBaseUrl, fetch]);

  useEffect(() => {
    void load();
  }, [load]);

  if (forbidden) {
    return (
      <p className="text-sm text-muted-foreground">
        Only an admin can manage the instance's users.
      </p>
    );
  }

  const create = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to create user");
      }
      toast.success(`Created ${form.email}`);
      setCreateOpen(false);
      setForm({ name: "", email: "", password: "", role: "user" });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create user");
    }
  };

  const changeRole = async (user: User, role: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to update role");
      }
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role");
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${apiBaseUrl}/users/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete user");
      }
      toast.success(`Deleted ${deleteTarget.email}`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete user");
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Users"
        description="Accounts that can sign in to this instance. Admins manage users and see every folder; everyone else sees the folders shared with them."
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            Add user
          </Button>
        }
      >
        <ul className="divide-y">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Role for ${user.email}`}
                  value={user.role}
                  onChange={(event) => changeRole(user, event.target.value)}
                  className="h-8 rounded-[8px] border border-ds-border-strong bg-ds-field px-2 text-[13px] text-ds-text outline-none"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(user)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
          {users.length === 0 && (
            <li className="py-3 text-sm text-muted-foreground">No users.</li>
          )}
        </ul>
      </SettingsSection>

      <DefaultDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add user"
        contentClassName="max-w-md"
      >
        <div className="space-y-4">
          <SettingsFields>
            <SettingsField label="Name">
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </SettingsField>
            <SettingsField label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
            </SettingsField>
            <SettingsField label="Password">
              <Input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm({ ...form, password: event.target.value })
                }
              />
            </SettingsField>
            <SettingsField label="Role">
              <select
                className={FIELD}
                value={form.role}
                onChange={(event) =>
                  setForm({ ...form, role: event.target.value })
                }
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </SettingsField>
          </SettingsFields>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={create}
              disabled={!form.email || !form.password || !form.name}
            >
              Create
            </Button>
          </div>
        </div>
      </DefaultDialog>

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete user"
        description={`Delete ${deleteTarget?.email ?? ""}? Their sessions and API keys go too.`}
        onConfirm={remove}
      />
    </div>
  );
}
