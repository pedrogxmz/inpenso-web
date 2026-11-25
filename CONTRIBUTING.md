# Guía de Contribución (Contributing Guide)

¡Gracias por tu interés en contribuir a **Inpenso Web (PWA)**! Este documento describe el flujo de trabajo, las convenciones del repositorio y los pasos para proponer mejoras o correcciones.

---

## 🧭 Principios del proyecto

1. **100% Local-First y Privacidad**: Todos los datos financieros del usuario (gastos, ingresos, cuentas y presupuestos) deben almacenarse localmente en el dispositivo (`localStorage`) sin enviar información personal a servidores externos.
2. **Experiencia PWA Multiplataforma**: Cualquier cambio visual debe verse y funcionar bien tanto en **móvil** (Safari en iOS / Chrome en Android con barra inferior) como en **escritorio** (diseño con barra lateral izquierda y cuadrículas multicolumna).
3. **Compatibilidad de Datos**: Mantener la compatibilidad hacia atrás con el esquema JSON de exportación/importación (`Expense`, `Account`, `budgets`).

---

## 🛠️ Configuración del entorno local

### Requisitos previos
- **Node.js** `v20+` o `v22+`
- **npm** `v10+`
- **Git**

### Instalación
1. Clona el repositorio:
   ```bash
   git clone https://github.com/pedrogxmz/inpenso-web.git
   cd inpenso-web
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
4. Verifica tipos y compilación de producción antes de subir cambios:
   ```bash
   npm run typecheck
   npm run build
   ```

---

## 🌿 Flujo de ramas (GitHub Flow)

El código productivo vive siempre en la rama **`main`**. No se suben archivos compilados (`dist/`) al repositorio ni se utiliza una rama manual `gh-pages`; el despliegue a GitHub Pages ocurre automáticamente mediante **GitHub Actions** al integrar cambios en `main`.

### 1. Crea una rama por funcionalidad o corrección
Desde `main` actualizada, crea una rama con prefijo descriptivo:
- `feat/nombre-de-la-funcionalidad` — para nuevas características (ej. `feat/export-csv`)
- `fix/nombre-del-error` — para correcciones de bugs (ej. `fix/cut-date-february`)
- `docs/descripcion` — para mejoras de documentación (ej. `docs/contributing-guide`)

```bash
git checkout main
git pull origin main
git checkout -b feat/mi-mejora
```

### 2. Convención de mensajes de commit (Conventional Commits)
Usa mensajes claros con prefijo:
- `feat: agrega filtro por cuenta en transacciones`
- `fix: corrige cálculo de interés compuesto en años bisiestos`
- `docs: actualiza guía de instalación en iOS`
- `ci: ajusta pipeline de validación`

### 3. Abre un Pull Request hacia `main`
Sube tu rama y abre un Pull Request:
```bash
git push -u origin feat/mi-mejora
gh pr create --fill
```

---

## ⚙️ Validación continua (CI/CD)

Cada Pull Request ejecuta automáticamente el workflow `.github/workflows/ci-cd.yml`:
1. **`Validate & Build (CI)`**:
   - Instala dependencias limpias (`npm ci`).
   - Verifica el tipado estricto de TypeScript (`npx tsc --noEmit`).
   - Ejecuta el build de producción (`npm run build`).
2. **`Deploy to GitHub Pages (CD)`**:
   - Una vez aprobado y fusionado (*merge*) el Pull Request en `main`, GitHub Actions publica automáticamente la nueva versión en **[https://pedrogxmz.github.io/inpenso-web/](https://pedrogxmz.github.io/inpenso-web/)**.

---

## 📁 Estructura del proyecto

```text
inpenso-web/
├── .github/workflows/
│   └── ci-cd.yml                          # Pipeline de validación (CI) y despliegue a Pages (CD)
├── ios-bridge/
│   └── FoundationModelsWebBridge.swift    # Puente nativo opcional para Apple Intelligence en iOS 26+
├── public/
│   ├── icon.svg                           # Icono de la PWA
│   ├── manifest.json                      # Manifiesto Web App (iOS / Android / Desktop)
│   └── sw.js                              # Service Worker (network-first con respaldo offline)
├── src/
│   ├── bridge/
│   │   └── appleIntelligence.ts           # Conector con el puente nativo de iOS
│   ├── App.tsx                            # Vistas principales (Inicio, Analíticas, Gastos, Cuentas, Ajustes)
│   ├── index.css                          # Estilos globales, safe-areas de iOS y variantes claro/oscuro
│   ├── main.tsx                           # Punto de entrada y registro del Service Worker
│   └── types.ts                           # Modelos y fórmulas (corte, pago, rendimiento diario compuesto)
├── CONTRIBUTING.md                        # Esta guía de contribución
└── README.md                              # Documentación general del proyecto
```
