"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import type { ApiErrorResponse } from "../../types/auth";
import type { Store } from "../../types/store";
import type {
  CreateUserPayload,
  StoreUser,
  UpdateUserPayload,
} from "../../types/user";

interface UserFormModalProps {
  stores: Store[];
  user?: StoreUser;
  onClose: () => void;
  onSaved: (user: StoreUser) => void;
}

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return errorResponse.message[0] ?? "Não foi possível salvar o usuário.";
  }

  return errorResponse.message ?? "Não foi possível salvar o usuário.";
}

export function UserFormModal({
  stores,
  user,
  onClose,
  onSaved,
}: UserFormModalProps) {
  const router = useRouter();
  const isEditing = user !== undefined;

  const activeStores = useMemo(
    () =>
      stores
        .filter((store) => store.isActive)
        .sort((firstStore, secondStore) =>
          firstStore.code.localeCompare(secondStore.code, "pt-BR", {
            numeric: true,
            sensitivity: "base",
          }),
        ),
    [stores],
  );

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [login, setLogin] = useState(user?.login ?? "");
  const [password, setPassword] = useState("");
  const [storeId, setStoreId] = useState(
    user?.storeId ?? activeStores[0]?.id ?? "",
  );
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function handleClose() {
    if (!isSaving) {
      onClose();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedLogin = login.trim().toLowerCase();

    if (!normalizedName || !normalizedEmail || !normalizedLogin || !storeId) {
      setErrorMessage("Informe nome, e-mail, login e loja.");
      return;
    }

    if (!isEditing && password.length < 8) {
      setErrorMessage("A senha deve possuir pelo menos 8 caracteres.");
      return;
    }

    if (isEditing && password && password.length < 8) {
      setErrorMessage("A nova senha deve possuir pelo menos 8 caracteres.");
      return;
    }

    const payload: CreateUserPayload | UpdateUserPayload = isEditing
      ? {
          name: normalizedName,
          email: normalizedEmail,
          login: normalizedLogin,
          storeId,
          isActive,
          ...(password ? { password } : {}),
        }
      : {
          name: normalizedName,
          email: normalizedEmail,
          login: normalizedLogin,
          password,
          storeId,
        };

    setIsSaving(true);

    try {
      const response = await fetch(
        isEditing ? `/api/users/${user.id}` : "/api/users",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }

      const responseBody = (await response.json()) as
        StoreUser | ApiErrorResponse;

      if (!response.ok) {
        setErrorMessage(getErrorMessage(responseBody as ApiErrorResponse));
        return;
      }

      onSaved(responseBody as StoreUser);
    } catch {
      setErrorMessage("Não foi possível conectar ao serviço de usuários.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
      role="presentation"
    >
      <section
        aria-labelledby="user-form-title"
        aria-modal="true"
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[var(--casabella-border)] bg-white shadow-[0_30px_80px_rgba(0,67,77,0.22)]"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-5 border-b border-[var(--casabella-border)] px-6 py-5">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-[var(--casabella-coral)] uppercase">
              Administração
            </p>
            <h2
              className="mt-2 text-2xl font-bold text-[var(--casabella-teal-dark)]"
              id="user-form-title"
            >
              {isEditing ? "Editar usuário" : "Cadastrar usuário"}
            </h2>
            <p className="mt-1 text-sm text-[var(--casabella-muted)]">
              {isEditing
                ? "Atualize os dados, a loja e a situação do usuário."
                : "Cadastre um usuário responsável pelas operações de uma loja."}
            </p>
          </div>

          <button
            aria-label="Fechar formulário"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--casabella-border)] text-xl text-[var(--casabella-muted)] transition hover:border-[var(--casabella-teal)] hover:bg-[var(--casabella-teal-soft)] hover:text-[var(--casabella-teal-dark)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving}
            onClick={handleClose}
            type="button"
          >
            ×
          </button>
        </header>

        <form className="flex flex-col gap-5 p-6" onSubmit={handleSubmit}>
          <div>
            <label
              className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
              htmlFor="user-name"
            >
              Nome
            </label>
            <input
              autoComplete="name"
              autoFocus
              className="h-12 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm text-[var(--casabella-graphite)] outline-none transition placeholder:text-zinc-400 focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
              disabled={isSaving}
              id="user-name"
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              placeholder="Digite o nome completo"
              required
              type="text"
              value={name}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
                htmlFor="user-email"
              >
                E-mail
              </label>
              <input
                autoComplete="email"
                className="h-12 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm text-[var(--casabella-graphite)] outline-none transition placeholder:text-zinc-400 focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
                disabled={isSaving}
                id="user-email"
                maxLength={255}
                onChange={(event) => setEmail(event.target.value.toLowerCase())}
                placeholder="usuario@empresa.com"
                required
                type="email"
                value={email}
              />
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
                htmlFor="user-login"
              >
                Login
              </label>
              <input
                autoComplete="username"
                className="h-12 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm text-[var(--casabella-graphite)] outline-none transition placeholder:text-zinc-400 focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
                disabled={isSaving}
                id="user-login"
                maxLength={80}
                minLength={3}
                onChange={(event) => setLogin(event.target.value.toLowerCase())}
                pattern="[a-z0-9._-]+"
                placeholder="nome.sobrenome"
                required
                type="text"
                value={login}
              />
              <p className="mt-2 text-xs text-[var(--casabella-muted)]">
                Use letras minúsculas, números, ponto, hífen ou sublinhado.
              </p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label
                className="text-sm font-semibold text-[var(--casabella-graphite)]"
                htmlFor="user-password"
              >
                {isEditing ? "Nova senha" : "Senha"}
              </label>

              <button
                className="text-sm font-medium text-[var(--casabella-teal)] transition hover:text-[var(--casabella-teal-dark)]"
                onClick={() => setShowPassword((currentValue) => !currentValue)}
                type="button"
              >
                {showPassword ? "Ocultar senha" : "Mostrar senha"}
              </button>
            </div>

            <input
              autoComplete="new-password"
              className="h-12 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm text-[var(--casabella-graphite)] outline-none transition placeholder:text-zinc-400 focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
              disabled={isSaving}
              id="user-password"
              maxLength={128}
              minLength={isEditing ? undefined : 8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={
                isEditing
                  ? "Deixe em branco para manter a senha atual"
                  : "Digite uma senha com pelo menos 8 caracteres"
              }
              required={!isEditing}
              type={showPassword ? "text" : "password"}
              value={password}
            />

            <p className="mt-2 text-xs text-[var(--casabella-muted)]">
              {isEditing
                ? "Preencha somente se desejar alterar a senha."
                : "A senha deve possuir entre 8 e 128 caracteres."}
            </p>
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-semibold text-[var(--casabella-graphite)]"
              htmlFor="user-store"
            >
              Loja
            </label>
            <select
              className="h-12 w-full rounded-xl border border-[var(--casabella-border)] bg-white px-4 text-sm text-[var(--casabella-graphite)] outline-none transition focus:border-[var(--casabella-teal)] focus:ring-3 focus:ring-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
              disabled={isSaving || activeStores.length === 0}
              id="user-store"
              onChange={(event) => setStoreId(event.target.value)}
              required
              value={storeId}
            >
              {activeStores.length === 0 ? (
                <option value="">Nenhuma loja ativa disponível</option>
              ) : null}

              {activeStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.code} — {store.name}
                </option>
              ))}
            </select>
          </div>

          {isEditing ? (
            <div className="rounded-2xl border border-[var(--casabella-border)] bg-[var(--casabella-background)] p-4">
              <label
                className="flex cursor-pointer items-center justify-between gap-4"
                htmlFor="user-active"
              >
                <span>
                  <span className="block text-sm font-semibold text-[var(--casabella-graphite)]">
                    Usuário ativo
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--casabella-muted)]">
                    Usuários inativos não podem entrar no sistema.
                  </span>
                </span>

                <input
                  checked={isActive}
                  className="size-5 accent-[var(--casabella-teal)]"
                  disabled={isSaving}
                  id="user-active"
                  onChange={(event) => setIsActive(event.target.checked)}
                  type="checkbox"
                />
              </label>
            </div>
          ) : null}

          {errorMessage ? (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700"
              role="alert"
            >
              {errorMessage}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-[var(--casabella-border)] pt-5 sm:flex-row sm:justify-end">
            <button
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--casabella-border)] bg-white px-5 text-sm font-semibold text-[var(--casabella-graphite)] transition hover:border-[var(--casabella-teal)] hover:bg-[var(--casabella-teal-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSaving}
              onClick={handleClose}
              type="button"
            >
              Cancelar
            </button>

            <button
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--casabella-teal)] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--casabella-teal-dark)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving || activeStores.length === 0}
              type="submit"
            >
              {isSaving
                ? "Salvando..."
                : isEditing
                  ? "Salvar alterações"
                  : "Cadastrar usuário"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
