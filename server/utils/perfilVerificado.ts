// server/utils/perfilVerificado.ts
import { StatusCref, TipoUsuario } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

function hasText(v: any) {
  return typeof v === "string" && v.trim().length > 0;
}

function hasAnyText(...vals: any[]) {
  return vals.some(hasText);
}

function hasArray(v: any) {
  return Array.isArray(v) && v.length > 0;
}

function hasNumber(v: any) {
  return typeof v === "number" && Number.isFinite(v);
}

function hasDecimal(v: any) {
  if (v == null) return false;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "string") return v.trim() !== "" && !Number.isNaN(Number(v));
  if (typeof (v as any)?.toNumber === "function") {
    const n = (v as any).toNumber();
    return Number.isFinite(n);
  }
  return false;
}

export function calcularPerfilVerificado(input: {
  usuario: {
    verified?: boolean | null;
    nome?: string | null;
    nomeDeUsuario?: string | null;
    email?: string | null;
    foto?: string | null;
  } | null | undefined;

  tipo: TipoUsuario | string | null | undefined;

  atleta?: {
    posicao?: string | null;
    categoria?: any[] | null;
    idade?: number | null;
    telefone1?: string | number | null;
    nacionalidade?: string | null;
    naturalidade?: string | null;
    altura?: Decimal | number | string | null;
    peso?: Decimal | number | string | null;
    seloQualidade?: string | null;
  } | null;

  professor?: {
    areaFormacao?: string | null;
    cref?: string | null;
    statusCref?: StatusCref | string | null;
    dataNascimento?: Date | string | null;
    escola?: string | null;
    qualificacoes?: string[] | string | null;
    certificacoes?: string[] | string | null;
    fotoUrl?: string | null;
  } | null;

  clube?: {
    nome?: string | null;
    cnpj?: string | null;
    email?: string | null;
    telefone1?: string | number | null;
    siteOficial?: string | null;
    sede?: string | null;
    cidade?: string | null;
    estado?: string | null;
    bairro?: string | null;
    pais?: string | null;
    cep?: string | null;
    logo?: string | null;
  } | null;

  escolinha?: {
    nome?: string | null;
    cnpj?: string | null;
    email?: string | null;
    telefone1?: string | number | null;
    siteOficial?: string | null;
    cidade?: string | null;
    estado?: string | null;
    bairro?: string | null;
    pais?: string | null;
    cep?: string | null;
    logo?: string | null;
  } | null;

  olheiro?: {
    areaAtuacao?: string | null;
    anosExperiencia?: number | null;
    emailPublico?: string | null;
    telefonePublico?: string | null;
    descricao?: string | null;
    fotoUrl?: string | null;
  } | null;
}) {
  const u = input.usuario;

  // base do usuário
  const baseOk =
    hasText(u?.nome) &&
    hasText(u?.nomeDeUsuario) &&
    hasText(u?.foto);

  if (!baseOk) return false;

  const tipoNorm = String(input.tipo || "").trim().toLowerCase();

  if (tipoNorm === "atleta") {
    const a = input.atleta;
    if (!a) return false;

    return (
      hasText(a.posicao) &&
      hasArray(a.categoria) &&
      hasNumber(a.idade) &&
      hasAnyText(a.telefone1) &&
      hasText(a.nacionalidade) &&
      hasText(a.naturalidade) &&
      hasDecimal(a.altura) &&
      hasDecimal(a.peso) &&
      hasText(a.seloQualidade)
    );
  }

  if (tipoNorm === "professor") {
    const p = input.professor;
    if (!p) return false;

    const qualificacoesOk =
      Array.isArray(p.qualificacoes)
        ? p.qualificacoes.length > 0
        : hasText(p.qualificacoes);

    const certificacoesOk =
      Array.isArray(p.certificacoes)
        ? p.certificacoes.length > 0
        : hasText(p.certificacoes);

    const dataNascimentoOk =
      p.dataNascimento instanceof Date
        ? !Number.isNaN(p.dataNascimento.getTime())
        : hasText(p.dataNascimento);

    return (
      hasText(p.areaFormacao) &&
      hasText(p.cref) &&
      hasText(p.statusCref) &&
      dataNascimentoOk &&
      hasText(p.escola) &&
      qualificacoesOk &&
      certificacoesOk &&
      hasText(p.fotoUrl)
    );
  }

  if (tipoNorm === "clube") {
    const c = input.clube;
    if (!c) return false;

    return (
      hasText(c.nome) &&
      hasText(c.cnpj) &&
      hasText(c.email) &&
      hasText(c.telefone1) &&
      hasText(c.siteOficial) &&
      hasText(c.sede) &&
      hasText(c.cidade) &&
      hasText(c.estado) &&
      hasText(c.bairro) &&
      hasText(c.pais) &&
      hasText(c.cep) &&
      hasText(c.logo)
    );
  }

  if (tipoNorm === "escolinha") {
    const e = input.escolinha;
    if (!e) return false;

    return (
      hasText(e.nome) &&
      hasText(e.cnpj) &&
      hasText(e.email) &&
      hasText(e.telefone1) &&
      hasText(e.siteOficial) &&
      hasText(e.cidade) &&
      hasText(e.estado) &&
      hasText(e.bairro) &&
      hasText(e.pais) &&
      hasText(e.cep) &&
      hasText(e.logo)
    );
  }

  if (tipoNorm === "olheiro") {
    const o = input.olheiro;
    if (!o) return false;

    return (
      hasText(o.areaAtuacao) &&
      hasNumber(o.anosExperiencia) &&
      hasText(o.emailPublico) &&
      hasText(o.telefonePublico) &&
      hasText(o.descricao) &&
      hasText(o.fotoUrl)
    );
  }

  return false;
}