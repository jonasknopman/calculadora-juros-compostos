// Camada pura da aba "Viver de renda": o que o usuário digita (texto) até o que a tela mostra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processarRetirada, MODOS_RETIRADA, PRAZO_MAXIMO_RETIRADA_MESES, HORIZONTE_TABELA_SEM_FIM_MESES } from '../docs/js/entrada_retirada.js';
import { moeda, textoDuracao } from '../docs/js/entrada.js';
import { simularRetirada } from '../docs/js/motor_retirada.js';
import { AVISO_VALOR_JUNTADO, AVISO_PRAZO_CURTO, REGIMES } from '../docs/js/tributacao.js';

const TOL = 0.01;
const quase = (obtido, esperado, rotulo) => assert.ok(
  Math.abs(obtido - esperado) <= TOL + 1e-9,
  `${rotulo}: obtido ${obtido}, esperado ${esperado}`,
);

// Campos como o usuário digita; âncoras da seção 11 (mês de início dezembro, inflação 4,5%).
const ancora = (extra) => ({
  modo: 'duracao',
  valorInicial: '500.000',
  retirada: '5.000',
  prazo: '20',
  prazoUnidade: 'anos',
  rentabilidade: '11',
  rentabilidadeTipo: 'nominal',
  regime: 'isento',
  inflacao: '4,5',
  mesInicio: '12',
  ...extra,
});

test('constantes exportadas', () => {
  assert.deepEqual([...MODOS_RETIRADA], ['duracao', 'valor', 'retirada']);
  assert.equal(PRAZO_MAXIMO_RETIRADA_MESES, 1200);
  assert.equal(HORIZONTE_TABELA_SEM_FIM_MESES, 360);
});

test('AVISO_VALOR_JUNTADO existe e fala em rendimento acumulado', () => {
  assert.equal(typeof AVISO_VALOR_JUNTADO, 'string');
  assert.match(AVISO_VALOR_JUNTADO, /sem rendimento acumulado/);
  assert.match(AVISO_VALOR_JUNTADO, /imposto das primeiras retiradas/);
});

// (a) âncoras digitadas como texto -------------------------------------------------------
for (const [regime, meses] of [['isento', 138], ['resgate_15', 127], ['come_cotas', 125]]) {
  test(`modo 1, 500.000 / 5.000, ${regime}: ${meses} meses`, () => {
    const r = processarRetirada(ancora({ regime }));
    assert.equal(r.ok, true);
    assert.equal(r.numeros.meses, meses);
    assert.equal(r.numeros.esgotou, true);
    assert.equal(r.destaque, `Seu dinheiro dura ${textoDuracao(meses)}`);
    assert.equal(r.valorDestaque, textoDuracao(meses));
  });
}

test('modo 1, 500.000 / 5.000 / 11% no isento: 11 anos e 6 meses', () => {
  const r = processarRetirada(ancora());
  assert.equal(r.destaque, 'Seu dinheiro dura 11 anos e 6 meses');
});

for (const [regime, valor] of [['isento', 698633.98], ['resgate_15', 755893.14], ['come_cotas', 792531.30]]) {
  test(`modo 2, Y = 5.000, 240 meses, ${regime}: ${valor}`, () => {
    const r = processarRetirada(ancora({ modo: 'valor', prazo: '240', prazoUnidade: 'meses', regime }));
    assert.equal(r.ok, true);
    quase(r.numeros.valorInicial, valor, 'valor necessário');
    assert.equal(r.valorDestaque, moeda(r.numeros.valorInicial));
    assert.equal(
      r.destaque,
      `Você precisa ter ${moeda(r.numeros.valorInicial)} para retirar ${moeda(5000)} por mês durante 20 anos`,
    );
  });
}

