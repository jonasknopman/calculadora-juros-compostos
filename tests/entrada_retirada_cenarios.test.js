// Cenários e gráfico da aba "Viver de renda" (etapa 4), pela camada pura.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processarRetirada, MODOS_RETIRADA } from '../docs/js/entrada_retirada.js';
import { moeda, textoDuracao } from '../docs/js/entrada.js';
import { simularRetirada } from '../docs/js/motor_retirada.js';
import { REGIMES } from '../docs/js/tributacao.js';

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
  variacao: '2',
  ...extra,
});

// (a) âncoras de cenário -----------------------------------------------------------------
test('cenários da especificação: 9% / 11% / 13% = 122 / 138 / 160 meses', () => {
  const r = processarRetirada(ancora());
  assert.deepEqual(r.cenarios.map((c) => c.nome), ['Conservador', 'Base', 'Otimista']);
  assert.deepEqual(r.cenarios.map((c) => c.valor), [122, 138, 160]);
  assert.deepEqual(r.cenarios.map((c) => c.texto), [textoDuracao(122), textoDuracao(138), textoDuracao(160)]);
  assert.deepEqual(r.cenarios.map((c) => c.rentabilidade), ['9% ao ano', '11% ao ano', '13% ao ano']);
  assert.equal(r.cenarios[1].valor, r.numeros.meses);
  assert.equal(r.cenarios[1].retornoAnual, r.numeros.retornoAnual);
  assert.ok(r.cenarios.every((c) => c.alcanca));
});

test('o cenário Base coincide com o resultado principal nos três modos', () => {
  for (const modo of MODOS_RETIRADA) {
    for (const regime of REGIMES) {
      const r = processarRetirada(ancora({ modo, regime, valorInicial: '1.000.000' }));
      const base = r.cenarios[1];
      if (modo === 'duracao') assert.equal(base.valor, r.numeros.meses);
      if (modo === 'valor') assert.equal(base.valor, r.numeros.valorInicial);
      if (modo === 'retirada') assert.equal(base.valor, r.numeros.retirada);
      assert.ok(r.destaque.includes(r.valorDestaque));
    }
  }
});

// (b) ordem dos cenários ------------------------------------------------------------------
test('Conservador ≤ Base ≤ Otimista nos três modos e regimes; variação 0 dá três iguais', () => {
  for (const modo of MODOS_RETIRADA) {
    for (const regime of REGIMES) {
      const r = processarRetirada(ancora({ modo, regime, valorInicial: '1.000.000' }));
      const [c, b, o] = r.cenarios.map((x) => x.valor);
      if (modo === 'retirada' || modo === 'duracao') {
        assert.ok(c <= b && b <= o, `${modo}/${regime}: ${c} ${b} ${o}`);
      } else {
        assert.ok(c >= b && b >= o, `${modo}/${regime}: ${c} ${b} ${o}`);
      }
      const zero = processarRetirada(ancora({ modo, regime, valorInicial: '1.000.000', variacao: '0' }));
      const v = zero.cenarios.map((x) => x.valor);
      assert.equal(v[0], v[1]);
      assert.equal(v[1], v[2]);
    }
  }
});

test('textos dos cenários nos modos valor e retirada', () => {
  const m2 = processarRetirada(ancora({ modo: 'valor', prazo: '240', prazoUnidade: 'meses' }));
  assert.deepEqual(m2.cenarios.map((c) => c.texto), m2.cenarios.map((c) => moeda(c.valor)));
  assert.equal(m2.cenarios[1].texto, moeda(m2.numeros.valorInicial));
  const m3 = processarRetirada(ancora({ modo: 'retirada', valorInicial: '1.000.000' }));
  assert.deepEqual(m3.cenarios.map((c) => c.texto), m3.cenarios.map((c) => `${moeda(c.valor)} por mês`));
  assert.equal(m3.cenarios[1].texto, `${moeda(m3.numeros.retirada)} por mês`);
});

