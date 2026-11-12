const { PrismaClient } = require("@prisma/client");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

async function main() {
  const prisma = new PrismaClient();

  try {
    const [db] = await prisma.$queryRaw`
      SELECT current_database() AS nome
    `;

    if (db?.nome !== "footera_billing_qa") {
      throw new Error("QA_BANCO_NAO_AUTORIZADO");
    }

    const historico = await prisma.$queryRaw`
      SELECT migration_name, checksum, finished_at, rolled_back_at
      FROM "_prisma_migrations"
    `;

    const pasta = path.resolve("server/prisma/migrations");

    const arquivos = fs.readdirSync(pasta, {
      withFileTypes: true
    }).filter(x => x.isDirectory());

    const porNome = new Map(
      historico.map(x => [x.migration_name, x])
    );

    const relatorio = arquivos.map(x => {
      const sql = path.join(pasta, x.name, "migration.sql");
      const existe = fs.existsSync(sql);
      const texto = existe ? fs.readFileSync(sql) : null;
      const hash = texto
        ? crypto.createHash("sha256").update(texto).digest("hex")
        : null;

      const registro = porNome.get(x.name);

      return {
        nome: x.name,
        possuiSql: existe,
        registrado: Boolean(registro),
        aplicado: Boolean(registro?.finished_at &&
                         !registro?.rolled_back_at),
        checksumConfere: registro ? registro.checksum === hash : null,
        possuiAlteracaoDados: texto
          ? /\b(UPDATE|INSERT|DELETE|TRUNCATE)\b/i.test(
              texto.toString("utf8")
            )
          : null,
        possuiSqlManual: texto
          ? /\b(CREATE\s+TRIGGER|CREATE\s+FUNCTION|DROP\s+COLUMN|DROP\s+INDEX)\b/i.test(
              texto.toString("utf8")
            )
          : null
      };
    });

    const nomes = new Set(arquivos.map(x => x.name));

    const ausentesNoDisco = historico
      .filter(x => !nomes.has(x.migration_name))
      .map(x => x.migration_name);

    const resultado = {
      banco: db.nome,
      totalArquivos: arquivos.length,
      totalHistorico: historico.length,
      arquivosSemRegistro: relatorio.filter(x => !x.registrado).length,
      divergenciasChecksum: relatorio.filter(
        x => x.registrado && !x.checksumConfere
      ),
      historicoSemArquivo: ausentesNoDisco,
      migrations: relatorio
    };

    const saida = "relatorio-migrations-qa.json";

    fs.writeFileSync(
      saida,
      JSON.stringify(resultado, null, 2)
    );

    console.log("Relatorio criado:", saida);
    console.log({
      totalArquivos: resultado.totalArquivos,
      totalHistorico: resultado.totalHistorico,
      arquivosSemRegistro: resultado.arquivosSemRegistro,
      divergenciasChecksum: resultado.divergenciasChecksum,
      historicoSemArquivo: resultado.historicoSemArquivo
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
