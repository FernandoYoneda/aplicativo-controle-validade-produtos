import Image from "next/image";
import Link from "next/link";

import type { AuthenticatedUser } from "../../types/auth";
import { AppNavigationMenu } from "./app-navigation-menu";

interface AppHeaderProps {
  section: string;
  user: AuthenticatedUser;
}

function ScanIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M7 9v6M10 9v6M14 9v6M17 9v6" />
    </svg>
  );
}

export function AppHeader({ section, user }: AppHeaderProps) {
  const appVersion = process.env.APP_VERSION ?? "desenvolvimento";

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--casabella-border)] bg-white shadow-[0_4px_18px_rgba(0,67,77,0.04)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" aria-label="Ir para o painel">
            <Image
              alt="Grupo CasaBella Fragrâncias"
              className="h-auto w-[150px] sm:w-[180px]"
              height={203}
              priority
              src="/brand/casabella-horizontal.png"
              width={360}
            />
          </Link>

          <div className="hidden h-9 w-px bg-[var(--casabella-border)] sm:block" />

          <div className="hidden min-w-0 sm:block">
            <p className="text-sm font-bold text-[var(--casabella-teal-dark)]">
              Controle de Validade
            </p>
            <p className="truncate text-xs text-[var(--casabella-muted)]">
              {section}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right lg:block">
            <p className="max-w-52 truncate text-sm font-semibold text-[var(--casabella-graphite)]">
              {user.name}
            </p>
            <p className="text-xs text-[var(--casabella-muted)]">
              {user.role === "ADMIN" ? "Administrador" : "Usuário da loja"}
            </p>
          </div>

          <Link
            className="hidden h-11 items-center justify-center gap-2 rounded-xl bg-[var(--casabella-teal)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--casabella-teal-dark)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--casabella-coral)] md:inline-flex"
            href="/expirations?action=write-off"
          >
            <ScanIcon />
            Escanear produto
          </Link>

          <AppNavigationMenu appVersion={appVersion} user={user} />
        </div>
      </div>

      <Link
        aria-label="Escanear produto para dar baixa"
        className="mobile-quick-scan fixed right-5 bottom-5 z-30 inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[var(--casabella-teal)] px-5 text-sm font-bold text-white shadow-[0_12px_35px_rgba(0,67,77,0.3)] transition duration-200 hover:bg-[var(--casabella-teal-dark)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--casabella-coral)] md:hidden"
        href="/expirations?action=write-off"
      >
        <ScanIcon />
        Escanear
      </Link>
    </header>
  );
}
