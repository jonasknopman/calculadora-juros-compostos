// Abas acessíveis: clique, setas, Home e End. Não grava nada no URL nem em storage.
import { ABAS, abaInicial } from './abas.js';
import { redimensionarGraficosRenda } from './graficos_retirada.js';

const abas = ABAS.map((nome) => document.getElementById(`aba-${nome}`));
const painelDe = (nome) => document.getElementById(`painel-${nome}`);

function selecionar(nome, { focar = false } = {}) {
  ABAS.forEach((outra, i) => {
    const ativa = outra === nome;
    abas[i].setAttribute('aria-selected', String(ativa));
    abas[i].tabIndex = ativa ? 0 : -1; // tabindex itinerante: só a aba ativa entra na ordem do Tab
    painelDe(outra).hidden = !ativa;
    if (ativa && focar) abas[i].focus();
  });
  // Os gráficos da aba "juntar" medem o tamanho do canvas; escondido, ele mede zero.
  window.dispatchEvent(new Event('resize'));
  // O gráfico da renda pode ter sido criado com o painel escondido (tamanho zero): mede de novo.
  if (nome === 'renda') redimensionarGraficosRenda();
}

abas.forEach((aba, i) => {
  aba.addEventListener('click', () => selecionar(ABAS[i]));
  aba.addEventListener('keydown', (evento) => {
    let destino = null;
    if (evento.key === 'ArrowRight') destino = (i + 1) % ABAS.length;
    else if (evento.key === 'ArrowLeft') destino = (i - 1 + ABAS.length) % ABAS.length;
    else if (evento.key === 'Home') destino = 0;
    else if (evento.key === 'End') destino = ABAS.length - 1;
    if (destino === null) return;
    evento.preventDefault();
    selecionar(ABAS[destino], { focar: true });
  });
});

selecionar(abaInicial(window.location.search));
