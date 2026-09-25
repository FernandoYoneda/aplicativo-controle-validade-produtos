import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppFooter } from "../../components/layout/app-footer";
import { AppHeader } from "../../components/layout/app-header";
import { getAuthenticatedUser } from "../../lib/auth";
import {
  createInventoryMovementQueryString,
  getInventoryMovementPage,
  type InventoryMovementQuery,
} from "../../lib/inventory-movements";
import { getStores } from "../../lib/stores";
import type { AuthenticatedUser } from "../../types/auth";
import type {
  InventoryMovementRecord,
  InventoryMovementTypeFilter,
} from "../../types/expiration";
import type { Store } from "../../types/store";

export const metadata: Metadata = {
  title: "Movimentações de estoque",
};

interface MovementsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const movementTypes = new Set<InventoryMovementTypeFilter>([
  "all",
  "entry",
  "adjustment",
  "writeOff",
  "reversal",
]);

const numberFormatter = new Intl.NumberFormat("pt-BR");
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
});

function getSingleValue(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getReasonLabel(movement: InventoryMovementRecord): string {
  if (movement.type !== "WRITE_OFF") return movement.reason;

  return (
    {
      SOLD: "Vendido",
      EXPIRED: "Vencido",
      DISCARDED: "Descartado",
    }[movement.reason] ?? movement.reason
  );
}

function getMovementDelta(movement: InventoryMovementRecord): number {
  return movement.resultingQuantity - movement.previousQuantity;
}

function getMovementQuantityLabel(movement: InventoryMovementRecord): string {
  const delta = getMovementDelta(movement);
  return `${delta >= 0 ? "+" : "−"}${numberFormatter.format(Math.abs(delta))}`;
}

function getMovementQuantityColor(movement: InventoryMovementRecord): string {
  return getMovementDelta(movement) < 0
    ? "text-amber-700"
    : "text-emerald-700";
}

function getPageHref(query: InventoryMovementQuery, page: number): string {
  return `/movements${createInventoryMovementQueryString({ ...query, page })}`;
}

function MovementBadge({ type }: Pick<InventoryMovementRecord, "type">) {
  const settings = {
    ENTRY: { label: "Entrada", className: "bg-sky-50 text-sky-800" },
    ADJUSTMENT: { label: "Ajuste", className: "bg-violet-50 text-violet-800" },
    WRITE_OFF: { label: "Baixa", className: "bg-amber-50 text-amber-800" },
    REVERSAL: { label: "Estorno", className: "bg-emerald-50 text-emerald-800" },
  }[type];

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${settings.className}`}
    >
      {settings.label}
    </span>
  );
}

export default async function MovementsPage({
  searchParams,
}: MovementsPageProps) {
  let user: AuthenticatedUser | null = null;
  try {
    user = await getAuthenticatedUser();
  } catch {
    user = null;
  }
  if (!user) redirect("/login");

  const parameters = await searchParams;
  const requestedPage = Number.parseInt(getSingleValue(parameters.page), 10);
  const requestedType = getSingleValue(parameters.type);
  const requestedFrom = getSingleValue(parameters.from);
  const requestedTo = getSingleValue(parameters.to);
  const isAdmin = user.role === "ADMIN";
  const query: InventoryMovementQuery = {
    page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    search: getSingleValue(parameters.search).trim(),
    storeId: isAdmin ? getSingleValue(parameters.storeId) : "",
    type: movementTypes.has(requestedType as InventoryMovementTypeFilter)
      ? (requestedType as InventoryMovementTypeFilter)
      : "all",
    from: isDateOnly(requestedFrom) ? requestedFrom : "",
    to: isDateOnly(requestedTo) ? requestedTo : "",
  };

  let movementPage = null;
  let stores: Store[] | null = [];
  let loadError = false;
  try {
    [movementPage, stores] = await Promise.all([
      getInventoryMovementPage(query),
      isAdmin ? getStores() : Promise.resolve([]),
    ]);
  } catch {
    loadError = true;
  }
  if (!loadError && (!movementPage || (isAdmin && !stores))) redirect("/login");

  const exportQuery = createInventoryMovementQueryString({
    ...query,
    page: undefined,
  });

  return (
    <main className="min-h-screen bg-[var(--casabella-background)]">
      <AppHeader section="Movimentações de estoque" user={user} />

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <Link
          className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm font-semibold text-[var(--casabella-teal)] shadow-sm transition hover:border-[var(--casabella-teal)] hover:bg-[var(--casabella-teal-soft)]"
          href="/"
        >
          <span aria-hidden="true">←</span>
          Voltar ao painel
        </Link>

        <section className="relative overflow-hidden rounded-3xl bg-[var(--casabella-teal)] px-6 py-8 text-white shadow-[0_20px_60px_rgba(0,67,77,0.13)] sm:px-10 sm:py-10">
          <div className="absolute -top-24 -right-20 size-64 rounded-full border-[45px] border-white/6" aria-hidden="true" />
          <div className="absolute -right-10 bottom-8 h-1.5 w-52 rotate-[-11deg] rounded-full bg-[var(--casabella-coral)]" aria-hidden="true" />
          <div className="relative z-10 max-w-2xl">
            <p className="text-sm font-bold tracking-[0.18em] text-[var(--casabella-coral)] uppercase">
              Auditoria
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Movimentações de estoque
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              Consulte entradas, ajustes, baixas e estornos, acompanhe os saldos e exporte o histórico operacional.
            </p>
          </div>
        </section>

        {loadError ? (
          <section className="mt-7 rounded-2xl border border-red-200 bg-red-50 p-6" role="alert">
            <h2 className="font-bold text-red-800">Não foi possível carregar as movimentações</h2>
            <p className="mt-2 text-sm text-red-700">Verifique se a API está disponível e tente novamente.</p>
            <Link className="mt-4 inline-flex h-10 items-center rounded-xl bg-red-700 px-4 text-sm font-semibold text-white" href="/movements">
              Tentar novamente
            </Link>
          </section>
        ) : (
          <>
            <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["Movimentações", movementPage!.summary.total, "text-[var(--casabella-teal-dark)]"],
                ["Unidades de entrada", movementPage!.summary.inboundQuantity, "text-emerald-700"],
                ["Unidades de saída", movementPage!.summary.outboundQuantity, "text-amber-700"],
                ["Variação líquida", movementPage!.summary.netQuantity, "text-[var(--casabella-coral-dark)]"],
              ].map(([label, value, color]) => (
                <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm" key={String(label)}>
                  <p className="text-sm text-[var(--casabella-muted)]">{label}</p>
                  <p className={`mt-2 text-2xl font-bold ${color}`}>{numberFormatter.format(Number(value))}</p>
                </article>
              ))}
            </section>

            <section className="mt-6 overflow-hidden rounded-3xl border border-[var(--casabella-border)] bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-[var(--casabella-border)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <h2 className="text-xl font-bold text-[var(--casabella-teal-dark)]">Histórico operacional</h2>
                  <p className="mt-1 text-sm text-[var(--casabella-muted)]">Os indicadores refletem todos os registros encontrados pelos filtros.</p>
                </div>
                <a className="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 px-5 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100" href={`/api/inventory-movements/export${exportQuery}`}>
                  Exportar Excel
                </a>
              </div>

              <form
                action="/movements"
                className="grid gap-4 border-b border-[var(--casabella-border)] bg-[var(--casabella-background)]/55 p-5 md:grid-cols-2 lg:grid-cols-6 lg:p-6"
                key={createInventoryMovementQueryString(query) || "unfiltered"}
                method="get"
              >
                <label className="md:col-span-2 lg:col-span-2">
                  <span className="text-sm font-bold text-[var(--casabella-graphite)]">Buscar movimentação</span>
                  <input className="mt-2 h-11 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 outline-none focus:border-[var(--casabella-teal)]" defaultValue={query.search} name="search" placeholder="Produto, código, loja, lote ou responsável" />
                </label>
                <label>
                  <span className="text-sm font-bold text-[var(--casabella-graphite)]">Tipo</span>
                  <select className="mt-2 h-11 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-3" defaultValue={query.type} name="type">
                    <option value="all">Todas</option>
                    <option value="entry">Entradas</option>
                    <option value="adjustment">Ajustes</option>
                    <option value="writeOff">Baixas</option>
                    <option value="reversal">Estornos</option>
                  </select>
                </label>
                {isAdmin ? (
                  <label>
                    <span className="text-sm font-bold text-[var(--casabella-graphite)]">Loja</span>
                    <select className="mt-2 h-11 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-3" defaultValue={query.storeId} name="storeId">
                      <option value="">Todas as lojas</option>
                      {(stores ?? []).map((store) => <option key={store.id} value={store.id}>{store.code} — {store.name}</option>)}
                    </select>
                  </label>
                ) : null}
                <label>
                  <span className="text-sm font-bold text-[var(--casabella-graphite)]">De</span>
                  <input className="mt-2 h-11 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-3" defaultValue={query.from} name="from" type="date" />
                </label>
                <label>
                  <span className="text-sm font-bold text-[var(--casabella-graphite)]">Até</span>
                  <input className="mt-2 h-11 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-3" defaultValue={query.to} name="to" type="date" />
                </label>
                <div className="flex gap-2 md:col-span-2 lg:col-span-6 lg:justify-end">
                  <a
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-[var(--casabella-border)] px-5 text-sm font-semibold text-[var(--casabella-muted)] lg:flex-none"
                    href="/movements"
                  >
                    Limpar filtros
                  </a>
                  <button className="h-11 flex-1 rounded-xl bg-[var(--casabella-teal)] px-6 text-sm font-bold text-white lg:flex-none" type="submit">Aplicar filtros</button>
                </div>
              </form>

              {movementPage!.data.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="font-bold text-[var(--casabella-teal-dark)]">Nenhuma movimentação encontrada</p>
                  <p className="mt-2 text-sm text-[var(--casabella-muted)]">Ajuste os filtros para ampliar a consulta.</p>
                </div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[980px] text-left text-sm">
                      <thead className="bg-[var(--casabella-background)] text-xs tracking-[0.12em] text-[var(--casabella-muted)] uppercase">
                        <tr><th className="px-6 py-4">Data</th><th className="px-4 py-4">Tipo</th><th className="px-4 py-4">Produto</th><th className="px-4 py-4">Loja / lote</th><th className="px-4 py-4">Quantidade</th><th className="px-4 py-4">Saldo</th><th className="px-4 py-4">Responsável</th></tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--casabella-border)]">
                        {movementPage!.data.map((movement) => {
                          const product = movement.productLot.storeProduct.product;
                          const store = movement.productLot.storeProduct.store;
                          return (
                            <tr key={movement.id}>
                              <td className="whitespace-nowrap px-6 py-5 text-[var(--casabella-muted)]">{dateTimeFormatter.format(new Date(movement.createdAt))}</td>
                              <td className="px-4 py-5"><MovementBadge type={movement.type} /></td>
                              <td className="max-w-xs px-4 py-5"><p className="font-bold text-[var(--casabella-graphite)]">{product.code} — {product.name}</p><p className="mt-1 text-xs text-[var(--casabella-muted)]">{getReasonLabel(movement)}{movement.notes ? ` · ${movement.notes}` : ""}</p></td>
                              <td className="px-4 py-5"><p className="font-semibold">{store.code} — {store.name}</p><p className="mt-1 text-xs text-[var(--casabella-muted)]">{movement.productLot.batchNumber ?? "Sem lote"} · validade {dateFormatter.format(new Date(movement.productLot.expirationDate))}</p></td>
                              <td className={`px-4 py-5 font-bold ${getMovementQuantityColor(movement)}`}>{getMovementQuantityLabel(movement)}</td>
                              <td className="whitespace-nowrap px-4 py-5">{movement.previousQuantity} → {movement.resultingQuantity}</td>
                              <td className="px-4 py-5"><p className="font-semibold">{movement.performedBy.name}</p><p className="mt-1 text-xs text-[var(--casabella-muted)]">{movement.performedBy.email}</p></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 bg-[var(--casabella-background)]/55 p-4 lg:hidden">
                    {movementPage!.data.map((movement) => {
                      const product = movement.productLot.storeProduct.product;
                      const store = movement.productLot.storeProduct.store;
                      return (
                        <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm" key={movement.id}>
                          <div className="flex items-start justify-between gap-3"><MovementBadge type={movement.type} /><time className="text-xs text-[var(--casabella-muted)]">{dateTimeFormatter.format(new Date(movement.createdAt))}</time></div>
                          <h3 className="mt-4 font-bold text-[var(--casabella-graphite)]">{product.code} — {product.name}</h3>
                          <p className="mt-1 text-sm text-[var(--casabella-muted)]">{store.code} — {store.name} · {movement.productLot.batchNumber ?? "Sem lote"}</p>
                          <div className="mt-4 grid grid-cols-2 gap-3"><div><p className="text-xs font-bold tracking-wide text-[var(--casabella-muted)] uppercase">Quantidade</p><p className={`mt-1 font-bold ${getMovementQuantityColor(movement)}`}>{getMovementQuantityLabel(movement)}</p></div><div><p className="text-xs font-bold tracking-wide text-[var(--casabella-muted)] uppercase">Saldo</p><p className="mt-1 font-bold">{movement.previousQuantity} → {movement.resultingQuantity}</p></div></div>
                          <p className="mt-4 text-sm"><span className="font-bold">Motivo:</span> {getReasonLabel(movement)}</p>
                          {movement.notes ? <p className="mt-1 text-sm text-[var(--casabella-muted)]">{movement.notes}</p> : null}
                          <p className="mt-4 border-t border-[var(--casabella-border)] pt-3 text-xs text-[var(--casabella-muted)]">Realizado por <strong>{movement.performedBy.name}</strong></p>
                        </article>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="flex flex-col gap-3 border-t border-[var(--casabella-border)] px-5 py-4 text-sm text-[var(--casabella-muted)] sm:flex-row sm:items-center sm:justify-between">
                <p>Página {movementPage!.meta.page} de {movementPage!.meta.totalPages} · {numberFormatter.format(movementPage!.meta.total)} registros</p>
                <div className="flex gap-2">
                  {movementPage!.meta.page > 1 ? <Link className="inline-flex h-10 items-center rounded-xl border border-[var(--casabella-border)] px-4 font-semibold text-[var(--casabella-teal)]" href={getPageHref(query, movementPage!.meta.page - 1)}>Anterior</Link> : <span className="inline-flex h-10 items-center rounded-xl border border-[var(--casabella-border)] px-4 opacity-40">Anterior</span>}
                  {movementPage!.meta.page < movementPage!.meta.totalPages ? <Link className="inline-flex h-10 items-center rounded-xl border border-[var(--casabella-border)] px-4 font-semibold text-[var(--casabella-teal)]" href={getPageHref(query, movementPage!.meta.page + 1)}>Próxima</Link> : <span className="inline-flex h-10 items-center rounded-xl border border-[var(--casabella-border)] px-4 opacity-40">Próxima</span>}
                </div>
              </div>
            </section>
          </>
        )}

        <AppFooter />
      </div>
    </main>
  );
}
