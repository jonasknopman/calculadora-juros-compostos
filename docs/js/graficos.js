// Só desenha. Os dados já vêm prontos de entrada.js; Chart.js vem de vendor/ (global `Chart`).
import { moeda, abreviarMoeda } from './entrada.js';

// Cores = tokens de estilo.css (:root); canvas não lê variáveis CSS, então ficam espelhadas aqui.
const COR_SALDO = '#1E5C3A'; // --green
const COR_INVESTIDO = '#1A2744'; // --navy
const COR_TOTAL_INICIAL = '#1A2744'; // --navy
const COR_TOTAL_FINAL = '#1E5C3A'; // --green
const COR_PERDA = '#AE1C1C'; // --red
const COR_PERDA_INDIRETA = 'rgba(174, 28, 28, 0.55)'; // --red a 55%
const COR_INFLACAO = '#92400E'; // --amber
const COR_TEXTO = '#1A2744'; // --navy
const COR_GRADE = '#E5E3DC'; // --rule
const FONTE_HORIZONTAL = 11; // px, cascata na horizontal (celular)
const ALTURA_POR_BARRA = 48; // px, cascata na horizontal
const MARGEM_HORIZONTAL = 56; // px de eixo e respiro
const FONTE = 'system-ui, -apple-system, "Segoe UI", sans-serif';

const formatoAno = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const instancias = new Map();

function substituir(canvas, configuracao) {
  instancias.get(canvas)?.destroy();
  instancias.set(canvas, new window.Chart(canvas, configuracao));
}

// Quebra o rótulo em linhas curtas para caber em telas estreitas.
function quebrar(texto, limite = 10) {
  const linhas = [];
  let atual = '';
  for (const palavra of texto.split(' ')) {
    if (atual && `${atual} ${palavra}`.length > limite) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = atual ? `${atual} ${palavra}` : palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

function corDaBarra(barra, indice, total) {
  if (barra.tipo === 'perda') return COR_PERDA;
  if (barra.tipo === 'perda-indireta') return COR_PERDA_INDIRETA;
  if (barra.tipo === 'inflacao') return COR_INFLACAO;
  return indice === total - 1 ? COR_TOTAL_FINAL : COR_TOTAL_INICIAL;
}

// Escreve o valor de cada barra (não depender só da cor): em cima, no gráfico vertical;
// ao fim da barra, no horizontal.
function criarPluginValores(barras, horizontal) {
  return {
    id: 'valoresNasBarras',
    afterDatasetsDraw(grafico) {
      const { ctx } = grafico;
      ctx.save();
      ctx.fillStyle = COR_TEXTO;
      ctx.textAlign = horizontal ? 'left' : 'center';
      ctx.textBaseline = horizontal ? 'middle' : 'bottom';
      ctx.font = horizontal ? `600 ${FONTE_HORIZONTAL}px ${FONTE}` : `600 10px ${FONTE}`;
      grafico.getDatasetMeta(0).data.forEach((elemento, i) => {
        if (horizontal) {
          ctx.fillText(abreviarMoeda(barras[i].valor), Math.max(elemento.x, elemento.base) + 6, elemento.y);
        } else {
          ctx.fillText(abreviarMoeda(barras[i].valor).replace('R$ ', ''), elemento.x, Math.min(elemento.y, elemento.base) - 4);
        }
      });
      ctx.restore();
    },
  };
}

const opcoesBase = {
  responsive: true,
  maintainAspectRatio: false,
  font: { family: FONTE },
  layout: { padding: { top: 18 } },
  animation: false,
  color: COR_TEXTO,
};

export function desenharEvolucao(canvas, grafico) {
  canvas.setAttribute('aria-label', grafico.descricao);
  substituir(canvas, {
    type: 'line',
    data: {
      datasets: [
        {
          label: grafico.rotuloSaldo,
          data: grafico.pontos.map((p) => ({ x: p.ano, y: p.saldoLiquidoReal })),
          borderColor: COR_SALDO,
          backgroundColor: COR_SALDO,
          borderWidth: 4,
          pointRadius: 0,
          pointHitRadius: 10,
          tension: 0.15,
        },
        {
          label: grafico.rotuloInvestido,
          data: grafico.pontos.map((p) => ({ x: p.ano, y: p.investidoReal })),
          borderColor: COR_INVESTIDO,
          backgroundColor: COR_INVESTIDO,
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          pointHitRadius: 10,
          tension: 0.15,
        },
      ],
    },
    options: {
      ...opcoesBase,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          title: { display: true, text: 'Anos' },
          ticks: { callback: (v) => (Number.isInteger(v) ? v : '') },
          grid: { color: COR_GRADE },
        },
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => abreviarMoeda(v) },
          grid: { color: COR_GRADE },
        },
      },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 14, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            title: (itens) => `Ano ${formatoAno.format(itens[0].parsed.x)}`,
            label: (item) => `${item.dataset.label}: ${moeda(item.parsed.y)}`,
          },
        },
      },
    },
  });
}

// Abaixo de 560 px a cascata é desenhada na horizontal; ao cruzar o ponto de quebra, reconstrói.
const telaEstreita = window.matchMedia('(max-width: 559px)');
let ultimaCascata = null;
telaEstreita.addEventListener('change', () => {
  if (ultimaCascata) desenharCascata(ultimaCascata.canvas, ultimaCascata.cascata);
});

export function desenharCascata(canvas, cascata) {
  ultimaCascata = { canvas, cascata };
  const horizontal = telaEstreita.matches;
  const area = canvas.parentElement;
  area.style.height = horizontal ? `${cascata.barras.length * ALTURA_POR_BARRA + MARGEM_HORIZONTAL}px` : '';
  canvas.dataset.orientacao = horizontal ? 'horizontal' : 'vertical';
  canvas.setAttribute('aria-label', cascata.descricao);

  const eixoValores = {
    beginAtZero: true,
    ticks: horizontal
      ? { callback: (v) => abreviarMoeda(v), maxTicksLimit: 4, font: { size: 10 } }
      : { callback: (v) => abreviarMoeda(v) },
    grid: { color: COR_GRADE },
  };
  const eixoNomes = horizontal
    ? { ticks: { autoSkip: false, font: { size: FONTE_HORIZONTAL } }, grid: { display: false } }
    : { ticks: { autoSkip: false, maxRotation: 0, font: { size: 9 }, padding: 2 }, grid: { display: false } };

  substituir(canvas, {
    type: 'bar',
    plugins: [criarPluginValores(cascata.barras, horizontal)],
    data: {
      labels: cascata.barras.map((b) => quebrar(b.rotuloCurto, horizontal ? 14 : 9)),
      datasets: [{
        data: cascata.barras.map((b) => [b.inicio, b.fim]),
        backgroundColor: cascata.barras.map((b, i, todas) => corDaBarra(b, i, todas.length)),
        borderSkipped: false,
        maxBarThickness: horizontal ? 28 : 64,
      }],
    },
    options: {
      ...opcoesBase,
      indexAxis: horizontal ? 'y' : 'x',
      layout: { padding: horizontal ? { right: 70 } : { top: 18 } },
      scales: horizontal ? { x: eixoValores, y: eixoNomes } : { x: eixoNomes, y: eixoValores },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (itens) => cascata.barras[itens[0].dataIndex].rotulo,
            label: (item) => {
              const barra = cascata.barras[item.dataIndex];
              return barra.tipo === 'total' ? barra.texto : `Perda de ${barra.texto}`;
            },
          },
        },
      },
    },
  });
}
