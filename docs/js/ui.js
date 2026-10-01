// Liga o DOM a entrada.js. Nenhuma regra de cálculo aqui.
import { processar, mesSeguinteAoAtual, INFLACAO_PADRAO } from './entrada.js';
import { PRESETS } from './tributacao.js';
import { desenharCascata, desenharEvolucao } from './graficos.js';
import { ehModoIncorporado, mensagemDeAltura } from './incorporacao.js';

const ATRASO_MS = 250;

// Modo incorporado (?embed=1): o site que incorpora já tem cabeçalho e hero.
if (ehModoIncorporado(window.location.search)) document.body.classList.add('embutido');

// Dentro de um iframe, avisa a página-mãe da altura do conteúdo (só a altura, nada de dados).
// Usa a altura do <body>: a do documento nunca fica menor que a do próprio iframe.
let ultimaAltura = 0;
function avisarAltura() {
  if (window.parent === window) return;
  const altura = Math.ceil(document.body.getBoundingClientRect().height);
  if (altura === ultimaAltura) return;
  ultimaAltura = altura;
  window.parent.postMessage(mensagemDeAltura(altura), '*');
}
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const formulario = document.getElementById('formulario');
const campoPorNome = (nome) => formulario.elements[nome];

function preencherListas() {
  // Tipo de tributação: grupo de opções (o rótulo longo quebra em várias linhas, o que um
  // <select> fechado não faz). O valor lido continua sendo campoPorNome('regime').value.
  const opcoes = document.getElementById('opcoes-regime');
  PRESETS.forEach((preset, i) => {
    const rotulo = document.createElement('label');
    rotulo.className = 'opcao opcao-regime';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'regime';
    radio.value = preset.regime;
    radio.checked = i === 0;
    const texto = document.createElement('span');
    texto.textContent = preset.rotulo;
    rotulo.append(radio, texto);
    opcoes.append(rotulo);
  });
  atualizarDescricaoDoRegime();

  const mes = campoPorNome('mesInicio');
  MESES.forEach((nome, i) => mes.add(new Option(nome, String(i + 1))));
  mes.value = String(mesSeguinteAoAtual());
}

function atualizarDescricaoDoRegime() {
  const preset = PRESETS.find((item) => item.regime === campoPorNome('regime').value);
  // Sem descrição: o parágrafo fica oculto (sem espaço vazio) e sai do aria-describedby.
  const descricao = preset?.descricao ?? '';
  const paragrafo = document.getElementById('descricao-regime');
  paragrafo.textContent = descricao;
  paragrafo.hidden = descricao === '';
  document.getElementById('campo-regime').setAttribute('aria-describedby', descricao === '' ? 'erro-regime' : 'descricao-regime erro-regime');
  document.getElementById('selo-regime').textContent = preset ? preset.selo : '';
}

function alternarDica(botao) {
  const texto = document.getElementById(botao.getAttribute('aria-controls'));
  const abrir = texto.hidden;
  texto.hidden = !abrir;
  botao.setAttribute('aria-expanded', String(abrir));
}

function lerFormulario() {
  return {
    modo: formulario.elements.modo.value,
    meta: campoPorNome('meta').value,
    valorInicial: campoPorNome('valorInicial').value,
    aporte: campoPorNome('aporte').value,
    prazo: campoPorNome('prazo').value,
    prazoUnidade: campoPorNome('prazoUnidade').value,
    rentabilidade: campoPorNome('rentabilidade').value,
    rentabilidadeTipo: campoPorNome('rentabilidadeTipo').value,
    regime: campoPorNome('regime').value,
    inflacao: campoPorNome('inflacao').value,
    reajustar: campoPorNome('reajustar').checked,
    reajuste: campoPorNome('reajuste').value,
    mesInicio: campoPorNome('mesInicio').value,
    variacao: campoPorNome('variacao').value,
  };
}

function atualizarVisibilidade(modo, reajustar) {
  for (const campo of formulario.querySelectorAll('[data-modos]')) {
    campo.hidden = !campo.dataset.modos.split(' ').includes(modo);
  }
  document.getElementById('campo-reajuste').hidden = !reajustar;
}

function mostrarErros(erros) {
  for (const campo of formulario.querySelectorAll('.erro')) {
    const nome = campo.id.replace('erro-', '');
    const mensagem = erros[nome] ?? '';
    campo.textContent = mensagem;
    const entrada = campoPorNome(nome);
    if (entrada && typeof entrada.setAttribute === 'function') {
      if (mensagem) entrada.setAttribute('aria-invalid', 'true');
      else entrada.removeAttribute('aria-invalid');
    }
  }
}

// Frase de destaque; o valor aparece em negrito (nós de texto, sem innerHTML).
function mostrarDestaque(frase, valor) {
  const alvo = document.getElementById('destaque');
  alvo.replaceChildren();
  if (!frase) return;
  const posicao = valor ? frase.indexOf(valor) : -1;
  if (posicao < 0) {
    alvo.textContent = frase;
    return;
  }
  const negrito = document.createElement('strong');
  negrito.textContent = valor;
  alvo.append(frase.slice(0, posicao), negrito, frase.slice(posicao + valor.length));
}

