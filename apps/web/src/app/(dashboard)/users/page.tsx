"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/auth-client";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: number;
  createdAt: number;
  updatedAt: number;
};

function UsersPageContent() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"user" | "admin">("user");

  const isAdmin =
    !isPending && (session?.user as any)?.role === "admin";

  useEffect(() => {
    if (!isPending && !session?.session) {
      router.push("/login");
      return;
    }
    if (!isPending && !isAdmin) {
      router.push("/");
      return;
    }
    if (isAdmin) {
      fetchUsers();
    }
  }, [session, isPending]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/users`, { credentials: "include" });
      if (res.ok) setUsers(await res.json());
      else setError("Failed to load users");
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setCreateError("");
    if (!newEmail || !newPassword || !newName) {
      setCreateError("All fields are required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/users`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          name: newName,
          role: newRole,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewEmail("");
        setNewPassword("");
        setNewName("");
        setNewRole("user");
        fetchUsers();
      } else {
        const data = await res.json();
        setCreateError(data.error || "Failed to create user");
      }
    } catch {
      setCreateError("Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (u: User) => {
    setEditingId(u.id);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRole(u.role as "user" | "admin");
  };

  const handleEdit = async () => {
    if (!editingId) return;
    try {
      const res = await fetch(`${apiBaseUrl}/users/${editingId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, email: editEmail, role: editRole }),
      });
      if (res.ok) { setEditingId(null); fetchUsers(); }
      else setError("Failed to update user");
    } catch { setError("Failed to update user"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    try {
      const res = await fetch(`${apiBaseUrl}/users/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) fetchUsers();
      else setError("Failed to delete user");
    } catch {
      setError("Failed to delete user");
    }
  };

  if (isPending || loading) {
    return (
      <div className="flex min-h-screen w-screen items-center justify-center bg-background px-4">
        <Spinner className="mx-auto" />
      </div>
    );
  }

  if (!session?.session || !isAdmin) return null;

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Users</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="px-6 py-8">
          <div className="mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold lg:text-4xl">Users</h1>
                <p className="text-muted-foreground leading-relaxed">
                  Manage user accounts
                </p>
              </div>
              <Button onClick={() => setShowCreate(!showCreate)}>
                {showCreate ? "Cancel" : "Create User"}
              </Button>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
            )}

            {showCreate && (
              <div className="rounded-lg border p-4 space-y-4">
                <h3 className="font-medium">New User</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email" type="email" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Password" type="password" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as "user" | "admin")}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                {createError && (
                  <div className="text-sm text-destructive">{createError}</div>
                )}
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? "Creating..." : "Create"}
                </Button>
              </div>
            )}

            <div className="rounded-lg border">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-sm text-muted-foreground">
                    <th className="text-left p-4 font-medium">User ID</th>
                    <th className="text-left p-4 font-medium">Name</th>
                    <th className="text-left p-4 font-medium">Email</th>
                    <th className="text-left p-4 font-medium">Role</th>
                    <th className="text-left p-4 font-medium">Created</th>
                    <th className="text-right p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      {editingId === u.id ? (
                        <>
                          <td className="p-4 text-muted-foreground font-mono text-xs">{u.id}</td>
                          <td className="p-4">
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm" />
                          </td>
                          <td className="p-4">
                            <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-8 text-sm" />
                          </td>
                          <td className="p-4">
                            <select className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm" value={editRole} onChange={(e) => setEditRole(e.target.value as "user" | "admin")}>
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="p-4 text-muted-foreground text-sm">{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td className="p-4 text-right space-x-2">
                            <Button variant="default" size="sm" onClick={handleEdit}>Save</Button>
                            <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-4 text-muted-foreground font-mono text-xs">{u.id}</td>
                          <td className="p-4">{u.name}</td>
                          <td className="p-4 text-muted-foreground">{u.email}</td>
                          <td className="p-4">
                            <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
                          </td>
                          <td className="p-4 text-muted-foreground text-sm">{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td className="p-4 text-right">
                            <Button variant="outline" size="sm" className="mr-2" onClick={() => startEdit(u)}>Edit</Button>
                            {u.id !== session?.user?.id && (
                              <Button variant="destructive" size="sm" onClick={() => handleDelete(u.id)}>Delete</Button>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </SidebarInset>
    </>
  );
}

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          Loading...
        </div>
      }
    >
      <UsersPageContent />
    </Suspense>
  );
}
