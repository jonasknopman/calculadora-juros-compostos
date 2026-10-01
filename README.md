# Simulador de Metas da Carteira Z

Simulador de metas de aportes. Responde à pergunta "preciso de R$ X daqui a N anos: quanto aportar por mês?" mostrando o resultado **em reais de hoje e líquido de imposto**, com aporte que pode ser reajustado pela inflação. Também calcula quanto se terá no final e em quanto tempo se chega à meta, com cenários, gráficos e tabela ano a ano.

É um site estático (HTML, CSS e JavaScript puro), publicado a partir da pasta `docs/`.

## Premissas e simplificações

O simulador usa as hipóteses de quem o preenche: rentabilidade e inflação futuras são apenas suposições, não promessa de ganho, e rentabilidade passada não garante rentabilidade futura. É uma ferramenta de simulação, **não é recomendação de investimento**.

Simplificações do cálculo: o imposto de renda é sempre de 15% sobre o ganho, como se cada aplicação ficasse investida por mais de 2 anos (em prazos menores a alíquota real é maior); o come-cotas é sempre de 15%; não entram IOF, taxas de administração nem de custódia.

Convenções: simulação mês a mês; em cada mês o saldo rende, o come-cotas é cobrado (se houver) e o aporte entra no fim do mês. "Reais de hoje" é o valor nominal dividido pela inflação acumulada até a data.

## Como rodar localmente

Os módulos ES não abrem por duplo clique; use um servidor local:

```
python -m http.server 8000 --directory docs
```

e abra `http://localhost:8000`.

## Como é testado

O motor de cálculo em JavaScript (`docs/js/motor.js`) é comparado, ao centavo, com um gabarito independente em Python (`referencia/`). Os vetores de teste (`referencia/test_vectors.json`) são gerados pelo gabarito e lidos pelos testes em JavaScript. Para rodar tudo (testado com Node.js 24):

```
node --test
```

Os testes cobrem também a leitura e a validação dos campos, os cenários, a cascata, o aviso de prazo curto, a incorporação em iframe e o contraste das cores.

## Estrutura

```
docs/                  o que o GitHub Pages publica
  index.html
  css/estilo.css
  js/motor.js          motor puro (sem DOM, sem rede)
  js/tributacao.js     regimes, alíquotas e textos (único lugar com números de imposto)
  js/entrada.js        leitura e validação dos campos; monta tudo que a tela mostra
  js/ui.js             liga o DOM a entrada.js
  js/graficos.js       desenha os gráficos
  js/incorporacao.js   modo incorporado (iframe)
  img/                 logo
  vendor/              Chart.js copiado para o repositório (sem CDN)
tests/                 testes (node --test)
referencia/            gabarito em Python e vetores de teste
```

## Licenças

- Chart.js: licença MIT (ver `docs/vendor/LICENSE-chartjs.md`).
- Código e marca: © Carteira Z. Todos os direitos reservados.
