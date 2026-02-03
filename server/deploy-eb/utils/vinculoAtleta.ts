export type VinculoContext =
  | { tipo: "direto"; professorId: string }
  | { tipo: "escolinha"; escolinhaId: string; nome?: string | null }
  | { tipo: "clube"; clubeId: string; nome?: string | null }
  | { tipo: "nenhum" };

export function pickVinculoContext(args: {
  temDireto: boolean;
  atletaEscolinha?: { id: string; nome?: string | null } | null;
  atletaClube?: { id: string; nome?: string | null } | null;
  escolinhaIdsDoProfessor: string[];
  clubeIdsDoProfessor: string[];
  professorId: string;
}): VinculoContext {
  const {
    temDireto,
    atletaEscolinha,
    atletaClube,
    escolinhaIdsDoProfessor,
    clubeIdsDoProfessor,
    professorId,
  } = args;

  if (temDireto) return { tipo: "direto", professorId };

  if (atletaEscolinha?.id && escolinhaIdsDoProfessor.includes(atletaEscolinha.id)) {
    return { tipo: "escolinha", escolinhaId: atletaEscolinha.id, nome: atletaEscolinha.nome ?? null };
  }

  if (atletaClube?.id && clubeIdsDoProfessor.includes(atletaClube.id)) {
    return { tipo: "clube", clubeId: atletaClube.id, nome: atletaClube.nome ?? null };
  }

  return { tipo: "nenhum" };
}
