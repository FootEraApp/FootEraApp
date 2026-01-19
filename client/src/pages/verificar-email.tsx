// client/src/pages/verificar-email.tsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useLocation } from "wouter";
import { API } from "../config.js";

function getTokenFromUrl() {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  return (url.searchParams.get("token") || "").trim();
}

type Status = "idle" | "success" | "error";

export default function PaginaVerificarEmail() {
  const [, setLocation] = useLocation();

  const token = useMemo(() => getTokenFromUrl(), []);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(10);

  const verificarAgora = async () => {
    if (!token) {
      setStatus("error");
      setMessage("Token ausente. Abra o link completo do e-mail.");
      return;
    }

    setLoading(true);
    setStatus("idle");
    setMessage("");

    try {
      const { data } = await axios.get(`${API.BASE_URL}/api/cadastro/verify`, {
        params: { token },
      });

      if (data?.ok) {
        setStatus("success");
        setMessage(data?.message || "E-mail verificado com sucesso!");
        setCountdown(10);
      } else {
        setStatus("error");
        setMessage(data?.message || "Não foi possível verificar o e-mail.");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Erro ao verificar e-mail.";
      setStatus("error");
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // countdown após sucesso
  useEffect(() => {
    if (status !== "success") return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (status === "success" && countdown <= 0) {
      setLocation("/login");
    }
  }, [status, countdown, setLocation]);

  // estilos por status
  const badge = (() => {
    if (status === "success")
      return {
        title: "Tudo certo!",
        bg: "bg-green-50",
        border: "border-green-200",
        titleColor: "text-green-900",
        textColor: "text-green-800",
      };
    if (status === "error")
      return {
        title: "Não deu certo",
        bg: "bg-red-50",
        border: "border-red-200",
        titleColor: "text-red-900",
        textColor: "text-red-800",
      };
    return {
      title: "Pronto para verificar",
      bg: "bg-blue-50",
      border: "border-blue-200",
      titleColor: "text-blue-900",
      textColor: "text-blue-800",
    };
  })();

  return (
    <div className="flex flex-col md:flex-row h-screen">
      {/* Lado esquerdo (igual vibe do login) */}
      <div className="md:w-1/2 bg-green-800 text-white flex flex-col items-center p-6 md:p-10">
        <div className="w-full max-w-[680px]">
          <div className="flex items-center gap-3 md:flex-col md:gap-2">
            <img
              src="/assets/usuarios/footera-logo.png"
              alt="Logo FootEra"
              className="
                shrink-0 object-contain transform-gpu
                w-12 h-12 md:w-[88px] md:h-[88px]
                max-[639px]:scale-[1.3]
                md:scale-[1.2]
                origin-left md:origin-center
              "
            />
            <h1 className="flex-1 md:flex-none text-center text-xl md:text-3xl font-bold">
              Confirmação de e-mail
            </h1>
          </div>

          <p className="text-center text-base md:text-lg mt-5 text-white/95">
            Para ativar sua conta, confirme seu e-mail. É rápido e garante que
            você é o dono desse endereço.
          </p>

          <div className="mt-6 p-5 md:p-6 rounded-xl text-sm md:text-base text-left w-full bg-white/10">
            <h2 className="font-semibold mb-2">Como funciona</h2>
            <ul className="list-disc list-inside space-y-1 text-white/95">
              <li>Clique em “Verificar e-mail”.</li>
              <li>Se o token estiver válido, sua conta será ativada.</li>
              <li>Você será redirecionado para o login em 10 segundos.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Lado direito (tema claro igual login) */}
      <div className="relative md:w-1/2 bg-cream flex justify-center items-center p-6 md:p-10">
        {/* watermark suave */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -z-0">
          <div
            aria-hidden
            className="w-[420px] h-[420px] opacity-[0.06] md:opacity-[0.08] rounded-full overflow-hidden"
            style={{
              backgroundImage: "url('/assets/usuarios/footera-logo.png')",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center 20%",
              backgroundSize: "85% auto",
              filter: "grayscale(100%)",
            }}
          />
        </div>

        <div className="relative z-10 w-full max-w-md bg-white shadow-lg rounded-2xl p-7 md:p-8 mx-auto">
          <h2 className="text-xl font-semibold mb-2 text-center">
            Verificar e-mail
          </h2>
          <p className="text-sm text-center text-gray-600 mb-6">
            Confirme para ativar sua conta na FootEra.
          </p>

          <div className={`rounded-xl border ${badge.border} ${badge.bg} p-4`}>
            <div className={`font-semibold ${badge.titleColor}`}>
              {badge.title}
            </div>

            <div className={`mt-1 text-sm ${badge.textColor}`}>
              {message ||
                "Clique no botão abaixo para verificar seu e-mail. Após confirmar, você será redirecionado para o login."}
            </div>

            {status === "success" && (
              <div className="mt-3 text-sm text-green-800">
                Redirecionando para o login em <b>{countdown}s</b>…
              </div>
            )}

            {!token && (
              <div className="mt-3 text-sm text-gray-700">
                Dica: abra este link diretamente pelo e-mail (ele precisa conter{" "}
                <b>?token=...</b>).
              </div>
            )}
          </div>

          <button
            onClick={verificarAgora}
            disabled={loading || status === "success"}
            className={`mt-5 w-full font-medium py-2 rounded transition active:scale-[0.98]
              ${
                loading || status === "success"
                  ? "bg-green-900/60 text-white cursor-not-allowed"
                  : "bg-green-900 hover:bg-green-800 text-white"
              }`}
          >
            {loading
              ? "Verificando..."
              : status === "success"
              ? "Verificado"
              : "Verificar e-mail"}
          </button>

          <div className="flex justify-between mt-4 text-sm">
            <Link href="/login" className="text-green-700 underline">
              Ir para o login
            </Link>

            <Link href="/esqueci-senha" className="text-gray-600 underline">
              Preciso de ajuda
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
