import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "../../components/auth/logout-button";
import { UsersManager } from "../../components/users/users-manager";
import { getAuthenticatedUser } from "../../lib/auth";
import { getStores } from "../../lib/stores";
import { getStoreUsers } from "../../lib/users";
import type { AuthenticatedUser } from "../../types/auth";
import type { Store } from "../../types/store";
import type { StoreUser } from "../../types/user";

export const metadata: Metadata = {
  title: "Gerenciamento de usuários",
};

export default async function UsersPage() {
  let authenticatedUser: AuthenticatedUser | null = null;

  try {
    authenticatedUser = await getAuthenticatedUser();
  } catch {
    authenticatedUser = null;
  }

  if (!authenticatedUser) {
    redirect("/login");
  }

  if (authenticatedUser.role !== "ADMIN") {
    redirect("/");
  }

  let users: StoreUser[] | null = null;
  let stores: Store[] | null = null;
  let loadError = false;

  try {
    [users, stores] = await Promise.all([getStoreUsers(), getStores()]);
  } catch {
    loadError = true;
  }

  if (!loadError && (!users || !stores)) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[var(--casabella-background)]">
      <header className="border-b border-[var(--casabella-border)] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" aria-label="Voltar ao painel">
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

            <div className="hidden sm:block">
              <p className="text-sm font-bold text-[var(--casabella-teal-dark)]">
                Controle de Validade
              </p>
              <p className="text-xs text-[var(--casabella-muted)]">
                Gerenciamento de usuários
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="max-w-52 truncate text-sm font-semibold text-[var(--casabella-graphite)]">
                {authenticatedUser.name}
              </p>
              <p className="text-xs text-[var(--casabella-muted)]">
                Administrador
              </p>
            </div>

            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <nav aria-label="Navegação estrutural">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--casabella-teal)] transition hover:text-[var(--casabella-teal-dark)]"
            href="/"
          >
            <span aria-hidden="true">←</span>
            Voltar ao painel
          </Link>
        </nav>

        <section className="relative mt-5 overflow-hidden rounded-3xl bg-[var(--casabella-teal)] px-6 py-8 text-white shadow-[0_20px_60px_rgba(0,67,77,0.13)] sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="absolute -top-24 -right-20 size-64 rounded-full border-[45px] border-white/6"
          />
          <div
            aria-hidden="true"
            className="absolute -right-10 bottom-8 h-1.5 w-52 rotate-[-11deg] rounded-full bg-[var(--casabella-coral)]"
          />

          <div className="relative z-10 max-w-2xl">
            <p className="text-sm font-bold tracking-[0.18em] text-[var(--casabella-coral)] uppercase">
              Administração
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Gerenciamento de usuários
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              Cadastre e mantenha atualizados os usuários responsáveis pelas
              operações das lojas.
            </p>
          </div>
        </section>

        <section className="mt-7">
          {loadError ? (
            <div
              className="rounded-2xl border border-red-200 bg-red-50 p-6"
              role="alert"
            >
              <h2 className="font-bold text-red-800">
                Não foi possível carregar os usuários
              </h2>
              <p className="mt-2 text-sm leading-6 text-red-700">
                Verifique se a API está disponível e tente novamente.
              </p>
              <Link
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-red-700 px-4 text-sm font-semibold text-white transition hover:bg-red-800"
                href="/users"
              >
                Tentar novamente
              </Link>
            </div>
          ) : (
            <UsersManager initialUsers={users ?? []} stores={stores ?? []} />
          )}
        </section>

        <footer className="mt-10 border-t border-[var(--casabella-border)] py-6 text-center text-xs text-[var(--casabella-muted)]">
          Grupo CasaBella Fragrâncias · Sistema interno de gestão
        </footer>
      </div>
    </main>
  );
}
