# ORMO — Control de Importaciones (prototipo)

Este es un **prototipo funcional de un solo archivo** (`index.html`) para un sistema de
control de costos de importación, embarques, pagos y fases logísticas. Sirvió para
validar la lógica de negocio antes de construir la aplicación real.

## Cómo abrirlo

Es HTML puro + JavaScript vanilla, sin build step. Solo ábrelo en un navegador:

```
open index.html
```

No usa `localStorage` — usa una API de almacenamiento propia del entorno donde se
generó (`window.storage`), que **no existe fuera de ese entorno**. Antes de usarlo
localmente o de convertirlo en la app real, esa capa de persistencia debe
reemplazarse (ver sección "Qué falta" abajo).

## Qué hace

Es un ERP ligero de importaciones con:

- **Dashboard** ejecutivo: próximo pago, embarques por fase, costos, alertas.
- **Productos**: catálogo con historial de precio FOB y costo puesto en destino
  (estimado vs. real), activar/desactivar con protección de historial.
- **Proveedores** y **Forwarders**: directorios simples con estatus activo/inactivo.
- **Embarques**: mercancía, costos configurables (por contenedor/HBL/pieza/%),
  costos extraordinarios, fases (0–4) con historial de fechas, pagos con concepto
  y cálculo automático de monto por porcentaje, reporte descargable (PDF vía
  impresión del navegador, Excel vía SheetJS).
- **Pagos**: vista consolidada de todos los embarques.
- **Parámetros**: tasas fiscales (IGI/DTA/IVA), seguro, umbrales de alerta.
- **Simulador**: cambios de tipo de cambio, flete, precio FOB, etc. en montos
  absolutos, sin tocar los datos oficiales.
- **Roles**: Admin (edita todo) / Socio (solo lectura + simulador).

## El motor de cálculo (lo más importante — no lo reescribas sin validar)

Toda la lógica financiera vive en dos funciones: `computeCore()` y
`computeShipment()`, dentro del `<script>` de `index.html`. Fue **validada línea
por línea contra una cotización real en Excel** (misma fórmula de IGI/DTA/IVA,
mismo tratamiento de CIF, mismo prorrateo por producto). Si migras esto a un
backend real (Node/Prisma, Python, etc.), pórtalo tal cual y vuelve a correr esa
validación contra el Excel original antes de confiar en los números.

Puntos no obvios del motor que hay que preservar:
- Un costo puede tener `includeInCIF` (si aumenta la base gravable) e
  `isRealExpense` (si de verdad se paga) como flags **independientes** — hay un
  costo (seguro de carga %FOB) que afecta impuestos pero no es un gasto real.
- "Estimado" vs. "Real": el estimado se puede congelar (`estimateSnapshot`); si no
  se ha congelado, se calcula en vivo excluyendo `extraCosts`. El "real" siempre
  incluye `extraCosts`.
- Los pagos con concepto FOB/Logística/Impuestos calculan su monto como
  `% × total correspondiente del embarque`, recalculado cada vez que cambia el %
  o el concepto.

## Qué falta para producción

Este prototipo es intencionalmente de un solo archivo, sin backend ni base de
datos real. Para producción se sugiere:

- Next.js + TypeScript + Tailwind (frontend/API)
- PostgreSQL + Prisma (persistencia real, multiusuario)
- Autenticación real para los roles Admin/Socio (aquí es solo un selector visual)
- Migrar `window.storage` a llamadas a la API/DB
- Exportar PDF con una librería real (ej. `@react-pdf/renderer` o Puppeteer) en
  vez de la ventana de impresión del navegador

## Modelo de datos actual (objeto `STATE`)

```
STATE = {
  role, alertConfig, taxParams,
  suppliers: [{id, name, country, contact, phone, email, address, notes, status}],
  forwarders: [{...misma forma que suppliers...}],
  products: [{id, sku, name, supplier, fraction, uom, status}],
  shipments: [{
    id, number, supplierName, forwarder, incoterm, containers, containerType,
    exchangeRate, date, phase, phaseEnteredAt, phaseLog: [{phase, date}],
    blNumber, eta, taxParams, allocationMethod,
    items: [{id, productId, qty, fobUnit, weight}],
    costItems: [{id, name, code, basis, rate, qty, includeInCIF, isRealExpense}],
    extraCosts: [{id, concept, category, amount, currency, date, productId, notes}],
    payments: [{id, concept, pct, amount, dueDate, paidDate, status}],
    estimateSnapshot: null | <resultado congelado de computeCore()>
  }]
}
```

## Sugerencia de siguiente paso para Claude Code

Usa este archivo como especificación funcional y de reglas de cálculo. Un buen
punto de partida:

1. Scaffold de Next.js + Prisma con el esquema anterior como modelo relacional.
2. Portar `computeCore()` / `computeShipment()` tal cual a una capa de servicio
   en TypeScript, con pruebas unitarias que reproduzcan los números validados.
3. Reconstruir cada pantalla del `index.html` como páginas/rutas de Next.js,
   conservando la paleta y tipografía (Manrope + Inter + IBM Plex Mono,
   variables CSS al inicio del `<style>`).
