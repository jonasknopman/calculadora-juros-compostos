// Motor de cálculo puro (sem DOM, sem rede). Reproduz referencia/motor_referencia.py.
// Em cada mês: (1) o saldo rende; (2) come-cotas, se aplicável; (3) entra o aporte, no fim do mês.
import {
  REGIMES,
  ALIQUOTA_LONGO_PRAZO,
  ehMesDeComeCotas,
} from './tributacao.js';

export const ITERACOES_MAXIMAS_BISSECAO = 100;
export const PRECISAO_BISSECAO = 1e-7;

export const PARAMETROS_PADRAO = Object.freeze({
  valorInicial: 0,
  aporteInicial: 0,
  prazoMeses: 240,
  retornoAnual: 0.11, // taxa nominal efetiva anual
  inflacaoAnual: 0,
  reajusteAnual: 0, // reajuste anual do aporte
  regime: 'isento',
  mesInicio: 1, // mês do calendário (1-12) do mês 1
  aliquotaComeCotas: ALIQUOTA_LONGO_PRAZO,
});

// Chaves com valor `undefined` não sobrescrevem o padrão.
function completar(p) {
  const definidos = Object.fromEntries(
    Object.entries(p).filter(([, valor]) => valor !== undefined),
  );
  return { ...PARAMETROS_PADRAO, ...definidos };
}

export function taxaMensal(taxaAnual) {
  return Math.pow(1 + taxaAnual, 1 / 12) - 1;
}

// "IPCA + x%" -> taxa nominal efetiva anual.
export function taxaNominalDeIpcaMais(inflacao, real) {
  return (1 + inflacao) * (1 + real) - 1;
}

function impostoSeResgatar(p, saldo, investido, custoFiscal) {
  switch (p.regime) {
    case 'isento':
      return 0;
    case 'resgate_15':
      return ALIQUOTA_LONGO_PRAZO * Math.max(0, saldo - investido);
    default: // come_cotas: só o ganho desde o último come-cotas
      return ALIQUOTA_LONGO_PRAZO * Math.max(0, saldo - custoFiscal);
  }
}

export function simular(entrada) {
  const p = completar(entrada);
  if (!REGIMES.includes(p.regime)) throw new Error(`regime inválido: ${p.regime}`);
  const i = taxaMensal(p.retornoAnual);

  let saldo = p.valorInicial;
  let custoFiscal = p.valorInicial; // base do come-cotas
  let investido = p.valorInicial;
  let investidoReal = p.valorInicial; // cada aporte deflacionado na própria data
  let comeCotasPagos = 0;

  const bruto = [saldo];
  const investidoSerie = [investido];
  const investidoRealSerie = [investidoReal];
  const imposto = [0];
  const liquido = [saldo];
  const liquidoReal = [saldo];
  const brutoReal = [saldo];

  for (let k = 1; k <= p.prazoMeses; k++) {
    // 1) rendimento
    saldo *= 1 + i;

    // 2) come-cotas
    if (p.regime === 'come_cotas') {
      const mesCalendario = ((p.mesInicio - 1 + k - 1) % 12) + 1;
      if (ehMesDeComeCotas(mesCalendario)) {
        const imp = p.aliquotaComeCotas * Math.max(0, saldo - custoFiscal);
        saldo -= imp;
        custoFiscal = saldo;
        comeCotasPagos += imp;
      }
    }

    // 3) aporte no fim do mês
    const aporte = p.aporteInicial * Math.pow(1 + p.reajusteAnual, Math.floor((k - 1) / 12));
    const deflator = Math.pow(1 + p.inflacaoAnual, k / 12);
    if (aporte > 0) {
      saldo += aporte;
      custoFiscal += aporte;
      investido += aporte;
      investidoReal += aporte / deflator;
    }

    const impK = impostoSeResgatar(p, saldo, investido, custoFiscal);
    bruto.push(saldo);
    investidoSerie.push(investido);
    investidoRealSerie.push(investidoReal);
    imposto.push(impK);
    liquido.push(saldo - impK);
    liquidoReal.push((saldo - impK) / deflator);
    brutoReal.push(saldo / deflator);
  }

  const n = p.prazoMeses;
  const resumo = {
    brutoNominal: bruto[n],
    investidoNominal: investidoSerie[n],
    investidoReal: investidoRealSerie[n],
    impostoResgate: imposto[n],
    comeCotasPagos,
    liquidoNominal: liquido[n],
    liquidoReal: liquidoReal[n],
    brutoReal: brutoReal[n],
    deflator: Math.pow(1 + p.inflacaoAnual, n / 12),
  };
  return {
    bruto,
    investido: investidoSerie,
    investidoReal: investidoRealSerie,
    imposto,
    liquido,
    liquidoReal,
    brutoReal,
    resumo,
  };
}

// Menor aporte inicial que entrega `alvoLiquidoReal` (reais de hoje, líquido) ao fim do prazo. Bisseção.
export function resolverAporte(alvoLiquidoReal, entrada) {
  const p = completar(entrada);
  const f = (aporteInicial) => simular({ ...p, aporteInicial }).resumo.liquidoReal;

  if (f(0) >= alvoLiquidoReal) return 0;
  let lo = 0;
  let hi = Math.max(1, alvoLiquidoReal);
  while (f(hi) < alvoLiquidoReal) {
    hi *= 2;
    if (hi > 1e12) throw new Error('meta inalcançável');
  }
  for (let iteracao = 0; iteracao < ITERACOES_MAXIMAS_BISSECAO && hi - lo >= PRECISAO_BISSECAO; iteracao++) {
    const meio = (lo + hi) / 2;
    if (f(meio) < alvoLiquidoReal) lo = meio;
    else hi = meio;
  }
  return hi;
}

// Menor número de meses para atingir `alvoLiquidoReal`; null se não atingir em `maxMeses`.
export function resolverPrazo(alvoLiquidoReal, entrada, maxMeses = 1200) {
  const serie = simular({ ...completar(entrada), prazoMeses: maxMeses }).liquidoReal;
  for (let k = 0; k < serie.length; k++) {
    if (serie[k] >= alvoLiquidoReal) return k;
  }
  return null;
}
