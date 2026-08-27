import Link from "next/link";

import type { ExpirationOverview as ExpirationOverviewData } from "../../types/expiration";

interface ExpirationOverviewProps {
  overview: ExpirationOverviewData | null;
  isAdmin: boolean;
  loadError: boolean;
}

const millisecondsPerDay = 1000 * 60 * 60 * 24;

function getExpirationTimestamp(value: string): number {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);

  return Date.UTC(year, month - 1, day);
}

function getTodayTimestamp(): number {
  const today = new Date();

  return Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
}

function getDaysUntilExpiration(value: string): number {
  return Math.round(
    (getExpirationTimestamp(value) - getTodayTimestamp()) / millisecondsPerDay,
  );
}

function formatExpirationDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`));
}

function getPriorityStatus(daysUntilExpiration: number): {
  label: string;
  className: string;
} {
  if (daysUntilExpiration < 0) {
    const overdueDays = Math.abs(daysUntilExpiration);

    return {
      label:
        overdueDays === 1
          ? "Vencido há 1 dia"
          : `Vencido há ${overdueDays} dias`,
      className: "bg-red-50 text-red-700",
    };
  }

  if (daysUntilExpiration === 0) {
    return {
      label: "Vence hoje",
      className: "bg-red-50 text-red-700",
    };
  }

  if (daysUntilExpiration === 1) {
    return {
      label: "Vence amanhã",
      className: "bg-amber-50 text-amber-700",
    };
  }

  return {
    label: `Vence em ${daysUntilExpiration} dias`,
    className: "bg-amber-50 text-amber-700",
  };
}

export function ExpirationOverview({
  overview,
  isAdmin,
  loadError,
}: ExpirationOverviewProps) {
  const summary = overview?.summary;
  const priorityExpirations = overview?.priorityItems ?? [];
  const activeRecords = summary
    ? summary.totalRecords - summary.inactiveRecords
    : 0;
  const expiredRecords = summary?.expiredRecords ?? 0;
  const upcomingRecords = summary?.upcomingRecords ?? 0;
  const alertRecords = expiredRecords + upcomingRecords;

  const indicators = [
    {
      label: "Registros ativos",
      value: activeRecords,
      valueClassName: "text-[var(--casabella-teal-dark)]",
    },
    {
      label: "Produtos vencidos",
      value: summary?.expiredRecords ?? 0,
      valueClassName: "text-red-700",
    },
    {
      label: "Próximos 30 dias",
      value: summary?.upcomingRecords ?? 0,
      valueClassName: "text-amber-700",
    },
    {
      label: "De 31 dias a 3 meses",
      value: summary?.threeMonthRecords ?? 0,
      valueClassName: "text-yellow-700",
    },
    {
      label: "De 3 a 6 meses",
      value: summary?.sixMonthRecords ?? 0,
      valueClassName: "text-lime-700",
    },
    {
      label: "De 6 meses a 1 ano",
      value: summary?.oneYearRecords ?? 0,
      valueClassName: "text-emerald-700",
    },
    {
      label: "Acima de 1 ano",
      value: summary?.beyondOneYearRecords ?? 0,
      valueClassName: "text-emerald-700",
    },
    {
      label: "Registros inativos",
      value: summary?.inactiveRecords ?? 0,
      valueClassName: "text-[var(--casabella-coral-dark)]",
    },
  ];

  return (
    <section className="mt-9" aria-labelledby="expiration-overview-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-[0.15em] text-[var(--casabella-coral)] uppercase">
            Monitoramento
          </p>

          <h2
            className="mt-1 text-2xl font-bold text-[var(--casabella-teal-dark)]"
            id="expiration-overview-title"
          >
            Situação das validades
          </h2>

          <p className="mt-1 text-sm text-[var(--casabella-muted)]">
            {isAdmin
              ? "Visão consolidada dos registros de todas as lojas."
              : "Visão dos registros vinculados à sua loja."}
          </p>
        </div>

        <Link
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm font-semibold text-[var(--casabella-teal)] transition hover:border-[var(--casabella-teal)] hover:text-[var(--casabella-teal-dark)]"
          href="/expirations"
        >
          Ver todas as validades
        </Link>
      </div>

      {loadError ? (
        <div
          className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-6"
          role="alert"
        >
          <h3 className="font-bold text-red-800">
            Não foi possível carregar os indicadores
          </h3>

          <p className="mt-2 text-sm leading-6 text-red-700">
            Verifique se a API está disponível e atualize a página.
          </p>
        </div>
      ) : (
        <>
          {alertRecords > 0 ? (
            <div
              className={`mt-5 flex flex-col gap-4 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
                expiredRecords > 0
                  ? "border-red-200 bg-red-50"
                  : "border-amber-200 bg-amber-50"
              }`}
              role="alert"
            >
              <div>
                <p
                  className={`font-bold ${
                    expiredRecords > 0 ? "text-red-800" : "text-amber-800"
                  }`}
                >
                  Alerta de validade
                </p>

                <p
                  className={`mt-1 text-sm ${
                    expiredRecords > 0 ? "text-red-700" : "text-amber-700"
                  }`}
                >
                  {expiredRecords > 0
                    ? `${expiredRecords} ${expiredRecords === 1 ? "registro está vencido" : "registros estão vencidos"}`
                    : "Nenhum registro vencido"}
                  {" e "}
                  {upcomingRecords}{" "}
                  {upcomingRecords === 1
                    ? "vence nos próximos 30 dias."
                    : "vencem nos próximos 30 dias."}
                </p>
              </div>

              <Link
                className={`inline-flex h-10 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white transition ${
                  expiredRecords > 0
                    ? "bg-red-700 hover:bg-red-800"
                    : "bg-amber-700 hover:bg-amber-800"
                }`}
                href="/expirations"
              >
                Ver validades
              </Link>
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {indicators.map((indicator) => (
              <article
                className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm"
                key={indicator.label}
              >
                <p className="text-sm text-[var(--casabella-muted)]">
                  {indicator.label}
                </p>

                <p
                  className={`mt-2 text-3xl font-bold ${indicator.valueClassName}`}
                >
                  {indicator.value}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--casabella-border)] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--casabella-border)] px-5 py-5 sm:px-6">
              <div>
                <h3 className="text-lg font-bold text-[var(--casabella-teal-dark)]">
                  Registros prioritários
                </h3>

                <p className="mt-1 text-sm text-[var(--casabella-muted)]">
                  Produtos vencidos ou com vencimento nos próximos 30 dias.
                </p>
              </div>

              {priorityExpirations.length > 0 ? (
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                  {priorityExpirations.length}{" "}
                  {priorityExpirations.length === 1
                    ? "prioridade"
                    : "prioridades"}
                </span>
              ) : null}
            </div>

            {priorityExpirations.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="font-bold text-emerald-700">
                  Nenhuma validade exige atenção imediata
                </p>

                <p className="mt-2 text-sm text-[var(--casabella-muted)]">
                  Não existem produtos ativos vencidos ou próximos do
                  vencimento.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--casabella-border)]">
                {priorityExpirations.map((expiration) => {
                  const product = expiration.storeProduct.product;
                  const store = expiration.storeProduct.store;
                  const daysUntilExpiration = getDaysUntilExpiration(
                    expiration.expirationDate,
                  );
                  const status = getPriorityStatus(daysUntilExpiration);

                  return (
                    <article
                      className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_130px_160px] lg:items-center"
                      key={expiration.id}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold tracking-[0.12em] text-[var(--casabella-muted)] uppercase">
                          Produto
                        </p>

                        <p className="mt-1 truncate font-bold text-[var(--casabella-graphite)]">
                          {product.code} — {product.name}
                        </p>

                        <p className="mt-1 truncate text-xs text-[var(--casabella-muted)]">
                          {expiration.batchNumber
                            ? `Lote: ${expiration.batchNumber}`
                            : "Sem lote informado"}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-bold tracking-[0.12em] text-[var(--casabella-muted)] uppercase">
                          Loja
                        </p>

                        <p className="mt-1 truncate text-sm font-semibold text-[var(--casabella-graphite)]">
                          {store.code} — {store.name}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold tracking-[0.12em] text-[var(--casabella-muted)] uppercase">
                          Validade
                        </p>

                        <p className="mt-1 text-sm font-bold text-[var(--casabella-teal-dark)]">
                          {formatExpirationDate(expiration.expirationDate)}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
