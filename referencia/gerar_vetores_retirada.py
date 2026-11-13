"""Gera test_vectors_retirada.json a partir do motor de referência da fase 2.
Uso:  python gerar_vetores_retirada.py
O JS (docs/js/motor_retirada.js) deve reproduzir cada 'esperado': prazos exatos (meses
inteiros) e valores com tolerância de 0,01.

Vetores marcados 'ancora': true têm o 'esperado' copiado À MÃO da seção 11 da
ESPECIFICACAO_V2.md (literais abaixo), e não calculado. O gerador confere o motor contra
esses literais e aborta se divergirem; o teste repete a conferência."""
import json
import sys
from motor_retirada import (REGIMES, duracao, valor_necessario, retirada_possivel,
                            simular, taxa_ipca_mais)

R, I, MES = 0.11, 0.045, 12     # parâmetros comuns da seção 11
casos = []


def entrada(valor_inicial=None, retirada=None, prazo_meses=None, rent=R, infl=I,
            regime="isento", mes=MES):
    e = {"rentabilidade_aa": rent, "inflacao_aa": infl, "regime": regime, "mes_inicio": mes}
    if valor_inicial is not None: e["valor_inicial"] = valor_inicial
    if retirada is not None: e["retirada"] = retirada
    if prazo_meses is not None: e["prazo_meses"] = prazo_meses
    return e


def args(e):
    return e["rentabilidade_aa"], e["inflacao_aa"], e["regime"], e["mes_inicio"]


def modo1(nome, e, ancora=None):
    """ancora: dict {duracao, esgotou} escrito à mão a partir da especificação."""
    meses, esgotou = duracao(e["valor_inicial"], e["retirada"], *args(e))
    calculado = {"duracao": meses, "esgotou": esgotou}
    if ancora is not None:
        if (meses, esgotou) != (ancora["duracao"], ancora["esgotou"]):
            sys.exit(f"DIVERGE da especificação em {nome}: gabarito {calculado}, spec {ancora}")
    casos.append({"nome": nome, "tipo": "duracao", "entrada": e,
                  "esperado": ancora if ancora is not None else calculado,
                  "ancora": ancora is not None})


def modo2(nome, e, ancora=None):
    x = valor_necessario(e["retirada"], e["prazo_meses"], *args(e))
    if ancora is not None and abs(x - ancora) > 0.01:
        sys.exit(f"DIVERGE da especificação em {nome}: gabarito {x:.2f}, spec {ancora}")
    casos.append({"nome": nome, "tipo": "valor_necessario", "entrada": e,
                  "esperado": {"valor_inicial": ancora if ancora is not None else round(x, 2)},
                  "ancora": ancora is not None})


def modo3(nome, e, ancora=None):
    y = retirada_possivel(e["valor_inicial"], e["prazo_meses"], *args(e))
    if ancora is not None and abs(y - ancora) > 0.01:
        sys.exit(f"DIVERGE da especificação em {nome}: gabarito {y:.2f}, spec {ancora}")
    casos.append({"nome": nome, "tipo": "retirada_possivel", "entrada": e,
                  "esperado": {"retirada": ancora if ancora is not None else round(y, 2)},
                  "ancora": ancora is not None})


def trajetoria(nome, e, meses, ancora=None):
    """ancora: dict mes -> campos escritos à mão a partir da especificação."""
    t = simular(e["valor_inicial"], e["retirada"], *args(e))["trajetoria"]
    esperado = {}
    for m in meses:
        calc = {k: v for k, v in t[m - 1].items() if k != "mes"}
        esperado[str(m)] = calc
    if ancora is not None:
        for m, campos in ancora.items():
            for campo, valor in campos.items():
                if abs(t[m - 1][campo] - valor) > 0.01:
                    sys.exit(f"DIVERGE da especificação em {nome}, mês {m}, {campo}: "
                             f"gabarito {t[m - 1][campo]:.2f}, spec {valor}")
            esperado[str(m)] = dict(campos)   # só o que a especificação traz
    casos.append({"nome": nome, "tipo": "trajetoria", "entrada": e, "esperado": esperado,
                  "ancora": ancora is not None})


# ------------------------------------------------ âncoras da seção 11 (à mão)
modo1("ancora_m1_2M_2k_isento", entrada(2_000_000, 2_000), {"duracao": 1200, "esgotou": False})
modo1("ancora_m1_2M_12k_isento", entrada(2_000_000, 12_000), {"duracao": 359, "esgotou": True})
modo1("ancora_m1_500k_5k_isento", entrada(500_000, 5_000), {"duracao": 138, "esgotou": True})
modo1("ancora_m1_500k_5k_resgate15", entrada(500_000, 5_000, regime="resgate_15"), {"duracao": 127, "esgotou": True})
modo1("ancora_m1_500k_5k_comecotas", entrada(500_000, 5_000, regime="come_cotas"), {"duracao": 125, "esgotou": True})
modo1("ancora_m1_1M_8k_comecotas", entrada(1_000_000, 8_000, regime="come_cotas"), {"duracao": 168, "esgotou": True})

for reg, v in (("isento", 698_633.98), ("resgate_15", 755_893.14), ("come_cotas", 792_531.30)):
    modo2(f"ancora_m2_5k_240m_{reg}", entrada(retirada=5_000, prazo_meses=240, regime=reg), v)
