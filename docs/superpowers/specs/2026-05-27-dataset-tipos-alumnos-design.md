# Diseño: Generación de Dataset con Tipos de Alumnos

**Fecha:** 2026-05-27  
**Archivo afectado:** `ai-service/data/generar_datasets.py`

---

## Objetivo

Refactorizar el generador de datasets para que los alumnos tengan perfiles realistas y diferenciados. Las notas y la asistencia deben ser los predictores dominantes de rendimiento y abandono, de modo que el modelo les asigne alta importancia.

---

## 1. Tipos de alumnos

Al crear cada alumno se le asigna un `tipo_alumno` que controla todas sus distribuciones. Las proporciones son fijas:

| Tipo | Proporción |
|---|---|
| `excelencia` | 50% |
| `regular` | 40% |
| `bajo_rendimiento` | 10% |

```python
tipo = np.random.choice(
    ["excelencia", "regular", "bajo_rendimiento"],
    p=[0.50, 0.40, 0.10]
)
```

---

## 2. Distribuciones de notas por tipo

Se reemplaza `generar_nota(media, std)` por `generar_nota_tipo(tipo)`:

| Tipo | Distribución | Rango efectivo |
|---|---|---|
| `excelencia` | N(8.0, 1.0) clip [7, 10] | 7–10, media ~8 |
| `regular` | N(5.5, 1.0) clip [4, 7] | 4–7, media ~5.5 |
| `bajo_rendimiento` | N(2.5, 0.8) clip [1, 4] | 1–4, media ~2.5 |

La nota ≥ 4 es el umbral de aprobación. Con estos rangos:
- Excelencia: aprueba casi siempre en primera instancia.
- Regular: aprueba, a veces necesita recuperatorio.
- Bajo rendimiento: casi siempre desaprueba (1-3), raramente alcanza 4.

Para recuperatorios y reexámenes se usa la misma función del tipo (el alumno no mejora mágicamente su perfil).

---

## 3. Distribuciones de asistencia por tipo

La asistencia se genera por cursada a partir del tipo, no del flag `abandona`:

| Tipo | Distribución |
|---|---|
| `excelencia` | uniform(0.90, 1.00) |
| `regular` | uniform(0.75, 1.00) |
| `bajo_rendimiento` | uniform(0.50, 0.80) |

---

## 4. Lógica de abandono

### 4a. Asignación al crear el alumno

```python
prob_abandono = {
    "excelencia": 0.00,
    "regular": 0.015,
    "bajo_rendimiento": 0.88,
}
abandona = np.random.random() < prob_abandono[tipo]
```

**Resultado esperado en 500 alumnos:**
- Excelencia (250): 0 abandonan
- Regular (200): ~3 abandonan
- Bajo rendimiento (50): ~44 abandonan
- Total: ~47 abandonan (~9.4%), LP representa ~94% de los que abandonan (≈95% objetivo)

### 4b. Timing del abandono (año-carrera de corte)

A cada alumno que abandona se le asigna un `anio_carrera_corte` que representa el año del plan donde deja de cursar:

| Tipo | Distribución del corte |
|---|---|
| `bajo_rendimiento` | 70% en año 1, 25% en año 2, 5% en año 3 |
| `regular` | 20% en año 2, 40% en año 3, 40% en año 4 |

Esto produce tasas condicionales de abandono decrecientes por año (los LP ya no están cuando se llega a año 3-4-5):

| Materias de año | Tasa condicional aprox. |
|---|---|
| Año 1-2 | ~8-9% |
| Año 3 | ~2-3% |
| Año 4 | ~1% |
| Año 5 | ~0% |

> **Nota sobre constraints:** las tasas objetivo (20%, 13%, 6%) no son alcanzables simultáneamente con LP = 10% y split 95/5 LP/regular. El diseño prioriza el split (más relevante para el modelo). Si se requieren tasas más altas, aumentar la proporción de LP o la probabilidad de abandono de regulares.

### 4c. Mapeo a cuatrimestres

`anio_carrera_corte` se convierte a `cuatrimestres_abandono` para mantener compatibilidad con el código existente:
- Año 1 → cuatrimestre 1 o 2 (aleatorio)
- Año 2 → cuatrimestre 3 o 4
- Año 3 → cuatrimestre 5 o 6

---

## 5. Cambios en nivel_examen.csv

El flujo de exámenes (parciales, recuperatorios, finales) se mantiene igual estructuralmente. Los cambios son:

- `generar_nota()` → `generar_nota_tipo(tipo_alumno)`
- La lógica `aprueba = True if not abandona else random < 0.30` desaparece: el aprobado se deriva directamente de si la nota ≥ 4
- `asistencia_final` se genera con los rangos del tipo antes de entrar al loop de exámenes

---

## 6. Cambios en nivel_materia.csv

| Campo | Antes | Después |
|---|---|---|
| `Asistencia` | Basada en flag `abandona` | Basada en `tipo_alumno` |
| `Recursa` | Heurística con `prob_recursa` fija | Probabilidad por tipo + año del plan |
| `NotaPromedioPrevias` | `random.uniform(4, 8)` | Promedio real de notas de correlativas del alumno |

**Probabilidad de recursado por tipo y año:**

| Tipo | Año 1-2 | Año 3-5 |
|---|---|---|
| `excelencia` | 3% | 1% |
| `regular` | 15% | 6% |
| `bajo_rendimiento` | 70% (si aún no abandonó) | 50% |

---

## 7. Cambios en nivel_alumno.csv

- Se agrega columna `TipoAlumno` (valor: `excelencia`, `regular`, `bajo_rendimiento`)
- `MateriasAprobadas` refleja el tipo: LP que no abandonaron tienen pocas (1-5), regulares más (10-30), excelencia ~48
- `MateriasRecursadasTotal` coherente: LP con muchas, excelencia con 0 o pocas

---

## 8. Impacto esperado en el modelo

El modelo de predicción debe aprender que:
- **Nota baja + asistencia baja → alta probabilidad de abandono y recursado**
- **Nota alta + asistencia alta → baja probabilidad de abandono, alta tasa de aprobación**

`TipoAlumno` puede usarse como feature de validación (no debe ser necesario como predictor si las notas y asistencia ya capturan la señal).

---

## 9. Archivos modificados

```
ai-service/data/generar_datasets.py
  ├── Nueva función generar_nota_tipo(tipo)
  ├── tipo_alumno asignado en creación de estudiantes
  ├── Abandono y anio_carrera_corte por tipo
  ├── Asistencia por tipo en exámenes y cursadas
  ├── Recursa y NotaPromedioPrevias coherentes con tipo
  └── TipoAlumno agregado a nivel_alumno.csv
```
