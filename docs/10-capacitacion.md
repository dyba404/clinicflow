# Capacitación y demo (v1.0.0)

Cómo se capacita a una clínica nueva y cómo grabar el video demo con la app ya
corriendo en local (o en producción cuando exista).

## Recursos que ya existen en la app

| Recurso | Dónde | Para quién |
|---|---|---|
| **Checklist de primeros pasos** | Panel `/consola` del dueño (aparece solo con setup pendiente y se oculta al completar) | Dueño/gerente nuevo |
| **Guía de la app (por rol)** | `/consola/guia` — filtra las guías según los permisos del rol | Todo el equipo |
| **Guía pública (sin login)** | `/{slug}/guia` — para enviar por WhatsApp al equipo sin darles acceso todavía | Equipo completo |
| **Centro de ayuda** | `/consola/soporte` — estado del servicio, contacto y link a la guía | Todos |
| **Páginas legales** | `/{slug}/privacidad` y `/{slug}/terminos` | Pacientes y equipo |

Las guías viven en `apps/web/src/lib/guias.ts` (datos estructurados, fácil de
migrar a Notion/Intercom si algún día se quiere un help center externo) y las
capturas que las ilustran en `apps/web/public/guia/` (se regeneran con
`node apps/web/scripts/captura-guia.mjs` contra el servidor en :3112).

Secciones de la guía:

1. **Primeros pasos** — legal, especialidades/servicios, invitar equipo, compartir reservas
2. **Citas y sala de espera** — confirmar solicitudes, flujo del día, reprogramar, triaje
3. **Caja y cobros** — registrar pago, anular, conciliar QR, split aseguradora
4. **Comprobantes SUNAT** — configurar emisión (RUC/cert/Clave SOL de la clínica), emitir, dar de baja
5. **Portal del paciente** — portal/pago QR, recall, campañas
6. **Canales** — WhatsApp, reseñas de Google, derechos ARCO (Ley 29733)

## Onboarding de una clínica nueva (paso a paso real)

1. La clínica se registra en `/signup` → dueño entra a su consola nueva (plan free).
2. El panel muestra el **checklist 0/5**: completar datos legales → crear
   especialidades/servicios → invitar equipo → compartir la página de reservas →
   confirmar la primera cita.
3. El dueño envía `/{slug}/guia` (link público) a su equipo por WhatsApp.
4. Primer paciente real: llega solicitud → recepción confirma → triaje/sala de
   espera → consulta (nota SOAP) → cobro + comprobante.
5. Nosotros acompañamos la primera semana vía el correo de soporte
   (`soporte@clinicflow.pe`).

## Video demo — guion para grabar (OBS)

Configuración: OBS Studio, 1920×1080, captura de ventana del navegador
(Chrome a pantalla completa, zoom 100%), micrófono. Servidor levantado:
`powershell -File scripts/serve-console.ps1` (http://localhost:3112).
Usuario demo: `owner@demo.clinicflow.pe` / `demo1234`.

### Versión ventas (5 min) — 6 escenas

| # | Escena | Qué mostrar | Qué decir (idea) | Duración |
|---|---|---|---|---|
| 1 | Alta clínica + checklist primeros pasos | `/consola` de clínica recién creada, checklist 0/5 | "Tu clínica lista en minutos: datos legales, especialidades y equipo" | 40s |
| 2 | Reserva pública | `/{slug}/reserva`: elegir especialidad, fecha, datos | "Tu paciente reserva solo, desde su celular, sin descargar nada" | 50s |
| 3 | Agenda, triaje y sala de espera | Agenda por recurso/doctor → check-in → triaje → Llamar | "El flujo del día completo: agenda multi-especialidad y sala de espera" | 50s |
| 4 | Consulta — nota SOAP | Ficha multi-especialidad + nota SOAP con permisos por rol | "Historia clínica única por paciente, con acceso auditado (Ley 29733)" | 50s |
| 5 | Cobro + comprobante SUNAT | Caja: registrar pago → emitir boleta → PDF con QR | "Yape, Plin, efectivo o POS; boleta/factura electrónica con el RUC de tu clínica" | 40s |
| 6 | Portal paciente | `/{slug}/portal/{token}`: resumen, cuotas, comprobantes | "Y el paciente ve sus citas, cuotas y comprobantes sin llamar" | 20s |

### Versión capacitación por rol (10 min)

1. **Gerente/dueño (2 min)**: panel/KPIs → checklist primeros pasos → invitar
   equipo → configuraciones (legal, especialidades, plan).
2. **Recepción (4 min)**: solicitudes → confirmar → sala de espera/triaje →
   caja, cobro y emisión de comprobante → cierre del día.
3. **Médico (2 min)**: mi agenda → ficha del paciente → nota SOAP → órdenes →
   atender y cerrar consulta.
4. **Enfermería (2 min)**: triaje → toma de datos/constantes → adjuntar
   resultados → apoyo en sala de espera.

Consejos de grabación:

- Graba sobre el seed demo (`npm run db:seed`): ya hay citas hoy, pagos y pacientes.
- Mantén el cursor visible y muévelo despacio; no hagas scroll rápido.
- Si algo falla, repite la toma: el seed es idempotente, puedes volver a correrlo.
- Sube a YouTube (no listado) o Loom; incrusta el link en `/consola/guia`
  cuando exista (editar `lib/guias.ts`).

## Regenerar capturas de la guía

```powershell
# Servidor ya corriendo en :3112 con datos seed (URL base http://localhost:3112)
node apps/web/scripts/captura-guia.mjs
# Las imágenes quedan en apps/web/public/guia/
```
