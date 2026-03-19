# 📚 Sistema de Predicción Académica

## 🎯 ¿De qué trata este proyecto?

Este es un **sistema inteligente de predicción académica** que utiliza Inteligencia Artificial y Machine Learning para predecir el desempeño de estudiantes universitarios. 

El sistema puede predecir:
- 🚀 **Abandono de carrera**: Si un estudiante tiene riesgo de abandonar sus estudios
- 📖 **Recursado de materia**: Si un estudiante probablemente deba repetir una asignatura
- 📊 **Nota de examen**: La calificación estimada que obtendrá en un examen

---

## 🏗️ ¿Cómo está organizado el proyecto?

El proyecto está dividido en **3 componentes principales**:

```
proyecto-final/
├── frontend/          → Aplicación web (donde los usuarios interactúan)
├── backend/           → Servidor API (procesa las solicitudes)
└── ai-service/        → Modelos de IA (hace las predicciones)
```

### **Frontend** 🖥️
- Interfaz web moderna y fácil de usar
- Construido con React + Vite + Tailwind CSS
- Los usuarios pueden autenticarse e ingresar datos de estudiantes

### **Backend** 🔧
- Servidor Express.js que actúa como intermediario
- Maneja autenticación de usuarios
- Almacena historial de predicciones en una base de datos SQLite
- Proporciona API REST para comunicarse con el frontend

### **AI Service** 🤖
- Aplicación Streamlit con modelos de Machine Learning
- 3 modelos entrenados para diferentes predicciones
- Proporciona explicabilidad con gráficos SHAP

---

## 📋 Requisitos previos

Antes de ejecutar el proyecto, necesitas tener instalado:

- **Python 3.8 o superior** ([Descargar](https://www.python.org/))
- **Node.js 14 o superior** ([Descargar](https://nodejs.org/))
- **npm** (viene incluido con Node.js)
- **Git** (opcional, para clonar el proyecto)

Puedes verificar si los tienes instalados ejecutando en terminal:
```bash
python --version
node --version
npm --version
```

---

## 🚀 ¿Cómo ejecutar el proyecto?

### **Paso 1: Preparar el entorno backend**

Abre una terminal en la carpeta `backend/` y ejecuta:

```bash
cd backend

# Instalar dependencias
npm install

# Ejecutar el servidor
npm start
```

El backend estará disponible en: `http://localhost:3001`

---

### **Paso 2: Preparar el entorno frontend**

Abre una **nueva terminal** en la carpeta `frontend/` y ejecuta:

```bash
cd frontend

# Instalar dependencias
npm install

# Ejecutar la aplicación web
npm run dev
```

El frontend estará disponible en: `http://localhost:5173`

---

### **Paso 3: Configurar el entorno AI Service**

Abre una **tercera terminal** en la carpeta `ai-service/` y ejecuta:

```bash
cd ai-service

# Crear un entorno virtual de Python
python -m venv venv

# Activar el entorno virtual
# En Windows:
venv\Scripts\activate
# En Mac/Linux:
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar la aplicación Streamlit
streamlit run app/streamlit_app.py
```

La aplicación Streamlit estará disponible en: `http://localhost:8501`

---

## ✅ Verificar que todo funciona

Cuando todo esté en marcha, deberías ver:

| Servicio | URL | Estado |
|----------|-----|--------|
| Frontend | `http://localhost:5173` | Aplicación web cargada |
| Backend | `http://localhost:3001/health` | `{ "status": "ok" }` |
| AI Service | `http://localhost:8501` | Dashboard de predicciones |

---

## 📁 Estructura del proyecto en detalle

```
proyecto-final/
│
├── frontend/                    # Aplicación web (React)
│   ├── src/
│   │   ├── components/          # Componentes React
│   │   ├── pages/               # Páginas principales
│   │   ├── context/             # Autenticación
│   │   └── api/                 # Llamadas al backend
│   ├── package.json
│   └── vite.config.js
│
├── backend/                     # Servidor API (Express.js)
│   ├── src/
│   │   ├── app.js               # Archivo principal del servidor
│   │   ├── routes/              # Rutas de la API
│   │   ├── db/                  # Base de datos SQLite
│   │   ├── config/              # Configuración (autenticación)
│   │   └── middleware/          # Middleware personalizado
│   ├── package.json
│   └── .env                     # Variables de entorno
│
└── ai-service/                  # Modelos de IA (Streamlit + ML)
    ├── app/
    │   └── streamlit_app.py     # Aplicación Streamlit
    ├── src/
    │   ├── model_training_evaluation.py  # Entrenamiento de modelos
    │   ├── model_explainability.py       # Explicabilidad SHAP
    │   └── model_deploy.py               # Despliegue
    ├── data/                    # Datos para entrenar modelos
    ├── models/                  # Modelos entrenados (.pkl)
    ├── requirements.txt         # Dependencias Python
    └── Dockerfile              # Para ejecutar en Docker

```

---

## 🛠️ Tecnologías utilizadas

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Express.js, SQLite, Passport.js
- **AI**: Python, Streamlit, Scikit-learn, SHAP
- **Autenticación**: Passport.js con sesiones

---

## 🔧 Solución de problemas

### El frontend no puede conectar con el backend
- Asegúrate de que el backend esté ejecutándose en `http://localhost:3001`
- Verifica las variables de entorno en `backend/.env`

### Error al instalar dependencias Python
- Asegúrate de tener Python 3.8+ instalado
- Usa un entorno virtual: `python -m venv venv`

### Puerto reservado
Si un puerto ya está en uso, puedes cambiar el puerto en:
- **Frontend**: Edita `frontend/vite.config.js`
- **Backend**: Edita la variable `PORT` en `backend/.env`
- **Streamlit**: Usa `streamlit run app/streamlit_app.py --server.port 8502`

---

## 📖 Flujo de uso

1. **Abre el navegador** en `http://localhost:5173` (frontend)
2. **Inicia sesión** con tu usuario
3. **Ingresa datos del estudiante** (historial académico, etc.)
4. **Recibe predicciones** del sistema de IA
5. **Visualiza explicaciones** de por qué el modelo hizo esa predicción

---

## 📞 Contacto

Si tienes dudas sobre cómo ejecutar este proyecto, verifica que:
- ✅ Todos los requisitos estén instalados
- ✅ Estés ejecutando los comandos en las carpetas correctas
- ✅ Los puertos estén disponibles (5173, 3001, 8501)

---

**¡Listo! Ya puedes usar el sistema de predicción académica.** 🎉