for (const [regime, valor] of [['isento', 7156.82], ['resgate_15', 6614.69], ['come_cotas', 6308.90]]) {
  test(`modo 3, X = 1.000.000, 240 meses, ${regime}: ${valor}`, () => {
    const r = processarRetirada(ancora({ modo: 'retirada', valorInicial: '1.000.000', prazo: '20', regime }));
    assert.equal(r.ok, true);
    quase(r.numeros.retirada, valor, 'retirada possível');
    assert.equal(r.valorDestaque, moeda(r.numeros.retirada));
    assert.equal(
      r.destaque,
      `Você pode retirar ${moeda(r.numeros.retirada)} por mês, em reais de hoje e já descontado o imposto, durante 20 anos`,
    );
  });
}

test('2.000.000 / 2.000 isento: não se esgota', () => {
  const r = processarRetirada(ancora({ valorInicial: '2.000.000', retirada: '2.000' }));
  assert.equal(r.ok, true);
  assert.equal(r.numeros.esgotou, false);
  assert.equal(r.numeros.meses, 1200);
  assert.equal(r.destaque, 'Seu dinheiro não se esgota (mais de 100 anos)');
  assert.equal(r.valorDestaque, 'não se esgota');
  assert.deepEqual(r.avisos, []);
  const prazo = r.linhas.find((l) => l.rotulo === 'Prazo');
  assert.equal(prazo.valor, 'Mais de 100 anos');
  assert.ok(!r.linhas.some((l) => l.rotulo.startsWith('Total retirado')));
  assert.ok(r.linhas.some((l) => l.rotulo === 'Imposto pago nos primeiros 30 anos (reais de hoje)'));
});

// (b) duração zero ----------------------------------------------------------------------
test('duração zero: X = 1.000, Y = 5.000', () => {
  const r = processarRetirada(ancora({ valorInicial: '1.000', retirada: '5.000' }));
  assert.equal(r.ok, true);
  assert.equal(r.numeros.meses, 0);
  assert.equal(r.destaque, 'Seu dinheiro não chega a cobrir a primeira retirada.');
  assert.equal(r.valorDestaque, null);
  assert.deepEqual(r.tabela, []);
  assert.equal(r.notaTabela, '');
});

// (c) campos inválidos -----------------------------------------------------------------
const GRADE_RUIM = [
  // [modo, campo, valor ruim]
  ...['', '   ', 'abc', '-5', '0', '1.000.000.000.001', '1,2,3'].map((v) => ['duracao', 'valorInicial', v]),
  ...['', 'abc', '-1', '0', '1.000.000.001'].map((v) => ['duracao', 'retirada', v]),
  ...['', 'abc', '-1', '0', '1.000.000.001'].map((v) => ['valor', 'retirada', v]),
  ...['', 'abc', '-5', '0', '1.000.000.000.001'].map((v) => ['retirada', 'valorInicial', v]),
  ...['', 'abc', '-3', '0', '2,5', '101'].map((v) => ['valor', 'prazo', v]),
  ...['', 'abc', '-3', '0', '2,5', '101'].map((v) => ['retirada', 'prazo', v]),
  ...['', 'abc', '-1', '100,01', '1.000'].map((v) => ['duracao', 'rentabilidade', v]),
  ...['', 'abc', '-1', '100,01'].map((v) => ['duracao', 'inflacao', v]),
  ...['0', '13', 'abc', '1,5', '-1'].map((v) => ['duracao', 'mesInicio', v]),
  ['duracao', 'regime', 'xyz'],
  ['duracao', 'modo', 'xyz'],
];

test('campos inválidos: erro no campo certo, sem exceção, sem resultado', () => {
  for (const [modo, campo, valor] of GRADE_RUIM) {
    const entrada = ancora({ modo: campo === 'modo' ? valor : modo, [campo]: valor });
    let r;
    assert.doesNotThrow(() => { r = processarRetirada(entrada); }, `${modo}/${campo}=${JSON.stringify(valor)}`);
    assert.equal(r.ok, false, `${modo}/${campo}=${JSON.stringify(valor)}`);
    assert.ok(r.erros[campo], `${modo}/${campo}=${JSON.stringify(valor)}: sem erro em ${campo}`);
    assert.equal(r.erroGeral, null);
    assert.equal(r.destaque, null);
    assert.deepEqual(r.tabela, []);
    assert.deepEqual(r.linhas, []);
    assert.equal(r.numeros, null);
  }
});

