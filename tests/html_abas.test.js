// Estrutura de docs/index.html: abas, painéis, ids únicos e referências que apontam para algo que existe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const existe = (id) => ids.includes(id);

// Fatia do HTML correspondente ao painel "Viver de renda".
const inicioRenda = html.indexOf('id="painel-renda"');
const fimRenda = html.indexOf('</main>');
const painelRenda = html.slice(inicioRenda, fimRenda);

function atributos(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
}

test('todos os id são únicos', () => {
  const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual([...new Set(repetidos)], []);
});

test('há um tablist com duas abas, e cada aba e painel apontam um para o outro', () => {
  assert.match(html, /<div class="abas" role="tablist" aria-label="Escolha o simulador">/);
  const abas = [...html.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map((m) => atributos(m[0]));
  assert.equal(abas.length, 2);
  for (const aba of abas) {
    assert.ok(existe(aba['aria-controls']), `painel ${aba['aria-controls']} não existe`);
    const painel = atributos(html.match(new RegExp(`<div[^>]*id="${aba['aria-controls']}"[^>]*>`))[0]);
    assert.equal(painel.role, 'tabpanel');
    assert.equal(painel['aria-labelledby'], aba.id);
  }
});

test('só a aba e o painel da fase 1 começam ativos', () => {
  const aba = (id) => atributos(html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`))[0]);
  const painel = (id) => html.match(new RegExp(`<div[^>]*id="${id}"[^>]*>`))[0];
  assert.equal(aba('aba-juntar')['aria-selected'], 'true');
  assert.equal(aba('aba-renda')['aria-selected'], 'false');
  assert.equal(aba('aba-renda').tabindex, '-1');
  assert.ok(!/\shidden[\s>]/.test(painel('painel-juntar')), 'painel da fase 1 deve começar visível');
  assert.ok(/\shidden[\s>]/.test(painel('painel-renda')), 'painel novo deve começar oculto');
});

test('painel novo: aria-controls, for e aria-describedby apontam para ids que existem', () => {
  assert.ok(painelRenda.length > 1000);
  const referencias = [];
  for (const m of painelRenda.matchAll(/aria-controls="([^"]+)"/g)) referencias.push(['aria-controls', m[1]]);
  for (const m of painelRenda.matchAll(/\sfor="([^"]+)"/g)) referencias.push(['for', m[1]]);
  for (const m of painelRenda.matchAll(/aria-describedby="([^"]+)"/g)) {
    for (const id of m[1].split(/\s+/)) referencias.push(['aria-describedby', id]);
  }
  for (const m of painelRenda.matchAll(/aria-labelledby="([^"]+)"/g)) referencias.push(['aria-labelledby', m[1]]);
  assert.ok(referencias.length > 10);
  for (const [tipo, id] of referencias) assert.ok(existe(id), `${tipo}="${id}" não existe`);
});

test('painel novo: todo botão de dica tem um texto de dica oculto', () => {
  const botoes = [...painelRenda.matchAll(/<button[^>]*class="dica-botao"[^>]*>/g)].map((m) => atributos(m[0]));
  assert.ok(botoes.length >= 5);
  for (const botao of botoes) {
    const alvo = botao['aria-controls'];
    const tag = painelRenda.match(new RegExp(`<p[^>]*id="${alvo}"[^>]*>`));
    assert.ok(tag, `dica ${alvo} não existe`);
    assert.match(tag[0], /class="dica-texto"/);
    assert.ok(/\shidden[\s>]/.test(tag[0]), `dica ${alvo} deve começar oculta`);
    assert.equal(botao['aria-expanded'], 'false');
  }
});

test('painel novo: ids com sufixo -renda ou prefixo renda (não repetem os da fase 1)', () => {
  const idsRenda = [...painelRenda.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of idsRenda) assert.match(id, /renda/, id);
});

test('noindex continua e os scripts estão presentes', () => {
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /<script type="module" src="js\/ui\.js"><\/script>/);
  assert.match(html, /<script type="module" src="js\/ui_retirada\.js"><\/script>/);
  assert.match(html, /<script type="module" src="js\/ui_abas\.js"><\/script>/);
  assert.ok(html.indexOf('js/ui.js') < html.indexOf('js/ui_retirada.js'));
});
