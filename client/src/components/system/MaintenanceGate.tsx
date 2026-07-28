import React from "react";
import { useLocation } from "wouter";
import { API } from "../../config.js";
import HealthBanner from "../legal/HealthBanner.js";
import { UserContext } from "../../context/UserContext.js";

type ConfiguracaoPublica = {
  maintenanceMode: boolean;
  maintenanceScheduledAt?: string | null;
  serverTime?: string;
};

type Props = {
  children: React.ReactNode;
};

function formatarContagem(ms: number) {
  const totalSegundos = Math.max(0, Math.ceil(ms / 1000));

  const dias = Math.floor(totalSegundos / 86_400);
  const horas = Math.floor((totalSegundos % 86_400) / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;

  if (dias > 0) {
    return `${dias}d ${horas}h ${minutos}min ${segundos}s`;
  }

  if (horas > 0) {
    return `${horas}h ${minutos}min ${segundos}s`;
  }

  return `${minutos}min ${segundos}s`;
}

export default function MaintenanceGate({ children }: Props) {
  const [path, setLocation] = useLocation();
  const userContext = React.useContext(UserContext);
  const manutencaoProcessadaRef = React.useRef(false);

  if (!userContext) {
    throw new Error(
      "MaintenanceGate deve estar dentro do UserProvider."
    );
  }

  const { logout } = userContext;

  const [configuracao, setConfiguracao] =
    React.useState<ConfiguracaoPublica | null>(null);

  const [verificando, setVerificando] = React.useState(true);
  const [agora, setAgora] = React.useState(Date.now());
  const [deslocamentoServidor, setDeslocamentoServidor] = React.useState(0);

  const carregarConfiguracao = React.useCallback(async () => {
    try {
      const response = await fetch(`${API.BASE_URL}/api/configuracoes`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Não foi possível consultar a manutenção.");
      }

      const data: ConfiguracaoPublica = await response.json();

      if (data.serverTime) {
        const serverTime = Date.parse(data.serverTime);

        if (Number.isFinite(serverTime)) {
          setDeslocamentoServidor(serverTime - Date.now());
        }
      }

      setConfiguracao(data);
    } catch (error) {
      // Em caso de falha na consulta, não bloqueia o aplicativo indevidamente.
      console.error("[manutenção] falha ao consultar status:", error);
    } finally {
      setVerificando(false);
    }
  }, []);

  React.useEffect(() => {
    void carregarConfiguracao();

    const interval = window.setInterval(() => {
      void carregarConfiguracao();
    }, 15_000);

    const atualizarAoVoltar = () => {
      if (document.visibilityState === "visible") {
        void carregarConfiguracao();
      }
    };

    document.addEventListener("visibilitychange", atualizarAoVoltar);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", atualizarAoVoltar);
    };
  }, [carregarConfiguracao]);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setAgora(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const horarioAgendado = configuracao?.maintenanceScheduledAt
    ? Date.parse(configuracao.maintenanceScheduledAt)
    : null;

  const tempoRestante =
    horarioAgendado !== null && Number.isFinite(horarioAgendado)
      ? horarioAgendado - (agora + deslocamentoServidor)
      : null;

  /*
   * Bloqueia imediatamente no frontend quando a contagem chega a zero.
   * A consulta seguinte também faz o backend efetivar maintenanceMode.
   */
  React.useEffect(() => {
    if (
      !configuracao?.maintenanceScheduledAt ||
      tempoRestante === null ||
      tempoRestante > 0
    ) {
      return;
    }

    setConfiguracao((atual) =>
      atual
        ? {
            ...atual,
            maintenanceMode: true,
            maintenanceScheduledAt: null,
          }
        : atual
    );

    void carregarConfiguracao();
  }, [
    configuracao?.maintenanceScheduledAt,
    tempoRestante,
    carregarConfiguracao,
  ]);

  const rotaAdministrativa =
    path === "/admin" || path.startsWith("/admin/");

React.useEffect(() => {
  if (!configuracao?.maintenanceMode) {
    manutencaoProcessadaRef.current = false;
    return;
  }

  // O administrador continua no painel para conseguir
  // encerrar o modo de manutenção.
  if (rotaAdministrativa) {
    return;
  }

  if (!manutencaoProcessadaRef.current) {
    manutencaoProcessadaRef.current = true;
    logout();
  }

  if (path !== "/login") {
    setLocation("/login", {
      replace: true,
    });
  }
}, [
  configuracao?.maintenanceMode,
  rotaAdministrativa,
  path,
  logout,
  setLocation,
]);

  if (verificando) {
    return (
      <div className="min-h-screen bg-[#fdf9e8] flex items-center justify-center">
        <p className="font-semibold text-green-900">Carregando FootEra...</p>
      </div>
    );
  }

  /*
   * O admin continua entrando no painel para conseguir encerrar a
   * manutenção. Todos os outros usuários veem a tela de manutenção.
   */
if (
  configuracao?.maintenanceMode &&
  !rotaAdministrativa &&
  path !== "/login"
) {
  return (
    <div className="min-h-screen bg-[#fdf9e8] flex items-center justify-center">
      <p className="font-semibold text-green-900">
        Redirecionando...
      </p>
    </div>
  );
}

  const mostrarAviso =
    horarioAgendado !== null &&
    Number.isFinite(horarioAgendado) &&
    tempoRestante !== null &&
    tempoRestante > 0;

  return (
    <>
      {mostrarAviso && (
        <div className="fixed left-1/2 top-3 z-[9999] w-[calc(100%-24px)] max-w-2xl -translate-x-1/2">
          <HealthBanner
            dismissible={false}
            compact
            className="shadow-lg"
          >
            <strong>Manutenção programada:</strong> o FootEra ficará
            temporariamente indisponível em{" "}
            <strong>{formatarContagem(tempoRestante)}</strong>.
          </HealthBanner>
        </div>
      )}

      {children}
    </>
  );
}