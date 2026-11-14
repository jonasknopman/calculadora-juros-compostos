// Roda os vetores do gabarito (referencia/test_vectors_retirada.json) contra docs/js/motor_retirada.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  simularRetirada,
  duracaoDoDinheiro,
  valorNecessario,
  retiradaPossivel,
} from '../docs/js/motor_retirada.js';

const vetores = JSON.parse(
  readFileSync(new URL('../referencia/test_vectors_retirada.json', import.meta.url), 'utf8'),
);
const tolerancia = vetores.tolerancia;

// Traduz os nomes do gabarito (Python) para os nomes do motor em português.
function traduzirEntrada(e) {
  return {
    valorInicial: e.valor_inicial,
    retirada: e.retirada,
    prazoMeses: e.prazo_meses,
    retornoAnual: e.rentabilidade_aa,
    inflacaoAnual: e.inflacao_aa,
    regime: e.regime,
    mesInicio: e.mes_inicio,
  };
}

const CAMPOS_TRAJETORIA = {
  retirada_liquida_nominal: 'retiradaLiquidaNominal',
  retirada_bruta: 'retiradaBruta',
  imposto_mes: 'impostoMes',
  saldo_bruto: 'saldoBruto',
  saldo_liquido: 'saldoLiquido',
  saldo_liquido_real: 'saldoLiquidoReal',
};

function quase(obtido, esperado, rotulo) {
  assert.ok(
    Math.abs(obtido - esperado) <= tolerancia,
    `${rotulo}: obtido ${obtido}, esperado ${esperado}, diferença ${Math.abs(obtido - esperado)}`,
  );
}

test('o arquivo de vetores tem pelo menos 24 casos', () => {
  assert.ok(vetores.casos.length >= 24);
});

for (const caso of vetores.casos) {
  test(caso.nome, () => {
    const entrada = traduzirEntrada(caso.entrada);
    switch (caso.tipo) {
      case 'duracao': {
        const r = duracaoDoDinheiro(entrada);
        assert.equal(r.meses, caso.esperado.duracao, 'meses');
        assert.equal(r.esgotou, caso.esperado.esgotou, 'esgotou');
        break;
      }
      case 'valor_necessario':
        quase(valorNecessario(entrada), caso.esperado.valor_inicial, 'valor necessário');
        break;
      case 'retirada_possivel':
        quase(retiradaPossivel(entrada), caso.esperado.retirada, 'retirada possível');
        break;
      case 'trajetoria': {
        const { serie } = simularRetirada(entrada);
        for (const [mes, campos] of Object.entries(caso.esperado)) {
          for (const [campoPy, valor] of Object.entries(campos)) {
            const campoJs = CAMPOS_TRAJETORIA[campoPy];
            assert.ok(campoJs, `campo desconhecido: ${campoPy}`);
            quase(serie[campoJs][Number(mes)], valor, `mês ${mes} ${campoPy}`);
          }
        }
        break;
      }
      default:
        assert.fail(`tipo desconhecido: ${caso.tipo}`);
    }
  });
}

test('regime inválido lança erro', () => {
  assert.throws(() => simularRetirada({ valorInicial: 1000, retirada: 10, regime: 'xyz' }), /regime inválido/);
  assert.throws(() => valorNecessario({ retirada: 10, regime: 'xyz' }), /regime inválido/);
  assert.throws(() => retiradaPossivel({ valorInicial: 1000, regime: 'xyz' }), /regime inválido/);
});

test('chave undefined não sobrescreve o padrão', () => {
  const r = duracaoDoDinheiro({ valorInicial: 1000, retirada: 100, retornoAnual: 0, inflacaoAnual: undefined });
  assert.equal(r.meses, 10);
});

test('série: índice 0 é o estado inicial, fluxos zerados, e vai só até o último mês concluído', () => {
  const r = simularRetirada({ valorInicial: 500000, retirada: 5000, retornoAnual: 0.11, inflacaoAnual: 0.045, regime: 'resgate_15', mesInicio: 12 });
  assert.equal(r.duracao, 127);
  for (const campo of Object.keys(r.serie)) assert.equal(r.serie[campo].length, 128, campo);
  assert.equal(r.serie.saldoBruto[0], 500000);
  assert.equal(r.serie.retiradaBruta[0], 0);
  assert.equal(r.serie.impostoMes[0], 0);
  assert.equal(r.serie.retiradaLiquidaNominal[0], 0);
});

test('retirada <= 0 e valor inicial <= 0 devolvem 0 nos modos 2 e 3', () => {
  assert.equal(valorNecessario({ retirada: 0, prazoMeses: 60 }), 0);
  assert.equal(retiradaPossivel({ valorInicial: 0, prazoMeses: 60 }), 0);
});
