import {
  useContext,
  useState,
} from "react";

import {
  UserContext,
} from "../../context/UserContext.js";


export default function ActiveContextSwitcher() {
  const context =
    useContext(
      UserContext
    );

  const [
    changing,
    setChanging,
  ] =
    useState(false);

  if (
    !context ||
    !context.isLoggedIn
  ) {
    return null;
  }

  const {
    activeContext,
    contexts,
    contextsLoading,
    switchActiveContext,
  } =
    context;

  if (
    contextsLoading ||
    contexts.length <= 1
  ) {
    return null;
  }

  return (
    <div className="min-w-0">
      <label className="mb-1 block text-[10px] font-medium text-zinc-500">
        Usando FootEra como
      </label>

      <select
        value={
          activeContext
            ?.key ?? ""
        }
        disabled={
          changing
        }
        onChange={
          async (
            event
          ) => {
            const key =
              event.target
                .value;

            if (!key) {
              return;
            }

            try {
              setChanging(
                true
              );

              await switchActiveContext(
                key
              );
            } catch (
              error
            ) {
              console.error(
                "Erro ao trocar contexto:",
                error
              );
            } finally {
              setChanging(
                false
              );
            }
          }
        }
        className="max-w-[240px] rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-900 outline-none"
      >
        {contexts.map(
          (item) => (
            <option
              key={
                item.key
              }
              value={
                item.key
              }
            >
              {item.label}
            </option>
          )
        )}
      </select>
    </div>
  );
}