"use client";

import { useCallback, useEffect, useState } from "react";
import {
  UtensilsCrossed,
  Plus,
  Minus,
  Printer,
  CreditCard,
  Banknote,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  PackageX,
  ShieldAlert,
} from "lucide-react";
import { supabase, type Mesa, type PedidoMesa, type PlatoMaster, type ItemPedido } from "@/lib/supabase";

// ─── Paleta por estado ─────────────────────────────────────

const MESA_CARD: Record<Mesa["estado"], string> = {
  LIBRE:     "bg-emerald-500/10 border-emerald-500/40 hover:bg-emerald-500/15",
  OCUPADA:   "bg-indigo-500/10  border-indigo-500/40  hover:bg-indigo-500/15",
  PRECUENTA: "bg-amber-500/10   border-amber-500/40   hover:bg-amber-500/15",
};
const MESA_ICON: Record<Mesa["estado"], string> = {
  LIBRE:     "text-emerald-400",
  OCUPADA:   "text-indigo-400",
  PRECUENTA: "text-amber-400",
};
const MESA_BADGE: Record<Mesa["estado"], string> = {
  LIBRE:     "bg-emerald-500/15 text-emerald-400",
  OCUPADA:   "bg-indigo-500/15  text-indigo-400",
  PRECUENTA: "bg-amber-500/15   text-amber-400",
};
const MESA_LABEL: Record<Mesa["estado"], string> = {
  LIBRE:     "Libre",
  OCUPADA:   "Ocupada",
  PRECUENTA: "Pre-cuenta",
};

type Status = { type: "success" | "error"; msg: string };

// ─── Componente ────────────────────────────────────────────

