// Só desenha o gráfico da aba "Viver de renda". Os dados já vêm prontos de entrada_retirada.js;
// Chart.js vem de vendor/ (global `Chart`). Não importa graficos.js.
import { moeda, abreviarMoeda } from './entrada.js';

// Cores = tokens de estilo.css (:root); canvas não lê variáveis CSS, então ficam espelhadas aqui.
const COR_SALDO = '#1E5C3A'; // --green
const COR_TEXTO = '#1A2744'; // --navy
const COR_GRADE = '#E5E3DC'; // --rule
const FONTE = 'system-ui, -apple-system, "Segoe UI", sans-serif';

const formatoAno = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const instancias = new Map();

const opcoesBase = {
  responsive: true,
  maintainAspectRatio: false,
  font: { family: FONTE },
  layout: { padding: { top: 18 } },
  animation: false,
  color: COR_TEXTO,
};

export function desenharSaldoRenda(canvas, grafico) {
  canvas.setAttribute('aria-label', grafico.descricao);
  instancias.get(canvas)?.destroy();
  instancias.set(canvas, new window.Chart(canvas, {
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
  }));
}

// Redesenha com o tamanho atual do canvas (para quando o painel escondido voltar a aparecer).
export function redimensionarGraficosRenda() {
  for (const grafico of instancias.values()) grafico.resize();
}