test('prazo no limite: 100 anos e 1.200 meses valem; 1.201 meses não', () => {
  assert.equal(processarRetirada(ancora({ modo: 'valor', prazo: '100' })).ok, true);
  assert.equal(processarRetirada(ancora({ modo: 'valor', prazo: '1.200', prazoUnidade: 'meses' })).ok, true);
  const r = processarRetirada(ancora({ modo: 'valor', prazo: '1.201', prazoUnidade: 'meses' }));
  assert.ok(r.erros.prazo);
});

test('campos que o modo não usa não são validados', () => {
  assert.equal(processarRetirada(ancora({ modo: 'duracao', prazo: 'lixo' })).ok, true);
  assert.equal(processarRetirada(ancora({ modo: 'valor', valorInicial: 'lixo' })).ok, true);
  assert.equal(processarRetirada(ancora({ modo: 'retirada', retirada: 'lixo' })).ok, true);
});

test('inflação e mês de início são opcionais; entrada vazia nunca lança', () => {
  const { inflacao, mesInicio, ...semOpcionais } = ancora();
  const r = processarRetirada(semOpcionais);
  assert.equal(r.ok, true);
  assert.equal(r.numeros.inflacaoAnual, 0.045);
  assert.doesNotThrow(() => processarRetirada({}));
  assert.equal(processarRetirada({}).ok, false);
});

test('erro do motor vira mensagem geral, sem exceção', () => {
  // Retirada enorme e rentabilidade zero no modo 3 com valor minúsculo: nada quebra a tela.
  const entradas = [
    ancora({ modo: 'retirada', valorInicial: '0,01', prazo: '100', rentabilidade: '0' }),
    ancora({ modo: 'valor', retirada: '1.000.000.000', prazo: '100', rentabilidade: '0', inflacao: '100' }),
  ];
  for (const e of entradas) {
    let r;
    assert.doesNotThrow(() => { r = processarRetirada(e); });
    if (!r.ok) assert.equal(r.erroGeral, 'Com esses números não foi possível calcular. Revise os valores.');
  }
});

// (d) IPCA + x -------------------------------------------------------------------------
for (const [regime, meses] of [['isento', 339], ['resgate_15', 279], ['come_cotas', 253]]) {
  test(`IPCA + 6, 1.000.000 / 6.000, ${regime}: ${meses} meses`, () => {
    const r = processarRetirada(ancora({
      valorInicial: '1.000.000', retirada: '6.000', rentabilidade: '6', rentabilidadeTipo: 'ipca_mais', regime,
    }));
    assert.equal(r.ok, true);
    assert.equal(r.numeros.meses, meses);
    quase(r.numeros.retornoAnual, 0.1077, 'taxa nominal');
  });
}

// (e) tabela ---------------------------------------------------------------------------
// Lê "R$ 1.234,56" (com espaço não separável) como número.
const lerMoeda = (texto) => Number(texto.replace(/[^\d,-]/g, '').replace(',', '.'));

