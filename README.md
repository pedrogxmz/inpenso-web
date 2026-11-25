# Inpenso Web (PWA)

Adaptación web progresiva (**PWA** en React + TypeScript + Tailwind CSS) basada en el proyecto original para iOS **[VintusS/Inpenso](https://github.com/VintusS/Inpenso)** creado por Dragomir Mindrescu.

🌐 **Demo en vivo:** **[https://pedrogxmz.github.io/inpenso-web/](https://pedrogxmz.github.io/inpenso-web/)**

---

## 📖 Origen del proyecto

Este proyecto toma como base el diseño, modelo de datos y filosofía de privacidad local de **[VintusS/Inpenso](https://github.com/VintusS/Inpenso)** (originalmente escrita en SwiftUI para iOS) y la adapta a una **Progressive Web App (PWA)** multiplataforma que puede instalarse directamente desde **Safari en iPhone** o **Chrome en Android** sin requerir una cuenta de pago de Apple Developer ($99 USD) ni re-firmar un `.ipa` cada 7 días.

---

## ✨ Cambios y nuevas funcionalidades respecto al proyecto original

1. **Adaptación completa a React Web + PWA Offline**:
   - Instalable en la pantalla de inicio en **iOS (Safari)** y **Android (Chrome WebAPK)** a pantalla completa (`display: standalone`).
   - *Service Worker* con estrategia *network-first* y caché offline para funcionar sin conexión a internet.
   - Almacenamiento 100% local en el dispositivo (`localStorage`), manteniendo el formato JSON de exportación/importación compatible con la app original.

2. **Nueva sección de Cuentas (Crédito y Débito)**:
   - Registro de tarjetas de **Crédito** y cuentas de **Débito**.
   - **Cálculo de saldo libre (crédito disponible)** y barra de progreso de consumo frente al límite de crédito.
   - **Ajuste manual del saldo actual** para tarjetas de crédito existentes, permitiendo capturar tanto el **Saldo disponible** actual como el **Saldo consumido** actual y sincronizándolo automáticamente con los nuevos gastos o abonos del ciclo.
   - **Cálculo automático de fechas de corte y fechas límite de pago** (*día de corte del mes + días de gracia para pagar*) con contador de días restantes para el vencimiento.
   - **Selector visual de cuenta** al agregar o editar cualquier gasto/ingreso (con opción de crear una cuenta rápida sin salir del formulario).

3. **Localización al Español y soporte de Peso Mexicano (`MXN`)**:
   - Interfaz completamente en español.
   - Soporte nativo para **Peso mexicano (`MXN`)** como moneda predeterminada, además de `USD`, `EUR`, `GBP`, `CAD`, `JPY`, `AUD`, `CHF`, `CNY` e `INR`.

4. **Analíticas y Análisis Inteligente determinista**:
   - **Resumen**: Flujo de caja mensual (Gasto total, Ingresos, Neto, Promedio diario, Presupuesto usado y Días restantes).
   - **Tendencias**: Gráfica de gasto diario a lo largo del mes.
   - **Análisis inteligente**: Estadísticas clave (categoría con mayor gasto y día de la semana más activo), alertas automáticas de presupuesto (75% y 90%), detección de incrementos (>30%) o reducciones (>20%) por categoría respecto al mes anterior, proyección de gasto a fin de mes y patrones de consumo (entre semana vs. fin de semana y tercios del mes).
   - **Presupuesto**: Configuración de presupuesto mensual y cálculo del presupuesto diario disponible.

5. **Puente preparado para Apple Intelligence (`FoundationModels`)**:
   - Incluye en `src/bridge/appleIntelligence.ts` y `ios-bridge/FoundationModelsWebBridge.swift` un conector bidireccional para `WKWebView` / Capacitor que permite invocar el modelo local en chip de Apple (`SystemLanguageModel.default` en iOS 26+) cuando la aplicación se empaqueta como `.ipa`, ocultando el asistente automáticamente cuando se ejecuta únicamente en navegador web.

---

## 📱 Cómo instalarla en tu teléfono

### En iPhone (Safari)
1. Abre **[https://pedrogxmz.github.io/inpenso-web/](https://pedrogxmz.github.io/inpenso-web/)** en **Safari**.
2. Toca el botón **Compartir** (icono inferior central).
3. Selecciona **"Agregar a la pantalla de inicio"** (*Add to Home Screen*) y confirma en **Agregar**.

### En Android (Chrome)
1. Abre **[https://pedrogxmz.github.io/inpenso-web/](https://pedrogxmz.github.io/inpenso-web/)** en **Chrome**.
2. Toca el menú de tres puntos (`⋮`) arriba a la derecha.
3. Selecciona **"Instalar aplicación"** o **"Agregar a la pantalla principal"**.

---

## 🛠️ Desarrollo local y despliegue

```bash
# Instalar dependencias
npm install

# Ejecutar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build

# Publicar en GitHub Pages (rama gh-pages)
npm run deploy
```

---

## 🙏 Créditos

- Proyecto iOS original: **[VintusS/Inpenso](https://github.com/VintusS/Inpenso)** por [Dragomir Mindrescu (@VintusS)](https://github.com/VintusS).
