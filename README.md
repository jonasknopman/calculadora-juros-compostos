# Simulador da Carteira Z

Simulador com duas abas, sempre em **reais de hoje e líquido de imposto**:

- **Juntar dinheiro** (acumulação): "preciso de R$ X daqui a N anos: quanto aportar por mês?" O aporte pode ser reajustado pela inflação. Também calcula quanto se terá no final e em quanto tempo se chega à meta, com cenários, gráficos e tabela ano a ano.
- **Viver de renda** (retirada): "juntei R$ X; por quanto tempo posso retirar R$ Y por mês?", "quanto preciso juntar para retirar R$ Y por mês durante N anos?" e "quanto posso retirar por mês com R$ X durante N anos?". O dinheiro que não foi retirado continua rendendo, e a retirada é corrigida pela inflação, de modo que ela compra sempre o mesmo. Mostra cenários, gráfico de saldo e tabela ano a ano.

É um site estático (HTML, CSS e JavaScript puro), publicado a partir da pasta `docs/`. Para abrir direto numa aba: `?aba=renda`. Para incorporar em outra página (iframe): `?embed=1` (combina com `?aba=renda`).

## Premissas e simplificações

O simulador usa as hipóteses de quem o preenche: rentabilidade e inflação futuras são apenas suposições, não promessa de ganho, e rentabilidade passada não garante rentabilidade futura. É uma ferramenta de simulação, **não é recomendação de investimento**.

Simplificações do cálculo: o imposto de renda é sempre de 15% sobre o ganho, como se cada aplicação ficasse investida por mais de 2 anos (em prazos menores a alíquota real é maior); o come-cotas é sempre de 15%; não entram IOF, taxas de administração nem de custódia.

Convenções de "Juntar dinheiro": simulação mês a mês; em cada mês o saldo rende, o come-cotas é cobrado (se houver) e o aporte entra no fim do mês. "Reais de hoje" é o valor nominal dividido pela inflação acumulada até a data.

Convenções de "Viver de renda": simulação mês a mês; em cada mês a retirada líquida sai no começo do mês, depois o saldo rende e, no regime com come-cotas, o imposto é cobrado em maio e novembro. A retirada é corrigida continuamente pela inflação (em reais de hoje é a mesma todo mês). O valor juntado é tratado como dinheiro do próprio investidor, sem rendimento acumulado: se parte dele já for rendimento, o imposto das primeiras retiradas será um pouco maior. O limite é de 1.200 meses (100 anos); depois disso o resultado é "não se esgota".

## Como rodar localmente

Os módulos ES não abrem por duplo clique; use um servidor local:

```
python -m http.server 8000 --directory docs
```

e abra `http://localhost:8000`.

## Como é testado

Os dois motores de cálculo em JavaScript são comparados, ao centavo (e com prazos exatos, em meses inteiros), com gabaritos independentes em Python, em `referencia/`:

| Aba | Motor em JavaScript | Gabarito em Python | Vetores de teste |
|---|---|---|---|
| Juntar dinheiro | `docs/js/motor.js` | `referencia/motor_referencia.py` | `referencia/test_vectors.json` |
| Viver de renda | `docs/js/motor_retirada.js` | `referencia/motor_retirada.py` | `referencia/test_vectors_retirada.json` |

Os vetores são gerados pelos gabaritos (`referencia/gerar_vetores.py` e `referencia/gerar_vetores_retirada.py`) e lidos pelos testes em JavaScript. Para rodar tudo (testado com Node.js 24):

```
node --test
```

Para rodar os testes dos gabaritos em Python (biblioteca padrão, sem dependências):

```
python referencia/test_referencia.py
python referencia/test_referencia_retirada.py
```

Os testes em JavaScript cobrem também a leitura e a validação dos campos, os cenários, a cascata, os avisos, a estrutura da página e das abas, a acessibilidade estática, a robustez contra entradas ruins, a incorporação em iframe e o contraste das cores.

## Estrutura

```
docs/                       o que o GitHub Pages publica
  index.html
  css/estilo.css
  js/motor.js               motor puro de "Juntar dinheiro" (sem DOM, sem rede)
  js/motor_retirada.js      motor puro de "Viver de renda"
  js/tributacao.js          regimes, alíquotas e textos (único lugar com números de imposto)
  js/entrada.js             leitura e validação dos campos de "Juntar dinheiro"; monta o que a tela mostra
  js/entrada_retirada.js    o mesmo para "Viver de renda"
  js/ui.js                  liga o DOM a entrada.js
  js/ui_retirada.js         liga o DOM a entrada_retirada.js
  js/abas.js                escolha da aba inicial (?aba=renda)
  js/ui_abas.js             navegação por abas (clique e teclado)
  js/graficos.js            gráficos de "Juntar dinheiro"
  js/graficos_retirada.js   gráfico de "Viver de renda"
  js/incorporacao.js        modo incorporado (iframe)
  img/                      logo
  vendor/                   Chart.js copiado para o repositório (sem CDN)
tests/                      testes em JavaScript (node --test)
referencia/                 gabaritos em Python, geradores e vetores de teste
```

## Licenças

- Chart.js: licença MIT (ver `docs/vendor/LICENSE-chartjs.md`).
- Código e marca: © Carteira Z. Todos os direitos reservados.
