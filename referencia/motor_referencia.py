"""
Motor de referência da Calculadora de Juros Compostos da Carteira Z.

Este arquivo é o GABARITO: a implementação em JavaScript (docs/js/motor.js) deve
produzir os mesmos números, com tolerância de R$ 0,01, nos casos de
test_vectors.json.

Convenções (todas devem ser replicadas no JS):
  * Simulação mês a mês. Mês k = 1..n.
  * Em cada mês: (1) o saldo rende; (2) se for mês de come-cotas, cobra-se o
    imposto; (3) entra o aporte do mês (aporte no FIM do mês, a mesma convenção
    da calculadora simples anterior: R$ 1.000/mês, 20 anos, 11% a.a. => R$ 808.544,93).
  * O valor inicial (pv) entra no mês 0, com idade zero.
  * Aporte do mês k = pmt0 * (1 + reajuste) ** ((k - 1) // 12).
  * Taxa mensal equivalente: (1 + a) ** (1/12) - 1.
  * "Reais de hoje" = valor nominal / (1 + inflacao) ** (k / 12).
  * "Investido em reais de hoje" (investido_real) = valor inicial + soma dos aportes,
    cada aporte k dividido por (1 + inflacao) ** (k / 12) (a inflação até a data do aporte).
  * Premissa tributária da v1: todo investimento é tratado como de prazo superior a 2 anos,
    então a alíquota no resgate é sempre 15% (não há tabela regressiva). Para prazos menores
    a alíquota real é maior (17,5% a 22,5%); a interface deve avisar.
  * Imposto "devido se resgatar agora" é calculado em todo mês, para o gráfico
    de evolução líquida. O resultado final usa o mês n.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict

REGIMES = ("isento", "resgate_15", "come_cotas")
ALIQUOTA_LONGO_PRAZO = 0.15


def taxa_mensal(taxa_anual: float) -> float:
    return (1.0 + taxa_anual) ** (1.0 / 12.0) - 1.0


def taxa_nominal_de_ipca_mais(inflacao: float, real: float) -> float:
    """'IPCA + x%'  ->  taxa nominal efetiva anual."""
    return (1.0 + inflacao) * (1.0 + real) - 1.0


@dataclass
class Parametros:
    pv: float = 0.0               # valor inicial (R$)
    pmt0: float = 0.0             # primeiro aporte mensal (R$)
    n: int = 240                  # prazo em meses
    retorno_anual: float = 0.11   # taxa nominal efetiva anual
    inflacao_anual: float = 0.0
    reajuste_anual: float = 0.0   # reajuste anual do aporte
    regime: str = "isento"
    mes_inicio: int = 1           # mês do calendário (1-12) do mês k=1
    aliquota_come_cotas: float = ALIQUOTA_LONGO_PRAZO


def simular(p: Parametros) -> dict:
    """Retorna séries mensais (índice 0..n) e o resumo final."""
    if p.regime not in REGIMES:
        raise ValueError(f"regime inválido: {p.regime}")
    i = taxa_mensal(p.retorno_anual)

    saldo = p.pv            # saldo bruto
    custo_fiscal = p.pv     # base para come-cotas
    investido = p.pv

    s_bruto = [saldo]
    s_investido = [investido]
    s_imposto = [0.0]
    s_liquido = [saldo]
    s_liquido_real = [saldo]
    s_bruto_real = [saldo]
    s_investido_real = [investido]   # cada aporte deflacionado na PRÓPRIA data (aporte_k / (1+infl)^(k/12))
    investido_real = investido
    come_cotas_pagos = 0.0

    def imposto_se_resgatar(saldo, investido, custo_fiscal):
        if p.regime == "isento":
            return 0.0
        if p.regime == "resgate_15":
            return ALIQUOTA_LONGO_PRAZO * max(0.0, saldo - investido)
        if p.regime == "come_cotas":
            return ALIQUOTA_LONGO_PRAZO * max(0.0, saldo - custo_fiscal)
        raise ValueError(p.regime)

    for k in range(1, p.n + 1):
        # 1) rendimento
        saldo *= 1.0 + i

        # 2) come-cotas em maio e novembro
        if p.regime == "come_cotas":
            mes_cal = ((p.mes_inicio - 1 + k - 1) % 12) + 1
            if mes_cal in (5, 11):
                imp = p.aliquota_come_cotas * max(0.0, saldo - custo_fiscal)
                saldo -= imp
                custo_fiscal = saldo
                come_cotas_pagos += imp

        # 3) aporte no fim do mês
        aporte = p.pmt0 * (1.0 + p.reajuste_anual) ** ((k - 1) // 12)
        if aporte > 0:
            saldo += aporte
            custo_fiscal += aporte
            investido += aporte

        imp_k = imposto_se_resgatar(saldo, investido, custo_fiscal)
        deflator = (1.0 + p.inflacao_anual) ** (k / 12.0)
        if aporte > 0:
            investido_real += aporte / deflator
        s_investido_real.append(investido_real)
        s_bruto.append(saldo)
        s_investido.append(investido)
        s_imposto.append(imp_k)
        s_liquido.append(saldo - imp_k)
        s_liquido_real.append((saldo - imp_k) / deflator)
        s_bruto_real.append(saldo / deflator)

    n = p.n
    deflator_final = (1.0 + p.inflacao_anual) ** (n / 12.0)
    resumo = {
        "bruto_nominal": s_bruto[n],
        "investido_nominal": s_investido[n],
        "investido_real": s_investido_real[n],
        "imposto_resgate": s_imposto[n],
        "come_cotas_pagos": come_cotas_pagos,
        "liquido_nominal": s_liquido[n],
        "liquido_real": s_liquido_real[n],
        "bruto_real": s_bruto_real[n],
        "deflator": deflator_final,
    }
    return {
        "bruto": s_bruto,
        "investido": s_investido,
        "investido_real": s_investido_real,
        "imposto": s_imposto,
        "liquido": s_liquido,
        "liquido_real": s_liquido_real,
        "bruto_real": s_bruto_real,
        "resumo": resumo,
    }


# ---------------------------------------------------------------- solvers --

def resolver_aporte(alvo_liquido_real: float, p: Parametros) -> float:
    """Menor primeiro aporte (pmt0) que entrega `alvo_liquido_real` (reais de
    hoje, líquido de imposto) ao fim de p.n meses. Bisseção."""
    def f(pmt0):
        q = Parametros(**{**asdict(p), "pmt0": pmt0})
        return simular(q)["resumo"]["liquido_real"]

    if f(0.0) >= alvo_liquido_real:
        return 0.0
    lo, hi = 0.0, max(1.0, alvo_liquido_real)
    while f(hi) < alvo_liquido_real:
        hi *= 2.0
        if hi > 1e12:
            raise ValueError("meta inalcançável")
    for _ in range(200):
        mid = (lo + hi) / 2.0
        if f(mid) < alvo_liquido_real:
            lo = mid
        else:
            hi = mid
    return hi


def resolver_prazo(alvo_liquido_real: float, p: Parametros, max_meses: int = 1200):
    """Menor número de meses para atingir `alvo_liquido_real`. None se não
    atingir em max_meses."""
    q = Parametros(**{**asdict(p), "n": max_meses})
    serie = simular(q)["liquido_real"]
    for k, v in enumerate(serie):
        if v >= alvo_liquido_real:
            return k
    return None


if __name__ == "__main__":
    # Verificações rápidas contra os números da calculadora simples anterior.
    base = Parametros(pmt0=1000, n=240, retorno_anual=0.11)
    print("Âncora 1 (valor final):", round(simular(base)["resumo"]["bruto_nominal"], 2))
    print("Âncora 2 (aporte p/ 2M):",
          round(resolver_aporte(2_000_000, Parametros(n=240, retorno_anual=0.11)), 2))
