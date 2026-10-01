// Regimes de tributação, alíquotas e textos. Único lugar do projeto com números de imposto.
// Decisão de produto: todo investimento é tratado como de prazo superior a 2 anos.

export const REGIMES = Object.freeze(['isento', 'resgate_15', 'come_cotas']);

export const ALIQUOTA_LONGO_PRAZO = 0.15;

// Come-cotas: meses do calendário (1-12) em que o imposto é cobrado.
export const MESES_COME_COTAS = Object.freeze([5, 11]);

// Prazos até este limite (em meses) têm alíquota real maior que a simulada.
export const PRAZO_CURTO_MAXIMO_MESES = 24;

export const AVISO_PRAZO_CURTO = 'Para prazos de até 2 anos, o imposto real costuma ser maior, de 17,5% a 22,5% sobre o ganho. Esta simulação usa 15%, então o resultado pode estar um pouco otimista.';

// Texto exibido ao usuário: `rotulo` e `descricao` (mostrada abaixo da lista).
export const PRESETS = Object.freeze([
  {
    regime: 'isento',
    rotulo: 'Isento de imposto (fundos de debêntures incentivadas, LCI e LCA)',
    selo: 'Isento',
    descricao: 'Debêntures incentivadas, LCI e LCA: sem imposto de renda para pessoa física.',
  },
  {
    regime: 'resgate_15',
    rotulo: 'Só no resgate, 15% (FIDCs, previdência VGBL e fundos de ações)',
    selo: 'Só no resgate',
    descricao: 'CDB, Tesouro, FIDCs, previdência VGBL, fundos de ações e outras aplicações sem come-cotas: 15% sobre o ganho, cobrados só quando você resgata. Vale para aplicações mantidas por mais de 2 anos. Na previdência VGBL, a simulação usa 15% sobre o ganho; é uma aproximação (a tabela regressiva da previdência chega a 10% após 10 anos). Não vale para o PGBL, em que o imposto incide sobre o valor total resgatado.',
  },
  {
    regime: 'come_cotas',
    rotulo: 'Come-cotas (fundos de renda fixa e multimercados)',
    selo: 'Come-cotas',
    descricao: 'Fundos de renda fixa e multimercado abertos: em maio e novembro o fundo desconta 15% do rendimento do período, e o restante no resgate.',
  },
]);

export function ehMesDeComeCotas(mesCalendario) {
  return MESES_COME_COTAS.includes(mesCalendario);
}

// Avisos de tributação para o prazo do resultado; vazio se nada a avisar.
export function avisosDeTributacao(regime, prazoMeses) {
  if (regime !== 'isento' && prazoMeses <= PRAZO_CURTO_MAXIMO_MESES) return [AVISO_PRAZO_CURTO];
  return [];
}
