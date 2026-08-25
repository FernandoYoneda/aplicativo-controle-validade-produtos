"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import type { ApiErrorResponse } from "../../types/auth";
import type { Product, ProductImportResult } from "../../types/product";
import { ProductFormModal } from "./product-form-modal";
import { ProductImportModal } from "./product-import-modal";

interface ProductsManagerProps {
  initialProducts: Product[];
}

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return errorResponse.message[0] ?? "Não foi possível listar os produtos.";
  }

  return errorResponse.message ?? "Não foi possível listar os produtos.";
}

function sortProducts(products: Product[]): Product[] {
  return [...products].sort((firstProduct, secondProduct) =>
    firstProduct.code.localeCompare(secondProduct.code, "pt-BR", {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

export function ProductsManager({ initialProducts }: ProductsManagerProps) {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>(
    sortProducts(initialProducts),
  );
  const [search, setSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const loadProducts = useCallback(async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/products", {
        method: "GET",
        cache: "no-store",
      });

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }

      const responseBody = (await response.json()) as
        Product[] | ApiErrorResponse;

      if (!response.ok) {
        setErrorMessage(getErrorMessage(responseBody as ApiErrorResponse));
        return;
      }

      setProducts(sortProducts(responseBody as Product[]));
    } catch {
      setErrorMessage("Não foi possível conectar ao serviço de produtos.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return products;
    }

    return products.filter((product) =>
      [
        product.code,
        product.barcode ?? "",
        product.name,
        product.brand ?? "",
        product.category ?? "",
      ].some((value) => value.toLowerCase().includes(normalizedSearch)),
    );
  }, [products, search]);

  const activeProducts = useMemo(
    () => products.filter((product) => product.isActive).length,
    [products],
  );

  const inactiveProducts = products.length - activeProducts;

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

  function handleProductSaved(savedProduct: Product) {
    const productAlreadyExists = products.some(
      (product) => product.id === savedProduct.id,
    );

    setProducts((currentProducts) => {
      const updatedProducts = productAlreadyExists
        ? currentProducts.map((product) =>
            product.id === savedProduct.id ? savedProduct : product,
          )
        : [...currentProducts, savedProduct];

      return sortProducts(updatedProducts);
    });

    setSuccessMessage(
      productAlreadyExists
        ? `O produto ${savedProduct.code} foi atualizado com sucesso.`
        : `O produto ${savedProduct.code} foi cadastrado com sucesso.`,
    );

    closeForm();
  }

  async function handleProductsImported(result: ProductImportResult) {
    setIsImportOpen(false);
    await loadProducts();
    setSuccessMessage(
      result.importedProducts === 1
        ? "1 produto foi cadastrado com sucesso pela planilha."
        : `${result.importedProducts} produtos foram cadastrados com sucesso pela planilha.`,
    );
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
              {isLoading ? "—" : products.length}
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[var(--casabella-muted)]">
              Produtos ativos
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {isLoading ? "—" : activeProducts}
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[var(--casabella-muted)]">
              Produtos inativos
            </p>
            <p className="mt-2 text-3xl font-bold text-[var(--casabella-coral-dark)]">
              {isLoading ? "—" : inactiveProducts}
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
                onClick={() => void loadProducts()}
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

          {!isLoading && !errorMessage && filteredProducts.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
              <p className="font-semibold text-[var(--casabella-graphite)]">
                Nenhum produto encontrado
              </p>

              <p className="mt-1 max-w-md text-sm leading-6 text-[var(--casabella-muted)]">
                {products.length === 0
                  ? "Cadastre o primeiro produto para iniciar o catálogo."
                  : "Tente buscar por outro código, nome, marca ou categoria."}
              </p>

              {products.length === 0 ? (
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

          {!isLoading && !errorMessage && filteredProducts.length > 0 ? (
            <div className="divide-y divide-[var(--casabella-border)]">
              {filteredProducts.map((product) => (
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
