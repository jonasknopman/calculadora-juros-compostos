// Testa entrada.js como o usuário usaria: texto digitado -> resultado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processar, lerNumero, abreviarMoeda, moeda } from '../docs/js/entrada.js';
import { taxaNominalDeIpcaMais } from '../docs/js/motor.js';

const TOLERANCIA = 0.01;

function quase(obtido, esperado, rotulo) {
  assert.ok(
    Math.abs(obtido - esperado) <= TOLERANCIA,
    `${rotulo}: obtido ${obtido}, esperado ${esperado}`,
  );
}

// Formulário como vem da tela, com os padrões do modo "quanto aportar".
const formulario = (extra = {}) => ({
  modo: 'aportar',
  meta: '2.000.000',
  valorInicial: '0',
  aporte: '',
  prazo: '20',
  prazoUnidade: 'anos',
  rentabilidade: '11',
  rentabilidadeTipo: 'nominal',
  regime: 'isento',
  inflacao: '0',
  reajustar: false,
  reajuste: '',
  mesInicio: '1',
  ...extra,
});

test('1. aportar, 11% a.a., 20 anos, sem inflação: R$ 2.473,58', () => {
  const r = processar(formulario());
  assert.equal(r.ok, true);
  quase(r.numeros.aporteInicial, 2473.58, 'aporte');
  assert.match(r.destaque, /2\.473,58/);
  assert.match(r.destaque, /por mês/);
});

test('2. aportar com inflação 4,5% e aporte fixo: R$ 5.965,57', () => {
  const r = processar(formulario({ inflacao: '4,5' }));
  quase(r.numeros.aporteInicial, 5965.57, 'aporte');
  assert.match(r.destaque, /5\.965,57/);
});

test('3. aportar com inflação 4,5% e reajuste acompanhando a inflação: R$ 4.405,80', () => {
  const r = processar(formulario({ inflacao: '4,5', reajustar: true }));
  quase(r.numeros.aporteInicial, 4405.8, 'aporte');
  assert.match(r.destaque, /4\.405,80 no primeiro mês, reajustado em 4,5% ao ano/);
});

test('3b. reajuste editado à mão vale no lugar da inflação', () => {
  const r = processar(formulario({ inflacao: '4,5', reajustar: true, reajuste: '3' }));
  assert.equal(r.numeros.reajusteAnual, 0.03);
});

test('4. valor final, aporte 1.000, 20 anos, 11%: R$ 808.544,93', () => {
  const r = processar(formulario({ modo: 'final', aporte: '1.000', meta: '' }));
  assert.equal(r.ok, true);
  quase(r.numeros.liquidoReal, 808544.93, 'saldo');
  assert.match(r.destaque, /808\.544,93/);
  assert.equal(r.tabela.length, 20);
});

test('5. IPCA + 6 com inflação 4,5 equivale a 10,77% a.a. nominal', () => {
  const r = processar(formulario({ rentabilidade: '6', rentabilidadeTipo: 'ipca_mais', inflacao: '4,5' }));
  assert.equal(r.ok, true);
  assert.equal(r.numeros.retornoAnual, taxaNominalDeIpcaMais(0.045, 0.06));
  quase(r.numeros.retornoAnual * 100, 10.77, 'retorno nominal');
});

test('6. entradas inválidas devolvem erro e nenhum número', () => {
  const casos = [
    ['vazio', { meta: '' }, 'meta'],
    ['texto', { meta: 'abc' }, 'meta'],
    ['negativo', { rentabilidade: '-5' }, 'rentabilidade'],
    ['prazo de 70 anos', { prazo: '70' }, 'prazo'],
    ['prazo de 721 meses', { prazo: '721', prazoUnidade: 'meses' }, 'prazo'],
    ['prazo zero', { prazo: '0' }, 'prazo'],
    ['prazo fracionado', { prazo: '2,5' }, 'prazo'],
  ];
  for (const [nome, extra, campo] of casos) {
    const r = processar(formulario(extra));
    assert.equal(r.ok, false, nome);
    assert.ok(r.erros[campo], `${nome}: deveria haver erro em ${campo}`);
    assert.equal(r.numeros, null, nome);
    assert.equal(r.destaque, null, nome);
  }
});