test('modo duração: "não se esgota" e "não cobre a primeira retirada"', () => {
  const sem = processarRetirada(ancora({ valorInicial: '2.000.000', retirada: '2.000' }));
  assert.equal(sem.cenarios[1].texto, 'Não se esgota (mais de 100 anos)');
  assert.equal(sem.cenarios[1].alcanca, true);
  const zero = processarRetirada(ancora({ valorInicial: '1.000', retirada: '5.000' }));
  for (const c of zero.cenarios) {
    assert.equal(c.texto, 'Não cobre a primeira retirada');
    assert.equal(c.alcanca, false);
  }
});

// (c) piso em 0 ---------------------------------------------------------------------------
test('piso em 0: rentabilidade 1% com variação 2 → conservador a 0%', () => {
  const r = processarRetirada(ancora({ rentabilidade: '1' }));
  assert.equal(r.cenarios[0].rentabilidade, '0% ao ano');
  assert.equal(r.cenarios[0].retornoAnual, 0);
  assert.equal(r.cenarios[2].rentabilidade, '3% ao ano');
});

// (d) IPCA + x ---------------------------------------------------------------------------
test('IPCA + x: a variação vai no x e o texto traz "IPCA +"', () => {
  const r = processarRetirada(ancora({ valorInicial: '1.000.000', retirada: '6.000', rentabilidade: '6', rentabilidadeTipo: 'ipca_mais' }));
  assert.deepEqual(r.cenarios.map((c) => c.rentabilidade), ['IPCA + 4% ao ano', 'IPCA + 6% ao ano', 'IPCA + 8% ao ano']);
  assert.ok(Math.abs(r.cenarios[0].retornoAnual - (1.045 * 1.04 - 1)) < 1e-12);
  assert.ok(Math.abs(r.cenarios[1].retornoAnual - 0.1077) < 1e-12);
  assert.ok(Math.abs(r.cenarios[2].retornoAnual - (1.045 * 1.08 - 1)) < 1e-12);
  assert.equal(r.cenarios[1].valor, 339);
});

// (e) variação inválida -----------------------------------------------------------------
test('variação inválida: erro em variacao, sem exceção', () => {
  for (const v of ['', '   ', 'abc', '-1', '11', '10,01']) {
    let r;
    assert.doesNotThrow(() => { r = processarRetirada(ancora({ variacao: v })); }, JSON.stringify(v));
    assert.equal(r.ok, false, JSON.stringify(v));
    assert.ok(r.erros.variacao, JSON.stringify(v));
    assert.deepEqual(r.cenarios, []);
    assert.equal(r.grafico, null);
  }
  assert.equal(processarRetirada(ancora({ variacao: '10' })).ok, true);
  assert.equal(processarRetirada(ancora({ variacao: '0' })).ok, true);
});

test('variação ausente usa o padrão (2)', () => {
  const { variacao, ...semVariacao } = ancora();
  const r = processarRetirada(semVariacao);
  assert.deepEqual(r.cenarios.map((c) => c.valor), [122, 138, 160]);
});

// (f) gráfico ---------------------------------------------------------------------------
test('gráfico: pontos anuais, primeiro ponto = X, valores da série do motor', () => {
  for (const regime of REGIMES) {
    const r = processarRetirada(ancora({ modo: 'valor', prazo: '20', regime }));
    assert.equal(r.grafico.pontos.length, 21);
    assert.equal(r.grafico.pontos[0].ano, 0);
    assert.equal(r.grafico.pontos[0].saldoLiquidoReal, r.numeros.valorInicial);
    const { serie } = simularRetirada({
      valorInicial: r.numeros.valorInicial, retirada: 5000, retornoAnual: 0.11, inflacaoAnual: 0.045, regime, mesInicio: 12,
    }, 240);
    r.grafico.pontos.forEach((p, i) => assert.equal(p.saldoLiquidoReal, serie.saldoLiquidoReal[12 * i]));
    assert.equal(r.grafico.rotuloSaldo, 'Seu saldo líquido (reais de hoje)');
  }
});

