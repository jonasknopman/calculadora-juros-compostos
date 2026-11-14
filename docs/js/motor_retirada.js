// Motor da fase 2 (Viver de renda), puro (sem DOM, sem rede). Reproduz referencia/motor_retirada.py.
// Em cada mês: (1) retirada líquida no começo do mês; (2) rendimento; (3) come-cotas em maio e novembro.
import {
  REGIMES,
  ALIQUOTA_LONGO_PRAZO,
  ehMesDeComeCotas,
} from './tributacao.js';
import { taxaMensal } from './motor.js';

export const LIMITE_MESES_RETIRADA = 1200; // 100 anos
export const ITERACOES_MAXIMAS_BISSECAO_RETIRADA = 200;
export const PRECISAO_BISSECAO_RETIRADA = 1e-7;
const TETO_VALOR = 1e15;

export const PARAMETROS_PADRAO_RETIRADA = Object.freeze({
  valorInicial: 0,
  retirada: 0, // líquida, em reais de hoje
  prazoMeses: 240,
  retornoAnual: 0.11, // taxa nominal efetiva anual
  inflacaoAnual: 0,
  regime: 'isento',
  mesInicio: 1, // mês do calendário (1-12) do mês 1
});

// Chaves com valor `undefined` não sobrescrevem o padrão.
function completar(p) {
  const definidos = Object.fromEntries(
    Object.entries(p).filter(([, valor]) => valor !== undefined),
  );
  return { ...PARAMETROS_PADRAO_RETIRADA, ...definidos };
}

function validarRegime(p) {
  if (!REGIMES.includes(p.regime)) throw new Error(`regime inválido: ${p.regime}`);
}

// Simula até `maxMeses`. `serie` vai só até o último mês concluído; índice 0 = estado inicial.
export function simularRetirada(entrada, maxMeses = LIMITE_MESES_RETIRADA) {
  const p = completar(entrada);
  validarRegime(p);
  const rm = taxaMensal(p.retornoAnual);

  let saldo = p.valorInicial; // saldo bruto nominal
  let base = p.valorInicial; // custo fiscal (valor juntado é todo principal)
  let duracao = 0;
  let esgotou = false;

  const saldoBruto = [saldo];
  const saldoLiquido = [saldo];
  const saldoLiquidoReal = [saldo];
  const retiradaLiquidaNominal = [0];
  const retiradaBruta = [0];
  const impostoMes = [0];

  for (let k = 1; k <= maxMeses; k++) {
    const yk = p.retirada * Math.pow(1 + p.inflacaoAnual, (k - 1) / 12);

    // 1) retirada no começo do mês
    let g;
    if (p.regime === 'isento') {
      g = yk;
    } else {
      const fracaoGanho = saldo > 0 ? Math.max(0, (saldo - base) / saldo) : 0;
      g = yk / (1 - ALIQUOTA_LONGO_PRAZO * fracaoGanho);
    }
    if (g > saldo) {
      esgotou = true;
      break;
    }
    const impostoRetirada = g - yk;

    // 2) saldo e base
    if (p.regime !== 'isento' && saldo > 0) base *= 1 - g / saldo;
    saldo -= g;

    // 3) rendimento
    saldo *= 1 + rm;

    // 4) come-cotas
    let impostoComeCotas = 0;
    if (p.regime === 'come_cotas') {
      const mesCalendario = ((p.mesInicio - 1 + k - 1) % 12) + 1;
      if (ehMesDeComeCotas(mesCalendario)) {
        impostoComeCotas = ALIQUOTA_LONGO_PRAZO * Math.max(0, saldo - base);
        saldo -= impostoComeCotas;
        base = saldo;
      }
    }

    duracao = k;
    const impostoResgateTotal = p.regime === 'isento' ? 0 : ALIQUOTA_LONGO_PRAZO * Math.max(0, saldo - base);
    const liquido = saldo - impostoResgateTotal;
    saldoBruto.push(saldo);
    saldoLiquido.push(liquido);
    saldoLiquidoReal.push(liquido / Math.pow(1 + p.inflacaoAnual, k / 12));
    retiradaLiquidaNominal.push(yk);
    retiradaBruta.push(g);
    impostoMes.push(impostoRetirada + impostoComeCotas);
  }

  return {
    duracao,
    esgotou,
    serie: { saldoBruto, saldoLiquido, saldoLiquidoReal, retiradaLiquidaNominal, retiradaBruta, impostoMes },
  };
}

// Modo 1. `esgotou: false` com meses = 1200 significa "não se esgota".
export function duracaoDoDinheiro(entrada) {
  const r = simularRetirada(entrada);
  return { meses: r.duracao, esgotou: r.esgotou };
}

function duraAoMenos(p, prazoMeses) {
  return simularRetirada(p, prazoMeses).duracao >= prazoMeses;
}

// Modo 2: menor valor inicial que sustenta a retirada pelo prazo. Bisseção.
export function valorNecessario(entrada) {
  const p = completar(entrada);
  validarRegime(p);
  if (p.retirada <= 0) return 0;
  const ok = (valorInicial) => duraAoMenos({ ...p, valorInicial }, p.prazoMeses);

  let lo = 0;
  let hi = p.retirada * p.prazoMeses;
  while (!ok(hi)) {
    lo = hi;
    hi *= 2;
    if (hi > TETO_VALOR) throw new Error('valor inalcançável');
  }
  for (let i = 0; i < ITERACOES_MAXIMAS_BISSECAO_RETIRADA && hi - lo >= PRECISAO_BISSECAO_RETIRADA; i++) {
    const meio = (lo + hi) / 2;
    if (ok(meio)) hi = meio;
    else lo = meio;
  }
  return hi;
}

// Modo 3: maior retirada mensal (líquida, reais de hoje) que o valor inicial sustenta pelo prazo. Bisseção.
export function retiradaPossivel(entrada) {
  const p = completar(entrada);
  validarRegime(p);
  if (p.valorInicial <= 0) return 0;
  const ok = (retirada) => duraAoMenos({ ...p, retirada }, p.prazoMeses);

  let lo = 0;
  let hi = p.valorInicial;
  while (ok(hi)) {
    lo = hi;
    hi *= 2;
    if (hi > TETO_VALOR) throw new Error('valor inalcançável');
  }
  for (let i = 0; i < ITERACOES_MAXIMAS_BISSECAO_RETIRADA && hi - lo >= PRECISAO_BISSECAO_RETIRADA; i++) {
    const meio = (lo + hi) / 2;
    if (ok(meio)) lo = meio;
    else hi = meio;
  }
  return lo;
}
