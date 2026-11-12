CREATE TYPE "BillingComunicacaoCanal" AS ENUM (
  'APP',
  'EMAIL'
);

CREATE TYPE "BillingComunicacaoStatus" AS ENUM (
  'PENDENTE',
  'PROCESSANDO',
  'ENVIADO',
  'FALHOU'
);

CREATE TABLE "BillingComunicacao" (
  "id" TEXT NOT NULL,
  "assinaturaId" TEXT NOT NULL,
  "cicloKey" TEXT NOT NULL,
  "evento" TEXT NOT NULL,
  "canal" "BillingComunicacaoCanal" NOT NULL,
  "status" "BillingComunicacaoStatus" NOT NULL DEFAULT 'PENDENTE',
  "tentativas" INTEGER NOT NULL DEFAULT 0,
  "enviadoEm" TIMESTAMP(3),
  "proximaTentativaEm" TIMESTAMP(3),
  "ultimoErro" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BillingComunicacao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
  "BillingComunicacao_assinaturaId_cicloKey_evento_canal_key"
ON "BillingComunicacao" (
  "assinaturaId",
  "cicloKey",
  "evento",
  "canal"
);

CREATE INDEX
  "BillingComunicacao_status_proximaTentativaEm_idx"
ON "BillingComunicacao" (
  "status",
  "proximaTentativaEm"
);

CREATE INDEX
  "BillingComunicacao_assinaturaId_idx"
ON "BillingComunicacao" (
  "assinaturaId"
);