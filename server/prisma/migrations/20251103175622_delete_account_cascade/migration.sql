-- DropForeignKey
ALTER TABLE "public"."Administrador" DROP CONSTRAINT "Administrador_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Amigo" DROP CONSTRAINT "Amigo_amigoId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Amigo" DROP CONSTRAINT "Amigo_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Assinatura" DROP CONSTRAINT "Assinatura_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AtividadeRecente" DROP CONSTRAINT "AtividadeRecente_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Atleta" DROP CONSTRAINT "Atleta_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AtletaObservado" DROP CONSTRAINT "AtletaObservado_atletaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Clube" DROP CONSTRAINT "Clube_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Comentario" DROP CONSTRAINT "Comentario_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Consentimento" DROP CONSTRAINT "Consentimento_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Curtida" DROP CONSTRAINT "Curtida_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DesafioEmGrupo" DROP CONSTRAINT "DesafioEmGrupo_criadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DocumentoFormador" DROP CONSTRAINT "DocumentoFormador_atletaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."EmailVerification" DROP CONSTRAINT "EmailVerification_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Escolinha" DROP CONSTRAINT "Escolinha_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."EstatisticaAtleta" DROP CONSTRAINT "EstatisticaAtleta_atletaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Evento" DROP CONSTRAINT "Evento_clubeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."FavoritoUsuario" DROP CONSTRAINT "FavoritoUsuario_favoritoUsuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."FavoritoUsuario" DROP CONSTRAINT "FavoritoUsuario_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Grupo" DROP CONSTRAINT "Grupo_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Indicacao" DROP CONSTRAINT "Indicacao_atletaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Indicacao" DROP CONSTRAINT "Indicacao_clubeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Indicacao" DROP CONSTRAINT "Indicacao_olheiroId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LogErro" DROP CONSTRAINT "LogErro_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MembroGrupo" DROP CONSTRAINT "MembroGrupo_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Mensagem" DROP CONSTRAINT "Mensagem_deId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Mensagem" DROP CONSTRAINT "Mensagem_paraId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Mensagem" DROP CONSTRAINT "Mensagem_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MensagemGrupo" DROP CONSTRAINT "MensagemGrupo_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Midia" DROP CONSTRAINT "Midia_atletaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Midia" DROP CONSTRAINT "Midia_submissaoDesafioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Midia" DROP CONSTRAINT "Midia_submissaoTreinoId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Olheiro" DROP CONSTRAINT "Olheiro_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PasswordReset" DROP CONSTRAINT "PasswordReset_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PontuacaoAtleta" DROP CONSTRAINT "PontuacaoAtleta_atletaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Postagem" DROP CONSTRAINT "Postagem_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Professor" DROP CONSTRAINT "Professor_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Ranking" DROP CONSTRAINT "Ranking_atletaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RegistroTreino" DROP CONSTRAINT "RegistroTreino_treinoId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Seguidor" DROP CONSTRAINT "Seguidor_seguidoUsuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Seguidor" DROP CONSTRAINT "Seguidor_seguidorUsuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SolicitacaoVinculo" DROP CONSTRAINT "SolicitacaoVinculo_atletaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SubmissaoDesafio" DROP CONSTRAINT "SubmissaoDesafio_atletaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SubmissaoDesafioEmGrupo" DROP CONSTRAINT "SubmissaoDesafioEmGrupo_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SubmissaoTreino" DROP CONSTRAINT "SubmissaoTreino_atletaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TransferenciaFormador" DROP CONSTRAINT "TransferenciaFormador_atletaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TreinoAgendado" DROP CONSTRAINT "TreinoAgendado_atletaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TreinoLivre" DROP CONSTRAINT "TreinoLivre_atletaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TreinoProgramadoRecebido" DROP CONSTRAINT "TreinoProgramadoRecebido_atletaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TreinoRealizado" DROP CONSTRAINT "TreinoRealizado_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TurmaUsuario" DROP CONSTRAINT "TurmaUsuario_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Video" DROP CONSTRAINT "Video_atletaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."VinculoFormacao" DROP CONSTRAINT "VinculoFormacao_atletaId_fkey";

