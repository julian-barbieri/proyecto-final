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
    """Student whose only exams are for the materia being predicted -> 0."""
    df = pd.DataFrame({
        'IdAlumno':     ['A', 'A'],
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
