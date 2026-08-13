import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "../../components/auth/login-form";
import { getAuthenticatedUser } from "../../lib/auth";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse o sistema de controle de validade da CasaBella.",
};

export default async function LoginPage() {
  let isAuthenticated = false;

  try {
    isAuthenticated = Boolean(await getAuthenticatedUser());
  } catch {
    isAuthenticated = false;
  }

  if (isAuthenticated) {
    redirect("/");
  }

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[var(--casabella-background)]">
      <section className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-[var(--casabella-teal)] p-12 text-white lg:flex xl:p-16">
        <div
          className="absolute -top-40 -right-44 size-[430px] rounded-full border-[70px] border-white/6"
          aria-hidden="true"
        />

        <div
          className="absolute -bottom-52 -left-40 size-[470px] rounded-full bg-[var(--casabella-coral)]/15"
          aria-hidden="true"
        />

        <div
          className="absolute top-[35%] -right-28 h-1.5 w-80 rotate-[-12deg] rounded-full bg-[var(--casabella-coral)]"
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-center gap-3">
          <span className="h-9 w-1.5 rounded-full bg-[var(--casabella-coral)]" />

          <div>
            <p className="text-sm font-bold tracking-[0.22em] uppercase">
              Grupo CasaBella
            </p>
            <p className="mt-1 text-sm text-white/70">Fragrâncias</p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <p className="mb-5 text-sm font-bold tracking-[0.2em] text-[var(--casabella-coral)] uppercase">
            Controle e segurança
          </p>

          <h1 className="text-4xl leading-tight font-bold tracking-tight xl:text-5xl">
            Validade sob controle, qualidade sempre presente.
          </h1>

          <p className="mt-6 max-w-lg text-base leading-7 text-white/75 xl:text-lg">
            Acompanhe produtos, lojas e equipes em um único ambiente
            administrativo, criado para tornar a rotina mais segura e eficiente.
          </p>
        </div>

        <p className="relative z-10 text-sm text-white/55">
          Sistema interno de gestão
        </p>
      </section>

      <section className="relative flex min-h-screen flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div
          className="absolute top-0 right-0 h-2 w-full bg-[var(--casabella-coral)] lg:hidden"
          aria-hidden="true"
        />

        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-[var(--casabella-border)] bg-white px-6 py-8 shadow-[0_24px_70px_rgba(0,67,77,0.10)] sm:px-10 sm:py-10">
            <div className="mb-8 flex justify-center">
              <Image
                className="h-auto w-full max-w-[310px]"
                src="/brand/casabella-horizontal.png"
                alt="Grupo CasaBella Fragrâncias"
                width={520}
                height={293}
                priority
              />
            </div>

            <div className="mb-7">
              <p className="text-sm font-bold tracking-[0.16em] text-[var(--casabella-coral)] uppercase">
                Área restrita
              </p>

              <h2 className="mt-2 text-3xl font-bold tracking-tight text-[var(--casabella-teal-dark)]">
                Bem-vindo
              </h2>

              <p className="mt-2 text-sm leading-6 text-[var(--casabella-muted)]">
                Entre com suas credenciais para acessar o controle de validade.
              </p>
            </div>

            <LoginForm />
          </div>

          <p className="mt-6 text-center text-xs leading-5 text-[var(--casabella-muted)]">
            Acesso exclusivo para usuários autorizados.
          </p>
        </div>
      </section>
    </main>
  );
}
