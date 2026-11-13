"""
Motor de referência da Fase 2 (Viver de renda): quanto tempo o dinheiro dura.

Este arquivo é o GABARITO do futuro docs/js/motor_retirada.js. Segue as seções 5 e 6
de ESPECIFICACAO_V2.md. Só biblioteca padrão.

Convenções, mês k = 1, 2, ...:
  * Taxa mensal rm = (1 + rentabilidade_aa) ** (1/12) - 1.
  * Retirada líquida nominal do mês k: Yk = Y * (1 + inflacao) ** ((k - 1) / 12)
    (correção contínua; em reais de hoje a retirada é exatamente Y todo mês).
  * Ordem no mês: (1) retirada no começo do mês; se a retirada bruta G passar do saldo,
    o dinheiro esgotou e a duração é k - 1; (2) atualiza saldo e base; (3) rendimento;
    (4) come-cotas no fim de maio e novembro (só no regime come_cotas).
  * Reais de hoje no fim do mês k = nominal / (1 + inflacao) ** (k / 12).
  * Mês do calendário do mês k: ((mes_inicio - 1 + k - 1) % 12) + 1.
"""
from __future__ import annotations

REGIMES = ("isento", "resgate_15", "come_cotas")
ALIQUOTA = 0.15            # única constante de alíquota (imposto sempre a 15%)
LIMITE_MESES = 1200        # 100 anos
PRECISAO_BISSECAO = 1e-9   # bem abaixo dos R$ 0,005 exigidos pela especificação


def taxa_mensal(taxa_anual: float) -> float:
    return (1.0 + taxa_anual) ** (1.0 / 12.0) - 1.0


def taxa_ipca_mais(ipca: float, x: float) -> float:
    """'IPCA + x%' -> taxa nominal efetiva anual."""
    return (1.0 + ipca) * (1.0 + x) - 1.0


def simular(valor_inicial, retirada, rentabilidade_aa, inflacao_aa, regime, mes_inicio,
            max_meses=LIMITE_MESES, com_trajetoria=True):
    """Simula mês a mês. Retorna dict com:
       duracao (meses concluídos), esgotou (True se faltou dinheiro antes de max_meses),
       trajetoria (lista, um item por mês concluído; vazia se com_trajetoria=False)."""
    if regime not in REGIMES:
        raise ValueError(f"regime inválido: {regime}")
    rm = taxa_mensal(rentabilidade_aa)
    saldo = float(valor_inicial)   # S, saldo bruto nominal
    base = float(valor_inicial)    # B, custo fiscal (valor juntado é todo principal)
    trajetoria = []
    duracao = 0
    esgotou = False

    for k in range(1, max_meses + 1):
        yk = retirada * (1.0 + inflacao_aa) ** ((k - 1) / 12.0)

        # 1) retirada no começo do mês
        if regime == "isento":
            g = yk
        else:
            frac_ganho = max(0.0, (saldo - base) / saldo) if saldo > 0 else 0.0
            g = yk / (1.0 - ALIQUOTA * frac_ganho)
        if g > saldo:
            esgotou = True
            break
        imposto_retirada = g - yk

        # 2) saldo e base
        if regime != "isento" and saldo > 0:
            base *= (1.0 - g / saldo)
        saldo -= g

        # 3) rendimento
        saldo *= 1.0 + rm

        # 4) come-cotas (maio e novembro)
        imposto_cc = 0.0
        if regime == "come_cotas":
            mes_cal = ((mes_inicio - 1 + k - 1) % 12) + 1
            if mes_cal in (5, 11):
                imposto_cc = ALIQUOTA * max(0.0, saldo - base)
                saldo -= imposto_cc
                base = saldo

        duracao = k
        if com_trajetoria:
            imp_resgate_total = 0.0 if regime == "isento" else ALIQUOTA * max(0.0, saldo - base)
            liquido = saldo - imp_resgate_total
            deflator = (1.0 + inflacao_aa) ** (k / 12.0)
            trajetoria.append({
                "mes": k,
                "retirada_liquida_nominal": yk,
                "retirada_bruta": g,
                "imposto_mes": imposto_retirada + imposto_cc,
                "saldo_bruto": saldo,
                "saldo_liquido": liquido,
                "saldo_liquido_real": liquido / deflator,
            })

    return {"duracao": duracao, "esgotou": esgotou, "trajetoria": trajetoria}


def duracao(valor_inicial, retirada, rentabilidade_aa, inflacao_aa, regime, mes_inicio,
            max_meses=LIMITE_MESES):
    """Modo 1. Retorna (meses concluídos, esgotou)."""
    r = simular(valor_inicial, retirada, rentabilidade_aa, inflacao_aa, regime, mes_inicio,
                max_meses, com_trajetoria=False)
    return r["duracao"], r["esgotou"]


def _dura_ao_menos(prazo_meses, valor_inicial, retirada, rentabilidade_aa, inflacao_aa,
                   regime, mes_inicio):
    meses, _ = duracao(valor_inicial, retirada, rentabilidade_aa, inflacao_aa, regime,
                       mes_inicio, max_meses=prazo_meses)
    return meses >= prazo_meses


def valor_necessario(retirada, prazo_meses, rentabilidade_aa, inflacao_aa, regime, mes_inicio):
    """Modo 2. Menor X tal que a duração seja pelo menos o prazo.
    Bisseção; cota superior começa em Y * prazo e dobra até bastar."""
    def ok(x):
        return _dura_ao_menos(prazo_meses, x, retirada, rentabilidade_aa, inflacao_aa,
                              regime, mes_inicio)
    if retirada <= 0:
        return 0.0
    lo, hi = 0.0, retirada * prazo_meses
    while not ok(hi):
        lo = hi
        hi *= 2.0
    for _ in range(300):
        if hi - lo < PRECISAO_BISSECAO:
            break
        meio = (lo + hi) / 2.0
        if ok(meio):
            hi = meio
        else:
            lo = meio
    return hi


def retirada_possivel(valor_inicial, prazo_meses, rentabilidade_aa, inflacao_aa, regime,
                      mes_inicio):
    """Modo 3. Maior Y tal que a duração seja pelo menos o prazo.
    Bisseção; cota superior começa em X e dobra até a duração ficar menor que o prazo."""
    def ok(y):
        return _dura_ao_menos(prazo_meses, valor_inicial, y, rentabilidade_aa, inflacao_aa,
                              regime, mes_inicio)
    if valor_inicial <= 0:
        return 0.0
    lo, hi = 0.0, float(valor_inicial)
    while ok(hi):
        lo = hi
        hi *= 2.0
    for _ in range(300):
        if hi - lo < PRECISAO_BISSECAO:
            break
        meio = (lo + hi) / 2.0
        if ok(meio):
            lo = meio
        else:
            hi = meio
    return lo


if __name__ == "__main__":
    print("Modo 1 (500k, 5k, isento):",
          duracao(500_000, 5_000, 0.11, 0.045, "isento", 12))
    print("Modo 2 (isento):",
          round(valor_necessario(5_000, 240, 0.11, 0.045, "isento", 12), 2))
    print("Modo 3 (isento):",
          round(retirada_possivel(1_000_000, 240, 0.11, 0.045, "isento", 12), 2))
