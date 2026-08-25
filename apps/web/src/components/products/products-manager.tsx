"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ApiErrorResponse } from "../../types/auth";
import type {
  Product,
  ProductImportResult,
  ProductPage,
} from "../../types/product";
import { ProductFormModal } from "./product-form-modal";
import { ProductImportModal } from "./product-import-modal";

interface ProductsManagerProps {
  initialPage: ProductPage;
}

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return errorResponse.message[0] ?? "Não foi possível listar os produtos.";
  }

  return errorResponse.message ?? "Não foi possível listar os produtos.";
}

function getVisiblePages(currentPage: number, totalPages: number): number[] {
  const pages = new Set([1, totalPages]);

  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page >= 1 && page <= totalPages) {
      pages.add(page);
    }
  }

  return [...pages].sort((firstPage, secondPage) => firstPage - secondPage);
}

export function ProductsManager({ initialPage }: ProductsManagerProps) {
  const router = useRouter();
  const activeRequest = useRef<AbortController | null>(null);
  const isFirstSearchRender = useRef(true);

  const [productPage, setProductPage] = useState(initialPage);
  const [search, setSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const loadProducts = useCallback(
    async (page: number, searchValue: string) => {
      activeRequest.current?.abort();
      const controller = new AbortController();
      activeRequest.current = controller;

      setErrorMessage("");
      setIsLoading(true);

      const parameters = new URLSearchParams({
        page: String(page),
        pageSize: String(productPage.pagination.pageSize),
      });
      const normalizedSearch = searchValue.trim();

      if (normalizedSearch) {
        parameters.set("search", normalizedSearch);
      }

      try {
        const response = await fetch(`/api/products/page?${parameters}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) {
          router.replace("/login");
          router.refresh();
          return;
        }

        const responseBody = (await response.json()) as
          ProductPage | ApiErrorResponse;

        if (!response.ok) {
          setErrorMessage(getErrorMessage(responseBody as ApiErrorResponse));
          return;
        }

        setProductPage(responseBody as ProductPage);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setErrorMessage("Não foi possível conectar ao serviço de produtos.");
      } finally {
        if (activeRequest.current === controller) {
          setIsLoading(false);
        }
      }
    },
    [productPage.pagination.pageSize, router],
  );

  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      setSuccessMessage("");
      void loadProducts(1, search);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [loadProducts, search]);

  useEffect(
    () => () => {
      activeRequest.current?.abort();
    },
    [],
  );

  const visiblePages = useMemo(
    () =>
      getVisiblePages(
        productPage.pagination.page,
        productPage.pagination.totalPages,
      ),
    [productPage.pagination.page, productPage.pagination.totalPages],
  );
  const firstVisibleItem =
    productPage.pagination.totalItems === 0
      ? 0
      : (productPage.pagination.page - 1) * productPage.pagination.pageSize + 1;
  const lastVisibleItem = Math.min(
    productPage.pagination.page * productPage.pagination.pageSize,
    productPage.pagination.totalItems,
  );

  function openCreateForm() {
    setSelectedProduct(null);
    setErrorMessage("");
    setSuccessMessage("");
    setIsFormOpen(true);
  }

  function openEditForm(product: Product) {
    setSelectedProduct(product);
    setErrorMessage("");
    setSuccessMessage("");
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setSelectedProduct(null);
  }

  async function handleProductSaved(savedProduct: Product) {
    const wasEditing = selectedProduct !== null;

    closeForm();
    await loadProducts(
      wasEditing ? productPage.pagination.page : 1,
      wasEditing ? search : "",
    );

    if (!wasEditing) {
      setSearch("");
    }

    setSuccessMessage(
      wasEditing
        ? `O produto ${savedProduct.code} foi atualizado com sucesso.`
        : `O produto ${savedProduct.code} foi cadastrado com sucesso.`,
    );
  }

  async function handleProductsImported(result: ProductImportResult) {
    setIsImportOpen(false);
    setSearch("");
    await loadProducts(1, "");
    setSuccessMessage(
      result.importedProducts === 1
        ? "1 produto foi cadastrado com sucesso pela planilha."
        : `${result.importedProducts} produtos foram cadastrados com sucesso pela planilha.`,
    );
  }

  function changePage(page: number) {
    if (
      page === productPage.pagination.page ||
      page < 1 ||
      page > productPage.pagination.totalPages
    ) {
      return;
    }

    setSuccessMessage("");
    void loadProducts(page, search);
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <section className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[var(--casabella-muted)]">
              Total de produtos
            </p>
            <p className="mt-2 text-3xl font-bold text-[var(--casabella-teal-dark)]">
              {isLoading ? "—" : productPage.summary.totalProducts}
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[var(--casabella-muted)]">
              Produtos ativos
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {isLoading ? "—" : productPage.summary.activeProducts}
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[var(--casabella-muted)]">
              Produtos inativos
            </p>
            <p className="mt-2 text-3xl font-bold text-[var(--casabella-coral-dark)]">
              {isLoading ? "—" : productPage.summary.inactiveProducts}
            </p>
          </article>
        </section>

        {successMessage ? (
          <div
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800"
            role="status"
          >
            {successMessage}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-[var(--casabella-border)] bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[var(--casabella-border)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--casabella-teal-dark)]">
                Produtos cadastrados
              </h2>
              <p className="mt-1 text-sm text-[var(--casabella-muted)]">
                Consulte e mantenha atualizado o catálogo do grupo.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm font-semibold text-[var(--casabella-teal)] transition hover:border-[var(--casabella-teal)] hover:bg-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading}
                onClick={() =>
                  void loadProducts(productPage.pagination.page, search)
                }
                type="button"
              >
                {isLoading ? "Atualizando..." : "Atualizar lista"}
              </button>

              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--casabella-teal)] bg-white px-4 text-sm font-semibold text-[var(--casabella-teal)] transition hover:bg-[var(--casabella-teal-soft)]"
                onClick={() => setIsImportOpen(true)}
                type="button"
              >
                Importar planilha
              </button>

              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--casabella-teal)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--casabella-teal-dark)]"
                onClick={openCreateForm}
                type="button"
              >
                <span aria-hidden="true">+</span>
                Novo produto
              </button>
            </div>
          </div>

          <div className="border-b border-[var(--casabella-border)] p-5">
            <label
              className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
              htmlFor="product-search"
            >
              Buscar produto
            </label>

            <input
              className="h-11 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm text-[var(--casabella-graphite)] outline-none transition placeholder:text-zinc-400 focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)]"
              id="product-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Digite código, código de barras, nome, marca ou categoria"
              type="search"
              value={search}
            />
          </div>

          {errorMessage ? (
            <div
              className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {errorMessage}
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex min-h-64 items-center justify-center p-8 text-sm text-[var(--casabella-muted)]">
              Carregando produtos...
            </div>
          ) : null}

          {!isLoading && !errorMessage && productPage.items.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
              <p className="font-semibold text-[var(--casabella-graphite)]">
                Nenhum produto encontrado
              </p>

              <p className="mt-1 max-w-md text-sm leading-6 text-[var(--casabella-muted)]">
                {productPage.summary.totalProducts === 0
                  ? "Cadastre o primeiro produto para iniciar o catálogo."
                  : "Tente buscar por outro código, nome, marca ou categoria."}
              </p>

              {productPage.summary.totalProducts === 0 ? (
                <button
                  className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--casabella-teal)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--casabella-teal-dark)]"
                  onClick={openCreateForm}
                  type="button"
                >
                  <span aria-hidden="true">+</span>
                  Cadastrar produto
                </button>
              ) : null}
            </div>
          ) : null}

          {!isLoading && !errorMessage && productPage.items.length > 0 ? (
            <>
              <div className="divide-y divide-[var(--casabella-border)]">
                {productPage.items.map((product) => (
                  <article
                    className="grid gap-4 p-5 transition hover:bg-[var(--casabella-background)] lg:grid-cols-[110px_minmax(0,1.5fr)_minmax(0,1fr)_auto_auto] lg:items-center"
                    key={product.id}
                  >
                    <div>
                      <p className="text-xs font-semibold tracking-[0.1em] text-[var(--casabella-muted)] uppercase">
                        Código
                      </p>
                      <p className="mt-1 font-bold text-[var(--casabella-teal-dark)]">
                        {product.code}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-semibold tracking-[0.1em] text-[var(--casabella-muted)] uppercase">
                        Produto
                      </p>
                      <p className="mt-1 truncate font-semibold text-[var(--casabella-graphite)]">
                        {product.name}
                      </p>
                      <p className="mt-1 truncate text-xs text-[var(--casabella-muted)]">
                        {product.barcode
                          ? `Código de barras: ${product.barcode}`
                          : "Sem código de barras"}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-semibold tracking-[0.1em] text-[var(--casabella-muted)] uppercase">
                        Classificação
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-[var(--casabella-graphite)]">
                        {product.category ?? "Sem categoria"}
                      </p>
                      <p className="mt-1 truncate text-xs text-[var(--casabella-muted)]">
                        {product.brand ?? "Sem marca"}
                      </p>
                    </div>

                    <span
                      className={
                        product.isActive
                          ? "w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                          : "w-fit rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700"
                      }
                    >
                      {product.isActive ? "Ativo" : "Inativo"}
                    </span>

                    <button
                      aria-label={`Editar o produto ${product.code}`}
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm font-semibold text-[var(--casabella-teal)] transition hover:border-[var(--casabella-teal)] hover:bg-[var(--casabella-teal-soft)]"
                      onClick={() => openEditForm(product)}
                      type="button"
                    >
                      Editar
                    </button>
                  </article>
                ))}
              </div>

              <nav
                aria-label="Paginação dos produtos"
                className="flex flex-col gap-4 border-t border-[var(--casabella-border)] p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm text-[var(--casabella-muted)]">
                  Exibindo {firstVisibleItem}–{lastVisibleItem} de{" "}
                  {productPage.pagination.totalItems} produtos
                  {search.trim() ? " encontrados" : ""}.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--casabella-border)] bg-white px-3 text-sm font-semibold text-[var(--casabella-teal)] transition hover:border-[var(--casabella-teal)] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={productPage.pagination.page === 1 || isLoading}
                    onClick={() => changePage(productPage.pagination.page - 1)}
                    type="button"
                  >
                    Anterior
                  </button>

                  {visiblePages.map((page, index) => (
                    <div className="contents" key={page}>
                      {index > 0 && page - visiblePages[index - 1] > 1 ? (
                        <span
                          aria-hidden="true"
                          className="px-1 text-[var(--casabella-muted)]"
                        >
                          …
                        </span>
                      ) : null}

                      <button
                        aria-current={
                          page === productPage.pagination.page
                            ? "page"
                            : undefined
                        }
                        aria-label={`Ir para a página ${page}`}
                        className={
                          page === productPage.pagination.page
                            ? "inline-flex size-9 items-center justify-center rounded-xl bg-[var(--casabella-teal)] text-sm font-bold text-white"
                            : "inline-flex size-9 items-center justify-center rounded-xl border border-[var(--casabella-border)] bg-white text-sm font-semibold text-[var(--casabella-teal)] transition hover:border-[var(--casabella-teal)]"
                        }
                        disabled={isLoading}
                        onClick={() => changePage(page)}
                        type="button"
                      >
                        {page}
                      </button>
                    </div>
                  ))}

                  <button
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--casabella-border)] bg-white px-3 text-sm font-semibold text-[var(--casabella-teal)] transition hover:border-[var(--casabella-teal)] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={
                      productPage.pagination.page ===
                        productPage.pagination.totalPages || isLoading
                    }
                    onClick={() => changePage(productPage.pagination.page + 1)}
                    type="button"
                  >
                    Próxima
                  </button>
                </div>
              </nav>
            </>
          ) : null}
        </section>
      </div>

      {isFormOpen ? (
        <ProductFormModal
          onClose={closeForm}
          onSaved={handleProductSaved}
          product={selectedProduct ?? undefined}
        />
      ) : null}

      {isImportOpen ? (
        <ProductImportModal
          onClose={() => setIsImportOpen(false)}
          onImported={handleProductsImported}
        />
      ) : null}
    </>
  );
}
