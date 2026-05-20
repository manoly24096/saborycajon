"use client";

import { useEffect, useState } from "react";
import {
  ShoppingCart,
  Plus,
  Minus,
  Bike,
  CheckCircle2,
  AlertCircle,
  Upload,
  X,
  Smartphone,
  RefreshCw,
  PackageX,
} from "lucide-react";
import { supabase, type PlatoMaster, type ItemPedido } from "@/lib/supabase";

type CartItem = {
  plato:    PlatoMaster;
  cantidad: number;
};

type FormData = {
  cliente_nombre:    string;
  direccion_entrega: string;
  telefono:          string;
  metodo_pago:       "YAPE" | "EFECTIVO";
};

const FORM_INIT: FormData = {
  cliente_nombre:    "",
  direccion_entrega: "",
  telefono:          "",
  metodo_pago:       "YAPE",
};

export default function MenuVecino() {
  const [platos,      setPlatos]      = useState<PlatoMaster[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [cart,        setCart]        = useState<CartItem[]>([]);
  const [form,        setForm]        = useState<FormData>(FORM_INIT);
  const [boucher,     setBoucher]     = useState<File | null>(null);
  const [step,        setStep]        = useState<"menu" | "checkout" | "success">("menu");
  const [enviando,    setEnviando]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const cargarMenu = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("platos_master")
      .select("*")
      .eq("activo_hoy", true)
      .order("nombre_plato");
    setPlatos(data ?? []);
    setLoading(false);
  };

  useEffect(() => { cargarMenu(); }, []);

  // ── Carrito ──────────────────────────────────────────────
  const getQty = (id: string) => cart.find((c) => c.plato.id === id)?.cantidad ?? 0;

  const updateQty = (plato: PlatoMaster, delta: number) => {
    // Bloqueo definitivo si agotado al intentar agregar
    if (delta > 0 && plato.stock_actual === 0) return;

    setCart((prev) => {
      const exist = prev.find((c) => c.plato.id === plato.id);
      if (!exist && delta > 0) return [...prev, { plato, cantidad: 1 }];
      return prev
        .map((c) => c.plato.id === plato.id ? { ...c, cantidad: c.cantidad + delta } : c)
        .filter((c) => c.cantidad > 0);
    });
  };

  const totalItems   = cart.reduce((s, c) => s + c.cantidad, 0);
  const totalImporte = cart.reduce((s, c) => s + c.cantidad * c.plato.precio, 0);

  // ── Enviar pedido ────────────────────────────────────────
  const handleEnviar = async () => {
    if (!form.cliente_nombre.trim())    return setError("Ingresa tu nombre completo.");
    if (!form.direccion_entrega.trim()) return setError("Ingresa la dirección de entrega.");
    if (!form.telefono.trim())          return setError("Ingresa tu número de teléfono.");
    if (cart.length === 0)              return setError("Tu carrito está vacío.");
    if (form.metodo_pago === "YAPE" && !boucher)
      return setError("Adjunta el voucher de pago Yape.");

    setEnviando(true);
    setError(null);

    let url_boucher: string | null = null;

    if (boucher) {
      const ext  = boucher.name.split(".").pop() ?? "jpg";
      const path = `bouchers/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("bouchers")
        .upload(path, boucher, { upsert: false });

      if (upErr) {
        setError("Error al subir voucher: " + upErr.message);
        setEnviando(false);
        return;
      }
      url_boucher = supabase.storage.from("bouchers").getPublicUrl(path).data.publicUrl;
    }

    const platos_pedido: ItemPedido[] = cart.map((c) => ({
      nombre:          c.plato.nombre_plato,
      cantidad:        c.cantidad,
      precio_unitario: c.plato.precio,
    }));

    // El trigger de PostgreSQL descuenta el stock automáticamente al insertar
    const { error: dbErr } = await supabase.from("pedidos_vecinos").insert({
      cliente_nombre:    form.cliente_nombre.trim(),
      direccion_entrega: form.direccion_entrega.trim(),
      telefono:          form.telefono.trim(),
      platos_pedido,
      monto_total:       totalImporte,
      metodo_pago:       form.metodo_pago,
      url_boucher,
      estado_envio:      "COCINA",
    });

    setEnviando(false);

    if (dbErr) {
      setError(dbErr.message);
    } else {
      setStep("success");
      setCart([]);
      setForm(FORM_INIT);
      setBoucher(null);
    }
  };

  // ── Success screen ───────────────────────────────────────
  if (step === "success") {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="w-24 h-24 rounded-full bg-emerald-500/15 flex items-center justify-center
                        ring-4 ring-emerald-500/20">
          <CheckCircle2 className="text-emerald-400" size={44} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-100">¡Pedido recibido!</h2>
          <p className="text-slate-400 text-sm mt-2 max-w-xs">
            Tu pedido está en cocina y saldrá en camino muy pronto.
          </p>
        </div>
        <button
          onClick={() => { setStep("menu"); cargarMenu(); }}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl
                     text-white font-bold text-sm transition-colors"
        >
          Hacer otro pedido
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto pb-28">
      {/* ── Navbar móvil ──────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur border-b border-slate-800
                      px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-black text-slate-100">Delivery Vecinos 🛵</h1>
          <p className="text-xs text-slate-500">Menú del día</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={cargarMenu} disabled={loading}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          {totalItems > 0 && (
            <button
              onClick={() => setStep("checkout")}
              className="relative flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500
                         px-3 py-2 rounded-xl text-white text-sm font-bold transition-colors"
            >
              <ShoppingCart size={14} />
              Carrito
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-500 rounded-full
                               text-[10px] font-black flex items-center justify-center">
                {totalItems}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── Menú ──────────────────────────────────────────── */}
      {step === "menu" && (
        <div className="px-4 pt-4 space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-slate-900 rounded-2xl animate-pulse" />
            ))
          ) : platos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600 gap-3">
              <PackageX size={40} />
              <div className="text-center">
                <p className="font-semibold text-slate-400">Sin menú publicado hoy</p>
                <p className="text-sm text-slate-600 mt-1">El administrador aún no ha activado los platos del día.</p>
              </div>
            </div>
          ) : (
            platos.map((plato) => {
              const qty     = getQty(plato.id);
              const agotado = plato.stock_actual === 0;

              return (
                <div
                  key={plato.id}
                  className={`
                    relative flex items-center gap-3 p-4 rounded-2xl border-2 transition-all overflow-hidden
                    ${agotado
                      ? "bg-slate-900/50 border-slate-800"
                      : qty > 0
                        ? "bg-indigo-600/10 border-indigo-500/50 shadow-lg shadow-indigo-500/10"
                        : "bg-slate-900 border-slate-800"
                    }
                  `}
                >
                  {/* Banda diagonal AGOTADO */}
                  {agotado && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="absolute inset-0 bg-slate-950/50" />
                      <span className="relative z-10 text-base font-black tracking-[0.2em]
                                       text-red-500/80 rotate-[-20deg] select-none
                                       border-2 border-red-500/40 px-4 py-1 rounded-lg
                                       bg-slate-950/80">
                        AGOTADO
                      </span>
                    </div>
                  )}

                  <div className={`flex-1 min-w-0 ${agotado ? "opacity-40" : ""}`}>
                    <p className={`text-sm font-bold leading-tight ${
                      agotado ? "text-slate-500" : "text-slate-100"
                    }`}>
                      {plato.nombre_plato}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{plato.descripcion}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-sm font-black ${agotado ? "text-slate-600" : "text-emerald-400"}`}>
                        S/ {plato.precio.toFixed(2)}
                      </span>
                      {!agotado && (
                        <span className="text-[10px] text-slate-600">
                          {plato.stock_actual} disponibles
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Controles */}
                  <div className={`flex items-center gap-2.5 shrink-0 ${agotado ? "opacity-20 pointer-events-none" : ""}`}>
                    <button
                      onClick={() => updateQty(plato, -1)}
                      disabled={qty === 0 || agotado}
                      className="w-9 h-9 flex items-center justify-center rounded-xl
                                 bg-slate-700 hover:bg-slate-600 disabled:opacity-25
                                 text-slate-200 transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-6 text-center text-base font-black text-slate-100">
                      {qty}
                    </span>
                    <button
                      onClick={() => updateQty(plato, 1)}
                      disabled={agotado || qty >= plato.stock_actual}
                      className="w-9 h-9 flex items-center justify-center rounded-xl
                                 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-25
                                 text-white transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Barra flotante del carrito */}
      {step === "menu" && totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-4
                        bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
          <button
            onClick={() => setStep("checkout")}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white
                       font-black text-sm flex items-center justify-between px-5
                       transition-colors shadow-xl shadow-indigo-500/20"
          >
            <span className="bg-white/20 rounded-xl px-2.5 py-1 font-bold">
              {totalItems} {totalItems === 1 ? "item" : "items"}
            </span>
            <span>Confirmar pedido</span>
            <span className="font-black">S/ {totalImporte.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* ── Checkout ──────────────────────────────────────── */}
      {step === "checkout" && (
        <div className="px-4 pt-4 space-y-5 pb-8">
          <button onClick={() => setStep("menu")}
                  className="text-xs text-indigo-400 flex items-center gap-1 hover:text-indigo-300">
            ← Volver al menú
          </button>

          {/* Resumen */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-300">Tu pedido</h2>
            </div>
            {cart.map((item) => (
              <div key={item.plato.id}
                   className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800 last:border-0">
                <span className="w-7 h-7 bg-indigo-600/20 text-indigo-300 text-xs font-black
                                 rounded-full flex items-center justify-center shrink-0">
                  {item.cantidad}
                </span>
                <span className="flex-1 text-sm text-slate-200 font-medium">
                  {item.plato.nombre_plato}
                </span>
                <span className="text-sm text-slate-400 shrink-0">
                  S/ {(item.cantidad * item.plato.precio).toFixed(2)}
                </span>
                <button onClick={() => updateQty(item.plato, -item.cantidad)}>
                  <X size={13} className="text-slate-600 hover:text-red-400 transition-colors" />
                </button>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3 bg-slate-800/60">
              <span className="text-sm font-bold text-slate-300">Total</span>
              <span className="text-base font-black text-emerald-400">
                S/ {totalImporte.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Datos de entrega */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-300">Datos de entrega</h2>
            {(
              [
                { key: "cliente_nombre",    label: "Nombre completo",      type: "text", ph: "María García" },
                { key: "direccion_entrega", label: "Dirección exacta",     type: "text", ph: "Jr. Los Pinos 234, Piso 3" },
                { key: "telefono",          label: "Teléfono / WhatsApp",  type: "tel",  ph: "999 888 777" },
              ] as const
            ).map((f) => (
              <div key={f.key}>
                <label className="text-xs text-slate-500 block mb-1">{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.ph}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-100
                             rounded-xl px-4 py-3 text-sm focus:outline-none
                             focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600"
                />
              </div>
            ))}
          </div>

          {/* Método de pago */}
          <div>
            <h2 className="text-sm font-bold text-slate-300 mb-2">Método de pago</h2>
            <div className="grid grid-cols-2 gap-3">
              {(["YAPE", "EFECTIVO"] as const).map((mp) => (
                <button
                  key={mp}
                  onClick={() => setForm((p) => ({ ...p, metodo_pago: mp }))}
                  className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                    form.metodo_pago === mp
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                      : "bg-slate-900 border-slate-800 text-slate-400"
                  }`}
                >
                  {mp === "YAPE" ? "📱 Yape" : "💵 Efectivo"}
                </button>
              ))}
            </div>
          </div>

          {/* QR y upload voucher */}
          {form.metodo_pago === "YAPE" && (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
                <Smartphone size={15} className="text-indigo-400" />
                Escanea el QR o paga al número
              </div>

              {/* QR estático simulado */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-40 h-40 bg-white rounded-2xl p-3 flex items-center justify-center">
                  <svg viewBox="0 0 21 21" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                    {/* Patrón QR simplificado estático */}
                    {[
                      [0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],
                      [0,1],[6,1],[0,2],[2,2],[3,2],[4,2],[6,2],
                      [0,3],[2,3],[4,3],[6,3],[0,4],[2,4],[3,4],[4,4],[6,4],
                      [0,5],[6,5],[0,6],[1,6],[2,6],[3,6],[4,6],[5,6],[6,6],
                      [8,0],[10,0],[12,0],[9,1],[11,1],[8,2],[10,2],[12,2],
                      [9,3],[8,4],[10,4],[11,4],[9,5],[12,5],[8,6],[10,6],
                      [14,0],[15,0],[16,0],[17,0],[18,0],[19,0],[20,0],
                      [14,1],[20,1],[14,2],[16,2],[17,2],[18,2],[20,2],
                      [14,3],[16,3],[18,3],[20,3],[14,4],[16,4],[17,4],[18,4],[20,4],
                      [14,5],[20,5],[14,6],[15,6],[16,6],[17,6],[18,6],[19,6],[20,6],
                      [0,8],[2,8],[4,8],[6,8],[8,8],[1,9],[3,9],[5,9],[9,9],
                      [0,10],[3,10],[5,10],[7,10],[8,10],[9,10],[2,11],[4,11],[6,11],
                      [0,12],[1,12],[3,12],[5,12],[7,12],[9,12],[10,12],[11,12],[12,12],
                      [14,8],[16,8],[18,8],[20,8],[15,9],[17,9],[19,9],
                      [14,10],[16,10],[17,10],[19,10],[20,10],
                      [14,11],[15,11],[18,11],[20,11],[16,12],[17,12],[19,12],
                      [0,14],[1,14],[2,14],[3,14],[4,14],[5,14],[6,14],
                      [0,15],[6,15],[2,16],[4,16],[6,16],[0,17],[2,17],[3,17],[4,17],
                      [0,18],[6,18],[0,19],[1,19],[2,19],[4,19],[5,19],[6,19],
                      [8,14],[9,14],[10,14],[11,14],[8,16],[10,16],[11,16],
                      [8,17],[9,17],[10,17],[8,18],[11,18],[9,19],[11,19],
                      [14,14],[16,14],[17,14],[19,14],[20,14],
                      [15,15],[16,15],[18,15],[20,15],[14,16],[17,16],[19,16],
                      [14,17],[15,17],[17,17],[20,17],[16,18],[18,18],[19,18],
                      [14,19],[15,19],[17,19],[18,19],[20,19],
                    ].map(([x, y], i) => (
                      <rect key={i} x={x} y={y} width={1} height={1} fill="#0f172a" />
                    ))}
                  </svg>
                </div>
                <p className="text-sm text-slate-400 text-center">
                  Yape al número{" "}
                  <span className="font-black text-indigo-400 text-base">999 000 111</span>
                </p>
                <p className="text-xs text-slate-600">Buro Restaurante</p>
              </div>

              {/* Upload voucher */}
              <div>
                <p className="text-xs text-slate-500 mb-2">Sube la captura del voucher *</p>
                <label className="flex items-center gap-2.5 p-3 rounded-xl border-2 border-dashed
                                  cursor-pointer transition-colors
                                  bg-slate-800 border-slate-700 hover:border-indigo-500">
                  <Upload size={15} className="text-slate-400 shrink-0" />
                  <span className={`text-sm truncate ${boucher ? "text-emerald-400 font-medium" : "text-slate-500"}`}>
                    {boucher ? boucher.name : "Seleccionar captura…"}
                  </span>
                  {boucher && (
                    <button
                      className="ml-auto shrink-0"
                      onClick={(e) => { e.preventDefault(); setBoucher(null); }}
                    >
                      <X size={13} className="text-slate-500 hover:text-red-400" />
                    </button>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setBoucher(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10
                            border border-red-500/30 text-red-400 text-sm">
              <AlertCircle size={14} className="shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)}><X size={13} /></button>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleEnviar}
            disabled={enviando}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50
                       rounded-2xl text-white font-black text-base flex items-center
                       justify-center gap-2 transition-colors shadow-xl shadow-emerald-500/20"
          >
            <Bike size={18} />
            {enviando ? "Enviando pedido…" : "Enviar pedido 🛵"}
          </button>
        </div>
      )}
    </div>
  );
}