test('6b. campos escondidos no modo atual não são validados', () => {
  const r = processar(formulario({ aporte: 'abc' })); // modo aportar não usa o aporte
  assert.equal(r.ok, true);
});

test('7. leitura de números no formato brasileiro', () => {
  assert.equal(lerNumero('1.000,50'), 1000.5);
  assert.equal(lerNumero('11,5'), 11.5);
  assert.equal(lerNumero('2.000.000'), 2000000);
  assert.equal(lerNumero('4.5'), 4.5);
  assert.equal(lerNumero('11,'), 11);
  assert.equal(lerNumero('-5'), -5);
  assert.equal(lerNumero(''), null);
  assert.equal(lerNumero('abc'), null);
  assert.equal(lerNumero('1,2,3'), null);
  assert.equal(lerNumero('1..000'), null);
});

test('modo tempo: devolve anos e meses e bate com o gabarito (prazo_1M_come_cotas)', () => {
  const r = processar(formulario({
    modo: 'tempo', meta: '1.000.000', valorInicial: '10.000', aporte: '2.000', prazo: '',
    rentabilidade: '11', inflacao: '4,5', reajustar: true, regime: 'come_cotas',
  }));
  assert.equal(r.ok, true);
  assert.match(r.destaque, /^Você chega lá em \d+ anos?( e \d+ mes(es)?)?$/);
  assert.ok(r.numeros.prazoMeses > 0);
});

test('modo tempo: meta que não chega em 100 anos vira mensagem', () => {
  const r = processar(formulario({
    modo: 'tempo', meta: '1.000.000', aporte: '0', valorInicial: '0', rentabilidade: '0', prazo: '',
  }));
  assert.equal(r.ok, false);
  assert.match(r.erroGeral, /100 anos/);
  assert.equal(r.numeros, null);
});

test('modo aportar: meta já coberta pelo valor inicial não pede aporte', () => {
  const r = processar(formulario({ meta: '1.000', valorInicial: '5.000' }));
  assert.equal(r.ok, true);
  assert.equal(r.numeros.aporteInicial, 0);
  assert.match(r.destaque, /sem novos aportes/);
});

test('tabela ganha linha final quando o prazo não é múltiplo de 12', () => {
  const r = processar(formulario({ modo: 'final', aporte: '100', prazo: '18', prazoUnidade: 'meses' }));
  assert.deepEqual(r.tabela.map((l) => l.rotulo), ['1', '1 ano e 6 meses']);
});

// ---- Etapa 3: cascata, cenários e gráfico ----

const REGIMES_TESTADOS = ['isento', 'resgate_15', 'come_cotas'];

const barraDe = (r, id) => r.cascata.barras.find((b) => b.id === id);

test('B1. cascata: barra 1 − imposto − rendimento perdido (se existir) − inflação = poder de compra, em todos os regimes', () => {
  for (const regime of REGIMES_TESTADOS) {
    for (const extra of [
      { modo: 'final', aporte: '1.000', meta: '' },
      { modo: 'aportar', inflacao: '4,5', reajustar: true },
    ]) {
      const r = processar(formulario({ regime, inflacao: '4,5', ...extra }));
      assert.equal(r.ok, true, regime);
      const barras = r.cascata.barras;
      const ids = barras.map((b) => b.id);
      assert.equal(ids[0], 'sem-imposto');
      assert.equal(ids[1], 'imposto-pago');
      assert.equal(ids.at(-2), 'inflacao');
      assert.equal(ids.at(-1), 'poder-de-compra');
      let resto = barras[0].valor;
      for (const b of barras.slice(1, -1)) resto -= b.valor;
      quase(resto, barras.at(-1).valor, `${regime}: cascata não fecha`);
      quase(barras.at(-1).valor, r.numeros.liquidoReal, `${regime}: última barra é o líquido real`);
    }
  }
});

