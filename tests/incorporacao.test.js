// Funções puras da incorporação em iframe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ehModoIncorporado, mensagemDeAltura, TIPO_MENSAGEM_ALTURA } from '../docs/js/incorporacao.js';

test('modo incorporado só com embed=1', () => {
  assert.equal(ehModoIncorporado('?embed=1'), true);
  assert.equal(ehModoIncorporado('embed=1'), true);
  assert.equal(ehModoIncorporado('?a=2&embed=1'), true);
  assert.equal(ehModoIncorporado('?embed=1&a=2'), true);
  assert.equal(ehModoIncorporado(''), false);
  assert.equal(ehModoIncorporado(undefined), false);
  assert.equal(ehModoIncorporado('?embed=0'), false);
  assert.equal(ehModoIncorporado('?embed=10'), false);
  assert.equal(ehModoIncorporado('?embedded=1'), false);
});

test('mensagem de altura leva só o tipo e a altura, arredondada para cima', () => {
  const m = mensagemDeAltura(1234.2);
  assert.deepEqual(m, { tipo: 'carteiraz-simulador-altura', altura: 1235 });
  assert.equal(m.tipo, TIPO_MENSAGEM_ALTURA);
  assert.deepEqual(Object.keys(m).sort(), ['altura', 'tipo']);
});

test('página: noindex com comentário, .nojekyll e rodapé fora do que o modo incorporado esconde', () => {
  const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
  assert.match(html, /<!-- Remover no lançamento oficial\. -->\s*<meta name="robots" content="noindex, nofollow">/);
  const css = readFileSync(new URL('../docs/css/estilo.css', import.meta.url), 'utf8');
  assert.match(css, /\.embutido \.topo, \.embutido \.hero \{ display: none; \}/);
  assert.ok(!/\.embutido[^{]*\.rodape/.test(css), 'o rodapé não pode ser escondido no modo incorporado');
  assert.doesNotThrow(() => readFileSync(new URL('../docs/.nojekyll', import.meta.url)));
});
