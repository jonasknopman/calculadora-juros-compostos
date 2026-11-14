// Robustez de processarRetirada: uma grade grande de entradas ruins e extremas, nos três modos.
// Contrato: nunca lança exceção; sempre devolve um objeto com `ok` booleano; se `ok` for falso,
// há ao menos um erro de campo ou um erro geral.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processarRetirada, MODOS_RETIRADA } from '../docs/js/entrada_retirada.js';

const BOM = {
  valorInicial: '500.000',
  retirada: '5.000',
  prazo: '20',
  prazoUnidade: 'anos',
  rentabilidade: '11',
  rentabilidadeTipo: 'nominal',
  regime: 'isento',
  inflacao: '4,5',
  mesInicio: '12',
  variacao: '2',
};

const NUMERICOS = ['valorInicial', 'retirada', 'prazo', 'rentabilidade', 'inflacao', 'variacao', 'mesInicio'];

const VALORES_RUINS = [
  '', ' ', '   ', 'abc', '1a', 'R$ 5.000', '-1', '-0', '0', '0,0', '0,001', '00', '1e3', '1e308', 'Infinity', 'NaN',
  '1.000.000.000.000.000', '999999999999999999999999', '1,5', '2,5', '1.5', '1..5', '1,,5', '1.2.3', ',5', '.5', '5,', '5.',
  '1.000,50', '1,000.50', '1.00,0', '12.34.567,8', '100', '100,01', '101', '1000', '13', '12,5', '11', '10,01',
  '٣', '１２', '1 000', '\t5\n', '+5', '--5', '5%', '0x10',
  undefined, null, 0, 1, -1, 1e15, -1e15, NaN, Infinity, 0.5, true, false, [], {}, [5], () => 5,
];

function conferir(entrada, rotulo) {
  let r;
  assert.doesNotThrow(() => { r = processarRetirada(entrada); }, rotulo);
  assert.equal(typeof r, 'object', rotulo);
  assert.notEqual(r, null, rotulo);
  assert.equal(typeof r.ok, 'boolean', rotulo);
  if (!r.ok) {
    const temErroDeCampo = r.erros && Object.keys(r.erros).length > 0;
    assert.ok(temErroDeCampo || typeof r.erroGeral === 'string', `${rotulo}: falha sem explicação`);
  } else {
    assert.equal(typeof r.destaque, 'string', rotulo);
    assert.ok(Array.isArray(r.cenarios) && r.cenarios.length === 3, rotulo);
    assert.ok(Array.isArray(r.tabela), rotulo);
    assert.ok(r.numeros && Number.isFinite(r.numeros.retornoAnual), rotulo);
  }
  return r;
}

test('cada campo com cada valor ruim, nos três modos e nos três regimes', () => {
  let casos = 0;
  for (const modo of MODOS_RETIRADA) {
    for (const regime of ['isento', 'resgate_15', 'come_cotas']) {
      for (const campo of NUMERICOS) {
        for (const valor of VALORES_RUINS) {
          conferir({ ...BOM, modo, regime, [campo]: valor }, `${modo}/${regime}/${campo}=${String(valor)}`);
          casos++;
        }
      }
    }
  }
  assert.ok(casos > 3000);
});

test('campos de escolha inválidos: modo, regime, unidade do prazo e tipo de rentabilidade', () => {
  const ruins = ['', 'xyz', 'ISENTO', undefined, null, 0, 1, true, [], {}, 'duracao ', 'prazo'];
  for (const campo of ['modo', 'regime', 'prazoUnidade', 'rentabilidadeTipo']) {
    for (const valor of ruins) {
      for (const modo of MODOS_RETIRADA) {
        const entrada = { ...BOM, modo, [campo]: valor };
        if (campo === 'modo') entrada.modo = valor;
        conferir(entrada, `${campo}=${String(valor)}`);
      }
    }
  }
});

test('regime e modo inválidos sempre dão erro no campo', () => {
  assert.ok(processarRetirada({ ...BOM, regime: 'xyz' }).erros.regime);
  assert.ok(processarRetirada({ ...BOM, modo: 'xyz' }).erros.modo);
});

test('entrada vazia, nula ou de tipo errado não derruba', () => {
  for (const entrada of [{}, { modo: 'valor' }, { modo: 'retirada' }, { modo: 'duracao' }]) conferir(entrada, JSON.stringify(entrada));
});

test('combinações extremas de valores válidos: resultado ok ou erro geral, nunca exceção', () => {
  const extremos = [
    { valorInicial: '0,01', retirada: '0,01', rentabilidade: '0', inflacao: '0' },
    { valorInicial: '1.000.000.000.000', retirada: '0,01', rentabilidade: '100', inflacao: '100' },
    { valorInicial: '0,01', retirada: '1.000.000.000', rentabilidade: '0', inflacao: '100' },
    { valorInicial: '1.000.000.000.000', retirada: '1.000.000.000', rentabilidade: '0', inflacao: '100' },
    { valorInicial: '1', retirada: '1.000.000.000', rentabilidade: '100', inflacao: '0' },
    { valorInicial: '1.000.000.000.000', retirada: '1.000.000.000', rentabilidade: '100', inflacao: '100', variacao: '10' },
    { valorInicial: '100', retirada: '1.000.000.000', rentabilidade: '55', inflacao: '60', variacao: '10', prazo: '100' },
    { valorInicial: '100', retirada: '100', rentabilidade: '0', inflacao: '0', variacao: '10', prazo: '1', prazoUnidade: 'meses' },
    { valorInicial: '100', retirada: '100', rentabilidade: '100', inflacao: '100', prazo: '1.200', prazoUnidade: 'meses' },
    { valorInicial: '1.000.000', retirada: '5.000', rentabilidade: '0', inflacao: '100', prazo: '100' },
    { valorInicial: '1.000.000', retirada: '5.000', rentabilidade: '100', inflacao: '0', prazo: '100', rentabilidadeTipo: 'ipca_mais' },
  ];
  for (const e of extremos) {
    for (const modo of MODOS_RETIRADA) {
      for (const regime of ['isento', 'resgate_15', 'come_cotas']) {
        for (const rentabilidadeTipo of ['nominal', 'ipca_mais']) {
          conferir({ ...BOM, ...e, modo, regime, rentabilidadeTipo: e.rentabilidadeTipo ?? rentabilidadeTipo }, JSON.stringify([e, modo, regime, rentabilidadeTipo]));
        }
      }
    }
  }
});

test('prazos nas bordas: 1 mês, 1.200 meses, 100 anos, 101 anos e fracionários', () => {
  for (const modo of ['valor', 'retirada']) {
    for (const [prazo, unidade, ok] of [
      ['1', 'meses', true], ['1.200', 'meses', true], ['100', 'anos', true], ['101', 'anos', false],
      ['1.201', 'meses', false], ['0', 'meses', false], ['0,5', 'anos', false], ['1,5', 'meses', false], ['2.5', 'anos', false],
    ]) {
      const r = conferir({ ...BOM, modo, prazo, prazoUnidade: unidade }, `${modo} ${prazo} ${unidade}`);
      assert.equal(r.ok, ok, `${modo} ${prazo} ${unidade}`);
    }
  }
});

test('pares de campos ruins ao mesmo tempo: vários erros de uma vez, sem exceção', () => {
  const r = conferir({ ...BOM, valorInicial: 'x', retirada: '-1', rentabilidade: '999', inflacao: '', variacao: 'y' }, 'vários');
  assert.equal(r.ok, false);
  for (const campo of ['valorInicial', 'retirada', 'rentabilidade', 'inflacao', 'variacao']) assert.ok(r.erros[campo], campo);
});
