// Presets de tributação: rótulo com exemplos (até 70 caracteres) e descrição para cada um.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, REGIMES } from '../docs/js/tributacao.js';

test('todo preset tem rótulo de até 70 caracteres', () => {
  for (const preset of PRESETS) {
    assert.ok(preset.rotulo.length <= 70, `${preset.regime}: rótulo com ${preset.rotulo.length} caracteres`);
  }
});

test('todo preset tem descrição', () => {
  for (const preset of PRESETS) {
    assert.ok(preset.descricao && preset.descricao.trim().length > 0, `${preset.regime}: sem descrição`);
  }
});

test('os presets cobrem exatamente os regimes do motor, na mesma ordem', () => {
  assert.deepEqual(PRESETS.map((p) => p.regime), [...REGIMES]);
});

test('três presets, nesta ordem, com os rótulos definidos', () => {
  assert.deepEqual(PRESETS.map((p) => p.rotulo), [
    'Isento de imposto (fundos de debêntures incentivadas, LCI e LCA)',
    'Só no resgate, 15% (FIDCs, previdência VGBL e fundos de ações)',
    'Come-cotas (fundos de renda fixa e multimercados)',
  ]);
});
