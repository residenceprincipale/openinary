"use client";

import {
  AppSidebar as DashboardSidebar,
  initials,
  SidebarAccount,
  SolarAccount,
  SolarAssets,
  SolarImages,
  SolarKey,
  SolarLogs,
  SolarPalette,
  SolarSettings,
  SolarStorage,
  SolarVideos,
  WorkspaceTile,
} from "@openinary/dashboard";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@openinary/dashboard/ui/dropdown-menu";
import { useOpeninary } from "@openinary/ui";
import { Archive, ListVideo, LogOut, Settings, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useBranding } from "@/components/branding-provider";
import { useVersion } from "@/components/sidebar/version-display";
import { signOut, useSession } from "@/lib/auth-client";

const mainItems = [
  { title: "Assets", icon: SolarAssets, url: "/" },
  { title: "Images", icon: SolarImages, url: "/images" },
  { title: "Videos", icon: SolarVideos, url: "/videos" },
  { title: "Logs", icon: SolarLogs, url: "/settings/logs" },
  { title: "Storage", icon: SolarStorage, url: "/settings/storage" },
];

const settingsPages = [
  { title: "Account", url: "/settings/account" },
  { title: "Appearance", url: "/settings/appearance" },
  { title: "API keys", url: "/settings/api-keys" },
  { title: "Storage", url: "/settings/storage" },
  { title: "Logs", url: "/settings/logs" },
  { title: "Queue", url: "/settings/queue" },
  { title: "Cache", url: "/settings/cache" },
  { title: "Transforms", url: "/settings/transforms" },
  { title: "Users", url: "/settings/users" },
];

const settingsIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Account: SolarAccount,
  Appearance: SolarPalette,
  "API keys": SolarKey,
  Storage: SolarStorage,
  Logs: SolarLogs,
  Queue: ListVideo,
  Cache: Archive,
  Transforms: SolarSettings,
  Users,
};

/** The workspace (this instance) and the signed-in account, at the bottom. */
function Account() {
  const router = useRouter();
  const user = useSession().data?.user;
  const version = useVersion();
  const branding = useBranding();
  const name = branding.title || "Openinary";
  const userName = user?.name || user?.email?.split("@")[0] || "You";

  return (
    <SidebarAccount
      tile={
        <WorkspaceTile name={name} logo={branding.logoUrl || null} />
      }
      name={name}
      detail={version ? `Self-hosted · ${version}` : "Self-hosted"}
      workspaceMenu={
        <DropdownMenuItem asChild>
          <Link href="/settings/storage">
            <Settings />
            Workspace settings
          </Link>
        </DropdownMenuItem>
      }
      avatar={
        user?.image ? (
          <img
            src={user.image}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          initials(userName)
        )
      }
      accountMenu={
        <>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate font-medium text-[13px] text-ds-text">
              {userName}
            </span>
            <span className="truncate">{user?.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings/account">
              <SolarAccount />
              Account settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/appearance">
              <SolarPalette />
              Appearance
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={async () => {
              await signOut();
              router.push("/login");
            }}
          >
            <LogOut />
            Log out
          </DropdownMenuItem>
        </>
      }
    />
  );
}

export function AppSidebar() {
  const router = useRouter();
  const branding = useBranding();
  const { transformsDisabled } = useOpeninary();

  // Without transforms there is no queue, and thumbnails read originals, so
  // the cache page has nothing to manage either.
  const hiddenWhenDisabled = [
    "/settings/queue",
    "/settings/cache",
    "/settings/transforms",
  ];
  const visibleMain = transformsDisabled
    ? mainItems.filter((item) => !hiddenWhenDisabled.includes(item.url))
    : mainItems;
  const visibleSettings = transformsDisabled
    ? settingsPages.filter((page) => !hiddenWhenDisabled.includes(page.url))
    : settingsPages;

  return (
    <DashboardSidebar
      brand={
        <img
          src={branding.logoUrl || "/icon.svg"}
          alt=""
          className="size-[18px] dark:invert"
        />
      }
      brandName={branding.title || "Openinary"}
      homeHref="/"
      showHome={false}
      buildItems={[]}
      showSetupGuide={false}
      showDocsLink={false}
      mainItems={visibleMain}
      settingsPages={visibleSettings}
      settingsActions={visibleSettings.map((page) => ({
        label: page.title,
        group: "Settings",
        icon: settingsIcons[page.title] ?? SolarSettings,
        onSelect: () => router.push(page.url),
      }))}
      account={<Account />}
      uploaderHref="/"
    />
  );
}