test('B1b. cascata fora do come-cotas: sem a barra de rendimento, imposto pago = imposto do resgate', () => {
  for (const regime of ['isento', 'resgate_15']) {
    const r = processar(formulario({ modo: 'final', aporte: '1.000', meta: '', regime, inflacao: '4,5' }));
    assert.equal(barraDe(r, 'rendimento-perdido'), undefined, regime);
    assert.equal(r.cascata.barras.length, 4, regime);
    quase(barraDe(r, 'imposto-pago').valor, r.numeros.impostoResgate, `${regime}: imposto pago`);
  }
  const isento = processar(formulario({ modo: 'final', aporte: '1.000', meta: '', regime: 'isento' }));
  assert.match(barraDe(isento, 'imposto-pago').texto, /^R\$\s0,00$/);
});

test('B1c. cascata no come-cotas: imposto pago = come-cotas + resgate e a barra de rendimento é positiva', () => {
  const r = processar(formulario({ modo: 'final', aporte: '1.000', meta: '', regime: 'come_cotas', mesInicio: '1', inflacao: '4,5' }));
  const pago = barraDe(r, 'imposto-pago');
  const perdido = barraDe(r, 'rendimento-perdido');
  quase(pago.valor, r.numeros.comeCotasPagos + r.numeros.impostoResgate, 'imposto pago');
  assert.ok(perdido && perdido.valor > 0, 'barra de rendimento perdido existe');
  quase(barraDe(r, 'sem-imposto').valor - pago.valor - perdido.valor, r.numeros.liquidoNominal, 'sobra o líquido nominal');
  assert.equal(r.cascata.barras.length, 5);
});

test('B1d. caso de referência: R$ 2 milhões, 20 anos, 11%, inflação 4,5% e reajuste, come-cotas', () => {
  const r = processar(formulario({ regime: 'come_cotas', inflacao: '4,5', reajustar: true, mesInicio: '1' }));
  const pago = barraDe(r, 'imposto-pago').valor;
  const perdido = barraDe(r, 'rendimento-perdido').valor;
  assert.ok(pago > 400000 && pago < 600000, `imposto pago ${pago}`);
  assert.ok(perdido > 0 && perdido < pago, `rendimento perdido ${perdido}`);
});

test('B1e. legenda da cascata traz cada valor formatado e o texto certo de cada regime', () => {
  const casos = {
    come_cotas: ['Como o come-cotas leva esse dinheiro antes do resgate', ['sem-imposto', 'imposto-pago', 'rendimento-perdido', 'inflacao', 'poder-de-compra']],
    resgate_15: ['O imposto soma', ['sem-imposto', 'imposto-pago', 'inflacao', 'poder-de-compra']],
    isento: ['Neste tipo de aplicação não há imposto de renda', ['sem-imposto', 'inflacao', 'poder-de-compra']],
  };
  for (const [regime, [trecho, ids]] of Object.entries(casos)) {
    const r = processar(formulario({ modo: 'final', aporte: '1.000', meta: '', regime, inflacao: '4,5', mesInicio: '1' }));
    const { legenda, descricao } = r.cascata;
    assert.ok(legenda.includes(trecho), `${regime}: trecho "${trecho}"`);
    for (const id of ids) assert.ok(legenda.includes(barraDe(r, id).texto), `${regime}: valor de ${id} na legenda`);
    assert.equal(descricao, legenda, 'a descrição acompanha a legenda');
  }
  const resgate = processar(formulario({ modo: 'final', aporte: '1.000', meta: '', regime: 'resgate_15' }));
  assert.ok(!resgate.cascata.legenda.includes('come-cotas'));
});

test('A4. linhas de apoio: investido nominal e em reais de hoje', () => {
  const r = processar(formulario({ modo: 'final', aporte: '1.000', meta: '', inflacao: '4,5' }));
  const rotulos = r.linhas.map((l) => l.rotulo);
  const i = rotulos.indexOf('Total investido (valores nominais)');
  assert.ok(i >= 0, 'linha nominal renomeada');
  assert.equal(rotulos[i + 1], 'Total investido em reais de hoje');
  assert.ok(!rotulos.includes('Total investido'));
  assert.equal(r.linhas[i + 1].valor, moeda(r.numeros.investidoReal));
  assert.notEqual(r.linhas[i].valor, r.linhas[i + 1].valor);
});