test('tabela do modo 2: 20 linhas, soma do retirado = meses × retirada, saldos iguais aos do motor', () => {
  for (const regime of REGIMES) {
    const r = processarRetirada(ancora({ modo: 'valor', prazo: '20', regime }));
    assert.equal(r.tabela.length, 20);
    assert.equal(r.tabela[0].rotulo, '1');
    assert.equal(r.tabela[19].rotulo, '20');
    const soma = r.tabela.reduce((s, l) => s + lerMoeda(l.retirado), 0);
    assert.ok(Math.abs(soma - 240 * 5000) <= 0.005 * 20 + 0.01, `${regime}: ${soma}`);
    const { serie } = simularRetirada({
      valorInicial: r.numeros.valorInicial, retirada: 5000, retornoAnual: 0.11, inflacaoAnual: 0.045, regime, mesInicio: 12,
    }, 240);
    r.tabela.forEach((l, i) => {
      const mes = 12 * (i + 1);
      assert.equal(l.bruto, moeda(serie.saldoBruto[mes]));
      assert.equal(l.liquido, moeda(serie.saldoLiquido[mes]));
      assert.equal(l.liquidoReal, moeda(serie.saldoLiquidoReal[mes]));
    });
    assert.equal(r.notaTabela, '');
  }
});

test('tabela com linha final parcial: 18 meses = 1 ano + 6 meses', () => {
  const r = processarRetirada(ancora({ modo: 'valor', prazo: '18', prazoUnidade: 'meses' }));
  assert.equal(r.tabela.length, 2);
  assert.equal(r.tabela[0].rotulo, '1');
  assert.equal(r.tabela[1].rotulo, '1 ano e 6 meses');
  quase(lerMoeda(r.tabela[1].retirado), 6 * 5000, 'retirado da linha parcial');
  quase(lerMoeda(r.tabela[0].retirado), 12 * 5000, 'retirado do primeiro ano');
  const { serie } = simularRetirada({
    valorInicial: r.numeros.valorInicial, retirada: 5000, retornoAnual: 0.11, inflacaoAnual: 0.045, regime: 'isento', mesInicio: 12,
  }, 18);
  assert.equal(r.tabela[1].liquidoReal, moeda(serie.saldoLiquidoReal[18]));
});

test('prazo de 1 mês: uma linha parcial', () => {
  const r = processarRetirada(ancora({ modo: 'valor', prazo: '1', prazoUnidade: 'meses' }));
  assert.equal(r.tabela.length, 1);
  assert.equal(r.tabela[0].rotulo, '1 mês');
});

test('modo 1 com fim: a tabela vai até a duração (11 anos e 6 meses = 12 linhas)', () => {
  const r = processarRetirada(ancora());
  assert.equal(r.tabela.length, 12);
  assert.equal(r.tabela[11].rotulo, '11 anos e 6 meses');
  assert.equal(r.notaTabela, '');
  const soma = r.tabela.reduce((s, l) => s + lerMoeda(l.retirado), 0);
  assert.ok(Math.abs(soma - 138 * 5000) <= 0.005 * 12 + 0.01);
  quase(r.numeros.totalRetirado, 138 * 5000, 'total retirado');
});

test('caso sem fim: tabela de 30 anos e nota', () => {
  const r = processarRetirada(ancora({ valorInicial: '2.000.000', retirada: '2.000' }));
  assert.equal(r.tabela.length, 30);
  assert.equal(r.tabela[29].rotulo, '30');
  assert.equal(r.notaTabela, 'A tabela mostra os primeiros 30 anos.');
  const soma = r.tabela.reduce((s, l) => s + lerMoeda(l.retirado), 0);
  assert.ok(Math.abs(soma - 360 * 2000) <= 0.005 * 30 + 0.01);
});

test('abreviação das colunas curtas acima de R$ 1 milhão', () => {
  const r = processarRetirada(ancora({ valorInicial: '2.000.000', retirada: '2.000' }));
  assert.match(r.tabela[0].liquidoRealCurto, /mi$/);
  assert.match(r.tabela[0].retiradoCurto, /^R\$/);
  assert.ok(!/mi$/.test(r.tabela[0].retiradoCurto));
});

test('imposto: zero no isento; positivo nos outros; come-cotas aparece em maio/novembro', () => {
  const iso = processarRetirada(ancora());
  assert.equal(iso.numeros.impostoTotal, 0);
  for (const regime of ['resgate_15', 'come_cotas']) {
    const r = processarRetirada(ancora({ regime }));
    assert.ok(r.numeros.impostoTotal > 0, regime);
  }
});

