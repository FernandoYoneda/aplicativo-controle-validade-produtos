import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppFooter } from "../../components/layout/app-footer";
import { AppHeader } from "../../components/layout/app-header";
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
      <AppHeader section="Gerenciamento de usuários" user={authenticatedUser} />

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <section className="relative overflow-hidden rounded-3xl bg-[var(--casabella-teal)] px-6 py-8 text-white shadow-[0_20px_60px_rgba(0,67,77,0.13)] sm:px-10 sm:py-10">
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

        <AppFooter />
      </div>
    </main>
  );
}
