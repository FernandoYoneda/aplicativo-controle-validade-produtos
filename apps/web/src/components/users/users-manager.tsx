"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { ApiErrorResponse } from "../../types/auth";
import type { Store } from "../../types/store";
import type { StoreUser } from "../../types/user";
import { UserFormModal } from "./user-form-modal";

interface UsersManagerProps {
  initialUsers: StoreUser[];
  stores: Store[];
}

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return errorResponse.message[0] ?? "Não foi possível listar os usuários.";
  }

  return errorResponse.message ?? "Não foi possível listar os usuários.";
}

function sortUsers(users: StoreUser[]): StoreUser[] {
  return [...users].sort((firstUser, secondUser) => {
    const firstStoreCode = firstUser.store?.code ?? "";
    const secondStoreCode = secondUser.store?.code ?? "";

    const storeComparison = firstStoreCode.localeCompare(
      secondStoreCode,
      "pt-BR",
      {
        numeric: true,
        sensitivity: "base",
      },
    );

    if (storeComparison !== 0) {
      return storeComparison;
    }

    return firstUser.name.localeCompare(secondUser.name, "pt-BR", {
      sensitivity: "base",
    });
  });
}

export function UsersManager({ initialUsers, stores }: UsersManagerProps) {
  const router = useRouter();

  const [users, setUsers] = useState<StoreUser[]>(sortUsers(initialUsers));
  const [search, setSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<StoreUser | null>(null);

  const loadUsers = useCallback(async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/users", {
        method: "GET",
        cache: "no-store",
      });

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }

      const responseBody = (await response.json()) as
        StoreUser[] | ApiErrorResponse;

      if (!response.ok) {
        setErrorMessage(getErrorMessage(responseBody as ApiErrorResponse));
        return;
      }

      setUsers(sortUsers(responseBody as StoreUser[]));
    } catch {
      setErrorMessage("Não foi possível conectar ao serviço de usuários.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return users;
    }

    return users.filter((user) => {
      const storeCode = user.store?.code.toLowerCase() ?? "";
      const storeName = user.store?.name.toLowerCase() ?? "";

      return (
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch) ||
        user.login.toLowerCase().includes(normalizedSearch) ||
        storeCode.includes(normalizedSearch) ||
        storeName.includes(normalizedSearch)
      );
    });
  }, [search, users]);

  const activeUsers = useMemo(
    () => users.filter((user) => user.isActive).length,
    [users],
  );

  const inactiveUsers = users.length - activeUsers;
  const hasActiveStores = stores.some((store) => store.isActive);

  function openCreateForm() {
    setSelectedUser(null);
    setErrorMessage("");
    setSuccessMessage("");
    setIsFormOpen(true);
  }

  function openEditForm(user: StoreUser) {
    setSelectedUser(user);
    setErrorMessage("");
    setSuccessMessage("");
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setSelectedUser(null);
  }

  function handleUserSaved(savedUser: StoreUser) {
    const wasEditing = selectedUser !== null;

    setUsers((currentUsers) => {
      const userAlreadyExists = currentUsers.some(
        (user) => user.id === savedUser.id,
      );

      const updatedUsers = userAlreadyExists
        ? currentUsers.map((user) =>
            user.id === savedUser.id ? savedUser : user,
          )
        : [...currentUsers, savedUser];

      return sortUsers(updatedUsers);
    });

    setSuccessMessage(
      wasEditing
        ? `O usuário ${savedUser.login} foi atualizado com sucesso.`
        : `O usuário ${savedUser.login} foi cadastrado com sucesso.`,
    );

    closeForm();
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <section className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[var(--casabella-muted)]">
              Total de usuários
            </p>
            <p className="mt-2 text-3xl font-bold text-[var(--casabella-teal-dark)]">
              {isLoading ? "—" : users.length}
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[var(--casabella-muted)]">
              Usuários ativos
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {isLoading ? "—" : activeUsers}
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--casabella-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[var(--casabella-muted)]">
              Usuários inativos
            </p>
            <p className="mt-2 text-3xl font-bold text-[var(--casabella-coral-dark)]">
              {isLoading ? "—" : inactiveUsers}
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

        {!hasActiveStores ? (
          <div
            className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800"
            role="alert"
          >
            Cadastre ou ative uma loja antes de cadastrar usuários.
          </div>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-[var(--casabella-border)] bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[var(--casabella-border)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--casabella-teal-dark)]">
                Usuários cadastrados
              </h2>
              <p className="mt-1 text-sm text-[var(--casabella-muted)]">
                Consulte e mantenha os responsáveis pelas lojas.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm font-semibold text-[var(--casabella-teal)] transition hover:border-[var(--casabella-teal)] hover:bg-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading}
                onClick={() => void loadUsers()}
                type="button"
              >
                {isLoading ? "Atualizando..." : "Atualizar lista"}
              </button>

              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--casabella-teal)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--casabella-teal-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!hasActiveStores}
                onClick={openCreateForm}
                type="button"
              >
                <span aria-hidden="true">+</span>
                Novo usuário
              </button>
            </div>
          </div>

          <div className="border-b border-[var(--casabella-border)] p-5">
            <label
              className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
              htmlFor="user-search"
            >
              Buscar usuário
            </label>
            <input
              className="h-11 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm text-[var(--casabella-graphite)] outline-none transition placeholder:text-zinc-400 focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)]"
              id="user-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Digite nome, e-mail, login ou loja"
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
              Carregando usuários...
            </div>
          ) : null}

          {!isLoading && !errorMessage && filteredUsers.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
              <p className="font-semibold text-[var(--casabella-graphite)]">
                Nenhum usuário encontrado
              </p>
              <p className="mt-1 max-w-md text-sm leading-6 text-[var(--casabella-muted)]">
                {users.length === 0
                  ? "Cadastre o primeiro usuário responsável por uma loja."
                  : "Tente buscar por outro nome, e-mail, login ou loja."}
              </p>
            </div>
          ) : null}

          {!isLoading && !errorMessage && filteredUsers.length > 0 ? (
            <div className="divide-y divide-[var(--casabella-border)]">
              {filteredUsers.map((user) => (
                <article
                  className="grid gap-4 p-5 transition hover:bg-[var(--casabella-background)] lg:grid-cols-[1.35fr_1fr_1fr_auto_auto] lg:items-center"
                  key={user.id}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-[0.1em] text-[var(--casabella-muted)] uppercase">
                      Usuário
                    </p>
                    <p className="mt-1 truncate font-bold text-[var(--casabella-teal-dark)]">
                      {user.name}
                    </p>
                    <p className="mt-1 truncate text-sm text-[var(--casabella-muted)]">
                      {user.email}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-[0.1em] text-[var(--casabella-muted)] uppercase">
                      Login
                    </p>
                    <p className="mt-1 truncate font-semibold text-[var(--casabella-graphite)]">
                      {user.login}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-[0.1em] text-[var(--casabella-muted)] uppercase">
                      Loja
                    </p>
                    <p className="mt-1 truncate font-semibold text-[var(--casabella-graphite)]">
                      {user.store
                        ? `${user.store.code} — ${user.store.name}`
                        : "Sem loja vinculada"}
                    </p>
                  </div>

                  <span
                    className={
                      user.isActive
                        ? "w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                        : "w-fit rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700"
                    }
                  >
                    {user.isActive ? "Ativo" : "Inativo"}
                  </span>

                  <button
                    aria-label={`Editar o usuário ${user.login}`}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm font-semibold text-[var(--casabella-teal)] transition hover:border-[var(--casabella-teal)] hover:bg-[var(--casabella-teal-soft)]"
                    onClick={() => openEditForm(user)}
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
        <UserFormModal
          onClose={closeForm}
          onSaved={handleUserSaved}
          stores={stores}
          user={selectedUser ?? undefined}
        />
      ) : null}
    </>
  );
}
