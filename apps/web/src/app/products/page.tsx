import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "../../components/auth/logout-button";
import { ProductsManager } from "../../components/products/products-manager";
import { getAuthenticatedUser } from "../../lib/auth";
import { getProducts } from "../../lib/products";
import type { AuthenticatedUser } from "../../types/auth";
import type { Product } from "../../types/product";

export const metadata: Metadata = {
  title: "Gerenciamento de produtos",
};

export default async function ProductsPage() {
  let user: AuthenticatedUser | null = null;

  try {
    user = await getAuthenticatedUser();
  } catch {
    user = null;
  }

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/");
  }

  let products: Product[] | null = null;
  let loadError = false;

  try {
    products = await getProducts();
  } catch {
    loadError = true;
  }

  if (!loadError && !products) {
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
                Gerenciamento de produtos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="max-w-52 truncate text-sm font-semibold text-[var(--casabella-graphite)]">
                {user.name}
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
            className="absolute -top-24 -right-20 size-64 rounded-full border-[45px] border-white/6"
            aria-hidden="true"
          />

          <div
            className="absolute -right-10 bottom-8 h-1.5 w-52 rotate-[-11deg] rounded-full bg-[var(--casabella-coral)]"
            aria-hidden="true"
          />

          <div className="relative z-10 max-w-2xl">
            <p className="text-sm font-bold tracking-[0.18em] text-[var(--casabella-coral)] uppercase">
              Catálogo
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Gerenciamento de produtos
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              Consulte e mantenha atualizado o catálogo de produtos do Grupo
              CasaBella.
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
                Não foi possível carregar os produtos
              </h2>

              <p className="mt-2 text-sm leading-6 text-red-700">
                Verifique se a API está disponível e tente novamente.
              </p>

              <Link
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-red-700 px-4 text-sm font-semibold text-white transition hover:bg-red-800"
                href="/products"
              >
                Tentar novamente
              </Link>
            </div>
          ) : (
            <ProductsManager initialProducts={products ?? []} />
          )}
        </section>

        <footer className="mt-10 border-t border-[var(--casabella-border)] py-6 text-center text-xs text-[var(--casabella-muted)]">
          Grupo CasaBella Fragrâncias · Sistema interno de gestão
        </footer>
      </div>
    </main>
  );
}
