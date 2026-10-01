// Camada pura entre o formulário e o motor: lê e valida texto, chama o motor e
// devolve tudo que a tela mostra. Sem DOM.
import { simular, resolverAporte, resolverPrazo, taxaNominalDeIpcaMais } from './motor.js';
import { REGIMES, avisosDeTributacao } from './tributacao.js';

export const MODOS = Object.freeze(['aportar', 'final', 'tempo']);
export const PRAZO_MAXIMO_ANOS = 60;
export const PRAZO_MAXIMO_TEMPO_MESES = 1200; // 100 anos, no modo "em quanto tempo"
export const INFLACAO_PADRAO = '4,5';

const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatoPercentual = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export const moeda = (valor) => formatoMoeda.format(valor);

// Eixo de gráfico: "R$ 1,2 mi", "R$ 800 mil", "R$ 500".
const formatoAbreviado = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
export function abreviarMoeda(valor) {
  const absoluto = Math.abs(valor);
  if (absoluto >= 1e9) return `R$ ${formatoAbreviado.format(valor / 1e9)} bi`;
  if (absoluto >= 1e6) return `R$ ${formatoAbreviado.format(valor / 1e6)} mi`;
  if (absoluto >= 1e3) return `R$ ${formatoAbreviado.format(valor / 1e3)} mil`;
  return `R$ ${formatoAbreviado.format(valor)}`;
}
export const percentual = (valor) => `${formatoPercentual.format(valor)}%`;

// Mês do calendário (1-12) seguinte ao da data informada.
export function mesSeguinteAoAtual(data = new Date()) {
  return (data.getMonth() + 1) % 12 + 1;
}

// Aceita "1.000,50", "11,5", "2.000.000", "4.5". Ponto seguido de exatamente três
// dígitos é milhar; outro ponto único é decimal. Devolve null se não for número.
export function lerNumero(texto) {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null;
  if (typeof texto !== 'string') return null;
  let t = texto.replace(/\s/g, '');
  const negativo = t.startsWith('-');
  if (negativo) t = t.slice(1);
  if (t === '' || !/^[\d.,]+$/.test(t)) return null;

  let valor;
  if (t.includes(',')) {
    const partes = t.split(',');
    if (partes.length !== 2) return null;
    const [inteira, decimais] = partes;
    if (!/^(\d+|\d{1,3}(\.\d{3})+)$/.test(inteira) || !/^\d*$/.test(decimais)) return null;
    valor = Number(`${inteira.replace(/\./g, '')}.${decimais || '0'}`);
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    valor = Number(t.replace(/\./g, ''));
  } else if (/^\d+(\.\d+)?$/.test(t)) {
    valor = Number(t);
  } else {
    return null;
  }
  return negativo ? -valor : valor;
}

// Lê um campo numérico e registra o erro, se houver. Devolve o número ou null.
function lerCampo(campos, erros, nome, { max, maxMensagem, inteiro = false, minimo = 0, minimoMensagem } = {}) {
  const texto = campos[nome];
  if (texto === undefined || texto === null || String(texto).trim() === '') {
    erros[nome] = 'Preencha este campo.';
    return null;
  }
  const valor = lerNumero(texto);
  if (valor === null) {
    erros[nome] = 'Digite apenas números, por exemplo 1.000,50.';
    return null;
  }
  if (valor < 0) {
    erros[nome] = 'Use um valor igual ou maior que zero.';
    return null;
  }
  if (valor < minimo) {
    erros[nome] = minimoMensagem ?? `Use um valor de pelo menos ${minimo}.`;
    return null;
  }
  if (inteiro && !Number.isInteger(valor)) {
    erros[nome] = 'Use um número inteiro.';
    return null;
  }
  if (max !== undefined && valor > max) {
    erros[nome] = maxMensagem ?? `O valor máximo é ${max}.`;
    return null;
  }
  return valor;
}

