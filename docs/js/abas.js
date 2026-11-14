// Abas da página (puro, sem DOM): quais existem e qual abre primeiro.
export const ABAS = Object.freeze(['juntar', 'renda']);

// `?aba=renda` (em qualquer posição da busca) abre a aba "Viver de renda".
// Qualquer outro valor, ou a ausência do parâmetro, abre a aba da fase 1.
export function abaInicial(busca) {
  const aba = new URLSearchParams(busca ?? '').get('aba');
  return ABAS.includes(aba) ? aba : 'juntar';
}
