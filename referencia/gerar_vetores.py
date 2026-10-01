"""Gera test_vectors.json a partir do motor de referência.
Uso:  python gerar_vetores.py
O JS (docs/js/motor.js) deve reproduzir cada 'esperado' com tolerância de 0,01.
Casos marcados 'ancora' vêm de números externos já conhecidos (calculadora simples anterior, sem imposto nem inflação)."""
import json
from dataclasses import asdict
from motor_referencia import (Parametros, simular, resolver_aporte, resolver_prazo,
                              taxa_nominal_de_ipca_mais)

def P(**kw): return Parametros(**kw)

casos = []
def forward(nome, p, ancora=None):
    r = simular(p)
    anos = {str(a): {"bruto": r["bruto"][12*a], "liquido": r["liquido"][12*a],
                     "liquido_real": r["liquido_real"][12*a], "investido": r["investido"][12*a],
                     "investido_real": r["investido_real"][12*a]}
            for a in range(1, p.n // 12 + 1) if 12*a <= p.n}
    casos.append({"nome": nome, "tipo": "simular", "entrada": asdict(p),
                  "esperado": {"resumo": r["resumo"], "anos": anos}, "ancora": ancora})

def aporte(nome, alvo, p, ancora=None):
    casos.append({"nome": nome, "tipo": "resolver_aporte", "alvo_liquido_real": alvo,
                  "entrada": asdict(p), "esperado": {"pmt0": resolver_aporte(alvo, p)}, "ancora": ancora})

def prazo(nome, alvo, p):
    casos.append({"nome": nome, "tipo": "resolver_prazo", "alvo_liquido_real": alvo,
                  "entrada": asdict(p), "esperado": {"n": resolver_prazo(alvo, p)}, "ancora": None})

base = dict(n=240, retorno_anual=0.11)
forward("ancora_valor_final_1000_por_mes", P(pmt0=1000, **base), ancora=808544.93)
aporte("ancora_aporte_para_2M", 2_000_000, P(**base), ancora=2473.58)
for reg in ("isento", "resgate_15", "come_cotas"):
    forward(f"1000_mes_20a_{reg}", P(pmt0=1000, regime=reg, **base))
    forward(f"pv50k_aporte500_inflacao_{reg}", P(pv=50000, pmt0=500, n=180, retorno_anual=0.12,
            inflacao_anual=0.045, reajuste_anual=0.045, regime=reg, mes_inicio=10))
    aporte(f"aporte_2M_reais_de_hoje_{reg}", 2_000_000,
           P(inflacao_anual=0.045, reajuste_anual=0.045, regime=reg, **base))
aporte("aporte_2M_inflacao_sem_reajuste", 2_000_000, P(inflacao_anual=0.045, **base))
forward("prazo_curto_resgate_15_18m", P(pv=10000, pmt0=1000, n=18, retorno_anual=0.10, regime="resgate_15"))
forward("so_valor_inicial_come_cotas", P(pv=100000, n=60, retorno_anual=0.10, regime="come_cotas", mes_inicio=3))
forward("retorno_real_negativo", P(pmt0=1000, n=120, retorno_anual=0.03, inflacao_anual=0.05, regime="resgate_15"))
prazo("prazo_1M_come_cotas", 1_000_000,
      P(pv=10000, pmt0=2000, retorno_anual=0.11, inflacao_anual=0.045, reajuste_anual=0.045, regime="come_cotas"))
casos.append({"nome": "ipca_mais_6", "tipo": "taxa_ipca_mais", "inflacao": 0.045, "real": 0.06,
              "esperado": {"retorno_anual": taxa_nominal_de_ipca_mais(0.045, 0.06)}, "ancora": None})

json.dump({"tolerancia": 0.01, "casos": casos}, open("test_vectors.json", "w"), indent=1, ensure_ascii=False)
print(len(casos), "casos gravados")
