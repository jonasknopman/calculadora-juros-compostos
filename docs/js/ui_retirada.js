// Liga o DOM da aba "Viver de renda" a entrada_retirada.js. Nenhuma regra de cálculo aqui.
// Não importa ui.js (ele executa código ao ser importado); alguns ajudantes de DOM se repetem.
import { processarRetirada } from './entrada_retirada.js';
import { PRESETS } from './tributacao.js';

const ATRASO_MS = 250;

const formulario = document.getElementById('formulario-renda');
const campoPorNome = (nome) => formulario.elements[nome];

function preencherListas() {
  // Tipo de tributação: grupo de opções (o rótulo longo quebra em várias linhas).
  const opcoes = document.getElementById('opcoes-regime-renda');
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
}

function atualizarDescricaoDoRegime() {
  const preset = PRESETS.find((item) => item.regime === campoPorNome('regime').value);
  const descricao = preset?.descricao ?? '';
  const paragrafo = document.getElementById('descricao-regime-renda');
  paragrafo.textContent = descricao;
  paragrafo.hidden = descricao === '';
  document.getElementById('campo-regime-renda').setAttribute(
    'aria-describedby',
    descricao === '' ? 'erro-renda-regime' : 'descricao-regime-renda erro-renda-regime',
  );
  document.getElementById('selo-regime-renda').textContent = preset ? preset.selo : '';
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
    valorInicial: campoPorNome('valorInicial').value,
    retirada: campoPorNome('retirada').value,
    prazo: campoPorNome('prazo').value,
    prazoUnidade: campoPorNome('prazoUnidade').value,
    rentabilidade: campoPorNome('rentabilidade').value,
    rentabilidadeTipo: campoPorNome('rentabilidadeTipo').value,
    regime: campoPorNome('regime').value,
    // inflacao e mesInicio ficam de fora: a etapa 4 os liga às opções avançadas.
  };
}

function atualizarVisibilidade(modo) {
  for (const campo of formulario.querySelectorAll('[data-modos]')) {
    campo.hidden = !campo.dataset.modos.split(' ').includes(modo);
  }
}

function mostrarErros(erros) {
  for (const campo of formulario.querySelectorAll('.erro')) {
    const nome = campo.id.replace('erro-renda-', '');
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
  const alvo = document.getElementById('destaque-renda');
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

function mostrarParagrafos(idAlvo, textos, classe) {
  const alvo = document.getElementById(idAlvo);
  alvo.replaceChildren();
  for (const texto of textos) {
    const p = document.createElement('p');
    p.className = classe;
    p.textContent = texto;
    alvo.append(p);
  }
}

function mostrarTabela(tabela) {
  const corpo = document.querySelector('#tabela-renda tbody');
  corpo.replaceChildren();
  for (const linha of tabela) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = linha.rotulo;
    th.style.fontWeight = '400';
    tr.append(th);
    // Cada valor traz a versão completa e a curta; o CSS mostra uma delas conforme a largura.
    const colunas = [
      [linha.retirado, linha.retiradoCurto, false],
      [linha.liquidoReal, linha.liquidoRealCurto, false],
      [linha.imposto, null, true],
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
}

function mostrarResultado(r) {
  const erroGeral = document.getElementById('erro-geral-renda');
  erroGeral.hidden = !r.erroGeral;
  erroGeral.textContent = r.erroGeral ?? '';

  mostrarDestaque(r.destaque, r.valorDestaque);
  mostrarParagrafos('avisos-renda', r.avisos, 'alerta');
  mostrarParagrafos('notas-renda', r.notas, 'nota');

  const apoio = document.getElementById('apoio-renda');
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

  mostrarTabela(r.tabela);
  const nota = document.getElementById('nota-tabela-renda');
  nota.textContent = r.notaTabela;
  nota.hidden = r.notaTabela === '';
  document.getElementById('cartao-tabela-renda').hidden = r.tabela.length === 0;
  atualizarDicaDeRolagem();
}

// Rede de segurança: se a tabela ainda precisar rolar, avisa (e só nesse caso).
function atualizarDicaDeRolagem() {
  const area = document.getElementById('rolavel-renda');
  document.getElementById('dica-rolagem-renda').hidden = !(area.scrollWidth > area.clientWidth + 1);
}

function recalcular() {
  const campos = lerFormulario();
  atualizarVisibilidade(campos.modo);
  atualizarDescricaoDoRegime();
  const resultado = processarRetirada(campos);
  mostrarErros(resultado.erros);
  mostrarResultado(resultado);
}

let temporizador;
function agendar() {
  clearTimeout(temporizador);
  temporizador = setTimeout(recalcular, ATRASO_MS);
}

preencherListas();
const observadorDaTabela = new ResizeObserver(atualizarDicaDeRolagem);
observadorDaTabela.observe(document.getElementById('rolavel-renda'));
observadorDaTabela.observe(document.getElementById('tabela-renda'));
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
