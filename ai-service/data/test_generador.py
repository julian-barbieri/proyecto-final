"""Unit tests for generar_datasets.py and ft_engineering.py fixes."""
import numpy as np
import pandas as pd


def test_fix1_loo_examen_single_exam():
    """Student with 1 exam: LOO PromedioNotaGeneral must be 0, not nota itself."""
    df = pd.DataFrame({
        'Nota':                [7.0,  8.0,  5.0],
        'PromedioNotaGeneral': [7.5,  7.5,  5.0],
        '_n_exams':            [2,    2,    1],
    })

    df['PromedioNotaGeneral'] = np.where(
        df['_n_exams'] > 1,
        (df['PromedioNotaGeneral'] * df['_n_exams'] - df['Nota']) / (df['_n_exams'] - 1),
        0.0,
    )

    assert df.loc[0, 'PromedioNotaGeneral'] == 8.0
    assert df.loc[1, 'PromedioNotaGeneral'] == 7.0
    assert df.loc[2, 'PromedioNotaGeneral'] == 0.0


def test_fix2_loo_materia_all_exams_from_same_subject():
    """Two independent scenarios tested in one pass:
    Row 0 (student A): all 2 exams belong to materia 140 → LOO average = 0.0
    Row 1 (student B): 2 exams total, 1 in materia 141, 1 in other → LOO average = 7.0
    """
    df = pd.DataFrame({
        'IdAlumno':     ['A', 'B'],
        'Materia':      [140, 141],
        '_global_sum':  [15.0, 15.0],
        '_global_cnt':  [2,    2],
        '_self_sum':    [15.0, 8.0],
        '_self_cnt':    [2,    1],
    })
    remaining = (df['_global_cnt'] - df['_self_cnt']).clip(lower=1)
    df['PromedioNotaGeneral'] = np.where(
        df['_global_cnt'] > df['_self_cnt'],
        (df['_global_sum'] - df['_self_sum']) / remaining,
        0.0,
    )
    assert df.loc[0, 'PromedioNotaGeneral'] == 0.0
    assert df.loc[1, 'PromedioNotaGeneral'] == 7.0


if __name__ == '__main__':
    test_fix1_loo_examen_single_exam()
    test_fix2_loo_materia_all_exams_from_same_subject()
    print('All leakage tests PASSED')


# ── Imports needed for generator tests ──────────────────────
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))


def test_sigmoid_range():
    from generar_datasets import sigmoid
    assert sigmoid(0.0) == 0.5
    assert 0 < sigmoid(-10) < 0.1
    assert 0.9 < sigmoid(10) < 1.0


def test_calcular_hazard_monotone():
    from generar_datasets import calcular_hazard
    import numpy as np
    hazards_high = [calcular_hazard('malo', 0.9, 0.8, 0.0, np.random.default_rng(i)) for i in range(200)]
    hazards_low  = [calcular_hazard('malo', 0.1, 0.8, 0.0, np.random.default_rng(i)) for i in range(200)]
    assert np.mean(hazards_high) < np.mean(hazards_low)


def test_generar_nota_range():
    from generar_datasets import generar_nota
    import numpy as np
    rng = np.random.default_rng(42)
    notas = [generar_nota('excelente', rng) for _ in range(500)]
    assert all(1.0 <= n <= 10.0 for n in notas)
    assert np.mean(notas) > 6.5


def test_generar_nota_overlap():
    from generar_datasets import generar_nota
    import numpy as np
    rng = np.random.default_rng(42)
    notas_excelente = [generar_nota('excelente', rng) for _ in range(1000)]
    notas_regular   = [generar_nota('regular',   rng) for _ in range(1000)]
    assert any(n < 7.0 for n in notas_excelente)
    assert any(n > 6.5 for n in notas_regular)