export default function SalonControl() {
  const [mesas,       setMesas]       = useState<Mesa[]>([]);
  const [platos,      setPlatos]      = useState<PlatoMaster[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [mesaActiva,  setMesaActiva]  = useState<Mesa | null>(null);
  const [pedidoAct,   setPedidoAct]   = useState<PedidoMesa | null>(null);
  const [cart,        setCart]        = useState<ItemPedido[]>([]);
  const [metodoPago,  setMetodoPago]  = useState<"EFECTIVO" | "YAPE" | null>(null);
  const [status,      setStatus]      = useState<Status | null>(null);
  const [guardando,   setGuardando]   = useState(false);

  // ── Carga inicial ────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoadingInit(true);
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase.from("mesas").select("*").order("numero_mesa"),
      supabase.from("platos_master").select("*").eq("activo_hoy", true).order("nombre_plato"),
    ]);
    setMesas(m ?? []);
    setPlatos(p ?? []);
    setLoadingInit(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Click en mesa ────────────────────────────────────────
  const handleClickMesa = async (mesa: Mesa) => {
    setStatus(null);
    setMetodoPago(null);
    setMesaActiva(mesa);

    if (mesa.estado === "LIBRE") {
      setCart([]);
      setPedidoAct(null);
    } else {
      const { data } = await supabase
        .from("pedidos_mesa")
        .select("*")
        .eq("mesa_id", mesa.id)
        .eq("estado_pago", "PENDIENTE")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const pedido = data as PedidoMesa | null;
      setPedidoAct(pedido);
      setCart(pedido?.platos_pedido ?? []);
    }
  };

  // ── Carrito ──────────────────────────────────────────────
  const getQty = (nombre: string) =>
    cart.find((c) => c.nombre === nombre)?.cantidad ?? 0;

  const updateQty = (plato: PlatoMaster, delta: number) => {
    if (delta > 0 && plato.stock_actual === 0) return;

    setCart((prev) => {
      const exist = prev.find((c) => c.nombre === plato.nombre_plato);
      if (!exist && delta > 0) {
        return [...prev, { nombre: plato.nombre_plato, cantidad: 1, precio_unitario: plato.precio }];
      }
      return prev
        .map((c) => c.nombre === plato.nombre_plato ? { ...c, cantidad: c.cantidad + delta } : c)
        .filter((c) => c.cantidad > 0);
    });
  };

  const totalCuenta = cart.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0);

  // Validación de stock antes de abrir cuenta
  const stockInsuficiente = cart.filter((item) => {
    const p = platos.find((pl) => pl.nombre_plato === item.nombre);
    return p ? p.stock_actual < item.cantidad : false;
  });

  // ── Abrir cuenta (LIBRE → OCUPADA) ──────────────────────
  const handleAbrirCuenta = async () => {
    if (!mesaActiva || cart.length === 0) return;
    if (stockInsuficiente.length > 0) {
      setStatus({
        type: "error",
        msg: `Sin stock: ${stockInsuficiente.map((i) => i.nombre).join(", ")}`,
      });
      return;
    }

    setGuardando(true);

    // El trigger descuenta stock automáticamente al insertar
    const { data: pedido, error } = await supabase
      .from("pedidos_mesa")
      .insert({
        mesa_id:       mesaActiva.id,
        platos_pedido: cart,
        monto_total:   totalCuenta,
        estado_pago:   "PENDIENTE",
      })
      .select()
      .single();

    if (error) {
      setStatus({ type: "error", msg: error.message });
      setGuardando(false);
      return;
    }

    await supabase.from("mesas").update({ estado: "OCUPADA" }).eq("id", mesaActiva.id);

    const updated: Mesa = { ...mesaActiva, estado: "OCUPADA" };
    setMesas((prev) => prev.map((m) => m.id === mesaActiva.id ? updated : m));
    setMesaActiva(updated);
    setPedidoAct(pedido as PedidoMesa);

    // Refrescar platos para mostrar stock actualizado
    const { data: platosNew } = await supabase
      .from("platos_master")
      .select("*")
      .eq("activo_hoy", true)
      .order("nombre_plato");
    setPlatos(platosNew ?? []);

    setGuardando(false);
  };

  // ── Pre-cuenta (OCUPADA → PRECUENTA + print) ─────────────
  const handlePreCuenta = async () => {
    if (!mesaActiva) return;
    await supabase.from("mesas").update({ estado: "PRECUENTA" }).eq("id", mesaActiva.id);
    const updated: Mesa = { ...mesaActiva, estado: "PRECUENTA" };
    setMesas((prev) => prev.map((m) => m.id === mesaActiva.id ? updated : m));
    setMesaActiva(updated);
    window.print();
  };

  // ── Cerrar cuenta (PRECUENTA/OCUPADA → LIBRE) ────────────
  const handleCerrarCuenta = async () => {
    if (!mesaActiva || !pedidoAct || !metodoPago) return;
    setGuardando(true);

    const { error } = await supabase
      .from("pedidos_mesa")
      .update({ estado_pago: "PAGADO" })
      .eq("id", pedidoAct.id);

    if (error) {
      setStatus({ type: "error", msg: error.message });
      setGuardando(false);
      return;
    }

    await supabase.from("mesas").update({ estado: "LIBRE" }).eq("id", mesaActiva.id);

    setStatus({ type: "success", msg: `Mesa ${mesaActiva.numero_mesa} cerrada · Pago: ${metodoPago} · S/ ${totalCuenta.toFixed(2)}` });
    setMesas((prev) => prev.map((m) => m.id === mesaActiva.id ? { ...m, estado: "LIBRE" } : m));
    setMesaActiva(null);
    setPedidoAct(null);
    setCart([]);
    setGuardando(false);
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <>
      {/* ═════════════ VISTA WEB ════════════════════════ */}
      <div className="no-print space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl">
              <UtensilsCrossed className="text-amber-400" size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Control de Salón</h1>
              <p className="text-sm text-slate-400">Gestión de mesas con stock en tiempo real</p>
            </div>
          </div>
          <button
            onClick={fetchData}
            disabled={loadingInit}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <RefreshCw size={15} className={loadingInit ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap gap-2">
          {(["LIBRE", "OCUPADA", "PRECUENTA"] as Mesa["estado"][]).map((e) => (
            <span key={e} className={`text-xs px-2.5 py-1 rounded-full font-semibold ${MESA_BADGE[e]}`}>
              {MESA_LABEL[e]}
            </span>
          ))}
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 font-medium">
            {mesas.filter((m) => m.estado === "LIBRE").length} libres de {mesas.length}
          </span>
        </div>

        {/* Status */}
        {status && (
          <div className={`flex items-center gap-2 p-3 rounded-xl text-sm border ${
            status.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10    border-red-500/30    text-red-400"
          }`}>
            {status.type === "success"
              ? <CheckCircle2 size={14} />
              : <AlertCircle  size={14} />
            }
            <span className="flex-1">{status.msg}</span>
            <button onClick={() => setStatus(null)}><X size={13} /></button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── Grid de mesas ─────────────────────────── */}
          <div className="lg:col-span-3">
            {loadingInit ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-slate-900 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {mesas.map((mesa) => (
                  <button
                    key={mesa.id}
                    onClick={() => handleClickMesa(mesa)}
                    className={`
                      relative aspect-square rounded-2xl border-2 flex flex-col
                      items-center justify-center gap-1.5 transition-all duration-200
                      ${MESA_CARD[mesa.estado]}
                      ${mesaActiva?.id === mesa.id
                        ? "ring-2 ring-white/20 scale-[0.96] shadow-xl"
                        : "hover:scale-[0.98]"
                      }
                    `}
                  >
                    <UtensilsCrossed size={20} className={MESA_ICON[mesa.estado]} />
                    <span className="text-xl font-black text-slate-100">{mesa.numero_mesa}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${MESA_BADGE[mesa.estado]}`}>
                      {MESA_LABEL[mesa.estado]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Panel de comanda ──────────────────────── */}
          <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
            {!mesaActiva ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-700 gap-3">
                <UtensilsCrossed size={36} />
                <p className="text-sm text-slate-500">Selecciona una mesa para gestionar</p>
              </div>
            ) : (
              <>
                {/* Header panel */}
                <div className={`px-4 py-3 border-b border-slate-800 flex items-center justify-between`}>
                  <div>
                    <h2 className="text-sm font-bold text-slate-200">Mesa {mesaActiva.numero_mesa}</h2>
                    {pedidoAct && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Abierta · S/ {totalCuenta.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${MESA_BADGE[mesaActiva.estado]}`}>
                    {MESA_LABEL[mesaActiva.estado]}
                  </span>
                </div>

                {/* Selector de platos (solo si mesa LIBRE para abrir) */}
                {mesaActiva.estado === "LIBRE" && (
                  <div className="p-3 border-b border-slate-800 space-y-1.5 max-h-56 overflow-y-auto">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Menú del día
                    </p>
                    {platos.length === 0 ? (
                      <div className="flex items-center gap-2 text-xs text-slate-600 py-2">
                        <PackageX size={14} />
                        Sin menú publicado hoy
                      </div>
                    ) : (
                      platos.map((plato) => {
                        const qty     = getQty(plato.nombre_plato);
                        const agotado = plato.stock_actual === 0;
                        return (
                          <div key={plato.id} className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs truncate font-medium ${agotado ? "text-slate-600 line-through" : "text-slate-300"}`}>
                                {plato.nombre_plato}
                              </p>
                              <p className={`text-[10px] ${agotado ? "text-red-500/60" : "text-slate-600"}`}>
                                {agotado ? "AGOTADO" : `${plato.stock_actual} uds · S/${plato.precio}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => updateQty(plato, -1)}
                                disabled={qty === 0}
                                className="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600
                                           disabled:opacity-25 flex items-center justify-center
                                           text-slate-300 transition-colors"
                              >
                                <Minus size={10} />
                              </button>
                              <span className="w-5 text-center text-xs font-black text-slate-200">
                                {qty}
                              </span>
                              <button
                                onClick={() => updateQty(plato, 1)}
                                disabled={agotado || qty >= plato.stock_actual}
                                className="w-6 h-6 rounded-lg bg-indigo-600 hover:bg-indigo-500
                                           disabled:opacity-25 flex items-center justify-center
                                           text-white transition-colors"
                              >
                                <Plus size={10} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Items en cuenta */}
                {cart.length > 0 && (
                  <div className="border-b border-slate-800 max-h-48 overflow-y-auto">
                    <div className="px-3 py-2 space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        En cuenta
                      </p>
                      {cart.map((item) => (
                        <div key={item.nombre} className="flex items-center gap-2">
                          <span className="text-xs text-indigo-400 w-5 text-right font-bold shrink-0">
                            {item.cantidad}×
                          </span>
                          <span className="flex-1 text-xs text-slate-300 truncate">{item.nombre}</span>
                          <span className="text-xs text-slate-400 shrink-0">
                            S/ {(item.cantidad * item.precio_unitario).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between px-3 py-2.5 bg-slate-800/60">
                      <span className="text-xs font-bold text-slate-300">Total</span>
                      <span className="text-sm font-black text-emerald-400">
                        S/ {totalCuenta.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Alerta stock */}
                {stockInsuficiente.length > 0 && (
                  <div className="mx-3 my-2 flex items-start gap-2 p-2 rounded-lg
                                  bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                    <ShieldAlert size={12} className="mt-0.5 shrink-0" />
                    Stock insuficiente para: {stockInsuficiente.map((i) => i.nombre).join(", ")}
                  </div>
                )}

                {/* Acciones */}
                <div className="p-3 space-y-2 mt-auto">
                  {mesaActiva.estado === "LIBRE" && (
                    <button
                      onClick={handleAbrirCuenta}
                      disabled={guardando || cart.length === 0 || stockInsuficiente.length > 0}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500
                                 disabled:opacity-40 rounded-xl text-white text-sm
                                 font-bold transition-colors"
                    >
                      {guardando ? "Abriendo…" : "Abrir cuenta"}
                    </button>
                  )}

                  {(mesaActiva.estado === "OCUPADA" || mesaActiva.estado === "PRECUENTA") && (
                    <>
                      {mesaActiva.estado === "OCUPADA" && (
                        <button
                          onClick={handlePreCuenta}
                          className="w-full py-2.5 bg-amber-600 hover:bg-amber-500
                                     rounded-xl text-white text-sm font-bold
                                     flex items-center justify-center gap-2 transition-colors"
                        >
                          <Printer size={13} />
                          Imprimir Pre-cuenta
                        </button>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        {(["EFECTIVO", "YAPE"] as const).map((mp) => (
                          <button
                            key={mp}
                            onClick={() => setMetodoPago(mp)}
                            className={`py-2 rounded-xl text-xs font-bold border-2 transition-all
                                        flex items-center justify-center gap-1 ${
                              metodoPago === mp
                                ? "bg-emerald-600 border-emerald-500 text-white"
                                : "bg-slate-800 border-slate-700 text-slate-400"
                            }`}
                          >
                            {mp === "EFECTIVO"
                              ? <><Banknote size={11} />Efectivo</>
                              : <><CreditCard size={11} />Yape</>
                            }
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={handleCerrarCuenta}
                        disabled={guardando || !metodoPago}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500
                                   disabled:opacity-40 rounded-xl text-white text-sm
                                   font-bold flex items-center justify-center gap-2
                                   transition-colors"
                      >
                        <CheckCircle2 size={13} />
                        {guardando ? "Cerrando…" : `Cerrar · S/ ${totalCuenta.toFixed(2)}`}
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => { setMesaActiva(null); setCart([]); setStatus(null); }}
                    className="w-full py-2 text-slate-600 hover:text-slate-400 text-xs
                               rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ═════════════ TICKET PRE-CUENTA 80mm ═══════════ */}
      {mesaActiva && pedidoAct && (
        <div className="only-print w-[80mm] font-mono text-black bg-white">
          <div className="text-center mb-3">
            <p className="text-xl font-black">★ BURO RESTAURANTE ★</p>
            <p className="text-sm">━━━━━━━━━━━━━━━━━━━━━━</p>
            <p className="text-base font-black">PRE-CUENTA</p>
            <p className="text-xs">{new Date().toLocaleString("es-PE")}</p>
            <p className="text-2xl font-black mt-1">MESA {mesaActiva.numero_mesa}</p>
          </div>
          <p className="text-sm text-center">━━━━━━━━━━━━━━━━━━━━━━</p>
          <table className="w-full text-sm my-2">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left py-1 font-black">CANT</th>
                <th className="text-left py-1 font-black">PLATO</th>
                <th className="text-right py-1 font-black">S/</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => (
                <tr key={item.nombre}>
                  <td className="py-1 font-bold text-lg">{item.cantidad}</td>
                  <td className="py-1 uppercase font-bold">{item.nombre}</td>
                  <td className="py-1 text-right font-bold">
                    {(item.cantidad * item.precio_unitario).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-center">━━━━━━━━━━━━━━━━━━━━━━</p>
          <div className="flex justify-between text-lg font-black mt-1">
            <span>TOTAL</span>
            <span>S/ {totalCuenta.toFixed(2)}</span>
          </div>
          <p className="text-xs text-center mt-3">PRECIO INCLUYE IGV · ¡Gracias!</p>
          <p className="text-[10px] text-center mt-1">{new Date().toLocaleDateString("es-PE")}</p>
        </div>
      )}
    </>
  );
}
