import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function requireElencoOwner(req: any, res: any, next: any) {
  const elencoId = req.params.id;
  const uid = req.userId as string;

  const usuario = await prisma.usuario.findUnique({
    where: { id: uid },
    include: { professor: true, clube: true, escolinha: true },
  });
  if (!usuario) return res.status(401).json({ error: "Não autenticado" });

  const elenco = await prisma.elenco.findUnique({ where: { id: elencoId } });
  if (!elenco) return res.status(404).json({ error: "Elenco não encontrado" });

  const isOwner =
    (usuario.professor && elenco.professorId === usuario.professor.id) ||
    (usuario.clube     && elenco.clubeId     === usuario.clube.id)     ||
    (usuario.escolinha && elenco.escolinhaId === usuario.escolinha.id);

  if (!isOwner) return res.status(403).json({ error: "Sem acesso" });
  next();
}

export async function requireVinculoComAtleta(req: any, res: any, next: any) {
  const atletaId = req.params.atletaId ?? req.query.atletaId;
  const uid = req.userId as string;
  if (!atletaId) return res.status(400).json({ error: "atletaId é obrigatório" });

  const usuario = await prisma.usuario.findUnique({
    where: { id: uid },
    include: { professor: true, clube: true, escolinha: true },
  });

  const vinculo = await prisma.relacaoTreinamento.findFirst({
    where: {
      atletaId: String(atletaId),
      OR: [
        usuario?.professor ? { professorId: usuario.professor.id } : undefined,
        usuario?.clube     ? { clubeId: usuario.clube.id }         : undefined,
        usuario?.escolinha ? { escolinhaId: usuario.escolinha.id } : undefined,
      ].filter(Boolean) as any,
    },
    select: { id: true },
  });

  if (!vinculo) return res.status(403).json({ error: "Sem vínculo com o atleta" });
  next();
}