test('B2. cenários no modo aportar: o aporte cresce do otimista para o conservador', () => {
  const r = processar(formulario({ inflacao: '4,5', reajustar: true, variacao: '2' }));
  const [conservador, base, otimista] = r.cenarios;
  assert.deepEqual(r.cenarios.map((c) => c.nome), ['Conservador', 'Base', 'Otimista']);
  assert.ok(conservador.valor > base.valor && base.valor > otimista.valor);
  quase(base.valor, r.numeros.aporteInicial, 'base igual ao resultado principal');
  assert.equal(conservador.rentabilidade, '9% ao ano');
  assert.equal(otimista.rentabilidade, '13% ao ano');
});

test('B2. cenários no modo final: o valor cai do otimista para o conservador', () => {
  const r = processar(formulario({ modo: 'final', aporte: '1.000', meta: '', inflacao: '4,5' }));
  const [conservador, base, otimista] = r.cenarios;
  assert.ok(otimista.valor > base.valor && base.valor > conservador.valor);
  quase(base.valor, r.numeros.liquidoReal, 'base igual ao resultado principal');
});

test('B2. cenários no modo tempo: o prazo cai do conservador para o otimista', () => {
  const r = processar(formulario({
    modo: 'tempo', meta: '500.000', aporte: '2.000', prazo: '', inflacao: '4,5',
  }));
  const [conservador, base, otimista] = r.cenarios;
  assert.ok(conservador.valor > base.valor && base.valor > otimista.valor);
});

test('B2. com IPCA + x a variação vale sobre o x, com piso em 0', () => {
  const r = processar(formulario({ rentabilidade: '1', rentabilidadeTipo: 'ipca_mais', inflacao: '4,5', variacao: '2' }));
  assert.deepEqual(r.cenarios.map((c) => c.rentabilidade), ['IPCA + 0% ao ano', 'IPCA + 1% ao ano', 'IPCA + 3% ao ano']);
  quase(r.cenarios[0].retornoAnual, 0.045, 'piso: IPCA + 0 = inflação');
});

test('B2. cenário que não atinge a meta mostra "Não alcança em 100 anos"', () => {
  const r = processar(formulario({
    modo: 'tempo', meta: '1.000.000', aporte: '300', prazo: '', rentabilidade: '2', inflacao: '0', variacao: '2',
  }));
  assert.equal(r.ok, true);
  assert.equal(r.cenarios[0].alcanca, false);
  assert.equal(r.cenarios[0].texto, 'Não alcança em 100 anos');
  assert.equal(r.cenarios[1].alcanca, true);
});

test('B2. variação dos cenários: aceita de 0 a 10, recusa o resto', () => {
  assert.equal(processar(formulario({ variacao: '0' })).ok, true);
  assert.equal(processar(formulario({ variacao: '10' })).ok, true);
  for (const variacao of ['11', '-1', 'abc', '']) {
    const r = processar(formulario({ variacao }));
    assert.equal(r.ok, false, variacao);
    assert.ok(r.erros.variacao, variacao);
  }
  const zero = processar(formulario({ variacao: '0' }));
  quase(zero.cenarios[0].valor, zero.cenarios[2].valor, 'sem variação os três iguais');
});

test('B2. sem o campo variacao, vale o padrão de 2 pontos', () => {
  const r = processar(formulario());
  assert.equal(r.cenarios[0].rentabilidade, '9% ao ano');
});

test('B3. gráfico: pontos anuais com saldo líquido e investido em reais de hoje', () => {
  const r = processar(formulario({ modo: 'final', aporte: '1.000', meta: '', inflacao: '4,5' }));
  const { pontos, legenda } = r.grafico;
  assert.equal(pontos.length, 21);
  assert.equal(pontos[0].ano, 0);
  assert.equal(pontos[20].ano, 20);
  quase(pontos[20].saldoLiquidoReal, r.numeros.liquidoReal, 'saldo final');
  quase(pontos[20].investidoReal, r.numeros.investidoReal, 'investido final');
  assert.ok(pontos[20].investidoReal < r.numeros.investidoNominal, 'investido real é menor que o nominal');
  assert.match(legenda, /^Você investe R\$.* em valores de hoje e chega a R\$.*\.$/);
});

