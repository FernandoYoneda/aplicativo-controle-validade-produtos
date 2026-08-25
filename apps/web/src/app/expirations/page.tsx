import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "../../components/auth/logout-button";
import { ExpirationsManager } from "../../components/expirations/expirations-manager";
import { getAuthenticatedUser } from "../../lib/auth";
import { getExpirations } from "../../lib/expirations";
import { getStores } from "../../lib/stores";
import type { AuthenticatedUser } from "../../types/auth";
import type { ExpirationRecord } from "../../types/expiration";
import type { Store } from "../../types/store";

export const metadata: Metadata = {
  title: "Gerenciamento de validades",
};

export default async function ExpirationsPage() {
  let user: AuthenticatedUser | null = null;

  try {
    user = await getAuthenticatedUser();
  } catch {
    user = null;
  }

  if (!user) {
    redirect("/login");
  }

  const isAdmin = user.role === "ADMIN";

  let expirations: ExpirationRecord[] | null = null;
  let stores: Store[] | null = [];
  let loadError = false;

  try {
    [expirations, stores] = await Promise.all([
      getExpirations(),
      isAdmin ? getStores() : Promise.resolve([]),
    ]);
  } catch {
    loadError = true;
  }

  if (!loadError && (!expirations || (isAdmin && !stores))) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[var(--casabella-background)]">
      <header className="border-b border-[var(--casabella-border)] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" aria-label="Voltar ao painel">
              <Image
                className="h-auto w-[150px] sm:w-[180px]"
                src="/brand/casabella-horizontal.png"
                alt="Grupo CasaBella Fragrâncias"
                width={360}
                height={203}
                priority
              />
            </Link>

            <div className="hidden h-9 w-px bg-[var(--casabella-border)] sm:block" />

            <div className="hidden sm:block">
              <p className="text-sm font-bold text-[var(--casabella-teal-dark)]">
                Controle de Validade
              </p>
              <p className="text-xs text-[var(--casabella-muted)]">
                Gerenciamento de validades
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="max-w-52 truncate text-sm font-semibold text-[var(--casabella-graphite)]">
                {user.name}
              </p>
              <p className="text-xs text-[var(--casabella-muted)]">
                {isAdmin ? "Administrador" : "Usuário da loja"}
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
            className="absolute -top-24 -right-20 size-64 rounded-full border-[45px] border-white/6"
            aria-hidden="true"
          />

          <div
            className="absolute -right-10 bottom-8 h-1.5 w-52 rotate-[-11deg] rounded-full bg-[var(--casabella-coral)]"
            aria-hidden="true"
          />

          <div className="relative z-10 max-w-2xl">
            <p className="text-sm font-bold tracking-[0.18em] text-[var(--casabella-coral)] uppercase">
              Operação
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Gerenciamento de validades
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              Acompanhe lotes, quantidades e datas de validade dos produtos por
              unidade.
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
                Não foi possível carregar as validades
              </h2>

              <p className="mt-2 text-sm leading-6 text-red-700">
                Verifique se a API está disponível e tente novamente.
              </p>

              <Link
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-red-700 px-4 text-sm font-semibold text-white transition hover:bg-red-800"
                href="/expirations"
              >
                Tentar novamente
              </Link>
            </div>
          ) : (
            <ExpirationsManager
              initialExpirations={expirations ?? []}
              isAdmin={isAdmin}
              stores={stores ?? []}
            />
          )}
        </section>

        <footer className="mt-10 border-t border-[var(--casabella-border)] py-6 text-center text-xs text-[var(--casabella-muted)]">
          Grupo CasaBella Fragrâncias · Sistema interno de gestão
        </footer>
      </div>
    </main>
  );
}
