// Camada pura entre o formulário "Viver de renda" e o motor de retirada: lê e valida
// texto, chama o motor e devolve tudo que a tela mostra. Sem DOM.
import {
  duracaoDoDinheiro,
  valorNecessario,
  retiradaPossivel,
  simularRetirada,
} from './motor_retirada.js';
import { taxaNominalDeIpcaMais } from './motor.js';
import { REGIMES, avisosDeTributacao, AVISO_VALOR_JUNTADO } from './tributacao.js';
import {
  lerNumero,
  lerCampo,
  moeda,
  textoDuracao,
  mesSeguinteAoAtual,
  INFLACAO_PADRAO,
  abreviarMoeda,
} from './entrada.js';

export const MODOS_RETIRADA = Object.freeze(['duracao', 'valor', 'retirada']);
export const PRAZO_MAXIMO_RETIRADA_MESES = 1200; // 100 anos
export const HORIZONTE_TABELA_SEM_FIM_MESES = 360; // 30 anos
export const VALOR_INICIAL_MAXIMO = 1e12; // R$ 1 trilhão
export const RETIRADA_MAXIMA = 1e9; // R$ 1 bilhão

const MENSAGEM_INALCANCAVEL = 'Com esses números não foi possível calcular. Revise os valores.';
const NOTA_TABELA_LIMITADA = 'A tabela mostra os primeiros 30 anos.';

const RESULTADO_VAZIO = Object.freeze({
  destaque: null,
  valorDestaque: null,
  avisos: [],
  notas: [],
  linhas: [],
  tabela: [],
  notaTabela: '',
  numeros: null,
});

// Acima de R$ 1 milhão, a tabela do celular mostra a versão abreviada ("R$ 1,2 mi").
const LIMITE_VALOR_ABREVIADO = 1e6;
const moedaCurta = (valor) => (Math.abs(valor) >= LIMITE_VALOR_ABREVIADO ? abreviarMoeda(valor) : moeda(valor));

// Tabela anual. `serie` é a do motor (índice 0 = estado inicial). Em cada linha:
//  - bruto, liquido e liquidoReal são os saldos no fim do último mês da linha;
//  - retirado = soma da retirada líquida de cada mês, levada a reais de hoje;
//  - imposto = soma do imposto de cada mês (retirada + come-cotas), em reais de hoje.
// Na linha final parcial (resto em meses), retirado e imposto somam só os meses dela.
function montarTabelaRetirada(serie, horizonteMeses, inflacaoAnual) {
  const linhas = [];
  const fator = (expoente) => Math.pow(1 + inflacaoAnual, expoente);
  const linha = (rotulo, primeiroMes, ultimoMes) => {
    let retirado = 0;
    let imposto = 0;
    for (let k = primeiroMes; k <= ultimoMes; k++) {
      retirado += serie.retiradaLiquidaNominal[k] / fator((k - 1) / 12);
      imposto += serie.impostoMes[k] / fator(k / 12);
    }
    linhas.push({
      rotulo,
      retirado: moeda(retirado),
      imposto: moeda(imposto),
      bruto: moeda(serie.saldoBruto[ultimoMes]),
      liquido: moeda(serie.saldoLiquido[ultimoMes]),
      liquidoReal: moeda(serie.saldoLiquidoReal[ultimoMes]),
      retiradoCurto: moedaCurta(retirado),
      liquidoRealCurto: moedaCurta(serie.saldoLiquidoReal[ultimoMes]),
    });
  };
  const anos = Math.floor(horizonteMeses / 12);
  for (let ano = 1; ano <= anos; ano++) linha(String(ano), 12 * (ano - 1) + 1, 12 * ano);
  if (horizonteMeses % 12 !== 0) linha(textoDuracao(horizonteMeses), 12 * anos + 1, horizonteMeses);
  return linhas;
}

function impostoTotalEmReaisDeHoje(serie, horizonteMeses, inflacaoAnual) {
  let total = 0;
  for (let k = 1; k <= horizonteMeses; k++) total += serie.impostoMes[k] / Math.pow(1 + inflacaoAnual, k / 12);
  return total;
}