for reg, v in (("isento", 7_156.82), ("resgate_15", 6_614.69), ("come_cotas", 6_308.90)):
    modo3(f"ancora_m3_1M_240m_{reg}", entrada(valor_inicial=1_000_000, prazo_meses=240, regime=reg), v)

for reg in REGIMES:
    modo1(f"ancora_rent0_infl0_{reg}", entrada(120_000, 1_000, rent=0.0, infl=0.0, regime=reg),
          {"duracao": 120, "esgotou": True})
for reg, d in (("isento", 151), ("resgate_15", 148), ("come_cotas", 148)):
    modo1(f"ancora_rent3_infl45_{reg}", entrada(500_000, 3_000, rent=0.03, regime=reg),
          {"duracao": d, "esgotou": True})
for reg, d in (("isento", 339), ("resgate_15", 279), ("come_cotas", 253)):
    modo1(f"ancora_ipca_mais_6_{reg}",
          entrada(1_000_000, 6_000, rent=taxa_ipca_mais(I, 0.06), regime=reg),
          {"duracao": d, "esgotou": True})
for rent, d in ((0.09, 122), (0.11, 138), (0.13, 160)):
    modo1(f"ancora_cenario_{int(rent * 100)}pct", entrada(500_000, 5_000, rent=rent),
          {"duracao": d, "esgotou": True})

trajetoria("ancora_trajetoria_1M_8k_comecotas",
           entrada(1_000_000, 8_000, regime="come_cotas"), [1, 6, 13],
           {1: {"saldo_bruto": 1_000_664.72},
            6: {"imposto_mes": 7_705.06, "saldo_bruto": 995_811.33},
            13: {"imposto_mes": 0.0, "retirada_liquida_nominal": 8_360.00}})

# --------------------------------------------- vetores extras (calculados pelo gabarito)
# mês de início diferente (janeiro, maio, junho, dezembro) no come-cotas
for mes in (1, 5, 6, 12):
    modo1(f"extra_m1_comecotas_mes{mes}", entrada(600_000, 4_000, regime="come_cotas", mes=mes))
# mês de início também no modo 2 e 3
modo2("extra_m2_comecotas_mes1", entrada(retirada=4_000, prazo_meses=180, regime="come_cotas", mes=1))
modo2("extra_m2_resgate15_mes5", entrada(retirada=4_000, prazo_meses=180, regime="resgate_15", mes=5))
modo3("extra_m3_comecotas_mes6", entrada(valor_inicial=800_000, prazo_meses=120, regime="come_cotas", mes=6))
# inflação zero
modo1("extra_m1_infl0_isento", entrada(300_000, 3_000, infl=0.0))
modo2("extra_m2_infl0_resgate15", entrada(retirada=3_000, prazo_meses=120, infl=0.0, regime="resgate_15"))
modo3("extra_m3_infl0_comecotas", entrada(valor_inicial=300_000, prazo_meses=120, infl=0.0, regime="come_cotas"))
# rentabilidade zero com inflação
modo1("extra_m1_rent0_infl45_isento", entrada(100_000, 1_000, rent=0.0))
modo2("extra_m2_rent0_infl0_isento", entrada(retirada=1_000, prazo_meses=60, rent=0.0, infl=0.0))
# rentabilidade abaixo da inflação, modos 2 e 3
modo2("extra_m2_rent3_infl45_comecotas", entrada(retirada=3_000, prazo_meses=120, rent=0.03, regime="come_cotas"))
modo3("extra_m3_rent3_infl45_resgate15", entrada(valor_inicial=500_000, prazo_meses=120, rent=0.03, regime="resgate_15"))
# IPCA + x nos modos 2 e 3
modo2("extra_m2_ipca_mais_5_isento", entrada(retirada=6_000, prazo_meses=300, rent=taxa_ipca_mais(I, 0.05)))
modo3("extra_m3_ipca_mais_5_comecotas",
      entrada(valor_inicial=1_000_000, prazo_meses=300, rent=taxa_ipca_mais(I, 0.05), regime="come_cotas"))
# dinheiro que não se esgota (1.200 meses concluídos) em outros regimes
modo1("extra_m1_nao_esgota_resgate15", entrada(3_000_000, 2_000, regime="resgate_15"))
modo1("extra_m1_nao_esgota_comecotas", entrada(3_000_000, 2_000, regime="come_cotas"))
# prazo curto e retirada maior que o saldo
modo1("extra_m1_esgota_no_mes_1", entrada(1_000, 5_000))
modo2("extra_m2_prazo_1_mes", entrada(retirada=5_000, prazo_meses=1, regime="resgate_15"))
modo3("extra_m3_prazo_1_mes_isento", entrada(valor_inicial=50_000, prazo_meses=1))
# trajetórias dos outros regimes
trajetoria("extra_trajetoria_resgate15", entrada(500_000, 5_000, regime="resgate_15"), [1, 12, 60, 127])
trajetoria("extra_trajetoria_isento", entrada(500_000, 5_000), [1, 12, 138])

json.dump({"tolerancia": 0.01, "casos": casos},
          open("test_vectors_retirada.json", "w"), indent=1, ensure_ascii=False)
print(len(casos), "casos gravados")
