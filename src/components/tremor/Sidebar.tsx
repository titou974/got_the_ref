"use client";

// Tremor Sidebar [v1.0.0]
//
// La colonne de navigation de Tremor, repeinte avec les jetons du thème et
// débarrassée de son repli : ici elle est toujours déroulée. Le tableau de bord
// n'a que six sections ; la place qu'un bouton « replier » ferait gagner ne
// vaut pas le geste qu'il ajoute, ni l'état à retenir dans un cookie. Ce qui
// disparaît par rapport à l'original : `SidebarTrigger`, `useSidebar`, le
// tiroir mobile et le cookie `sidebar:state`.
//
// Sous `lg`, la colonne redevient une barre dans le flux, au-dessus du
// contenu : un rail de 16 rem mangerait la moitié d'un écran de téléphone.

import Link from "next/link";
import * as React from "react";

import { cx, focusRing } from "@/lib/utils";

const SIDEBAR_WIDTH = "16rem";

/**
 * Le cadre : la colonne à gauche, le contenu à droite.
 *
 * La largeur passe par une variable CSS pour que la colonne et la gouttière qui
 * lui réserve la place ne puissent pas diverger.
 */
const SidebarProvider = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, style, children, ...props }, ref) => (
    <div
      ref={ref}
      style={{ "--sidebar-width": SIDEBAR_WIDTH, ...style } as React.CSSProperties}
      className={cx("flex min-h-svh w-full flex-col lg:flex-row", className)}
      {...props}
    >
      {children}
    </div>
  ),
);
SidebarProvider.displayName = "SidebarProvider";

const Sidebar = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, children, ...props }, ref) => (
    <>
      {/* La colonne est fixée au viewport : sans cette gouttière, le contenu
          passerait dessous. */}
      <div aria-hidden className="hidden w-[var(--sidebar-width)] shrink-0 lg:block" />
      <div
        ref={ref}
        data-sidebar="sidebar"
        className={cx(
          "flex w-full flex-col border-b border-border bg-surface",
          "lg:fixed lg:inset-y-0 lg:left-0 lg:z-10 lg:h-svh lg:w-[var(--sidebar-width)] lg:border-b-0 lg:border-r",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </>
  ),
);
Sidebar.displayName = "Sidebar";

const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="header"
      className={cx("flex flex-col gap-2 p-3", className)}
      {...props}
    />
  ),
);
SidebarHeader.displayName = "SidebarHeader";

const SidebarContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="content"
      className={cx("flex min-h-0 flex-1 flex-col gap-2 lg:overflow-auto", className)}
      {...props}
    />
  ),
);
SidebarContent.displayName = "SidebarContent";

const SidebarFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="footer"
      className={cx("flex flex-col gap-2 p-3", className)}
      {...props}
    />
  ),
);
SidebarFooter.displayName = "SidebarFooter";

const SidebarGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="group"
      className={cx("relative flex w-full min-w-0 flex-col p-3", className)}
      {...props}
    />
  ),
);
SidebarGroup.displayName = "SidebarGroup";

const SidebarGroupContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="group-content"
      className={cx("w-full text-sm", className)}
      {...props}
    />
  ),
);
SidebarGroupContent.displayName = "SidebarGroupContent";

const SidebarMenu = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      data-sidebar="menu"
      // Sur téléphone les entrées s'alignent et défilent : empilées, elles
      // repousseraient le premier chiffre sous la ligne de flottaison.
      className={cx(
        "-mx-1 flex w-full min-w-0 gap-1 overflow-x-auto px-1 pb-1",
        "lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0",
        className,
      )}
      {...props}
    />
  ),
);
SidebarMenu.displayName = "SidebarMenu";

const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cx("min-w-0 shrink-0 lg:shrink", className)} {...props} />
  ),
);
SidebarMenuItem.displayName = "SidebarMenuItem";

/**
 * Une entrée de premier niveau.
 *
 * L'onglet ouvert se marque par la pastille claire et le noir plein, pas par
 * une couleur d'accent : le système n'en a pas.
 */
const SidebarLink = React.forwardRef<
  HTMLAnchorElement,
  Omit<React.ComponentPropsWithoutRef<typeof Link>, "href"> & {
    href: string;
    children: React.ReactNode;
    icon?: React.ElementType;
    isActive?: boolean;
    notifications?: number | boolean;
    /**
     * Pastille posée à droite de l'entrée, à la place du compteur : elle nomme
     * l'offre qui ouvrirait une section fermée (« Coup de Boost »,
     * « Tout-en-un »).
     */
    badge?: React.ReactNode;
  }
>(({ children, href, isActive, icon, notifications, badge, className, ...props }, ref) => {
  const Icon = icon;
  return (
    <Link
      ref={ref}
      href={href}
      aria-current={isActive ? "page" : undefined}
      data-active={isActive}
      className={cx(
        "flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors duration-200",
        "text-steel hover:bg-mist/70 hover:text-ink",
        "data-[active=true]:bg-mist data-[active=true]:font-semibold data-[active=true]:text-obsidian",
        focusRing,
        className,
      )}
      {...props}
    >
      <span className="flex min-w-0 items-center gap-x-2.5">
        {Icon && <Icon className="size-[18px] shrink-0" aria-hidden="true" />}
        <span className="truncate">{children}</span>
      </span>
      {badge}
      {!badge && notifications && (
        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-obsidian text-xs font-medium text-white">
          {notifications}
        </span>
      )}
    </Link>
  );
});
SidebarLink.displayName = "SidebarLink";

const SidebarMenuSub = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      data-sidebar="menu-sub"
      className={cx("relative space-y-1 border-l border-transparent", className)}
      {...props}
    />
  ),
);
SidebarMenuSub.displayName = "SidebarMenuSub";

/** Une entrée de second niveau : retrait à gauche, filet devant l'active. */
const SidebarSubLink = React.forwardRef<
  HTMLAnchorElement,
  Omit<React.ComponentPropsWithoutRef<typeof Link>, "href"> & {
    href: string;
    children: React.ReactNode;
    isActive?: boolean;
  }
>(({ children, href, isActive, className, ...props }, ref) => (
  <Link
    ref={ref}
    href={href}
    aria-current={isActive ? "page" : undefined}
    data-active={isActive}
    className={cx(
      "relative flex cursor-pointer gap-2 rounded-xl py-1.5 pl-9 pr-3 text-sm transition-colors duration-200",
      "text-steel hover:text-ink",
      "data-[active=true]:bg-surface data-[active=true]:font-medium data-[active=true]:text-obsidian data-[active=true]:ring-1 data-[active=true]:ring-border",
      focusRing,
      className,
    )}
    {...props}
  >
    {isActive && (
      <span
        className="absolute left-4 top-1/2 h-5 w-px -translate-y-1/2 bg-obsidian"
        aria-hidden="true"
      />
    )}
    {children}
  </Link>
));
SidebarSubLink.displayName = "SidebarSubLink";

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarLink,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarProvider,
  SidebarSubLink,
};
