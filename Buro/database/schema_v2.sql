-- ============================================================
-- ERP GASTRONÓMICO v2.0 — SCHEMA CON CONTROL DE INVENTARIO
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- 1. EMPRESAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empresas (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre_empresa  TEXT          NOT NULL,
  dias_credito    INT           NOT NULL CHECK (dias_credito IN (30, 45)),
  linea_credito   NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2. PLATOS MASTER (catálogo + inventario diario)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platos_master (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre_plato  TEXT          NOT NULL UNIQUE,
  precio        NUMERIC(10,2) NOT NULL DEFAULT 0,
  descripcion   TEXT          NOT NULL DEFAULT '',
  activo_hoy    BOOLEAN       NOT NULL DEFAULT FALSE,
  stock_actual  INT           NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Seed de 20 platos maestros
INSERT INTO platos_master (nombre_plato, precio, descripcion) VALUES
  ('Menú Ejecutivo',              15.00, 'Entrada + segundo + refresco'),
  ('Pollo al Horno',              22.00, 'Con papas doradas y ensalada'),
  ('Lomo Saltado',                25.00, 'Con arroz blanco y papas fritas'),
  ('Ceviche Clásico',             28.00, 'Con choclo, cancha y leche de tigre'),
  ('Arroz con Leche',              8.00, 'Postre tradicional'),
  ('Pollo a la Brasa 1/4',        18.00, 'Con papas fritas y ensalada'),
  ('Tallarines Verdes',           20.00, 'Con albahaca fresca y queso'),
  ('Sopa a la Minuta',            14.00, 'Con carne y fideos'),
  ('Chicharrón de Pollo',         23.00, 'Con yuca frita y salsa criolla'),
  ('Trucha Frita',                26.00, 'Con menestras y arroz'),
  ('Ají de Gallina',              24.00, 'Con arroz, papa y aceituna'),
  ('Causa Limeña',                16.00, 'Rellena de pollo o atún'),
  ('Seco de Res',                 27.00, 'Con menestras y arroz'),
  ('Carapulcra',                  22.00, 'Con papa seca y maní'),
  ('Anticuchos',                  20.00, 'Con papa sancochada y choclo'),
  ('Inca Kola 500ml',              4.00, 'Bebida gaseosa'),
  ('Agua Mineral 600ml',           3.00, 'Sin gas'),
  ('Chicha Morada 1L',             6.00, 'Preparación casera'),
  ('Mazamorra Morada',             7.00, 'Postre tradicional'),
  ('Pan con Chicharrón',          10.00, 'Sándwich mañanero')
ON CONFLICT (nombre_plato) DO NOTHING;

-- ------------------------------------------------------------
-- 3. PEDIDOS CORPORATIVOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos_corporativos (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  fecha_pedido    DATE          NOT NULL DEFAULT CURRENT_DATE,
  nombre_empleado TEXT          NOT NULL,
  entrada_pedido  TEXT          NOT NULL DEFAULT '',
  plato_pedido    TEXT          NOT NULL,
  observaciones   TEXT          NOT NULL DEFAULT '',
  precio_cobrado  NUMERIC(10,2) NOT NULL DEFAULT 0,
  facturado       BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pc_empresa    ON pedidos_corporativos(empresa_id);
CREATE INDEX idx_pc_facturado  ON pedidos_corporativos(facturado);
CREATE INDEX idx_pc_fecha      ON pedidos_corporativos(fecha_pedido);

-- ------------------------------------------------------------
-- 4. PEDIDOS VECINOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos_vecinos (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_nombre    TEXT          NOT NULL,
  direccion_entrega TEXT          NOT NULL,
  telefono          TEXT          NOT NULL,
  platos_pedido     JSONB         NOT NULL DEFAULT '[]',
  monto_total       NUMERIC(10,2) NOT NULL DEFAULT 0,
  metodo_pago       TEXT          NOT NULL CHECK (metodo_pago IN ('YAPE', 'EFECTIVO')),
  url_boucher       TEXT,
  estado_envio      TEXT          NOT NULL DEFAULT 'COCINA'
                                  CHECK (estado_envio IN ('COCINA', 'EN_RUTA', 'ENTREGADO')),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pv_estado ON pedidos_vecinos(estado_envio);

-- ------------------------------------------------------------
-- 5. MESAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mesas (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_mesa  TEXT NOT NULL UNIQUE,
  estado       TEXT NOT NULL DEFAULT 'LIBRE'
               CHECK (estado IN ('LIBRE', 'OCUPADA', 'PRECUENTA'))
);

INSERT INTO mesas (numero_mesa) VALUES
  ('1'),('2'),('3'),('4'),('5'),('6'),
  ('7'),('8'),('9'),('10'),('11'),('12')
ON CONFLICT (numero_mesa) DO NOTHING;

-- ------------------------------------------------------------
-- 6. PEDIDOS MESA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos_mesa (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  mesa_id       UUID          NOT NULL REFERENCES mesas(id) ON DELETE CASCADE,
  platos_pedido JSONB         NOT NULL DEFAULT '[]',
  monto_total   NUMERIC(10,2) NOT NULL DEFAULT 0,
  estado_pago   TEXT          NOT NULL DEFAULT 'PENDIENTE'
                              CHECK (estado_pago IN ('PENDIENTE', 'PAGADO')),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pm_mesa   ON pedidos_mesa(mesa_id);
CREATE INDEX idx_pm_estado ON pedidos_mesa(estado_pago);

-- ============================================================
-- TRIGGERS PARA DESCUENTO AUTOMÁTICO DE STOCK
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- Helper: descuenta stock de platos_master dado un nombre
-- Usa UPDATE … WHERE nombre_plato ILIKE … para ser tolerante
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION descontar_stock_por_nombre(
  p_nombre TEXT,
  p_cantidad INT DEFAULT 1
) RETURNS VOID AS $$
BEGIN
  UPDATE platos_master
  SET    stock_actual = GREATEST(0, stock_actual - p_cantidad)
  WHERE  activo_hoy = TRUE
    AND  nombre_plato ILIKE '%' || p_nombre || '%';
END;
$$ LANGUAGE plpgsql;

-- ──────────────────────────────────────────────────────────
-- TRIGGER A: Descuenta stock al insertar pedido corporativo
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_stock_corporativo()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM descontar_stock_por_nombre(NEW.plato_pedido, 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_stock_corporativo ON pedidos_corporativos;
CREATE TRIGGER tg_stock_corporativo
  AFTER INSERT ON pedidos_corporativos
  FOR EACH ROW EXECUTE FUNCTION trigger_stock_corporativo();

-- ──────────────────────────────────────────────────────────
-- TRIGGER B: Descuenta stock al insertar pedido vecinos
-- platos_pedido es JSONB: [{"nombre": "...", "cantidad": 2}, ...]
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_stock_vecinos()
RETURNS TRIGGER AS $$
DECLARE
  item   JSONB;
  nombre TEXT;
  cant   INT;
BEGIN
  FOR item IN SELECT jsonb_array_elements(NEW.platos_pedido)
  LOOP
    nombre := item->>'nombre';
    cant   := COALESCE((item->>'cantidad')::INT, 1);
    PERFORM descontar_stock_por_nombre(nombre, cant);
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_stock_vecinos ON pedidos_vecinos;
CREATE TRIGGER tg_stock_vecinos
  AFTER INSERT ON pedidos_vecinos
  FOR EACH ROW EXECUTE FUNCTION trigger_stock_vecinos();

-- ──────────────────────────────────────────────────────────
-- TRIGGER C: Descuenta stock al insertar pedido de mesa
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_stock_mesa()
RETURNS TRIGGER AS $$
DECLARE
  item   JSONB;
  nombre TEXT;
  cant   INT;
BEGIN
  FOR item IN SELECT jsonb_array_elements(NEW.platos_pedido)
  LOOP
    nombre := item->>'nombre';
    cant   := COALESCE((item->>'cantidad')::INT, 1);
    PERFORM descontar_stock_por_nombre(nombre, cant);
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_stock_mesa ON pedidos_mesa;
CREATE TRIGGER tg_stock_mesa
  AFTER INSERT ON pedidos_mesa
  FOR EACH ROW EXECUTE FUNCTION trigger_stock_mesa();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE empresas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE platos_master        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_corporativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_vecinos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_mesa         ENABLE ROW LEVEL SECURITY;

-- Políticas públicas (reemplazar con auth real en producción)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['empresas','platos_master','pedidos_corporativos',
                            'pedidos_vecinos','mesas','pedidos_mesa']
  LOOP
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS public_access ON %I FOR ALL USING (true)', t
    );
  END LOOP;
END $$;
