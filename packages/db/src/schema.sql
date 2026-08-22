-- clinicflow — esquema inicial multi-tenant (M0)
-- Base: BoxyHQ saas-starter-kit aporta users, organizations, memberships, invitations.
-- Regla: TODA tabla de dominio lleva tenant_id (organization_id) con índice.
-- Ver docs/04-modelo-datos.md para el diseño completo.

-- M0: solo enums y estructuras mínimas para arrancar.
-- Las migraciones reales se generan al integrar Drizzle/Prisma en M0 (deploy).

CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  duracion_min integer NOT NULL CHECK (duracion_min > 0),
  precio numeric(10,2) NOT NULL CHECK (precio >= 0),
  activo boolean NOT NULL DEFAULT true,
  creado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_services_tenant ON services(tenant_id);

CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  celular text NOT NULL,
  email text,
  documento text,
  fnac date,
  alergias text,
  gestacion boolean NOT NULL DEFAULT false,
  creado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, celular)
);
CREATE INDEX IF NOT EXISTS idx_patients_tenant ON patients(tenant_id);

CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  doctor_id uuid,
  preferencia_doctor_id uuid,
  fecha date NOT NULL,
  hora_ini time NOT NULL,
  hora_fin time NOT NULL,
  estado text NOT NULL DEFAULT 'solicitada'
    CHECK (estado IN ('solicitada','confirmada','en_espera','en_atencion','atendida','no_show','cancelada')),
  monto numeric(10,2) NOT NULL DEFAULT 0,
  monto_pagado numeric(10,2) NOT NULL DEFAULT 0,
  creado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_fecha ON appointments(tenant_id, fecha);
CREATE INDEX IF NOT EXISTS idx_appointments_estado ON appointments(estado);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id),
  patient_id uuid REFERENCES patients(id),
  monto numeric(10,2) NOT NULL CHECK (monto > 0),
  metodo text NOT NULL CHECK (metodo IN ('yape','plin','efectivo','tarjeta_pos','tarjeta_online','otro')),
  referencia text,
  registrado_por uuid,
  caja_cerrada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id, created_at);

CREATE TABLE IF NOT EXISTS subscriptions (
  tenant_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','premium')),
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','por_renovar','suspendido','cancelado')),
  vence date,
  monto numeric(10,2),
  metodo_pago text,
  nota text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL,
  user_id uuid,
  accion text NOT NULL,
  entidad text,
  entidad_id uuid,
  ip inet,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id, created_at);
