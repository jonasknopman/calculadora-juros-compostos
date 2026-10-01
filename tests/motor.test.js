// Roda os vetores do gabarito (referencia/test_vectors.json) contra docs/js/motor.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simular, resolverAporte, resolverPrazo, taxaNominalDeIpcaMais } from '../docs/js/motor.js';

const vetores = JSON.parse(
  readFileSync(new URL('../referencia/test_vectors.json', import.meta.url), 'utf8'),
);
const tolerancia = vetores.tolerancia;

// Traduz os nomes do gabarito (Python) para os nomes do motor em português.
function traduzirEntrada(e) {
  return {
    valorInicial: e.pv,
    aporteInicial: e.pmt0,
    prazoMeses: e.n,
    retornoAnual: e.retorno_anual,
    inflacaoAnual: e.inflacao_anual,
    reajusteAnual: e.reajuste_anual,
    regime: e.regime,
    mesInicio: e.mes_inicio,
    aliquotaComeCotas: e.aliquota_come_cotas,
  };
}

function quase(obtido, esperado, rotulo) {
  assert.ok(
    Math.abs(obtido - esperado) <= tolerancia,
    `${rotulo}: obtido ${obtido}, esperado ${esperado}, diferença ${Math.abs(obtido - esperado)}`,
  );
}

const CAMPOS_RESUMO = {
  bruto_nominal: 'brutoNominal',
  investido_nominal: 'investidoNominal',
  investido_real: 'investidoReal',
  imposto_resgate: 'impostoResgate',
  come_cotas_pagos: 'comeCotasPagos',
  liquido_nominal: 'liquidoNominal',
  liquido_real: 'liquidoReal',
  bruto_real: 'brutoReal',
  deflator: 'deflator',
};

for (const caso of vetores.casos) {
  test(caso.nome, () => {
    if (caso.tipo === 'simular') {
      const entrada = traduzirEntrada(caso.entrada);
      const r = simular(entrada);
      for (const [campoPy, campoJs] of Object.entries(CAMPOS_RESUMO)) {
        quase(r.resumo[campoJs], caso.esperado.resumo[campoPy], `resumo.${campoPy}`);
      }
      for (const [ano, esp] of Object.entries(caso.esperado.anos)) {
        const mes = 12 * Number(ano);
        quase(r.bruto[mes], esp.bruto, `ano ${ano} bruto`);
        quase(r.liquido[mes], esp.liquido, `ano ${ano} liquido`);
        quase(r.liquidoReal[mes], esp.liquido_real, `ano ${ano} liquido_real`);
        quase(r.investido[mes], esp.investido, `ano ${ano} investido`);
        quase(r.investidoReal[mes], esp.investido_real, `ano ${ano} investido_real`);
      }
    } else if (caso.tipo === 'resolver_aporte') {
      const obtido = resolverAporte(caso.alvo_liquido_real, traduzirEntrada(caso.entrada));
      quase(obtido, caso.esperado.pmt0, 'aporte inicial');
    } else if (caso.tipo === 'resolver_prazo') {
      const obtido = resolverPrazo(caso.alvo_liquido_real, traduzirEntrada(caso.entrada));
      assert.equal(obtido, caso.esperado.n);
    } else if (caso.tipo === 'taxa_ipca_mais') {
      quase(
        taxaNominalDeIpcaMais(caso.inflacao, caso.real),
        caso.esperado.retorno_anual,
        'retorno anual',
      );
    } else {
      assert.fail(`tipo de caso desconhecido: ${caso.tipo}`);
    }
  });
}
