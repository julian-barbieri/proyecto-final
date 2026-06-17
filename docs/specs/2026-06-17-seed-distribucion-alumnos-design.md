# Spec: Corrección de distribución de alumnos en seed masivo

**Fecha:** 2026-06-17  
**Archivo principal:** `ai-service/data/seed-data-generator.py`  
**Acción posterior:** Regenerar `backend/src/db/seed-masivo-data.json` y re-correr el seed

---

## Contexto

El seed masivo (`seedMasivo500AlumnosCDU()` en `seed.js`) carga los datos de ~640 alumnos desde `seed-masivo-data.json`, generado por `seed-data-generator.py`. El JSON contiene perfiles de alumnos con cursadas y exámenes históricos y del 2026.

Se detectaron tres problemas en los datos generados:

1. **90 alumnos en riesgo de abandono** (objetivo: 10-15): el modelo ML predice demasiados alumnos como at-risk porque la proporción de perfiles "regular" y "malo" es alta (25%).
2. **Muchos alumnos con cursada 2026 finalizada**: la simulación corre ambos cuatrimestres de 2026, generando Finales aprobados. El panel los detecta como "Aprobados" vía `estado_efectivo`, cuando deberían estar en curso.
3. **Distribución de cursadas 2026 no equitativa**: Teología (año 4, sin correlatvas) aparece con 507 alumnos en 2026 porque cualquier alumno de cualquier año puede tomarla. Proyecto Final (año 5) aparece con 4.

---

## Solución: 3 cambios en `seed-data-generator.py`

### Cambio 1 — Reducir perfiles en riesgo (`TIPOS_PROB`)

**Línea ~46**

```python
# ANTES
TIPOS_PROB = [0.75, 0.20, 0.05]  # excelente, regular, malo

# DESPUÉS
TIPOS_PROB = [0.95, 0.04, 0.01]
```

Con ~580 alumnos generados (después del filtro de abandono): ~23 "regular" + ~6 "malo" = ~29 con perfil de riesgo. El modelo ML no predice a todos como at-risk → resultado esperado: **10-18 alumnos en riesgo**. Si el resultado queda en el borde alto (~18), ajustar a `[0.96, 0.03, 0.01]` y regenerar.

---

### Cambio 2 — Snapshot solo en cuatrimestre 1 de 2026

**Función `simular_trayectoria_seed`, línea ~106**

```python
# ANTES
for anio in range(perfil['AnioIngreso'], snapshot_anio + 1):
    for cuatr in [1, 2]:

# DESPUÉS
for anio in range(perfil['AnioIngreso'], snapshot_anio + 1):
    cuatrs = [1] if anio == snapshot_anio else [1, 2]
    for cuatr in cuatrs:
```

Para años históricos (2022-2025): ambos cuatrimestres se simulan normalmente. Para 2026: solo cuatrimestre 1. Efecto: los alumnos 2026 tienen a lo sumo Parcial 1 y Recuperatorio 1, sin Finales. `snapshot_to_alumno` ya setea `estado = 'cursando'` para todas las cursadas de 2026, por lo que el panel los mostrará como en curso.

---

### Cambio 3 — Restricción de materias por año de carrera

**Función `simular_trayectoria_seed`, línea ~116**

```python
# ANTES
disponibles = [
    m for m in MATERIAS
    if m not in aprobadas
    and m not in pendiente_recursa
    and all(c in aprobadas for c in MATERIAS[m][3])
    and (MATERIAS[m][1] == 'C' or cuatr == 1)
]

# DESPUÉS
anio_relativo = anio - perfil['AnioIngreso'] + 1
disponibles = [
    m for m in MATERIAS
    if m not in aprobadas
    and m not in pendiente_recursa
    and all(c in aprobadas for c in MATERIAS[m][3])
    and (MATERIAS[m][1] == 'C' or cuatr == 1)
    and MATERIAS[m][2] <= anio_relativo
]
```

`MATERIAS[m][2]` es el `año_plan` de la materia (1-5). `anio_relativo` es el año de carrera del alumno en ese momento (`anio - AnioIngreso + 1`). La restricción impide que alumnos de años inferiores tomen materias de años superiores. Las materias en `recursa_disp` (recursadas) no pasan por este filtro y siguen funcionando correctamente.

Distribución esperada tras el cambio:

| Materia | Año plan | Antes | Después |
|---|---|---|---|
| Teología | 4 | ~507 | ~120-180 |
| Proyecto Final | 5 | ~4 | ~30-60 |
| AM1 | 1 | ~150 | ~150 (sin cambio) |

---

## Pasos de ejecución

1. Aplicar los 3 cambios en `ai-service/data/seed-data-generator.py`
2. Regenerar el JSON: `cd ai-service && python data/seed-data-generator.py`
3. Wipear y re-correr el seed de la base de datos
4. Verificar en el panel: conteo de alumnos en riesgo y distribución por materia

---

## Archivos modificados

- `ai-service/data/seed-data-generator.py` — 3 cambios quirúrgicos
- `backend/src/db/seed-masivo-data.json` — regenerado automáticamente por el script Python

No se modifica `seed.js` ni ningún otro archivo.
