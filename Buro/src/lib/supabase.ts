import { createClient } from "@supabase/supabase-js";

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Tipos canónicos ──────────────────────────────────────────────────────────

export type Empresa = {
  id:             string;
  nombre_empresa: string;
  dias_credito:   30 | 45;
  linea_credito:  number;
  created_at:     string;
};

export type PlatoMaster = {
  id:           string;
  nombre_plato: string;
  precio:       number;
  descripcion:  string;
  activo_hoy:   boolean;
  stock_actual: number;
  created_at:   string;
};

export type PedidoCorporativo = {
  id:              string;
  empresa_id:      string;
  fecha_pedido:    string;
  nombre_empleado: string;
  entrada_pedido:  string;
  plato_pedido:    string;
  observaciones:   string;
  precio_cobrado:  number;
  facturado:       boolean;
  created_at:      string;
};

export type ItemPedido = {
  nombre:          string;
  cantidad:        number;
  precio_unitario: number;
};

export type PedidoVecino = {
  id:                string;
  cliente_nombre:    string;
  direccion_entrega: string;
  telefono:          string;
  platos_pedido:     ItemPedido[];
  monto_total:       number;
  metodo_pago:       "YAPE" | "EFECTIVO";
  url_boucher:       string | null;
  estado_envio:      "COCINA" | "EN_RUTA" | "ENTREGADO";
  created_at:        string;
};

export type Mesa = {
  id:          string;
  numero_mesa: string;
  estado:      "LIBRE" | "OCUPADA" | "PRECUENTA";
};

export type PedidoMesa = {
  id:            string;
  mesa_id:       string;
  platos_pedido: ItemPedido[];
  monto_total:   number;
  estado_pago:   "PENDIENTE" | "PAGADO";
  created_at:    string;
};

// ─── Mapas de normalización (Excel → nombre_plato canónico) ───────────────────
// Clave: fragmento regex · Valor: nombre_plato exacto en platos_master

export const NORMALIZACION_PLATOS: Array<[RegExp, string]> = [
  [/pollo.*horno|horno.*pollo/i,           "Pollo al Horno"],
  [/pollo.*brasa|brasa.*pollo/i,           "Pollo a la Brasa 1/4"],
  [/lomo.*salt/i,                          "Lomo Saltado"],
  [/ceviche/i,                             "Ceviche Clásico"],
  [/tallar.*verde|verde.*tallar/i,         "Tallarines Verdes"],
  [/ají.*gallin|gallin.*ají/i,             "Ají de Gallina"],
  [/chicharr.*poll|poll.*chicharr/i,       "Chicharrón de Pollo"],
  [/trucha/i,                              "Trucha Frita"],
  [/seco.*res|res.*seco/i,                 "Seco de Res"],
  [/causa/i,                               "Causa Limeña"],
  [/carapulcra/i,                          "Carapulcra"],
  [/anticuch/i,                            "Anticuchos"],
  [/sopa.*minuta|minuta/i,                 "Sopa a la Minuta"],
  [/arroz.*leche|leche.*arroz/i,           "Arroz con Leche"],
  [/mazamorra/i,                           "Mazamorra Morada"],
  [/inca.?kola|inca cola/i,               "Inca Kola 500ml"],
  [/agua.*mineral|mineral/i,               "Agua Mineral 600ml"],
  [/chicha.*morada|morada/i,               "Chicha Morada 1L"],
  [/menú.*ejecut|ejecut.*menú|menu.*exec/i,"Menú Ejecutivo"],
  [/pan.*chicharr|chicharr.*pan/i,         "Pan con Chicharrón"],
];

export function normalizarPlato(texto: string): string {
  const t = texto.trim();
  for (const [regex, canonico] of NORMALIZACION_PLATOS) {
    if (regex.test(t)) return canonico;
  }
  // Fallback: capitaliza cada palabra
  return t.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