// `campos` traz o texto como o usuário digitou:
//   modo, valorInicial, retirada, prazo, prazoUnidade ('anos'|'meses'),
//   rentabilidade, rentabilidadeTipo ('nominal'|'ipca_mais'), regime,
//   e, opcionais: inflacao (padrão INFLACAO_PADRAO) e mesInicio (padrão: mês seguinte ao atual).
// Nunca lança exceção.
export function processarRetirada(campos) {
  const erros = {};
  const modo = campos.modo ?? 'duracao';
  if (!MODOS_RETIRADA.includes(modo)) erros.modo = 'Escolha uma das opções.';

  const precisaValor = modo === 'duracao' || modo === 'retirada';
  const precisaRetirada = modo === 'duracao' || modo === 'valor';
  const precisaPrazo = modo === 'valor' || modo === 'retirada';

  const valorInicial = precisaValor
    ? lerCampo(campos, erros, 'valorInicial', {
      minimo: 0.01,
      minimoMensagem: 'O valor investido precisa ser maior que zero.',
      max: VALOR_INICIAL_MAXIMO,
      maxMensagem: 'O valor investido máximo é R$ 1 trilhão.',
    })
    : null;
  const retirada = precisaRetirada
    ? lerCampo(campos, erros, 'retirada', {
      minimo: 0.01,
      minimoMensagem: 'A retirada precisa ser maior que zero.',
      max: RETIRADA_MAXIMA,
      maxMensagem: 'A retirada máxima é R$ 1 bilhão por mês.',
    })
    : null;

  let prazoMeses = null;
  if (precisaPrazo) {
    const emAnos = (campos.prazoUnidade ?? 'anos') === 'anos';
    const prazo = lerCampo(campos, erros, 'prazo', {
      inteiro: true,
      minimo: 1,
      minimoMensagem: 'O prazo precisa ser de pelo menos 1.',
      max: emAnos ? PRAZO_MAXIMO_RETIRADA_MESES / 12 : PRAZO_MAXIMO_RETIRADA_MESES,
      maxMensagem: `O prazo máximo é de ${PRAZO_MAXIMO_RETIRADA_MESES / 12} anos (${PRAZO_MAXIMO_RETIRADA_MESES} meses).`,
    });
    prazoMeses = prazo === null ? null : (emAnos ? prazo * 12 : prazo);
  }

  const rentabilidade = lerCampo(campos, erros, 'rentabilidade', {
    max: 100,
    maxMensagem: 'Use uma rentabilidade de até 100% ao ano.',
  });
  const inflacaoPct = lerCampo({ inflacao: campos.inflacao ?? INFLACAO_PADRAO }, erros, 'inflacao', {
    max: 100,
    maxMensagem: 'Use uma inflação de até 100% ao ano.',
  });

  const regime = campos.regime ?? 'isento';
  if (!REGIMES.includes(regime)) erros.regime = 'Escolha um tipo de tributação da lista.';

  let mesInicio = mesSeguinteAoAtual();
  if (campos.mesInicio !== undefined && campos.mesInicio !== null && String(campos.mesInicio).trim() !== '') {
    const m = lerNumero(campos.mesInicio);
    if (m === null || !Number.isInteger(m) || m < 1 || m > 12) {
      erros.mesInicio = 'Escolha um mês de 1 a 12.';
    } else {
      mesInicio = m;
    }
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros, erroGeral: null, ...RESULTADO_VAZIO };

  const inflacaoAnual = inflacaoPct / 100;
  const tipoRentabilidade = campos.rentabilidadeTipo === 'ipca_mais' ? 'ipca_mais' : 'nominal';
  const retornoAnual = tipoRentabilidade === 'ipca_mais'
    ? taxaNominalDeIpcaMais(inflacaoAnual, rentabilidade / 100)
    : rentabilidade / 100;
  const base = { retornoAnual, inflacaoAnual, regime, mesInicio };

  try {
    return calcular({ modo, valorInicial, retirada, prazoMeses, base });
  } catch {
    return { ok: false, erros: {}, erroGeral: MENSAGEM_INALCANCAVEL, ...RESULTADO_VAZIO };
  }
}

