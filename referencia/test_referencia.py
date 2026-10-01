"""Testes do próprio gabarito (rode: python -m pytest -q  ou  python test_referencia.py)."""
import json, math
from motor_referencia import *

def test_ancoras():
    assert abs(simular(Parametros(pmt0=1000, n=240, retorno_anual=.11))["resumo"]["bruto_nominal"] - 808544.93) < .01
    assert abs(resolver_aporte(2e6, Parametros(n=240, retorno_anual=.11)) - 2473.58) < .01

def test_isento_sem_inflacao_eh_identidade():
    r = simular(Parametros(pv=1000, pmt0=100, n=24, retorno_anual=.1))["resumo"]
    assert r["liquido_real"] == r["bruto_nominal"]

def test_come_cotas_pior_que_resgate_unico():
    a = simular(Parametros(pmt0=1000, n=240, retorno_anual=.11, regime="resgate_15"))["resumo"]
    b = simular(Parametros(pmt0=1000, n=240, retorno_anual=.11, regime="come_cotas"))["resumo"]
    assert b["liquido_nominal"] < a["liquido_nominal"]

def test_ordem_dos_regimes():
    v = {r: simular(Parametros(pmt0=1000, n=240, retorno_anual=.11, regime=r))["resumo"]["liquido_real"] for r in REGIMES}
    assert v["isento"] > v["resgate_15"] > v["come_cotas"]

def test_solver_ida_e_volta():
    p = Parametros(n=180, retorno_anual=.1, inflacao_anual=.04, reajuste_anual=.04, regime="come_cotas")
    x = resolver_aporte(500000, p)
    p.pmt0 = x
    assert abs(simular(p)["resumo"]["liquido_real"] - 500000) < .01

def test_investido_real():
    r = simular(Parametros(pv=1000, pmt0=100, n=24, retorno_anual=.1))["resumo"]
    assert abs(r["investido_real"] - r["investido_nominal"]) < 1e-9          # sem inflação
    q = simular(Parametros(pv=1000, pmt0=100, n=24, retorno_anual=.1, inflacao_anual=.05))["resumo"]
    assert q["investido_real"] < q["investido_nominal"]
    esperado = 1000 + sum(100 / 1.05 ** (k / 12) for k in range(1, 25))
    assert abs(q["investido_real"] - esperado) < 1e-9

if __name__ == "__main__":
    for nome, fn in list(globals().items()):
        if nome.startswith("test_"):
            fn(); print("ok", nome)
