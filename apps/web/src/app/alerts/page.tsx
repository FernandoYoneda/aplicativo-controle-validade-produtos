import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ExpirationAlertsManager } from "../../components/alerts/expiration-alerts-manager";
import { LogoutButton } from "../../components/auth/logout-button";
import { AppFooter } from "../../components/layout/app-footer";
import { getAuthenticatedUser } from "../../lib/auth";
import { getExpirationAlerts } from "../../lib/expirations";
import { getStores } from "../../lib/stores";
import type { AuthenticatedUser } from "../../types/auth";
import type { ExpirationAlertPage } from "../../types/expiration";
import type { Store } from "../../types/store";

export const metadata: Metadata = {
  title: "Central de alertas",
};

export default async function AlertsPage() {
  let user: AuthenticatedUser | null = null;

  try {
    user = await getAuthenticatedUser();
  } catch {
    user = null;
  }

  if (!user) redirect("/login");

  const isAdmin = user.role === "ADMIN";
  let alerts: ExpirationAlertPage | null = null;
  let stores: Store[] | null = [];
  let loadError = false;

  try {
    [alerts, stores] = await Promise.all([
      getExpirationAlerts(),
      isAdmin ? getStores() : Promise.resolve([]),
    ]);
  } catch {
    loadError = true;
  }

  if (!loadError && (!alerts || (isAdmin && !stores))) redirect("/login");

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
                Central de alertas
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
            <span aria-hidden="true">←</span> Voltar ao painel
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
              Acompanhamento
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Central de alertas
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              Produtos vencidos e com vencimento nos próximos 30 dias,
              organizados para acompanhamento da equipe.
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
                Não foi possível carregar os alertas
              </h2>
              <p className="mt-2 text-sm leading-6 text-red-700">
                Verifique se a API está disponível e tente novamente.
              </p>
              <Link
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-red-700 px-4 text-sm font-semibold text-white"
                href="/alerts"
              >
                Tentar novamente
              </Link>
            </div>
          ) : (
            <ExpirationAlertsManager
              initialPage={alerts!}
              isAdmin={isAdmin}
              stores={stores ?? []}
            />
          )}
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
