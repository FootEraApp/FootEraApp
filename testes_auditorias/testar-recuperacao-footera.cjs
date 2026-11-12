/* Executar SOMENTE no PostgreSQL local de desenvolvimento.
   Copie este arquivo para a raiz de FootEraApp-app.
   PowerShell: $env:FOOTERA_TEST_PASSWORD = Read-Host 'Senha dos usuários de teste'
   node .\testar-recuperacao-footera.cjs
*/
const path = require('path');
require('dotenv').config({ path: path.resolve('server/.env.development') });
require('dotenv').config({ path: path.resolve('server/.env') });
const { PrismaClient, TipoUsuario, StatusUsuarioPapel } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = new PrismaClient();
const BASE = 'http://127.0.0.1:3001/api';
const password = process.env.FOOTERA_TEST_PASSWORD;
const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid:invalid@invalid/invalid');
if (!['127.0.0.1','localhost'].includes(url.hostname) || !password || password.length < 8) {
 console.error('Bloqueado: DATABASE_URL deve apontar a localhost e FOOTERA_TEST_PASSWORD ter no mínimo 8 caracteres.'); process.exit(1);
}
const tests = ['Atleta','Professor','Olheiro','Learning','Responsavel','Creator','Clube','Escolinha','Marca','Federacao'];
const org = new Set(['Clube','Escolinha','Marca','Federacao']);
const suffix = Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
async function api(endpoint, method, token, body) {
 try { const response = await fetch(BASE+endpoint, {method, headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)}); const data=await response.json().catch(()=>({}));return {status:response.status,code:data.code||null,message:data.message||data.error||null,data}; }
 catch(e){ return {status:0,code:'NETWORK_ERROR',message:e.message,data:{}}; }
}
(async()=>{
 const senhaHash = await bcrypt.hash(password,10);
 console.log('Teste no banco LOCAL:',url.hostname+':'+(url.port||5432)+'/'+url.pathname.slice(1));
 for(const papel of tests){
  const usuario = `qa_rec_${papel.toLowerCase()}_${suffix}`;
  const email = `${usuario}@example.invalid`;
  const nascimento = new Date('2000-05-01T12:00:00Z');
  const u=await prisma.usuario.create({data:{nomeDeUsuario:usuario,email,nome:`QA ${papel}`,senhaHash,verified:true,tipo:TipoUsuario.Learning,dataNascimento:nascimento,papeis:{create:{papel:TipoUsuario.Learning,status:StatusUsuarioPapel.PENDENTE}}},select:{id:true}});
  const login=await api('/auth/login','POST',null,{nomeDeUsuario:usuario,senha:password});
  if(login.status!==200 || !login.data.token){console.log(papel,'LOGIN FALHOU',login.status,login.code,login.message);continue;}
  const token=login.data.token;
  if(login.data.somenteGestaoConta!==true) {console.log(papel,'SEM CONTEXTO não reconhecido; não prosseguiu',login.data.activeContext);continue;}
  let step;
  if(org.has(papel)){
   step=await api('/usuarios/me/organizacao-recuperacao','POST',token,{tipo:papel,perfil:{nome:`QA ${papel} ${suffix}`}});
  }else{
   const add=await api('/usuarios/me/papeis','POST',token,{papel,reativar:false});
   if(add.status>=400){step=add;}
   else {
    if(papel!=='Responsavel'){
     const dados=papel==='Creator'?{nomePublico:`QA Creator ${suffix}`,headline:'Teste automatizado'}:{};
     const prepared=await api(`/usuarios/me/papeis/${papel}/perfil-recuperacao`,'POST',token,{perfil:dados});
     step=prepared.status>=400?prepared:await api(`/usuarios/me/papeis/${papel}/concluir`,'PATCH',token,{});
    }else step=await api(`/usuarios/me/papeis/${papel}/concluir`,'PATCH',token,{});
   }
  }
  const sessaoFinal = await api(
   '/auth/me',
   'GET',
   token
   );

   const contextoEsperado = org.has(papel)
   ? 'ORGANIZATION'
   : 'PERSONAL';

   const sessaoValida =
   sessaoFinal.status === 200 &&
   sessaoFinal.data.somenteGestaoConta === false &&
   sessaoFinal.data.activeContext?.kind === contextoEsperado;
   
  const roles=await prisma.usuarioPapel.findMany({where:{usuarioId:u.id},select:{papel:true,status:true}});
  const memberships=await prisma.membroOrganizacao.findMany({where:{usuarioId:u.id},select:{organizacaoId:true,funcao:true,ativo:true}});
  const statusEsperado = org.has(papel) ? 201 : 200;

const papelAtivo = roles.some(
  (item) =>
    item.papel === papel &&
    item.status === "ATIVO"
);

const proprietarioValido =
  !org.has(papel) ||
  memberships.some(
    (item) =>
      item.funcao === "PROPRIETARIO" &&
      item.ativo === true &&
      item.organizacaoId === step.data.organizacaoId
  );

const aprovado =
  step.status === statusEsperado &&
  sessaoValida &&
  papelAtivo &&
  proprietarioValido;

console.log(
  JSON.stringify(
    {
      resultado: aprovado ? "APROVADO" : "FALHOU",
      papel,
      usuario,
      http: step.status,
      code: step.code,
      message: step.message,
      contextKind:
        step.data.activeContext?.kind ?? null,
      sessaoHttp: sessaoFinal.status,
      sessaoValida,
      papelAtivo,
      proprietarioValido,
      roles,
      memberships,
    },
    null,
    2
  )
);

if (!aprovado) {
  process.exitCode = 1;
}
 }
 console.log('Usuários QA permanecem no banco para inspeção. NÃO use exclusão em cascata sem revisão.');
})().catch(e=>{console.error('FALHA:',e.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
