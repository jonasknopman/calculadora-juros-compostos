// Escolha da aba inicial pela busca da URL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ABAS, abaInicial } from '../docs/js/abas.js';

test('as abas são juntar e renda, nesta ordem', () => {
  assert.deepEqual([...ABAS], ['juntar', 'renda']);
});

test('?aba=renda abre a aba de renda, em qualquer posição', () => {
  assert.equal(abaInicial('?aba=renda'), 'renda');
  assert.equal(abaInicial('aba=renda'), 'renda');
  assert.equal(abaInicial('?embed=1&aba=renda'), 'renda');
  assert.equal(abaInicial('?aba=renda&embed=1'), 'renda');
});

test('?aba=juntar abre a aba da fase 1', () => {
  assert.equal(abaInicial('?aba=juntar'), 'juntar');
});

test('valor desconhecido, vazio ou ausente abre a aba da fase 1', () => {
  assert.equal(abaInicial('?aba=xyz'), 'juntar');
  assert.equal(abaInicial('?aba='), 'juntar');
  assert.equal(abaInicial('?aba=RENDA'), 'juntar');
  assert.equal(abaInicial('?embed=1'), 'juntar');
  assert.equal(abaInicial(''), 'juntar');
  assert.equal(abaInicial(undefined), 'juntar');
  assert.equal(abaInicial(null), 'juntar');
});