// avisos e notas -----------------------------------------------------------------------
test('notas: aviso do valor juntado só fora do isento', () => {
  assert.deepEqual(processarRetirada(ancora()).notas, []);
  assert.deepEqual(processarRetirada(ancora({ regime: 'resgate_15' })).notas, [AVISO_VALOR_JUNTADO]);
  assert.deepEqual(processarRetirada(ancora({ regime: 'come_cotas' })).notas, [AVISO_VALOR_JUNTADO]);
});

test('aviso de prazo curto: duração de até 24 meses fora do isento', () => {
  const curto = processarRetirada(ancora({ valorInicial: '60.000', retirada: '5.000', regime: 'resgate_15' }));
  assert.ok(curto.numeros.meses <= 24 && curto.numeros.meses > 0);
  assert.deepEqual(curto.avisos, [AVISO_PRAZO_CURTO]);
  assert.deepEqual(processarRetirada(ancora({ valorInicial: '60.000', retirada: '5.000' })).avisos, []);
  assert.deepEqual(processarRetirada(ancora({ regime: 'resgate_15' })).avisos, []);
});

test('linhas de apoio, com fim', () => {
  const r = processarRetirada(ancora());
  assert.deepEqual(r.linhas.map((l) => l.rotulo), [
    'Valor investido hoje',
    'Retirada mensal (reais de hoje, líquida)',
    'Prazo',
    'Total retirado (reais de hoje)',
    'Imposto pago ao longo do período (reais de hoje)',
  ]);
  assert.equal(r.linhas[0].valor, moeda(500000));
  assert.equal(r.linhas[2].valor, '11 anos e 6 meses');
});

// (f) ida e volta pelo valor mostrado ----------------------------------------------------
test('o valor mostrado no modo 2, digitado de volta no modo 1, dura pelo menos o prazo', () => {
  for (const regime of REGIMES) {
    for (const mesInicio of ['1', '5', '12']) {
      const r2 = processarRetirada(ancora({ modo: 'valor', prazo: '240', prazoUnidade: 'meses', regime, mesInicio }));
      const digitado = r2.numeros.valorInicial.toFixed(2).replace('.', ',');
      const r1 = processarRetirada(ancora({ modo: 'duracao', valorInicial: digitado, regime, mesInicio }));
      assert.ok(r1.numeros.meses >= 240, `${regime} ${mesInicio}: ${r1.numeros.meses}`);
    }
  }
});

test('a retirada mostrada no modo 3, digitada de volta no modo 1, dura pelo menos o prazo', () => {
  for (const regime of REGIMES) {
    for (const mesInicio of ['1', '5', '12']) {
      const r3 = processarRetirada(ancora({ modo: 'retirada', valorInicial: '1.000.000', prazo: '240', prazoUnidade: 'meses', regime, mesInicio }));
      const digitado = r3.numeros.retirada.toFixed(2).replace('.', ',');
      const r1 = processarRetirada(ancora({ modo: 'duracao', valorInicial: '1.000.000', retirada: digitado, regime, mesInicio }));
      assert.ok(r1.numeros.meses >= 240, `${regime} ${mesInicio}: ${r1.numeros.meses}`);
    }
  }
});

// (g) formatos -------------------------------------------------------------------------
test('o destaque usa moeda() e o valorDestaque é um trecho dele', () => {
  for (const modo of MODOS_RETIRADA) {
    const r = processarRetirada(ancora({ modo, valorInicial: '1.000.000' }));
    assert.ok(r.destaque.includes(r.valorDestaque), modo);
  }
  const r = processarRetirada(ancora({ modo: 'valor' }));
  assert.ok(r.destaque.startsWith(`Você precisa ter ${moeda(r.numeros.valorInicial)}`));
});