-- CreateIndex
CREATE INDEX "TreinoUsuario_usuarioId_idx" ON "TreinoUsuario"("usuarioId");

-- AddForeignKey
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assinatura" ADD CONSTRAINT "Assinatura_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Professor" ADD CONSTRAINT "Professor_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Amigo" ADD CONSTRAINT "Amigo_amigoId_fkey" FOREIGN KEY ("amigoId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Amigo" ADD CONSTRAINT "Amigo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Olheiro" ADD CONSTRAINT "Olheiro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_deId_fkey" FOREIGN KEY ("deId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_paraId_fkey" FOREIGN KEY ("paraId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atleta" ADD CONSTRAINT "Atleta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seguidor" ADD CONSTRAINT "Seguidor_seguidoUsuarioId_fkey" FOREIGN KEY ("seguidoUsuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seguidor" ADD CONSTRAINT "Seguidor_seguidorUsuarioId_fkey" FOREIGN KEY ("seguidorUsuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtletaObservado" ADD CONSTRAINT "AtletaObservado_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postagem" ADD CONSTRAINT "Postagem_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Midia" ADD CONSTRAINT "Midia_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Midia" ADD CONSTRAINT "Midia_submissaoDesafioId_fkey" FOREIGN KEY ("submissaoDesafioId") REFERENCES "SubmissaoDesafio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Midia" ADD CONSTRAINT "Midia_submissaoTreinoId_fkey" FOREIGN KEY ("submissaoTreinoId") REFERENCES "SubmissaoTreino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escolinha" ADD CONSTRAINT "Escolinha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comentario" ADD CONSTRAINT "Comentario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clube" ADD CONSTRAINT "Clube_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoVinculo" ADD CONSTRAINT "SolicitacaoVinculo_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissaoDesafio" ADD CONSTRAINT "SubmissaoDesafio_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissaoTreino" ADD CONSTRAINT "SubmissaoTreino_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroGrupo" ADD CONSTRAINT "MembroGrupo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemGrupo" ADD CONSTRAINT "MensagemGrupo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Administrador" ADD CONSTRAINT "Administrador_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogErro" ADD CONSTRAINT "LogErro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curtida" ADD CONSTRAINT "Curtida_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoAgendado" ADD CONSTRAINT "TreinoAgendado_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoLivre" ADD CONSTRAINT "TreinoLivre_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroTreino" ADD CONSTRAINT "RegistroTreino_treinoId_fkey" FOREIGN KEY ("treinoId") REFERENCES "TreinoLivre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PontuacaoAtleta" ADD CONSTRAINT "PontuacaoAtleta_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ranking" ADD CONSTRAINT "Ranking_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtividadeRecente" ADD CONSTRAINT "AtividadeRecente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoRealizado" ADD CONSTRAINT "TreinoRealizado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoProgramadoRecebido" ADD CONSTRAINT "TreinoProgramadoRecebido_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesafioEmGrupo" ADD CONSTRAINT "DesafioEmGrupo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissaoDesafioEmGrupo" ADD CONSTRAINT "SubmissaoDesafioEmGrupo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstatisticaAtleta" ADD CONSTRAINT "EstatisticaAtleta_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoritoUsuario" ADD CONSTRAINT "FavoritoUsuario_favoritoUsuarioId_fkey" FOREIGN KEY ("favoritoUsuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoritoUsuario" ADD CONSTRAINT "FavoritoUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicacao" ADD CONSTRAINT "Indicacao_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicacao" ADD CONSTRAINT "Indicacao_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicacao" ADD CONSTRAINT "Indicacao_olheiroId_fkey" FOREIGN KEY ("olheiroId") REFERENCES "Olheiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinculoFormacao" ADD CONSTRAINT "VinculoFormacao_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferenciaFormador" ADD CONSTRAINT "TransferenciaFormador_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoFormador" ADD CONSTRAINT "DocumentoFormador_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoUsuario" ADD CONSTRAINT "TreinoUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionChecklist" ADD CONSTRAINT "SubmissionChecklist_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consentimento" ADD CONSTRAINT "Consentimento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaUsuario" ADD CONSTRAINT "TurmaUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
