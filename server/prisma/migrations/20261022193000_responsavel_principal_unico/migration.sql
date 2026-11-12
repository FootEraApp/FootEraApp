CREATE UNIQUE INDEX "ResponsavelAtleta_um_principal_ativo"
ON "ResponsavelAtleta" ("atletaId")
WHERE "principal" = true
  AND "status" = 'ATIVO';