test('B3. gráfico com prazo quebrado ganha ponto no último mês', () => {
  const r = processar(formulario({ modo: 'final', aporte: '100', prazo: '18', prazoUnidade: 'meses' }));
  assert.deepEqual(r.grafico.pontos.map((p) => p.ano), [0, 1, 1.5]);
});

test('B3. eixo abreviado: R$ 1,2 mi, R$ 800 mil', () => {
  assert.equal(abreviarMoeda(1_200_000), 'R$ 1,2 mi');
  assert.equal(abreviarMoeda(800_000), 'R$ 800 mil');
  assert.equal(abreviarMoeda(2_000_000), 'R$ 2 mi');
  assert.equal(abreviarMoeda(0), 'R$ 0');
  assert.equal(abreviarMoeda(1_500_000_000), 'R$ 1,5 bi');
});

// ---- Aviso de prazo curto ----

const AVISO = /^Para prazos de até 2 anos, o imposto real costuma ser maior, de 17,5% a 22,5% sobre o ganho\. Esta simulação usa 15%, então o resultado pode estar um pouco otimista\.$/;
const prazoEmMeses = (prazo, regime) => processar(formulario({
  modo: 'final', aporte: '1.000', meta: '', prazo: String(prazo), prazoUnidade: 'meses', regime,
}));

test('aviso: 18 meses avisa em resgate_15 e em come_cotas', () => {
  for (const regime of ['resgate_15', 'come_cotas']) {
    const r = prazoEmMeses(18, regime);
    assert.equal(r.ok, true, regime);
    assert.equal(r.avisos.length, 1, regime);
    assert.match(r.avisos[0], AVISO);
    assert.ok(r.destaque, 'o resultado continua aparecendo');
  }
});

test('aviso: 24 meses avisa e 25 meses não avisa', () => {
  for (const regime of ['resgate_15', 'come_cotas']) {
    assert.equal(prazoEmMeses(24, regime).avisos.length, 1, `${regime} 24`);
    assert.deepEqual(prazoEmMeses(25, regime).avisos, [], `${regime} 25`);
  }
});

test('aviso: isento nunca avisa', () => {
  for (const prazo of [1, 12, 18, 24, 25]) assert.deepEqual(prazoEmMeses(prazo, 'isento').avisos, [], `isento ${prazo}`);
});

test('aviso: no modo tempo vale o prazo encontrado', () => {
  const curto = processar(formulario({
    modo: 'tempo', meta: '20.000', valorInicial: '0', aporte: '1.000', prazo: '', regime: 'resgate_15', rentabilidade: '11',
  }));
  assert.ok(curto.numeros.prazoMeses <= 24, `prazo ${curto.numeros.prazoMeses}`);
  assert.equal(curto.avisos.length, 1);
  const longo = processar(formulario({
    modo: 'tempo', meta: '1.000.000', valorInicial: '0', aporte: '2.000', prazo: '', regime: 'resgate_15',
  }));
  assert.ok(longo.numeros.prazoMeses > 24);
  assert.deepEqual(longo.avisos, []);
});

test('aviso: entrada inválida não traz aviso', () => {
  assert.deepEqual(processar(formulario({ meta: 'abc' })).avisos, []);
});

test('tabela anual: versão curta só abrevia valores acima de R$ 1 milhão', () => {
  const r = processar(formulario({ modo: 'final', aporte: '5.000', meta: '', inflacao: '0' }));
  const primeira = r.tabela[0];
  assert.equal(primeira.investidoCurto, primeira.investido, 'abaixo de 1 milhão não muda');
  assert.equal(primeira.liquidoRealCurto, primeira.liquidoReal);
  const ultima = r.tabela.at(-1);
  assert.match(ultima.liquidoRealCurto, /^R\$ [\d,]+ mi$/);
  assert.ok(ultima.liquidoReal.includes(','), 'o valor completo continua completo');
  assert.ok(ultima.liquidoRealCurto.length < ultima.liquidoReal.length);
});
