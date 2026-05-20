-- ============================================================
-- ERP GASTRONÓMICO INTEGRAL — SCHEMA SUPABASE / POSTGRESQL
-- ============================================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- 1. EMPRESAS (clientes corporativos)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empresas (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre_empresa TEXT        NOT NULL,
  dias_credito  INT         NOT NULL CHECK (dias_credito IN (30, 45)),
  linea_credito NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2. PEDIDOS CORPORATIVOS (consumos por empleado)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos_corporativos (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  fecha_pedido    DATE        NOT NULL DEFAULT CURRENT_DATE,
  nombre_empleado TEXT        NOT NULL,
  plato_pedido    TEXT        NOT NULL,
  precio_cobrado  NUMERIC(10, 2) NOT NULL DEFAULT 0,
  facturado       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pedidos_corporativos_empresa ON pedidos_corporativos(empresa_id);
CREATE INDEX idx_pedidos_corporativos_facturado ON pedidos_corporativos(facturado);

-- ------------------------------------------------------------
-- 3. PEDIDOS VECINOS (delivery auto-servicio)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos_vecinos (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_nombre    TEXT        NOT NULL,
  direccion_entrega TEXT        NOT NULL,
  telefono          TEXT        NOT NULL,
  platos_pedido     JSONB       NOT NULL DEFAULT '[]',
  monto_total       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  metodo_pago       TEXT        NOT NULL CHECK (metodo_pago IN ('YAPE', 'EFECTIVO')),
  url_boucher       TEXT,
  estado_envio      TEXT        NOT NULL DEFAULT 'COCINA'
                                CHECK (estado_envio IN ('COCINA', 'EN_RUTA', 'ENTREGADO')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pedidos_vecinos_estado ON pedidos_vecinos(estado_envio);

-- ------------------------------------------------------------
-- 4. MESAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mesas (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_mesa  TEXT NOT NULL UNIQUE,
  estado       TEXT NOT NULL DEFAULT 'LIBRE'
               CHECK (estado IN ('LIBRE', 'OCUPADA', 'PRECUENTA'))
);

-- Seed inicial de mesas
INSERT INTO mesas (numero_mesa, estado) VALUES
  ('1',  'LIBRE'), ('2',  'LIBRE'), ('3',  'LIBRE'),
  ('4',  'LIBRE'), ('5',  'LIBRE'), ('6',  'LIBRE'),
  ('7',  'LIBRE'), ('8',  'LIBRE'), ('9',  'LIBRE'),
  ('10', 'LIBRE'), ('11', 'LIBRE'), ('12', 'LIBRE')
ON CONFLICT (numero_mesa) DO NOTHING;

-- ------------------------------------------------------------
-- 5. PEDIDOS MESA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos_mesa (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  mesa_id       UUID        NOT NULL REFERENCES mesas(id) ON DELETE CASCADE,
  platos_pedido JSONB       NOT NULL DEFAULT '[]',
  monto_total   NUMERIC(10, 2) NOT NULL DEFAULT 0,
  estado_pago   TEXT        NOT NULL DEFAULT 'PENDIENTE'
                            CHECK (estado_pago IN ('PENDIENTE', 'PAGADO')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pedidos_mesa_mesa ON pedidos_mesa(mesa_id);
CREATE INDEX idx_pedidos_mesa_estado ON pedidos_mesa(estado_pago);

-- ------------------------------------------------------------
-- RLS: Habilitar Row Level Security (ajustar políticas según auth)
-- ------------------------------------------------------------
ALTER TABLE empresas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_corporativos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_vecinos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesas                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_mesa          ENABLE ROW LEVEL SECURITY;

-- Política pública temporal (reemplazar con auth real en producción)
CREATE POLICY "public_access" ON empresas             FOR ALL USING (true);
CREATE POLICY "public_access" ON pedidos_corporativos FOR ALL USING (true);
CREATE POLICY "public_access" ON pedidos_vecinos      FOR ALL USING (true);
CREATE POLICY "public_access" ON mesas                FOR ALL USING (true);
CREATE POLICY "public_access" ON pedidos_mesa         FOR ALL USING (true);
