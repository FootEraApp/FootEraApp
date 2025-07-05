import { useQuery } from "@tanstack/react-query";
import MobileLayout from "@/components/layout/MobileLayout";

export default function RankingPage() {
  const { data: rankings = [], isLoading } = useQuery({
    queryKey: ["ranking"],
    queryFn: async () => {
      const res = await fetch("/api/ranking");
      return res.json();
    }
  });

  return (
    <MobileLayout>
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">Ranking Geral</h1>
        {isLoading ? (
          <p>Carregando...</p>
        ) : (
          <ul>
            {rankings.map((r: any, i: number) => (
              <li key={r.id} className="mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold">{i + 1}º</span> - {r.atleta.usuario.nome}
                  </div>
                  <span className="font-bold">{r.total} pts</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MobileLayout>
  );
}
