// Funções puras de incorporação (iframe): modo incorporado e mensagem de altura.

export const TIPO_MENSAGEM_ALTURA = 'carteiraz-simulador-altura';

// `?embed=1` (em qualquer posição da busca) liga o modo incorporado.
export function ehModoIncorporado(busca) {
  return new URLSearchParams(busca ?? '').get('embed') === '1';
}

// A mensagem leva só a altura do conteúdo, nenhum dado do usuário.
export function mensagemDeAltura(altura) {
  return { tipo: TIPO_MENSAGEM_ALTURA, altura: Math.ceil(altura) };
}
