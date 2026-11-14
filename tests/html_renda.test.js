// Estrutura da aba "Viver de renda" (etapa 4): opções avançadas, cenários e gráfico em docs/index.html.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const painelRenda = html.slice(html.indexOf('id="painel-renda"'), html.indexOf('</main>'));
const avancadas = painelRenda.slice(painelRenda.indexOf('id="avancadas-renda"'), painelRenda.indexOf('</details>'));

const atributos = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

test('todo id continua único', () => {
  const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual([...new Set(repetidos)], []);
});

test('as opções avançadas existem dentro de #avancadas-renda, recolhidas por padrão', () => {
  assert.match(painelRenda, /<details class="avancadas" id="avancadas-renda">/);
  assert.ok(!/<details[^>]*id="avancadas-renda"[^>]*\sopen/.test(painelRenda));
  assert.match(avancadas, /<summary>Opções avançadas<\/summary>/);
  assert.match(avancadas, /<input[^>]*name="inflacao"[^>]*value="4,5"/);
  assert.match(avancadas, /<select[^>]*name="mesInicio"/);
  assert.match(avancadas, /<input[^>]*name="variacao"[^>]*value="2"/);
  for (const campo of ['inflacao', 'mesInicio', 'variacao']) {
    assert.ok(ids.includes(`erro-renda-${campo}`), `falta erro-renda-${campo}`);
    assert.match(avancadas, new RegExp(`id="erro-renda-${campo}"`));
  }
});

test('cada botão "?" do painel aponta para uma dica existente e escondida', () => {
  const botoes = [...painelRenda.matchAll(/<button[^>]*class="dica-botao"[^>]*>/g)].map((m) => atributos(m[0]));
  assert.ok(botoes.length >= 8);
  const alvos = botoes.map((b) => b['aria-controls']);
  assert.equal(new Set(alvos).size, alvos.length, 'dicas repetidas');
  for (const botao of botoes) {
    const tag = painelRenda.match(new RegExp(`<p[^>]*id="${botao['aria-controls']}"[^>]*>`));
    assert.ok(tag, `dica ${botao['aria-controls']} não existe`);
    assert.ok(/\shidden[\s>]/.test(tag[0]));
    assert.equal(botao['aria-expanded'], 'false');
  }
  // as três dicas das opções avançadas
  assert.equal([...avancadas.matchAll(/class="dica-botao"/g)].length, 3);
});

test('o painel tem os cartões de cenários e de evolução, e o canvas do gráfico com role="img"', () => {
  assert.match(painelRenda, /<section class="cartao" id="cartao-cenarios-renda"/);
  assert.match(painelRenda, /id="cenarios-renda"/);
  assert.match(painelRenda, /<section class="cartao" id="cartao-evolucao-renda"/);
  assert.match(painelRenda, /<canvas id="grafico-evolucao-renda" role="img" aria-label="">/);
  assert.match(painelRenda, /<figcaption id="legenda-evolucao-renda">/);
  // ordem: resultado, cenários, evolução, tabela
  const ordem = ['id="resultado-renda"', 'id="cartao-cenarios-renda"', 'id="cartao-evolucao-renda"', 'id="cartao-tabela-renda"']
    .map((trecho) => painelRenda.indexOf(trecho));
  assert.ok(ordem.every((v) => v > 0));
  assert.deepEqual([...ordem].sort((a, b) => a - b), ordem);
});

test('noindex e scripts continuam; CSS solta o formulário fixo com as opções abertas', () => {
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  for (const js of ['ui.js', 'ui_retirada.js', 'ui_abas.js']) {
    assert.match(html, new RegExp(`<script type="module" src="js/${js}"></script>`));
  }
  const css = readFileSync(new URL('../docs/css/estilo.css', import.meta.url), 'utf8');
  assert.match(css, /#formulario-renda:has\(#avancadas-renda\[open\]\)/);
});
