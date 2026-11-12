/**
 * FootEra — QA do cupom 20PARABENS.
 * Testa a implementacao REAL do servico de aniversario e da reserva transacional.
 * NAO executa webhook, confirmacao de pagamento, provisionamento ou Mercado Pago.
 * Executar apenas em NODE_ENV=test e banco footera_billing_qa.
 * Requer export de criarPagamentoComReservaQa no billingController (sem criar rota).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "./server/prisma.js";

function protegerQa() {
  const u = new URL(process.env.DATABASE_URL ?? "");
  const variaveis: Record<string,string> = {
    NODE_ENV: "test",
    BILLING_CUPOM_RESERVA_QA: "true",
    ENABLE_BILLING_SCHEDULER: "false",
    ENABLE_MP_CONCILIACAO_SCHEDULER: "false",
  };
  for (const [k,v] of Object.entries(variaveis)) {
    assert.equal(process.env[k],v,`QA_INSEGURO_${k}`);
  }
  assert.ok(["postgresql:","postgres:"].includes(u.protocol),"QA_PROTOCOLO_INVALIDO");
  assert.ok(["localhost","127.0.0.1"].includes(u.hostname),"QA_HOST_INVALIDO");
  assert.equal(u.port,"5433","QA_PORTA_INVALIDA");
  assert.equal(u.pathname,"/footera_billing_qa","QA_BANCO_INVALIDO");
  assert.equal(process.env.MP_ACCESS_TOKEN ?? "","","QA_MP_TOKEN_DEVE_ESTAR_VAZIO");
}
protegerQa();

const PREFIXO = `QA_PARABENS_${randomUUID().replaceAll("-","")}`;
const usuarios: string[] = [];
const pagamentos: string[] = [];
const cupons: string[] = [];
let checks = 0;
let limpezaOk = false;
function aprovar(cond: unknown, descricao: string) {
  assert.ok(cond,`REPROVADO: ${descricao}`);
  checks++;
  console.log(`APROVADO ${String(checks).padStart(2,"0")} — ${descricao}`);
}

function partesBrasilia(date: Date) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const n = (s: string) => Number(p.find(x => x.type === s)?.value);
  return { ano: n("year"), mes: n("month"), dia: n("day") };
}
function nascimentoCivil(ano: number, mes: number, dia: number) {
  return new Date(Date.UTC(ano, mes-1, dia));
}
function dataNascimentoDiferente(hoje: {mes:number,dia:number}) {
  return new Date(Date.UTC(2001, hoje.mes-1, hoje.dia+1));
}
function dataSomadaBRT(dia: {ano:number,mes:number,dia:number}, delta: number) {
  const ref = new Date(Date.UTC(dia.ano,dia.mes-1,dia.dia+delta,12));
  const p = partesBrasilia(ref);
  return new Date(`${p.ano}-${String(p.mes).padStart(2,"0")}-${String(p.dia).padStart(2,"0")}T12:00:00-03:00`);
}

async function criarUsuario(sufixo: string, nascimento: Date|null, verified=true, aptoDesde?: Date|null) {
  const user = await prisma.usuario.create({
    data: {
      nome: `QA aniversario ${sufixo}`,
      nomeDeUsuario: `${PREFIXO}_${sufixo}`.toLowerCase().slice(0,65),
      email: `${PREFIXO}_${sufixo}@example.invalid`.toLowerCase(),
      senhaHash: `NAO_UTILIZAR_${PREFIXO}`,
      tipo: "Atleta",
      dataNascimento: nascimento,
      verified,
      aniversarioElegivelApartirDe: aptoDesde ?? null,
    },
  });
  usuarios.push(user.id);
  return user.id;
}

async function executar() {
  const banco = await prisma.$queryRaw<Array<{ nome: string }>>`SELECT current_database() AS nome`;
  assert.equal(banco[0]?.nome,"footera_billing_qa");
  const {
    consultarBeneficioAniversario,
    obterCupomAniversario,
    CupomAniversarioError,
    ehCupomAniversario,
  } = await import("./server/services/billingCupomAniversarioService.js");
  const { criarPagamentoComReservaQa } =
    await import("./server/controllers/billingController.js");

  const agora = new Date();
  const hoje = partesBrasilia(agora);
  const antes = new Date(agora.getTime()-45*86400000);
  const depois = new Date(agora.getTime()+45*86400000);
  const aniversariante = await criarUsuario("aniversariante",nascimentoCivil(2000,hoje.mes,hoje.dia),true,antes);
  const naoAniversariante = await criarUsuario("outro",dataNascimentoDiferente(hoje),true,antes);
  const semVerificacao = await criarUsuario("sem_verificacao",nascimentoCivil(2000,hoje.mes,hoje.dia),false,antes);
  const emCarencia = await criarUsuario("carencia",nascimentoCivil(2000,hoje.mes,hoje.dia),true,depois);
  const semNascimento = await criarUsuario("sem_nascimento",null,true,antes);
  const semDataElegibilidade = await criarUsuario("sem_data_elegibilidade",nascimentoCivil(2000,hoje.mes,hoje.dia),true,null);

  const beneficio = await consultarBeneficioAniversario(aniversariante,agora);
  aprovar(beneficio.elegivel===true && beneficio.disponivel===true,"Aniversariante verificado e fora da carencia e elegivel");
  aprovar(beneficio.codigo==="20PARABENS" && beneficio.percentual===20,"Codigo publico e percentual de 20%");
  const expira = new Date(beneficio.expiraEm!);
  aprovar(Number.isFinite(expira.getTime()) && expira>agora,"Beneficio informa expiracao futura");
  aprovar(partesBrasilia(new Date(expira.getTime()-1000)).dia===hoje.dia,"Beneficio expira no fim do dia civil em Brasilia");
  aprovar(!(await consultarBeneficioAniversario(naoAniversariante,agora)).elegivel,"Outro usuario nao faz aniversario");
  aprovar(!(await consultarBeneficioAniversario(semVerificacao,agora)).elegivel,"Conta nao verificada nao ganha cupom");
  aprovar(!(await consultarBeneficioAniversario(emCarencia,agora)).elegivel,"Carencia futura bloqueia promocao");
  aprovar(!(await consultarBeneficioAniversario(semNascimento,agora)).elegivel,"Conta sem nascimento nao ganha cupom");
  aprovar(!(await consultarBeneficioAniversario(semDataElegibilidade,agora)).elegivel,"Elegibilidade nao habilitada bloqueia cupom");
  const amanha = dataSomadaBRT(hoje,1);
  aprovar(!(await consultarBeneficioAniversario(aniversariante,amanha)).elegivel,"Cupom deixa de ser elegivel no dia seguinte em Brasilia");
  let amanhaBloqueado=false;
  try { await obterCupomAniversario(aniversariante,"20PARABENS",amanha); }
  catch(e) { amanhaBloqueado=e instanceof CupomAniversarioError && e.code==="BIRTHDAY_COUPON_NOT_TODAY"; }
  aprovar(amanhaBloqueado,"Emissao do cupom e recusada fora da data");
  aprovar((await obterCupomAniversario(aniversariante,"OUTRO",agora))===null,"Codigo diferente nao resolve para aniversario");
  let foraDaData=false;
  try { await obterCupomAniversario(naoAniversariante,"20PARABENS",agora); }
  catch(e) { foraDaData = e instanceof CupomAniversarioError && e.code==="BIRTHDAY_COUPON_NOT_TODAY"; }
  aprovar(foraDaData,"Codigo publico recusado para outro usuario fora do aniversario");

  const cupom = await obterCupomAniversario(aniversariante,"20parabens",agora);
  assert.ok(cupom);
  cupons.push(cupom.id);
  aprovar(cupom.codigo===`ANIVERSARIO_${hoje.ano}_${aniversariante}`,"Codigo interno individual por usuario e ano");
  aprovar(cupom.concedidoParaUsuarioId===aniversariante && cupom.transferivel===false,"Cupom nao transferivel e exclusivo do dono");
  aprovar(cupom.tipo==="PERCENTUAL" && cupom.descontoPerc===20 && cupom.usosMax===1,"Cupom persistido com percentual e uso maximo corretos");
  aprovar(ehCupomAniversario(cupom),"Identificacao do cupom especial valida");

  const valorBaseCentavos = 10000;
  const valorFinalCentavos = Math.round(valorBaseCentavos*0.8);
  const preco = valorFinalCentavos / 100;
  aprovar(valorFinalCentavos===8000 && preco===80,"Formula de referencia: R$100,00 -> R$80,00 (NAO testa checkout)");

  const dadosPagamento = (usuarioId: string) => ({
    usuarioId, plano: "ATLETA_PRO", periodicidade: "Mensal" as const,
    metodo: "PIX" as const, status: "PENDENTE" as const,
    valor: preco.toFixed(2), moeda: "BRL", cupomId: cupom.id,
    provider: "INTERNAL_FAKE", contextoKind: "PERSONAL", contextoTipo: "Atleta",
  });

  // Cria pagamentos pendentes com a FUNCAO REAL de reserva do billingController,
  // sem chamar endpoints, Mercado Pago ou rotina de aprovacao/provisionamento.
  const r = await Promise.allSettled([
    criarPagamentoComReservaQa({ usuarioId: aniversariante, cupomId: cupom.id, data: dadosPagamento(aniversariante) }),
    criarPagamentoComReservaQa({ usuarioId: aniversariante, cupomId: cupom.id, data: dadosPagamento(aniversariante) }),
  ]);
  for(const x of r) if(x.status==="fulfilled") pagamentos.push(x.value.id);
  aprovar(r.filter(x=>x.status==="fulfilled").length===1,"Concorrencia: exatamente uma reserva pelo codigo real");
  aprovar(r.filter(x=>x.status==="rejected").length===1,"Concorrencia: segunda tentativa bloqueada");
  const pagamento = r.find(x=>x.status==="fulfilled");
  assert.ok(pagamento && pagamento.status==="fulfilled");
  const reserva = await prisma.cupomReserva.findUnique({where:{pagamentoId:pagamento.value.id}});
  aprovar(reserva?.status==="RESERVADA" && reserva.usuarioId===aniversariante && reserva.cupomId===cupom.id,"Reserva vinculada a cupom, pagador e pagamento certos");
  aprovar((await prisma.pagamento.count({where:{usuarioId:aniversariante,cupomId:cupom.id}}))===1,"Concorrencia nao criou segundo pagamento");
  const reservado = await consultarBeneficioAniversario(aniversariante,agora);
  aprovar(reservado.elegivel===true && reservado.disponivel===false,"Banner informa indisponivel quando existe reserva ativa");
  let outraReservaBloqueada=false;
  try { const p=await criarPagamentoComReservaQa({usuarioId:aniversariante,cupomId:cupom.id,data:dadosPagamento(aniversariante)}); pagamentos.push(p.id); }
  catch { outraReservaBloqueada=true; }
  aprovar(outraReservaBloqueada,"Terceiro checkout bloqueado enquanto reserva esta ativa");
  let terceiroBloqueado=false;
  try { const p=await criarPagamentoComReservaQa({usuarioId:naoAniversariante,cupomId:cupom.id,data:dadosPagamento(naoAniversariante)}); pagamentos.push(p.id); }
  catch(e) { terceiroBloqueado=String(e).includes("BILLING_COUPON_OWNER_MISMATCH"); }
  aprovar(terceiroBloqueado,"Outro usuario nao consegue reservar cupom interno do aniversariante");
  aprovar((await prisma.pagamento.count({where:{usuarioId:naoAniversariante,cupomId:cupom.id}}))===0,"Tentativa de terceiro nao gera pagamento");

  // Nao altera status da cobranca nem concede beneficio: simula SOMENTE
  // um registro de consumo no banco para certificar unicidade e disponibilidade.
  await prisma.cupomResgate.create({data:{cupomId:cupom.id,usuarioId:aniversariante,pagamentoId:pagamento.value.id}});
  await prisma.cupom.update({where:{id:cupom.id},data:{usosAtuais:{increment:1}}});
  let duplaGravacao=false;
  try { await prisma.cupomResgate.create({data:{cupomId:cupom.id,usuarioId:aniversariante,pagamentoId:pagamento.value.id}}); }
  catch { duplaGravacao=true; }
  aprovar(duplaGravacao,"Banco impede resgate duplicado do mesmo cupom por usuario");
  const aposUso=await consultarBeneficioAniversario(aniversariante,agora);
  aprovar(aposUso.elegivel && !aposUso.disponivel,"Beneficio fica indisponivel apos resgate simulado");

  // Novo ano: apenas consulta elegibilidade, sem reservar um pagamento futuro.
  const proxAno = new Date(Date.UTC(hoje.ano+1,hoje.mes-1,hoje.dia,16));
  const futuro = await consultarBeneficioAniversario(aniversariante,proxAno);
  aprovar(futuro.elegivel===true && futuro.disponivel===true,"Beneficio pode renovar em outro ano");
  aprovar((await prisma.cupom.findUnique({where:{codigo:`ANIVERSARIO_${hoje.ano+1}_${aniversariante}`}}))===null,"Consulta do proximo ano nao cria cupom antecipado");
  console.log(`\nRESULTADO: ${checks}/${checks} verificacoes aprovadas.`);
  console.log("NAO COBERTO: HTTP de checkout/precos reais; webhook; confirmacao e provisionamento; PIX apos meia-noite; cancelamento pelo provedor; documentos.");
}

async function limpar() {
  // Exclusivamente os registros associados aos usuarios ficticios desta execucao.
  if (cupons.length) {
    await prisma.cupomResgate.deleteMany({where:{cupomId:{in:cupons}}});
    await prisma.cupomReserva.deleteMany({where:{cupomId:{in:cupons}}});
  }
  if (pagamentos.length) await prisma.pagamento.deleteMany({where:{id:{in:pagamentos},usuarioId:{in:usuarios}}});
  if (cupons.length) await prisma.cupom.deleteMany({where:{id:{in:cupons},concedidoParaUsuarioId:{in:usuarios}}});
  if (usuarios.length) await prisma.usuario.deleteMany({where:{id:{in:usuarios},email:{endsWith:"@example.invalid"}}});
  limpezaOk=true;
  console.log("LIMPEZA_QA: registros desta execucao removidos.");
}

async function main(){
  try { await executar(); }
  finally {
    try { await limpar(); }
    catch(e) { console.error("LIMPEZA_QA_FALHOU",e,"IDs criados:",{usuarios,pagamentos,cupons}); process.exitCode=1; }
    await prisma.$disconnect();
  }
}
main().catch(e=>{ console.error("TESTE_CUPOM_ANIVERSARIO_QA_FALHOU",e); process.exitCode=1; });