function mostrarResultado(r) {
  const erroGeral = document.getElementById('erro-geral');
  erroGeral.hidden = !r.erroGeral;
  erroGeral.textContent = r.erroGeral ?? '';

  mostrarDestaque(r.destaque, r.valorDestaque);

  const avisos = document.getElementById('avisos');
  avisos.replaceChildren();
  for (const texto of r.avisos) {
    const caixa = document.createElement('p');
    caixa.className = 'alerta';
    caixa.textContent = texto;
    avisos.append(caixa);
  }

  const apoio = document.getElementById('apoio');
  apoio.replaceChildren();
  for (const linha of r.linhas) {
    const bloco = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = linha.rotulo;
    dd.textContent = linha.valor;
    bloco.append(dt, dd);
    apoio.append(bloco);
  }

  const corpo = document.querySelector('#tabela tbody');
  corpo.replaceChildren();
  for (const linha of r.tabela) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = linha.rotulo;
    th.style.fontWeight = '400';
    tr.append(th);
    // Cada valor traz a versão completa e a curta; o CSS mostra uma delas conforme a largura.
    const colunas = [
      [linha.liquidoReal, linha.liquidoRealCurto, false],
      [linha.investido, linha.investidoCurto, false],
      [linha.liquido, null, true],
      [linha.bruto, null, true],
    ];
    for (const [cheio, curto, soLargo] of colunas) {
      const td = document.createElement('td');
      if (soLargo) td.className = 'so-largo';
      if (curto !== null && curto !== cheio) {
        const spanCheio = document.createElement('span');
        spanCheio.className = 'v-cheio';
        spanCheio.textContent = cheio;
        const spanCurto = document.createElement('span');
        spanCurto.className = 'v-curto';
        spanCurto.textContent = curto;
        td.append(spanCheio, spanCurto);
      } else {
        td.textContent = cheio;
      }
      tr.append(td);
    }
    corpo.append(tr);
  }
  document.getElementById('cartao-tabela').hidden = r.tabela.length === 0;
  atualizarDicaDeRolagem();

  mostrarCenarios(r.cenarios);
  mostrarGraficos(r);
}

// Rede de segurança: se a tabela ainda precisar rolar, avisa (e só nesse caso).
function atualizarDicaDeRolagem() {
  const area = document.querySelector('.tabela-rolavel');
  document.getElementById('dica-rolagem').hidden = !(area.scrollWidth > area.clientWidth + 1);
}

function mostrarCenarios(cenarios) {
  const cartao = document.getElementById('cartao-cenarios');
  const area = document.getElementById('cenarios');
  area.replaceChildren();
  cartao.hidden = cenarios.length === 0;
  for (const cenario of cenarios) {
    const item = document.createElement('div');
    item.className = `cenario cenario-${cenario.nome.toLowerCase()}`;
    const nome = document.createElement('h3');
    nome.textContent = cenario.nome;
    const taxa = document.createElement('p');
    taxa.className = 'cenario-taxa';
    taxa.textContent = cenario.rentabilidade;
    const principal = document.createElement('p');
    principal.className = cenario.alcanca ? 'cenario-valor' : 'cenario-valor cenario-falha';
    principal.textContent = cenario.texto;
    item.append(nome, taxa, principal);
    area.append(item);
  }
}

function mostrarGraficos(r) {
  const temEvolucao = Boolean(r.grafico) && r.grafico.pontos.length > 1 && typeof window.Chart === 'function';
  document.getElementById('cartao-evolucao').hidden = !temEvolucao;
  document.getElementById('cartao-cascata').hidden = !(r.cascata && typeof window.Chart === 'function');
  if (typeof window.Chart !== 'function') return;
  if (temEvolucao) {
    desenharEvolucao(document.getElementById('grafico-evolucao'), r.grafico);
    document.getElementById('legenda-evolucao').textContent = r.grafico.legenda;
  }
  if (r.cascata) {
    desenharCascata(document.getElementById('grafico-cascata'), r.cascata);
    document.getElementById('legenda-cascata').textContent = r.cascata.legenda;
  }
}

function recalcular() {
  const campos = lerFormulario();
  atualizarVisibilidade(campos.modo, campos.reajustar);
  atualizarDescricaoDoRegime();
  campoPorNome('reajuste').placeholder = campos.inflacao.trim() || INFLACAO_PADRAO;
  const resultado = processar(campos);
  mostrarErros(resultado.erros);
  mostrarResultado(resultado);
  avisarAltura();
}

let temporizador;
function agendar() {
  clearTimeout(temporizador);
  temporizador = setTimeout(recalcular, ATRASO_MS);
}

preencherListas();
const observadorDaTabela = new ResizeObserver(atualizarDicaDeRolagem);
observadorDaTabela.observe(document.querySelector('.tabela-rolavel'));
observadorDaTabela.observe(document.getElementById('tabela'));
window.addEventListener('resize', atualizarDicaDeRolagem);
document.fonts?.ready.then(atualizarDicaDeRolagem);
formulario.addEventListener('input', agendar);
formulario.addEventListener('change', agendar);
formulario.addEventListener('click', (evento) => {
  const botao = evento.target.closest('.dica-botao');
  if (botao) alternarDica(botao);
});
formulario.addEventListener('submit', (evento) => evento.preventDefault());
recalcular();
window.addEventListener('load', avisarAltura);
new ResizeObserver(avisarAltura).observe(document.body);
