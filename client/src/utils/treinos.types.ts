// client/src/utils/treinos.types.ts

export type ExercicioDoBanco = {
  exercicioId: string;        // id do catálogo
  repeticoes?: string | null;
  ordem?: number;
};

export type ExercicioTemporario = {
  // sem exercicioId!
  nome: string;               // obrigatório p/ temporário
  descricao?: string | null;
  repeticoes?: string | null;
  ordem?: number;
};

export type TreinoCreatePayload = {
  nome: string;
  descricao?: string | null;
  nivel: string;              // mantenha coerente com enum do backend
  usuarioId: string;
  tipoUsuario: "professor" | "clube" | "escolinha";
  tipoUsuarioId: string;
  categoria?: string[];
  tipoTreino?: string | null;
  objetivo?: string | null;
  duracao?: number | null;
  dataTreino?: string | null;
  dataAgendada?: string | null;
  dicas?: string[];
  atletasIds?: string[];      // agenda automaticamente p/ estes atletas
  exercicios: (ExercicioDoBanco | ExercicioTemporario)[];
};

// estado mínimo de item de exercício no formulário
export type ExItemUI = {
  idCatalogo?: string | null; // quando veio do select do catálogo
  nome?: string;              // se for temporário
  descricao?: string | null;
  repeticoes?: string | null;
  ordem?: number;
  series?: string; 
};
