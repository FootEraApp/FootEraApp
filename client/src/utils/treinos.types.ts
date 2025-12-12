export type ExercicioDoBanco = {
  exercicioId: string;    
  repeticoes?: string | null;
  ordem?: number;
};

export type ExercicioTemporario = {
  nome: string;        
  descricao?: string | null;
  repeticoes?: string | null;
  ordem?: number;
  videoDemonstrativoUrl?: string;
};

export type TreinoCreatePayload = {
  codigo?: string;
  nome: string;
  descricao?: string | null;
  nivel: string;          
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
  atletasIds?: string[];   
  elencosIds?: string[];
  exercicios: (ExercicioDoBanco | ExercicioTemporario)[];
  pontuacao?: number;
};

export type ExItemUI = {
  idCatalogo?: string | null;
  nome?: string;        
  descricao?: string | null;
  repeticoes?: string | null;
  ordem?: number;
  series?: string; 
  exercicioId?: string; 
  repeticoesTexto?: string | null;
};