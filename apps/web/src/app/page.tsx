import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "../components/auth/logout-button";
import { getAuthenticatedUser } from "../lib/auth";
import type { AuthenticatedUser } from "../types/auth";

export const metadata: Metadata = {
  title: "Painel administrativo",
};

const modules = [
  {
    number: "01",
    title: "Lojas",
    description:
      "Consulte, cadastre, atualize, ative e inative as lojas do grupo.",
    status: "API disponível",
    href: "/stores",
  },
  {
    number: "02",
    title: "Usuários",
    description:
      "Gerencie os usuários responsáveis pelas operações de cada loja.",
    status: "API disponível",
    href: null,
  },
  {
    number: "03",
    title: "Produtos",
    description: "Acompanhe produtos e seus respectivos prazos de validade.",
    status: "Próxima etapa",
    href: null,
  },
];

function getRoleLabel(role: AuthenticatedUser["role"]): string {
  return role === "ADMIN" ? "Administrador" : "Usuário de loja";
}

export default async function Home() {
  let user: AuthenticatedUser | null = null;

  try {
    user = await getAuthenticatedUser();
  } catch {
    user = null;
  }

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[var(--casabella-background)]">
      <header className="border-b border-[var(--casabella-border)] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-4">
            <Image
              className="h-auto w-[150px] sm:w-[180px]"
              src="/brand/casabella-horizontal.png"
              alt="Grupo CasaBella Fragrâncias"
              width={360}
              height={203}
              priority
            />

            <div className="hidden h-9 w-px bg-[var(--casabella-border)] sm:block" />

            <div className="hidden sm:block">
              <p className="text-sm font-bold text-[var(--casabella-teal-dark)]">
                Controle de Validade
              </p>

              <p className="text-xs text-[var(--casabella-muted)]">
                Área administrativa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="max-w-52 truncate text-sm font-semibold text-[var(--casabella-graphite)]">
                {user.name}
              </p>

              <p className="text-xs text-[var(--casabella-muted)]">
                {getRoleLabel(user.role)}
              </p>
            </div>

            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <section className="relative overflow-hidden rounded-3xl bg-[var(--casabella-teal)] px-6 py-8 text-white shadow-[0_20px_60px_rgba(0,67,77,0.13)] sm:px-10 sm:py-10">
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
              Visão geral
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Olá, {user.name.split(" ")[0]}!
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              Bem-vindo ao painel de controle de validade da CasaBella.
              Selecione uma área para começar.
            </p>
          </div>
        </section>

        <section className="mt-9">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold tracking-[0.15em] text-[var(--casabella-coral)] uppercase">
                Administração
              </p>

              <h2 className="mt-1 text-2xl font-bold text-[var(--casabella-teal-dark)]">
                Áreas do sistema
              </h2>
            </div>

            <p className="text-sm text-[var(--casabella-muted)]">
              Sessão protegida por autenticação
            </p>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => (
              <article
                className="group flex min-h-64 flex-col rounded-2xl border border-[var(--casabella-border)] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[var(--casabella-teal)] hover:shadow-[0_18px_45px_rgba(0,67,77,0.09)]"
                key={module.title}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--casabella-teal-soft)] text-sm font-bold text-[var(--casabella-teal-dark)]">
                    {module.number}
                  </span>

                  <span className="rounded-full bg-[var(--casabella-background)] px-3 py-1 text-xs font-semibold text-[var(--casabella-muted)]">
                    {module.status}
                  </span>
                </div>

                <h3 className="mt-6 text-xl font-bold text-[var(--casabella-teal-dark)]">
                  {module.title}
                </h3>

                <p className="mt-2 flex-1 text-sm leading-6 text-[var(--casabella-muted)]">
                  {module.description}
                </p>

                {module.href ? (
                  <Link
                    className="mt-5 border-t border-[var(--casabella-border)] pt-4 text-sm font-semibold text-[var(--casabella-teal)] transition group-hover:text-[var(--casabella-teal-dark)]"
                    href={module.href}
                  >
                    Acessar módulo <span aria-hidden="true">→</span>
                  </Link>
                ) : (
                  <p className="mt-5 border-t border-[var(--casabella-border)] pt-4 text-sm font-semibold text-[var(--casabella-muted)]">
                    Interface em preparação
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-10 border-t border-[var(--casabella-border)] py-6 text-center text-xs text-[var(--casabella-muted)]">
          Grupo CasaBella Fragrâncias · Sistema interno de gestão
        </footer>
      </div>
    </main>
  );
}