test('gráfico com último mês parcial e legendas', () => {
  const r = processarRetirada(ancora());
  assert.equal(r.grafico.pontos.length, 13); // 0..11 anos + 11 anos e 6 meses
  assert.equal(r.grafico.pontos[12].ano, 138 / 12);
  assert.equal(
    r.grafico.legenda,
    `Você começa com ${moeda(500000)} e, retirando ${moeda(5000)} por mês, o saldo líquido chega perto de zero em ${textoDuracao(138)}.`,
  );
  assert.match(r.grafico.descricao, /Gráfico de linha de 0 a 11 anos e 6 meses; os mesmos números estão na tabela ano a ano\.$/);
  const m2 = processarRetirada(ancora({ modo: 'valor', prazo: '20' }));
  assert.match(m2.grafico.legenda, /chega perto de zero ao fim de 20 anos\.$/);
});

test('gráfico sem fim: 30 anos', () => {
  const r = processarRetirada(ancora({ valorInicial: '2.000.000', retirada: '2.000' }));
  assert.equal(r.grafico.pontos.length, 31);
  assert.equal(r.grafico.pontos[30].ano, 30);
  assert.match(r.grafico.legenda, /^Em 30 anos, seu saldo líquido vai de R\$/);
  assert.match(r.grafico.legenda, /O gráfico mostra os primeiros 30 anos\.$/);
  assert.ok(r.grafico.legenda.includes(moeda(r.grafico.pontos[30].saldoLiquidoReal)));
});

test('gráfico nulo na duração zero; cenários presentes', () => {
  const r = processarRetirada(ancora({ valorInicial: '1.000', retirada: '5.000' }));
  assert.equal(r.grafico, null);
  assert.equal(r.cenarios.length, 3);
});

// (g) cenário que falha não derruba os outros ---------------------------------------------
// Sem costura de teste: valores extremos reais (retirada de R$ 1 bi/mês por 100 anos, inflação de
// 60% e rentabilidade de 55%) fazem o motor lançar "valor inalcançável" só no cenário conservador.
test('cenário que lança exceção vira "Não foi possível calcular" e os outros seguem', () => {
  const r = processarRetirada(ancora({
    modo: 'valor', retirada: '1.000.000.000', prazo: '100', rentabilidade: '55', inflacao: '60', variacao: '10', mesInicio: '1',
  }));
  assert.equal(r.ok, true);
  assert.equal(r.cenarios[0].alcanca, false);
  assert.equal(r.cenarios[0].texto, 'Não foi possível calcular');
  assert.equal(r.cenarios[1].alcanca, true);
  assert.equal(r.cenarios[2].alcanca, true);
  assert.equal(r.cenarios[1].valor, r.numeros.valorInicial);
});

// (h) inflação e mês de início vindos do formulário -----------------------------------------
test('inflação e rentabilidade zero: duração = floor(X / Y)', () => {
  const r = processarRetirada(ancora({ valorInicial: '120.000', retirada: '1.000', rentabilidade: '0', inflacao: '0', variacao: '0' }));
  assert.equal(r.numeros.meses, 120);
  const r2 = processarRetirada(ancora({ valorInicial: '100.000', retirada: '3.000', rentabilidade: '0', inflacao: '0' }));
  assert.equal(r2.numeros.meses, Math.floor(100000 / 3000));
});

test('inflação e mês de início mudam o resultado', () => {
  const base = processarRetirada(ancora());
  const infl = processarRetirada(ancora({ inflacao: '8' }));
  assert.ok(infl.numeros.meses < base.numeros.meses);
  assert.equal(infl.numeros.inflacaoAnual, 0.08);
  // A duração é em meses inteiros e pode coincidir; o valor necessário (contínuo) mostra o efeito.
  const valores = new Set(['1', '5', '6', '12'].map((m) => processarRetirada(
    ancora({ modo: 'valor', prazo: '20', regime: 'come_cotas', mesInicio: m }),
  ).numeros.valorInicial));
  assert.ok(valores.size > 1, 'o mês de início deveria alterar o valor necessário no come-cotas');
  const iso = new Set(['1', '5', '12'].map((m) => processarRetirada(ancora({ mesInicio: m })).numeros.meses));
  assert.equal(iso.size, 1, 'no isento o mês de início não importa');
});
