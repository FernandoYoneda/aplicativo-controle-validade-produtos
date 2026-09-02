"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { AuthenticatedUser } from "../../types/auth";
import { LogoutButton } from "../auth/logout-button";

interface AppNavigationMenuProps {
  appVersion: string;
  user: AuthenticatedUser;
}

type NavigationIconName =
  | "home"
  | "alerts"
  | "expirations"
  | "products"
  | "stores"
  | "users";

interface NavigationItem {
  href: string;
  icon: NavigationIconName;
  label: string;
  adminOnly?: boolean;
}

const navigationItems: NavigationItem[] = [
  { href: "/", icon: "home", label: "Painel" },
  { href: "/alerts", icon: "alerts", label: "Alertas" },
  { href: "/expirations", icon: "expirations", label: "Validades" },
  { href: "/products", icon: "products", label: "Produtos", adminOnly: true },
  { href: "/stores", icon: "stores", label: "Lojas", adminOnly: true },
  { href: "/users", icon: "users", label: "Usuários", adminOnly: true },
];

function NavigationIcon({ name }: { name: NavigationIconName }) {
  const commonProps = {
    "aria-hidden": true,
    className: "size-5 shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  if (name === "home") {
    return (
      <svg {...commonProps}>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9M9 20v-6h6v6" />
      </svg>
    );
  }

  if (name === "alerts") {
    return (
      <svg {...commonProps}>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
    );
  }

  if (name === "expirations") {
    return (
      <svg {...commonProps}>
        <rect height="17" rx="2" width="18" x="3" y="4" />
        <path d="M8 2v4M16 2v4M3 9h18M12 13v4M10 15h4" />
      </svg>
    );
  }

  if (name === "products") {
    return (
      <svg {...commonProps}>
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m4.5 7.5 7.5 4 7.5-4M12 11.5V21" />
      </svg>
    );
  }

  if (name === "stores") {
    return (
      <svg {...commonProps}>
        <path d="M4 10v10h16V10M3 10l2-6h14l2 6" />
        <path d="M8 20v-6h8v6M3 10c1 2 3 2 4.5 0 1 2 3.5 2 4.5 0 1 2 3.5 2 4.5 0 1.5 2 3.5 2 4.5 0" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function AppNavigationMenu({
  appVersion,
  user,
}: AppNavigationMenuProps) {
  const pathname = usePathname();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const isAdmin = user.role === "ADMIN";
  const availableItems = navigationItems.filter(
    (item) => !item.adminOnly || isAdmin,
  );

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        menuButtonRef.current?.focus();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  function closeMenu() {
    setIsOpen(false);
    window.setTimeout(() => menuButtonRef.current?.focus(), 0);
  }

  return (
    <>
      <button
        aria-controls="application-navigation"
        aria-expanded={isOpen}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--casabella-border)] bg-white px-3 text-sm font-bold text-[var(--casabella-teal-dark)] transition hover:border-[var(--casabella-teal)] hover:bg-[var(--casabella-teal-soft)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--casabella-coral)]"
        onClick={() => setIsOpen(true)}
        ref={menuButtonRef}
        type="button"
      >
        <span aria-hidden="true" className="flex flex-col gap-1.5">
          <span className="h-0.5 w-5 rounded-full bg-current" />
          <span className="h-0.5 w-5 rounded-full bg-current" />
          <span className="h-0.5 w-5 rounded-full bg-current" />
        </span>
        <span className="hidden sm:inline">Menu</span>
        <span className="sr-only sm:hidden">Abrir menu</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 cursor-default bg-zinc-950/45 backdrop-blur-[2px]"
            onClick={closeMenu}
            type="button"
          />

          <aside
            aria-label="Menu principal"
            aria-modal="true"
            className="absolute top-0 right-0 flex h-full w-[min(90vw,380px)] flex-col bg-white shadow-[-20px_0_60px_rgba(0,0,0,0.18)]"
            id="application-navigation"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--casabella-border)] px-6 py-5">
              <div>
                <p className="text-xs font-bold tracking-[0.16em] text-[var(--casabella-coral)] uppercase">
                  Navegação
                </p>
                <h2 className="mt-1 text-xl font-bold text-[var(--casabella-teal-dark)]">
                  Menu do sistema
                </h2>
              </div>
              <button
                aria-label="Fechar menu"
                className="flex size-10 items-center justify-center rounded-full border border-[var(--casabella-border)] text-xl text-[var(--casabella-muted)] transition hover:border-[var(--casabella-coral)] hover:text-[var(--casabella-coral-dark)]"
                onClick={closeMenu}
                ref={closeButtonRef}
                type="button"
              >
                ×
              </button>
            </div>

            <nav
              aria-label="Áreas do sistema"
              className="flex-1 overflow-y-auto px-4 py-5"
            >
              <ul className="space-y-1">
                {availableItems.map((item) => {
                  const isCurrent = pathname === item.href;

                  return (
                    <li key={item.href}>
                      <Link
                        aria-current={isCurrent ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                          isCurrent
                            ? "bg-[var(--casabella-teal)] text-white shadow-sm"
                            : "text-[var(--casabella-graphite)] hover:bg-[var(--casabella-teal-soft)] hover:text-[var(--casabella-teal-dark)]"
                        }`}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                      >
                        <NavigationIcon name={item.icon} />
                        <span>{item.label}</span>
                        {isCurrent ? (
                          <span className="ml-auto text-xs font-medium text-white/70">
                            Atual
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="border-t border-[var(--casabella-border)] bg-[var(--casabella-background)] px-6 py-5">
              <p className="truncate text-sm font-bold text-[var(--casabella-teal-dark)]">
                {user.name}
              </p>
              <p className="mt-0.5 text-xs text-[var(--casabella-muted)]">
                {isAdmin ? "Administrador" : "Usuário da loja"}
              </p>
              <p className="mt-1 text-xs text-[var(--casabella-muted)]">
                Versão {appVersion}
              </p>
              <LogoutButton className="mt-4 w-full" />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
