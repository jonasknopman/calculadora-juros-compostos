// Propriedades do motor da fase 2 (independem dos vetores).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { duracaoDoDinheiro, valorNecessario, retiradaPossivel } from '../docs/js/motor_retirada.js';
import { REGIMES } from '../docs/js/tributacao.js';

const TOL = 0.01;

test('isento: modo 2 confere com a anuidade antecipada em taxa real', () => {
  for (const [rent, infl, y, n] of [[0.11, 0.045, 5000, 240], [0.08, 0.03, 2500, 120], [0.07, 0.06, 1000, 60], [0.03, 0.045, 3000, 100]]) {
    const i = Math.pow((1 + rent) / (1 + infl), 1 / 12) - 1;
    const anuidade = ((y * (1 - Math.pow(1 + i, -n))) / i) * (1 + i);
    const x = valorNecessario({ retirada: y, prazoMeses: n, retornoAnual: rent, inflacaoAnual: infl, regime: 'isento' });
    assert.ok(Math.abs(x - anuidade) <= TOL, `${rent}/${infl}: ${x} vs ${anuidade}`);
  }
});

test('monotonicidade: mais X nunca diminui a duração; mais Y nunca a aumenta', () => {
  for (const regime of REGIMES) {
    const base = { retornoAnual: 0.11, inflacaoAnual: 0.045, regime, mesInicio: 12 };
    let anterior = -1;
    for (const x of [100000, 200000, 400000, 800000, 1600000]) {
      const { meses } = duracaoDoDinheiro({ ...base, valorInicial: x, retirada: 4000 });
      assert.ok(meses >= anterior, `${regime} X=${x}`);
      anterior = meses;
    }
    anterior = Infinity;
    for (const y of [1000, 2000, 4000, 8000, 16000]) {
      const { meses } = duracaoDoDinheiro({ ...base, valorInicial: 500000, retirada: y });
      assert.ok(meses <= anterior, `${regime} Y=${y}`);
      anterior = meses;
    }
  }
});

test('ida e volta: retiradaPossivel(valorNecessario(Y)) devolve Y, nos três regimes', () => {
  for (const regime of REGIMES) {
    for (const mesInicio of [1, 5, 12]) {
      for (const [y, n] of [[5000, 240], [3000, 100], [8000, 36]]) {
        const base = { retornoAnual: 0.11, inflacaoAnual: 0.045, regime, mesInicio, prazoMeses: n };
        const x = valorNecessario({ ...base, retirada: y });
        const y2 = retiradaPossivel({ ...base, valorInicial: x });
        assert.ok(Math.abs(y2 - y) <= TOL, `${regime} mês ${mesInicio} Y=${y} n=${n}: ${y2}`);
      }
    }
  }
});

test('modos 2 e 3: o resultado satisfaz o prazo e 2 centavos para o lado ruim não', () => {
  for (const regime of REGIMES) {
    for (const [retornoAnual, inflacaoAnual] of [[0.11, 0.045], [0.03, 0.045], [0, 0]]) {
      const base = { retornoAnual, inflacaoAnual, regime, mesInicio: 12, prazoMeses: 120 };
      const x = valorNecessario({ ...base, retirada: 3000 });
      assert.ok(duracaoDoDinheiro({ ...base, valorInicial: x, retirada: 3000 }).meses >= 120);
      assert.ok(duracaoDoDinheiro({ ...base, valorInicial: x - 0.02, retirada: 3000 }).meses < 120);
      const y = retiradaPossivel({ ...base, valorInicial: 500000 });
      assert.ok(duracaoDoDinheiro({ ...base, valorInicial: 500000, retirada: y }).meses >= 120);
      assert.ok(duracaoDoDinheiro({ ...base, valorInicial: 500000, retirada: y + 0.02 }).meses < 120);
    }
  }
});

test('rentabilidade 0% e inflação 0%: duração = floor(X / Y)', () => {
  for (const regime of REGIMES) {
    for (const [x, y] of [[120000, 1000], [100000, 3000], [1000, 5000], [10000, 3333.33]]) {
      const { meses } = duracaoDoDinheiro({ valorInicial: x, retirada: y, retornoAnual: 0, inflacaoAnual: 0, regime });
      assert.equal(meses, Math.floor(x / y), `${regime} ${x}/${y}`);
    }
  }
});

test('pureza: motor_retirada.js não usa DOM, rede nem armazenamento', () => {
  const texto = readFileSync(new URL('../docs/js/motor_retirada.js', import.meta.url), 'utf8');
  for (const proibido of ['window', 'document', 'fetch', 'localStorage']) {
    assert.ok(!texto.includes(proibido), `contém "${proibido}"`);
  }
});
