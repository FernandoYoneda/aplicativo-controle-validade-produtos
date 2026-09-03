import Image from "next/image";
import Link from "next/link";

import type { AuthenticatedUser } from "../../types/auth";
import { AppNavigationMenu } from "./app-navigation-menu";

interface AppHeaderProps {
  section: string;
  user: AuthenticatedUser;
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

          <AppNavigationMenu appVersion={appVersion} user={user} />
        </div>
      </div>
    </header>
  );
}
