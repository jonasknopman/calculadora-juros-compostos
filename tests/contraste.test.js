// Razão de contraste WCAG entre os pares de cores declarados em docs/css/estilo.css.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../docs/css/estilo.css', import.meta.url), 'utf8');
const raiz = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));

function token(nome) {
  const m = raiz.match(new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})\\b`));
  assert.ok(m, `token --${nome} não encontrado em :root`);
  return m[1];
}

function luminancia(hex) {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canais.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function razaoDeContraste(a, b) {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

// [descrição, texto, fundo]
const PARES = [
  ['navy sobre bg (texto do corpo)', 'navy', 'bg'],
  ['navy sobre card (texto do corpo)', 'navy', 'card'],
  ['slate sobre card (texto secundário)', 'slate', 'card'],
  ['slate sobre card-alt (cabeçalho da tabela)', 'slate', 'card-alt'],
  ['green sobre green-lt (selo)', 'green', 'green-lt'],
  ['red sobre red-lt (aviso de erro)', 'red', 'red-lt'],
  ['amber sobre amber-lt (alerta)', 'amber', 'amber-lt'],
  ['azul-claro-texto sobre navy (hero e rodapé)', 'azul-claro-texto', 'navy'],
  ['branco sobre navy', '#FFFFFF', 'navy'],
  ['mint sobre navy (rótulo do hero)', 'mint', 'navy'],
  ['green sobre card (valor em destaque)', 'green', 'card'],
  ['red sobre card (mensagem de erro)', 'red', 'card'],
];

const cor = (nome) => (nome.startsWith('#') ? nome : token(nome));
const tabela = [];

for (const [descricao, texto, fundo] of PARES) {
  test(`contraste ≥ 4,5: ${descricao}`, () => {
    const razao = razaoDeContraste(cor(texto), cor(fundo));
    tabela.push(`${descricao.padEnd(46)} ${cor(texto)} / ${cor(fundo)}  ${razao.toFixed(2)}`);
    assert.ok(razao >= 4.5, `${descricao}: ${razao.toFixed(2)}`);
  });
}

test('tabela de razões (informativo)', () => {
  console.log(`\n${tabela.join('\n')}`);
});

test('--muted não é usado como cor de texto em fundo claro', () => {
  const usos = css.split('\n').filter((l) => /(^|[\s;{])color:\s*var\(--muted\)/.test(l));
  assert.deepEqual(usos, []);
});
