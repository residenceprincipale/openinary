"use client";

import { SettingsPage, type SettingsPageEntry } from "@openinary/dashboard";
import { AppearanceTab, StorageTab, useOpeninary } from "@openinary/ui";
import {
  Archive,
  HardDrive,
  KeyRound,
  ListVideo,
  Palette,
  ScrollText,
  SlidersHorizontal,
  User,
  Users,
} from "lucide-react";

import { ApiKeyManager } from "@/components/api-key-manager";
import { AccountTab } from "@/components/settings/account-tab";
import { ActivityTab } from "@/components/settings/activity-tab";
import { CachePage } from "@/components/settings/cache-page";
import { QueuePage } from "@/components/settings/queue-page";
import { TransformsPage } from "@/components/settings/transforms-page";
import { UsersPage } from "@/components/settings/users-page";
import { useSession } from "@/lib/auth-client";
import { Skeleton } from "skullet/react";

function AccountPage() {
  const user = useSession().data?.user;

  // The form takes its defaults at mount, so until the session is known it is
  // drawn as skeleton over sample values, then remounted (key) with the real
  // ones: same fields, same height, nothing pops in.
  return (
    <Skeleton loading={!user} label="Loading your account">
      <AccountTab
        key={user ? "user" : "sample"}
        userName={user ? user.name || user.email.split("@")[0] : "Your name"}
        userEmail={user?.email ?? "you@example.com"}
        userAvatar={user?.image || ""}
        isOpen
      />
    </Skeleton>
  );
}

export const SETTINGS_PAGES: SettingsPageEntry[] = [
  {
    value: "account",
    label: "Account",
    description: "Your name, email and avatar.",
    icon: User,
    content: AccountPage,
  },
  {
    value: "appearance",
    label: "Appearance",
    description: "Theme and display preferences for this dashboard.",
    icon: Palette,
    content: AppearanceTab,
  },
  {
    value: "api-keys",
    label: "API keys",
    description: "The keys your apps use to authenticate with Openinary.",
    icon: KeyRound,
    content: ApiKeyManager,
  },
  {
    value: "storage",
    label: "Storage",
    description: "Storage used by your files and by cached transformations.",
    icon: HardDrive,
    content: StorageTab,
  },
  {
    value: "logs",
    label: "Logs",
    description: "The deliveries and video jobs behind your traffic.",
    icon: ScrollText,
    content: ActivityTab,
    wide: true,
  },
  {
    value: "queue",
    label: "Queue",
    description: "Background video transcodes, with retry and cancel.",
    icon: ListVideo,
    content: QueuePage,
    wide: true,
  },
  {
    value: "cache",
    label: "Cache",
    description: "Local and cloud transformation cache entries.",
    icon: Archive,
    content: CachePage,
    wide: true,
  },
  {
    value: "transforms",
    label: "Transforms",
    description: "Default image and video encoding, and dashboard branding.",
    icon: SlidersHorizontal,
    content: TransformsPage,
  },
  {
    value: "users",
    label: "Users",
    description: "Accounts, admin roles, and folder sharing.",
    icon: Users,
    content: UsersPage,
  },
];

export function Settings({ tab }: { tab: string }) {
  const { transformsDisabled } = useOpeninary();
  const pages = transformsDisabled
    ? SETTINGS_PAGES.filter(
        (page) =>
          page.value !== "queue" &&
          page.value !== "cache" &&
          page.value !== "transforms",
      )
    : SETTINGS_PAGES;
  return <SettingsPage tab={tab} pages={pages} />;
}
