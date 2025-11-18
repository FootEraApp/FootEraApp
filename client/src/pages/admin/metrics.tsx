// client/src/pages/admin/metrics.tsx
import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { API } from "../../config.js";

type CapCounters = {
  allowed: number;
  denied: number;
};

type CanStats = {
  count: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
};

type Snapshot = {
  capabilityCounters: Record<string, CapCounters>;
  canLatency: Record<string, CanStats>;
};

export default function AdminMetricsPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API.BASE_URL}/api/admin/metrics`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((json) => setData(json))
      .catch((err) => console.error("Erro ao carregar métricas:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4">Carregando métricas…</div>;

  if (!data) return <div className="p-4">Não foi possível carregar métricas.</div>;

  const caps = Object.keys(data.capabilityCounters || {});
  const latCaps = Object.keys(data.canLatency || {});

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h1 className="text-lg font-semibold">Observabilidade / Métricas</h1>
        <Link href="/admin">
          <a className="text-sm text-sky-400 hover:underline">Voltar ao Admin</a>
        </Link>
      </header>

      <main className="p-4 space-y-8">
        <section>
          <h2 className="text-base font-semibold mb-2">Contadores por capability</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/60">
                <tr>
                  <th className="px-3 py-2 text-left">Capability</th>
                  <th className="px-3 py-2 text-right">Permitidas</th>
                  <th className="px-3 py-2 text-right">Negadas</th>
                </tr>
              </thead>
              <tbody>
                {caps.map((cap) => {
                  const c = data.capabilityCounters[cap];
                  return (
                    <tr key={cap} className="border-t border-slate-800">
                      <td className="px-3 py-2">{cap}</td>
                      <td className="px-3 py-2 text-right">{c.allowed}</td>
                      <td className="px-3 py-2 text-right text-red-400">{c.denied}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">Latência do can() (ms)</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/60">
                <tr>
                  <th className="px-3 py-2 text-left">Capability</th>
                  <th className="px-3 py-2 text-right">Chamadas</th>
                  <th className="px-3 py-2 text-right">Média</th>
                  <th className="px-3 py-2 text-right">p95</th>
                  <th className="px-3 py-2 text-right">Máx</th>
                </tr>
              </thead>
              <tbody>
                {latCaps.map((cap) => {
                  const s = data.canLatency[cap];
                  return (
                    <tr key={cap} className="border-t border-slate-800">
                      <td className="px-3 py-2">{cap}</td>
                      <td className="px-3 py-2 text-right">{s.count}</td>
                      <td className="px-3 py-2 text-right">{s.avgMs.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{s.p95Ms.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{s.maxMs.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}