function calcular({ modo, valorInicial, retirada, prazoMeses, base }) {
  const { regime, inflacaoAnual, retornoAnual } = base;
  let x = valorInicial; // valor investido hoje
  let y = retirada; // retirada mensal líquida, em reais de hoje
  let meses; // duração do resultado
  let esgotou = true;
  let destaque;
  let valorDestaque = null; // trecho da frase que a tela realça

  if (modo === 'duracao') {
    const r = duracaoDoDinheiro({ ...base, valorInicial: x, retirada: y });
    meses = r.meses;
    esgotou = r.esgotou;
    if (!esgotou) {
      valorDestaque = 'não se esgota';
      destaque = 'Seu dinheiro não se esgota (mais de 100 anos)';
    } else if (meses === 0) {
      destaque = 'Seu dinheiro não chega a cobrir a primeira retirada.';
    } else {
      valorDestaque = textoDuracao(meses);
      destaque = `Seu dinheiro dura ${valorDestaque}`;
    }
  } else if (modo === 'valor') {
    // Arredonda para cima ao centavo: o valor mostrado, se digitado de volta, cumpre o prazo.
    x = Math.ceil(valorNecessario({ ...base, retirada: y, prazoMeses }) * 100) / 100;
    meses = prazoMeses;
    valorDestaque = moeda(x);
    destaque = `Você precisa ter ${valorDestaque} para retirar ${moeda(y)} por mês durante ${textoDuracao(meses)}`;
  } else {
    // Arredonda para baixo ao centavo, pelo mesmo motivo.
    y = Math.floor(retiradaPossivel({ ...base, valorInicial: x, prazoMeses }) * 100) / 100;
    meses = prazoMeses;
    valorDestaque = moeda(y);
    destaque = `Você pode retirar ${valorDestaque} por mês, em reais de hoje e já descontado o imposto, durante ${textoDuracao(meses)}`;
  }

  const semFim = !esgotou;
  const horizonte = semFim ? HORIZONTE_TABELA_SEM_FIM_MESES : meses;
  const { serie } = simularRetirada({ ...base, valorInicial: x, retirada: y }, horizonte);
  const totalRetirado = semFim ? null : meses * y;
  const impostoTotal = impostoTotalEmReaisDeHoje(serie, horizonte, inflacaoAnual);

  const linhas = [
    { rotulo: 'Valor investido hoje', valor: moeda(x) },
    { rotulo: 'Retirada mensal (reais de hoje, líquida)', valor: moeda(y) },
    { rotulo: 'Prazo', valor: semFim ? 'Mais de 100 anos' : textoDuracao(meses) },
  ];
  if (!semFim) linhas.push({ rotulo: 'Total retirado (reais de hoje)', valor: moeda(totalRetirado) });
  linhas.push({
    rotulo: semFim
      ? 'Imposto pago nos primeiros 30 anos (reais de hoje)'
      : 'Imposto pago ao longo do período (reais de hoje)',
    valor: moeda(impostoTotal),
  });

  return {
    ok: true,
    erros: {},
    erroGeral: null,
    destaque,
    valorDestaque,
    avisos: semFim ? [] : avisosDeTributacao(regime, meses),
    notas: regime === 'isento' ? [] : [AVISO_VALOR_JUNTADO],
    linhas,
    tabela: horizonte > 0 ? montarTabelaRetirada(serie, horizonte, inflacaoAnual) : [],
    notaTabela: semFim ? NOTA_TABELA_LIMITADA : '',
    numeros: {
      modo,
      valorInicial: x,
      retirada: y,
      meses,
      esgotou,
      retornoAnual,
      inflacaoAnual,
      totalRetirado,
      impostoTotal,
    },
  };
}
