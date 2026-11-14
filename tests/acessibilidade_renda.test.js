// Verificações estáticas de acessibilidade no HTML e no CSS (aba "Viver de renda" e botão "?" das duas abas).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../docs/css/estilo.css', import.meta.url), 'utf8');
const painel = html.slice(html.indexOf('id="painel-renda"'), html.indexOf('</main>'));
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const atributos = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const tags = (re) => [...painel.matchAll(re)].map((m) => ({ texto: m[0], attr: atributos(m[0]) }));

test('todo campo de texto, lista e opção do painel tem rótulo associado', () => {
  const campos = tags(/<(?:input|select)\b[^>]*>/g).filter((c) => c.attr.type !== 'radio' && c.attr.type !== 'checkbox');
  assert.ok(campos.length >= 7);
  for (const { attr } of campos) {
    const porFor = attr.id && new RegExp(`<label[^>]*\\sfor="${attr.id}"`).test(painel);
    assert.ok(porFor || attr['aria-label'], `campo ${attr.name ?? attr.id} sem rótulo`);
  }
  // radios: cada um dentro de um <label>
  const radios = painel.match(/<label[^>]*>\s*<input type="radio"[^>]*>/g) ?? [];
  assert.equal(radios.length, 3, 'as três opções de modo ficam dentro de <label>');
});

test('todo aria-describedby e aria-labelledby do painel aponta para id existente', () => {
  for (const [, valor] of painel.matchAll(/aria-(?:describedby|labelledby)="([^"]+)"/g)) {
    for (const id of valor.split(/\s+/)) assert.ok(ids.has(id), `id ${id} não existe`);
  }
});

test('cada campo com mensagem de erro liga o campo ao erro por aria-describedby', () => {
  for (const [, nome] of painel.matchAll(/id="erro-renda-([\w]+)"/g)) {
    if (nome === 'regime') continue; // o grupo de opções aponta para o erro pelo fieldset
    const campo = tags(/<(?:input|select)\b[^>]*>/g).find((c) => c.attr.name === nome);
    assert.ok(campo, `campo ${nome} não encontrado`);
    assert.ok(campo.attr['aria-describedby'].split(/\s+/).includes(`erro-renda-${nome}`), nome);
  }
  assert.match(painel, /<fieldset[^>]*id="campo-regime-renda"[^>]*aria-describedby="[^"]*erro-renda-regime/);
});

test('mensagens de erro e destaque são regiões "polite"', () => {
  for (const id of ['destaque-renda', 'erro-geral-renda']) {
    assert.match(painel, new RegExp(`id="${id}"[^>]*aria-live="polite"`), id);
  }
  for (const { texto } of tags(/<p class="erro"[^>]*>/g)) assert.match(texto, /aria-live="polite"/);
});

test('todo botão "?" (das duas abas) tem aria-label, aria-controls e aria-expanded', () => {
  const botoes = [...html.matchAll(/<button[^>]*class="dica-botao"[^>]*>/g)].map((m) => atributos(m[0]));
  assert.ok(botoes.length >= 19);
  for (const b of botoes) {
    assert.ok(b['aria-label'] && b['aria-label'].length > 3);
    assert.ok(b['aria-controls'] && ids.has(b['aria-controls']));
    assert.equal(b['aria-expanded'], 'false');
    assert.equal(b.type, 'button');
  }
});

test('grupos de opções têm <legend>; as opções avançadas usam <details> com <summary>', () => {
  for (const fieldset of painel.match(/<fieldset[\s\S]*?<\/fieldset>/g)) assert.match(fieldset, /<legend>/);
  assert.match(painel, /<details class="avancadas" id="avancadas-renda">\s*<summary>/);
});

test('o canvas do gráfico tem role="img" e aria-label (preenchido pela interface)', () => {
  assert.match(painel, /<canvas id="grafico-evolucao-renda" role="img" aria-label="">/);
  const ui = readFileSync(new URL('../docs/js/graficos_retirada.js', import.meta.url), 'utf8');
  assert.match(ui, /canvas\.setAttribute\('aria-label', grafico\.descricao\)/);
});

test('a tabela fica numa região rolável focável, com nome', () => {
  assert.match(painel, /<div class="tabela-rolavel" id="rolavel-renda" tabindex="0" role="region" aria-labelledby="titulo-tabela-renda">/);
});

test('abas: tablist, tabindex itinerante inicial e painéis ligados', () => {
  assert.match(html, /role="tablist"/);
  assert.match(html, /id="aba-juntar"[^>]*aria-selected="true"/);
  assert.match(html, /id="aba-renda"[^>]*aria-selected="false" tabindex="-1"/);
});

test('CSS: foco visível global e área de toque de 44 x 44 px no botão "?"', () => {
  assert.match(css, /:focus-visible \{ outline: 2px solid/);
  assert.match(css, /\.dica-botao \{ position: relative; \}/);
  const regra = css.match(/\.dica-botao::after \{([^}]*)\}/);
  assert.ok(regra, 'falta a regra .dica-botao::after');
  const px = (propriedade) => Number(regra[1].match(new RegExp(`${propriedade}:\\s*(-?\\d+)px`))[1]);
  const altura = 28 - px('top') - px('bottom');
  const largura = 28 - px('left') - px('right');
  assert.ok(altura >= 44, `altura da área de toque: ${altura}`);
  assert.ok(largura >= 44, `largura da área de toque: ${largura}`);
  // não pode invadir o espaço do campo seguinte: abaixo, no máximo a margem de 6 px do rótulo
  assert.ok(-px('bottom') <= 6);
  assert.ok(-px('left') <= 8);
});
