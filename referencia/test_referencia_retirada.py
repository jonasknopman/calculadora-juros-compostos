"""Testes do gabarito da fase 2 (rode: python -m pytest -q  ou  python test_referencia_retirada.py)."""
import json, os
from motor_retirada import *

TOL = 0.01
CAMINHO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_vectors_retirada.json")
VETORES = json.load(open(CAMINHO, encoding="utf-8"))["casos"]
REGS = REGIMES


def _args(e):
    return e["rentabilidade_aa"], e["inflacao_aa"], e["regime"], e["mes_inicio"]


# ------------------------------------------------------------------ vetores --
def test_quantidade_e_cobertura_dos_vetores():
    assert len(VETORES) >= 24
    for tipo in ("duracao", "valor_necessario", "retirada_possivel", "trajetoria"):
        for reg in REGS:
            if tipo != "trajetoria":
                assert any(v["tipo"] == tipo and v["entrada"]["regime"] == reg for v in VETORES), (tipo, reg)
    assert {1, 5, 6, 12} <= {v["entrada"]["mes_inicio"] for v in VETORES}
    assert any(v["ancora"] for v in VETORES)


def test_vetores():
    for v in VETORES:
        e, esp, tipo = v["entrada"], v["esperado"], v["tipo"]
        if tipo == "duracao":
            meses, esgotou = duracao(e["valor_inicial"], e["retirada"], *_args(e))
            assert meses == esp["duracao"], (v["nome"], meses, esp)       # prazo exato
            assert esgotou == esp["esgotou"], v["nome"]
        elif tipo == "valor_necessario":
            x = valor_necessario(e["retirada"], e["prazo_meses"], *_args(e))
            assert abs(x - esp["valor_inicial"]) <= TOL, (v["nome"], x, esp)
        elif tipo == "retirada_possivel":
            y = retirada_possivel(e["valor_inicial"], e["prazo_meses"], *_args(e))
            assert abs(y - esp["retirada"]) <= TOL, (v["nome"], y, esp)
        elif tipo == "trajetoria":
            t = simular(e["valor_inicial"], e["retirada"], *_args(e))["trajetoria"]
            for mes, campos in esp.items():
                for campo, valor in campos.items():
                    assert abs(t[int(mes) - 1][campo] - valor) <= TOL, (v["nome"], mes, campo)
        else:
            raise AssertionError(f"tipo desconhecido: {tipo}")


# ------------------------------------------------------------- propriedades --
def test_isento_modo2_confere_com_anuidade_antecipada_real():
    for rent, infl, y, n in [(.11, .045, 5000, 240), (.08, .03, 2500, 120), (.07, .06, 1000, 60),
                             (.03, .045, 3000, 100)]:
        r = (1 + rent) / (1 + infl)            # fator real anual
        i = r ** (1 / 12) - 1                  # taxa real mensal
        anuidade = y * (1 - (1 + i) ** -n) / i * (1 + i)
        x = valor_necessario(y, n, rent, infl, "isento", 1)
        assert abs(x - anuidade) <= TOL, (rent, infl, x, anuidade)


def test_monotonicidade_duracao():
    for reg in REGS:
        ant = -1
        for x in (100_000, 200_000, 400_000, 800_000, 1_600_000):    # X maior: nunca dura menos
            d, _ = duracao(x, 4_000, .11, .045, reg, 12)
            assert d >= ant, (reg, x)
            ant = d
        ant = 10**9
        for y in (1_000, 2_000, 4_000, 8_000, 16_000):               # Y maior: nunca dura mais
            d, _ = duracao(500_000, y, .11, .045, reg, 12)
            assert d <= ant, (reg, y)
            ant = d


def test_ida_e_volta_nos_tres_regimes():
    for reg in REGS:
        for mes in (1, 5, 12):
            for y, n in ((5_000, 240), (3_000, 100), (8_000, 36)):
                x = valor_necessario(y, n, .11, .045, reg, mes)
                y2 = retirada_possivel(x, n, .11, .045, reg, mes)
                assert abs(y2 - y) <= TOL, (reg, mes, y, y2)


def test_modos_2_e_3_resultado_exato_e_folga_de_dois_centavos():
    for reg in REGS:
        for rent, infl in ((.11, .045), (.03, .045), (.0, .0)):
            n = 120
            a = (rent, infl, reg, 12)
            x = valor_necessario(3_000, n, *a)
            assert duracao(x, 3_000, *a)[0] >= n                       # exato satisfaz
            assert duracao(x - 0.02, 3_000, *a)[0] < n                 # 2 centavos a menos não
            y = retirada_possivel(500_000, n, *a)
            assert duracao(500_000, y, *a)[0] >= n
            assert duracao(500_000, y + 0.02, *a)[0] < n


def test_rentabilidade_zero_e_inflacao_zero_eh_x_sobre_y_para_baixo():
    for reg in REGS:
        for x, y in ((120_000, 1_000), (100_000, 3_000), (1_000, 5_000), (10_000, 3_333.33)):
            esperado = int(x // y)
            d, _ = duracao(x, y, 0.0, 0.0, reg, 12)
            assert d == esperado, (reg, x, y, d, esperado)


def test_taxa_ipca_mais():
    assert abs(taxa_ipca_mais(.045, .06) - 0.1077) < 1e-12


def test_trajetoria_consistente():
    t = simular(1_000_000, 8_000, .11, .045, "come_cotas", 12)["trajetoria"]
    assert len(t) == 168
    for linha in t:   # retirada bruta nunca menor que a líquida; saldo líquido nunca maior que o bruto
        assert linha["retirada_bruta"] >= linha["retirada_liquida_nominal"] - 1e-9
        assert linha["saldo_liquido"] <= linha["saldo_bruto"] + 1e-9
    # em reais de hoje a retirada líquida é exatamente Y todo mês
    for linha in t:
        assert abs(linha["retirada_liquida_nominal"] / 1.045 ** ((linha["mes"] - 1) / 12) - 8_000) < 1e-6


def test_regime_invalido():
    try:
        simular(1000, 10, .1, .04, "xyz", 1)
    except ValueError:
        return
    raise AssertionError("deveria recusar regime inválido")


if __name__ == "__main__":
    for nome, fn in list(globals().items()):
        if nome.startswith("test_"):
            fn(); print("ok", nome)
