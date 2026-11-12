import assert from 'node:assert/strict';
import {
  consultarPagamentoMercadoPago,
  validarPixRecuperavelMercadoPago,
} from './server/services/billingConciliacaoMercadoPagoService.js';

const pagamentoId = '11111111-1111-4111-8111-111111111111';
const providerRef = '123456789';
const qr = 'PIX_FICTICIO_NAO_PAGAVEL_QA';
const esperado = {
  id: providerRef, status: 'pending', currency_id: 'BRL',
  transaction_amount: 19.9, external_reference: pagamentoId,
  date_of_expiration: new Date(Date.now() + 3600000).toISOString(),
  point_of_interaction: { transaction_data: { qr_code: qr } },
};
const seguro = (mp: Awaited<ReturnType<typeof consultarPagamentoMercadoPago>>) =>
  validarPixRecuperavelMercadoPago({pagamentoId, providerRef, valor: '19.90',
    moeda: 'BRL', pixCopiaECola: qr, mp});

async function main() {
  let total = 0;
  const checar = (nome: string) => { total++; console.log('✔', nome); };
  const chamar = async (body: object, status = 200) => {
    let chamadas = 0;
    const mp = await consultarPagamentoMercadoPago(providerRef, {
      token: 'TOKEN_FICTICIO_QA',
      fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
        chamadas++;
        assert.equal(String(url), `https://api.mercadopago.com/v1/payments/${providerRef}`);
        assert.equal(init?.method, 'GET');
        assert.equal(init?.headers && (init.headers as Record<string,string>).Authorization, 'Bearer TOKEN_FICTICIO_QA');
        return new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}});
      }) as typeof fetch,
    });
    assert.equal(chamadas, 1);
    return mp;
  };
  // Nenhuma requisição de rede é realizada. O fetch é sempre simulado.
  assert.equal(seguro(await chamar(esperado)), true);
  checar('GET simulado confirma PIX pendente e identidade');
  assert.equal(seguro(await chamar({...esperado, status: 'approved'})), false);
  checar('PIX liquidado é recusado');
  assert.equal(seguro(await chamar({...esperado, external_reference: 'outra-compra'})), false);
  checar('Identidade divergente é recusada');
  assert.equal(seguro(await chamar({...esperado, transaction_amount: 29.9})), false);
  checar('Valor divergente é recusado');
  assert.equal(seguro(await chamar({...esperado, point_of_interaction: null})), false);
  checar('QR ausente é recusado');
  assert.equal(seguro(await chamar({...esperado, date_of_expiration: new Date(Date.now()-3600000).toISOString()})), false);
  checar('PIX expirado é recusado');
  await assert.rejects(chamar({message:'unavailable'}, 503), /MP_QUERY_HTTP_503/);
  checar('HTTP 503 não confirma a cobrança');
  await assert.rejects(chamar([]), /MP_QUERY_INVALID_BODY/);
  checar('Resposta HTTP inválida é recusada');
  console.log(`\nRESULTADO: ${total}/8`);
}
main().catch(e=>{console.error('QA_PIX_HTTP_FALHOU', e); process.exitCode=1});
