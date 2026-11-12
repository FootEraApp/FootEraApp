/** Evidência fictícia exclusivamente para testes de serviço/HTTP de decisão.
 * NÃO cria objeto S3 e NÃO comprova upload/download ou conferência real.
 */
import { randomUUID } from "node:crypto";
type Db = typeof import("./server/prisma.js").prisma;

export async function prepararEvidenciaNascimentoQA(
  db: Db,
  solicitacaoId: string,
  administradorId: string,
) {
  if (process.env.NODE_ENV !== "test") throw new Error("SOMENTE_TESTE_QA");
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (url.hostname !== "127.0.0.1" || url.port !== "5433" ||
      url.pathname !== "/footera_billing_qa") {
    throw new Error("BANCO_QA_INCORRETO");
  }
  const documento = await db.documentoCorrecaoNascimento.create({
    data: {
      solicitacaoId,
      s3Key: `documentos-nascimento/${solicitacaoId}/${randomUUID()}.pdf`,
      mimeType: "application/pdf",
      tamanhoBytes: 24,
      sha256: "0".repeat(64),

      // Exclusivo para a fixture QA.
      // NÃO representa uma varredura antimalware real.
      statusSeguranca: "SEGURO",
      analisadoEm: new Date(),
      scannerRef: `QA_FIXTURE_${randomUUID()}`,
    },
  });
  await db.logAuditoria.create({
    data: {
      usuarioId: administradorId,
      acao: "DOCUMENTO_NASCIMENTO_ACESSADO",
      entidade: "SolicitacaoCorrecaoNascimento",
      entidadeId: solicitacaoId,
      meta: { documentoId: documento.id, fixtureSomenteQA: true },
    },
  });
  return documento;
}