function pluralizar(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function textoDuracao(meses) {
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const partes = [];
  if (anos > 0) partes.push(pluralizar(anos, 'ano', 'anos'));
  if (resto > 0) partes.push(pluralizar(resto, 'mês', 'meses'));
  return partes.length > 0 ? partes.join(' e ') : '0 meses';
}

// Acima deste valor, a tabela do celular mostra a versão abreviada ("R$ 1,2 mi").
const LIMITE_VALOR_ABREVIADO = 1e6;
const moedaCurta = (valor) => (Math.abs(valor) >= LIMITE_VALOR_ABREVIADO ? abreviarMoeda(valor) : moeda(valor));

function montarTabela(serie, prazoMeses) {
  const linhas = [];
  const linha = (rotulo, mes) => linhas.push({
    rotulo,
    investido: moeda(serie.investido[mes]),
    bruto: moeda(serie.bruto[mes]),
    liquido: moeda(serie.liquido[mes]),
    liquidoReal: moeda(serie.liquidoReal[mes]),
    investidoCurto: moedaCurta(serie.investido[mes]),
    liquidoRealCurto: moedaCurta(serie.liquidoReal[mes]),
  });
  for (let ano = 1; 12 * ano <= prazoMeses; ano++) linha(String(ano), 12 * ano);
  if (prazoMeses % 12 !== 0) linha(textoDuracao(prazoMeses), prazoMeses);
  return linhas;
}

function montarLinhasApoio(resumo) {
  const linhas = [
    { rotulo: 'Valor bruto no fim (nominal)', valor: moeda(resumo.brutoNominal) },
    { rotulo: 'Imposto devido no resgate', valor: moeda(resumo.impostoResgate) },
  ];
  if (resumo.comeCotasPagos > 0) {
    linhas.push({ rotulo: 'Come-cotas já pago no caminho', valor: moeda(resumo.comeCotasPagos) });
  }
  linhas.push(
    { rotulo: 'Valor líquido no fim (nominal)', valor: moeda(resumo.liquidoNominal) },
    { rotulo: 'Valor líquido em reais de hoje', valor: moeda(resumo.liquidoReal) },
    { rotulo: 'Total investido (valores nominais)', valor: moeda(resumo.investidoNominal) },
    { rotulo: 'Total investido em reais de hoje', valor: moeda(resumo.investidoReal) },
  );
  return linhas;
}

const RESULTADO_VAZIO = Object.freeze({
  destaque: null,
  valorDestaque: null,
  avisos: [],
  linhas: [],
  tabela: [],
  cascata: null,
  cenarios: [],
  grafico: null,
  numeros: null,
});

export const VARIACAO_CENARIOS_PADRAO = '2';
export const VARIACAO_CENARIOS_MAXIMA = 10;
const TEXTO_NAO_ALCANCA = 'Não alcança em 100 anos';

// Resolve o modo escolhido para uma taxa. Devolve { aporteInicial, meses } ou null se não alcança.
function resolverModo(modo, meta, base, prazoMeses) {
  if (modo === 'aportar') {
    try {
      return { aporteInicial: resolverAporte(meta, { ...base, prazoMeses }), meses: prazoMeses };
    } catch {
      return null;
    }
  }
  if (modo === 'tempo') {
    const meses = resolverPrazo(meta, base, PRAZO_MAXIMO_TEMPO_MESES);
    return meses === null ? null : { aporteInicial: base.aporteInicial, meses };
  }
  return { aporteInicial: base.aporteInicial, meses: prazoMeses };
}

function textoRentabilidade(tipo, pct) {
  return tipo === 'ipca_mais' ? `IPCA + ${percentual(pct)} ao ano` : `${percentual(pct)} ao ano`;
}

function montarCenario(nome, modo, tipo, pct, retornoAnual, meta, base, prazoMeses) {
  const cenario = { nome, rentabilidade: textoRentabilidade(tipo, pct), retornoAnual, alcanca: false, valor: null, texto: TEXTO_NAO_ALCANCA };
  const solucao = resolverModo(modo, meta, base, prazoMeses);
  if (solucao === null) return cenario;
  cenario.alcanca = true;
  if (modo === 'aportar') {
    cenario.valor = solucao.aporteInicial;
    cenario.texto = solucao.aporteInicial === 0 ? 'Sem novos aportes' : `${moeda(solucao.aporteInicial)} por mês`;
  } else if (modo === 'tempo') {
    cenario.valor = solucao.meses;
    cenario.texto = solucao.meses === 0 ? 'Você já atingiu a meta' : textoDuracao(solucao.meses);
  } else {
    const { resumo } = simular({ ...base, aporteInicial: solucao.aporteInicial, prazoMeses: solucao.meses });
    cenario.valor = resumo.liquidoReal;
    cenario.texto = `${moeda(resumo.liquidoReal)} em reais de hoje`;
  }
  return cenario;
}

// Abaixo disto, a perda de rendimento por imposto antecipado conta como zero (barra não aparece).
const LIMITE_BARRA_RENDIMENTO = 0.005;

// Cascata: do valor "de vitrine" ao que vale no bolso. Cada barra flutua entre `inicio` e `fim`.
// O imposto efetivamente pago e o rendimento que ele deixou de gerar aparecem em barras separadas.
function montarCascata(resumo, brutoSemImposto) {
  const barra = (id, rotulo, valor, inicio, fim, tipo, rotuloCurto = rotulo) => ({
    id, rotulo, rotuloCurto, valor, texto: moeda(valor), inicio, fim, tipo,
  });
  const impostoPago = resumo.comeCotasPagos + resumo.impostoResgate;
  let rendimentoPerdido = (brutoSemImposto - resumo.liquidoNominal) - impostoPago;
  if (rendimentoPerdido <= LIMITE_BARRA_RENDIMENTO) rendimentoPerdido = 0;
  const inflacao = resumo.liquidoNominal - resumo.liquidoReal;

  const barras = [barra('sem-imposto', 'Sem imposto e sem inflação', brutoSemImposto, 0, brutoSemImposto, 'total', 'Sem imposto')];
  barras.push(barra('imposto-pago', 'Imposto pago', impostoPago, brutoSemImposto - impostoPago, brutoSemImposto, 'perda'));
  if (rendimentoPerdido > 0) {
    barras.push(barra(
      'rendimento-perdido', 'Rendimento que o imposto deixou de gerar', rendimentoPerdido,
      brutoSemImposto - impostoPago - rendimentoPerdido, brutoSemImposto - impostoPago, 'perda-indireta',
      'Rendimento perdido',
    ));
  }
  barras.push(
    barra('inflacao', 'Inflação', inflacao, resumo.liquidoReal, resumo.liquidoNominal, 'inflacao'),
    barra('poder-de-compra', 'Seu poder de compra de hoje', resumo.liquidoReal, 0, resumo.liquidoReal, 'total', 'Poder de compra'),
  );

  const final = `Sobram ${moeda(resumo.liquidoReal)} em poder de compra de hoje.`;
  let legenda;
  if (rendimentoPerdido > 0) {
    legenda = `Com os mesmos aportes, sem imposto e sem inflação você teria ${moeda(brutoSemImposto)}. O imposto pago soma ${moeda(impostoPago)}. Como o come-cotas leva esse dinheiro antes do resgate, ele também deixa de render nos anos seguintes, o que custa mais ${moeda(rendimentoPerdido)}. A inflação tira mais ${moeda(inflacao)}. ${final}`;
  } else if (impostoPago > LIMITE_BARRA_RENDIMENTO) {
    legenda = `Com os mesmos aportes, sem imposto e sem inflação você teria ${moeda(brutoSemImposto)}. O imposto soma ${moeda(impostoPago)}. A inflação tira mais ${moeda(inflacao)}. ${final}`;
  } else {
    legenda = `Com os mesmos aportes, sem imposto e sem inflação você teria ${moeda(brutoSemImposto)}. Neste tipo de aplicação não há imposto de renda. A inflação tira ${moeda(inflacao)}. ${final}`;
  }
  return { titulo: 'De quanto aparece na tela ao que vale no seu bolso', barras, legenda, descricao: legenda };
}

// Pontos anuais (e o último mês, se o prazo não for múltiplo de 12) para o gráfico de evolução.
function montarGrafico(serie, prazoMeses) {
  const meses = [];
  for (let ano = 0; 12 * ano <= prazoMeses; ano++) meses.push(12 * ano);
  if (prazoMeses % 12 !== 0) meses.push(prazoMeses);
  const pontos = meses.map((mes) => ({
    ano: mes / 12,
    saldoLiquidoReal: serie.liquidoReal[mes],
    investidoReal: serie.investidoReal[mes],
  }));
  const investido = serie.investidoReal[prazoMeses];
  const saldo = serie.liquidoReal[prazoMeses];
  const legenda = `Você investe ${moeda(investido)} em valores de hoje e chega a ${moeda(saldo)}.`;
  return {
    titulo: 'Evolução do seu dinheiro, em reais de hoje',
    rotuloSaldo: 'Seu saldo líquido (reais de hoje)',
    rotuloInvestido: 'Total que você investiu (reais de hoje)',
    pontos,
    legenda,
    descricao: `${legenda} Gráfico de linhas de 0 a ${textoDuracao(prazoMeses)}; os mesmos números estão na tabela ano a ano.`,
  };
}

// `campos` traz o texto como o usuário digitou:
//   modo, meta, valorInicial, aporte, prazo, prazoUnidade ('anos'|'meses'),
//   rentabilidade, rentabilidadeTipo ('nominal'|'ipca_mais'), regime,
//   inflacao, reajustar (booleano), reajuste (vazio = igual à inflação), mesInicio,
//   variacao (pontos percentuais dos cenários, de 0 a 10).
export function processar(campos) {
  const erros = {};
  const modo = campos.modo ?? 'aportar';
  if (!MODOS.includes(modo)) erros.modo = 'Escolha uma das opções.';

  const precisaMeta = modo === 'aportar' || modo === 'tempo';
  const precisaAporte = modo === 'final' || modo === 'tempo';
  const precisaPrazo = modo === 'aportar' || modo === 'final';

  const meta = precisaMeta
    ? lerCampo(campos, erros, 'meta', { minimo: 0.01, minimoMensagem: 'A meta precisa ser maior que zero.' })
    : null;
  const valorInicial = lerCampo(campos, erros, 'valorInicial');
  const aporte = precisaAporte ? lerCampo(campos, erros, 'aporte') : 0;

  let prazoMeses = PRAZO_MAXIMO_TEMPO_MESES;
  if (precisaPrazo) {
    const emAnos = (campos.prazoUnidade ?? 'anos') === 'anos';
    const prazo = lerCampo(campos, erros, 'prazo', {
      inteiro: true,
      minimo: 1,
      minimoMensagem: 'O prazo precisa ser de pelo menos 1.',
      max: emAnos ? PRAZO_MAXIMO_ANOS : PRAZO_MAXIMO_ANOS * 12,
      maxMensagem: `O prazo máximo é de ${PRAZO_MAXIMO_ANOS} anos (${PRAZO_MAXIMO_ANOS * 12} meses).`,
    });
    prazoMeses = prazo === null ? null : (emAnos ? prazo * 12 : prazo);
  }

  const rentabilidade = lerCampo(campos, erros, 'rentabilidade', {
    max: 100,
    maxMensagem: 'Use uma rentabilidade de até 100% ao ano.',
  });
  const inflacaoPct = lerCampo(campos, erros, 'inflacao', {
    max: 100,
    maxMensagem: 'Use uma inflação de até 100% ao ano.',
  });

  const reajustar = Boolean(campos.reajustar);
  let reajustePct = 0;
  if (reajustar) {
    const vazio = campos.reajuste === undefined || String(campos.reajuste).trim() === '';
    if (vazio) {
      reajustePct = inflacaoPct; // acompanha a inflação
    } else {
      reajustePct = lerCampo(campos, erros, 'reajuste', {
        max: 100,
        maxMensagem: 'Use um reajuste de até 100% ao ano.',
      });
    }
  }

  const variacao = lerCampo({ variacao: campos.variacao ?? VARIACAO_CENARIOS_PADRAO }, erros, 'variacao', {
    max: VARIACAO_CENARIOS_MAXIMA,
    maxMensagem: `Use uma variação de até ${VARIACAO_CENARIOS_MAXIMA} pontos percentuais.`,
  });

  const regime = campos.regime ?? 'isento';
  if (!REGIMES.includes(regime)) erros.regime = 'Escolha um tipo de tributação da lista.';

  let mesInicio = mesSeguinteAoAtual();
  if (campos.mesInicio !== undefined && String(campos.mesInicio).trim() !== '') {
    const m = lerNumero(campos.mesInicio);
    if (m === null || !Number.isInteger(m) || m < 1 || m > 12) {
      erros.mesInicio = 'Escolha um mês de 1 a 12.';
    } else {
      mesInicio = m;
    }
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros, erroGeral: null, ...RESULTADO_VAZIO };

  const inflacaoAnual = inflacaoPct / 100;
  const reajusteAnual = reajustar ? reajustePct / 100 : 0;
  const tipoRentabilidade = campos.rentabilidadeTipo === 'ipca_mais' ? 'ipca_mais' : 'nominal';
  const paraTaxaNominal = (pct) => (tipoRentabilidade === 'ipca_mais'
    ? taxaNominalDeIpcaMais(inflacaoAnual, pct / 100)
    : pct / 100);
  const retornoAnual = paraTaxaNominal(rentabilidade);

  const base = { valorInicial, aporteInicial: aporte, retornoAnual, inflacaoAnual, reajusteAnual, regime, mesInicio };
  const falha = (erroGeral) => ({ ok: false, erros: {}, erroGeral, ...RESULTADO_VAZIO });

  const solucao = resolverModo(modo, meta, base, prazoMeses);
  if (solucao === null) {
    return falha(modo === 'aportar'
      ? 'Com esses números a meta não é alcançável. Tente aumentar o prazo ou a rentabilidade.'
      : 'Com esses números você não chega à meta em 100 anos. Tente aumentar o aporte, o valor inicial ou a rentabilidade.');
  }
  const { aporteInicial, meses } = solucao;

  let destaque;
  let valorDestaque = null; // trecho da frase que a tela realça
  if (modo === 'aportar') {
    if (aporteInicial === 0) {
      destaque = 'Com o que você já tem investido, você alcança a meta sem novos aportes.';
    } else if (reajusteAnual > 0) {
      valorDestaque = moeda(aporteInicial);
      destaque = `Você precisa aportar ${moeda(aporteInicial)} no primeiro mês, reajustado em ${percentual(reajusteAnual * 100)} ao ano`;
    } else {
      valorDestaque = moeda(aporteInicial);
      destaque = `Você precisa aportar ${moeda(aporteInicial)} por mês`;
    }
  } else if (modo === 'tempo') {
    if (meses > 0) valorDestaque = textoDuracao(meses);
    destaque = meses === 0
      ? 'Você já atingiu a meta com o que tem investido.'
      : `Você chega lá em ${textoDuracao(meses)}`;
  }

  const serie = simular({ ...base, aporteInicial, prazoMeses: meses });
  if (modo === 'final') {
    valorDestaque = moeda(serie.resumo.liquidoReal);
    destaque = `Você terá ${moeda(serie.resumo.liquidoReal)} em reais de hoje, já descontado o imposto`;
  }

  // Cascata: mesma simulação, sem imposto (regime isento) e sem inflação.
  const brutoSemImposto = simular({ ...base, aporteInicial, prazoMeses: meses, regime: 'isento' }).resumo.brutoNominal;

  // Cenários: rentabilidade informada -X, a informada e +X pontos percentuais (piso em 0).
  const cenarios = [
    ['Conservador', Math.max(0, rentabilidade - variacao)],
    ['Base', rentabilidade],
    ['Otimista', rentabilidade + variacao],
  ].map(([nome, pct]) => montarCenario(
    nome, modo, tipoRentabilidade, pct, paraTaxaNominal(pct), meta,
    { ...base, retornoAnual: paraTaxaNominal(pct) }, prazoMeses,
  ));

  return {
    ok: true,
    erros: {},
    erroGeral: null,
    destaque,
    valorDestaque,
    avisos: avisosDeTributacao(regime, meses),
    linhas: montarLinhasApoio(serie.resumo),
    tabela: montarTabela(serie, meses),
    cascata: montarCascata(serie.resumo, brutoSemImposto),
    cenarios,
    grafico: montarGrafico(serie, meses),
    numeros: {
      modo,
      aporteInicial,
      prazoMeses: meses,
      retornoAnual,
      inflacaoAnual,
      reajusteAnual,
      ...serie.resumo,
    },
  };
}
