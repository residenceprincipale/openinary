"use client"

import {
  AudioWaveform,
  Command,
  Database,
  GalleryVerticalEnd,
  Image as ImageIcon,
  Package,
  Settings,
  Users,
  Video,
} from "lucide-react"
import { useSession } from "@/lib/auth-client";
import { useBranding } from "@/components/branding-provider";

import { NavMain } from "@/components/sidebar/nav-main"
import { NavProjects } from "@/components/sidebar/nav-projects"
import { NavUser } from "@/components/sidebar/nav-user"
import { VersionDisplay } from "@/components/sidebar/version-display"

type MediaFile = {
  id: string
  name: string
  path: string
  type: "image" | "video" | "audio" | "other"
}
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import Link from "next/link"
import {cn} from "@/lib/utils";

function useNavItems() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  return [
    { title: "Assets", url: "/", icon: Package, isActive: true },
    ...(isAdmin ? [{ title: "Users", url: "/users", icon: Users }] : []),
    { title: "Cache", url: "/cache", icon: Database },
    { title: "Config", url: "/config", icon: Settings },
    // { title: "Image", url: "/", icon: ImageIcon, disabled: true },
    // { title: "Video", url: "/", icon: Video, disabled: true },
  ];
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  onMediaSelect?: (media: MediaFile) => void
}

export function AppSidebar({ onMediaSelect, ...props }: AppSidebarProps) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const navItems = useNavItems()
  const branding = useBranding()
  const logoSrc = branding.logoUrl || "/icon.svg"
  
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="pl-4 pt-4">
        <Link href="/" className="flex items-center">
          <img
            src={logoSrc}
            alt={branding.title}
            className={cn("h-[25px] w-auto", !branding.logoUrl && 'dark:invert')}
          />
          {!isCollapsed && (
            <span className="ml-2 text-lg font-semibold">{branding.title || 'Openinary'}</span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
        <NavProjects onMediaSelect={onMediaSelect} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
        {!isCollapsed && <VersionDisplay />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
