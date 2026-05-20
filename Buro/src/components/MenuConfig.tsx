"use client";

import { useEffect, useState } from "react";
import {
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Hash,
  X,
  Zap,
} from "lucide-react";
import { supabase, type PlatoMaster } from "@/lib/supabase";

const MAX_ACTIVOS = 6;

type PlatoLocal = PlatoMaster & {
  seleccionado: boolean;
  stockInput:   string; // string para manejar el input sin conflictos
};

type Status = { type: "success" | "error" | "warning"; msg: string };

export default function MenuConfig() {
  const [platos, setPlatos]   = useState<PlatoLocal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [status,  setStatus]  = useState<Status | null>(null);

  // ── Carga inicial ────────────────────────────────────────
  const cargarPlatos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("platos_master")
      .select("*")
      .order("nombre_plato");

    if (error) {
      setStatus({ type: "error", msg: error.message });
    } else {
      setPlatos(
        (data as PlatoMaster[]).map((p) => ({
          ...p,
          seleccionado: p.activo_hoy,
          stockInput:   p.activo_hoy ? String(p.stock_actual) : "",
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => { cargarPlatos(); }, []);

  // ── Contadores ───────────────────────────────────────────
  const activosCount = platos.filter((p) => p.seleccionado).length;
  const limitAlcanzado = activosCount >= MAX_ACTIVOS;

  // ── Toggle plato ─────────────────────────────────────────
  const togglePlato = (id: string) => {
    setPlatos((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (!p.seleccionado && limitAlcanzado) return p; // bloquea si ya hay MAX
        return {
          ...p,
          seleccionado: !p.seleccionado,
          stockInput:   !p.seleccionado ? "20" : "",
        };
      })
    );
  };

  // ── Cambio de stock input ────────────────────────────────
  const setStock = (id: string, val: string) => {
    const num = val.replace(/\D/g, "");
    setPlatos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stockInput: num } : p))
    );
  };

  // ── Publicar menú del día ────────────────────────────────
  const handlePublicar = async () => {
    const seleccionados = platos.filter((p) => p.seleccionado);

    if (seleccionados.length === 0) {
      setStatus({ type: "warning", msg: "Selecciona al menos un plato antes de publicar." });
      return;
    }

    const stockInvalido = seleccionados.find(
      (p) => !p.stockInput || parseInt(p.stockInput) <= 0
    );
    if (stockInvalido) {
      setStatus({
        type: "warning",
        msg: `Ingresa un stock mayor a 0 para "${stockInvalido.nombre_plato}".`,
      });
      return;
    }

    setSaving(true);
    setStatus(null);

    // 1. Reset todos los platos
    const { error: errReset } = await supabase
      .from("platos_master")
      .update({ activo_hoy: false, stock_actual: 0 })
      .neq("id", "00000000-0000-0000-0000-000000000000"); // afecta todos

    if (errReset) {
      setStatus({ type: "error", msg: "Error al resetear platos: " + errReset.message });
      setSaving(false);
      return;
    }

    // 2. Activar los seleccionados con su stock
    for (const plato of seleccionados) {
      const { error } = await supabase
        .from("platos_master")
        .update({
          activo_hoy:   true,
          stock_actual: parseInt(plato.stockInput),
        })
        .eq("id", plato.id);

      if (error) {
        setStatus({ type: "error", msg: `Error en "${plato.nombre_plato}": ${error.message}` });
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setStatus({
      type: "success",
      msg: `✓ Menú publicado con ${seleccionados.length} platos activos.`,
    });
    cargarPlatos();
  };

  // ── UI ───────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-xl">
            <SlidersHorizontal className="text-amber-400" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Control de Menú e Inventario</h1>
            <p className="text-sm text-slate-400">
              Activa los platos del día y define el stock inicial antes de abrir
            </p>
          </div>
        </div>
        <button
          onClick={cargarPlatos}
          disabled={loading}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800
                     transition-colors disabled:opacity-40"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Contador y alerta de límite */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700
                        px-3 py-1.5 rounded-full">
          <Hash size={13} className="text-indigo-400" />
          <span className="text-sm text-slate-300">
            <span className={`font-bold ${activosCount >= MAX_ACTIVOS ? "text-amber-400" : "text-indigo-400"}`}>
              {activosCount}
            </span>
            <span className="text-slate-500"> / {MAX_ACTIVOS} platos activos</span>
          </span>
        </div>
        {limitAlcanzado && (
          <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30
                           px-2.5 py-1 rounded-full">
            Límite diario alcanzado
          </span>
        )}
      </div>

      {/* Grid de platos */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-900 rounded-xl border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {platos.map((plato) => (
            <div
              key={plato.id}
              onClick={() => togglePlato(plato.id)}
              className={`
                group relative rounded-xl border-2 p-4 cursor-pointer
                transition-all duration-200 select-none
                ${plato.seleccionado
                  ? "bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-500/10"
                  : limitAlcanzado
                    ? "bg-slate-900 border-slate-800 opacity-50 cursor-not-allowed"
                    : "bg-slate-900 border-slate-800 hover:border-slate-600 hover:bg-slate-800/50"
                }
              `}
            >
              {/* Checkbox visual */}
              <div className={`
                absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center
                transition-all ${plato.seleccionado
                  ? "bg-indigo-600 border-indigo-500"
                  : "border-slate-600"
                }
              `}>
                {plato.seleccionado && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                    <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5"
                          fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>

              {/* Info del plato */}
              <p className="text-sm font-semibold text-slate-200 pr-6 leading-tight">
                {plato.nombre_plato}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{plato.descripcion}</p>
              <p className="text-sm font-bold text-emerald-400 mt-1.5">
                S/ {plato.precio.toFixed(2)}
              </p>

              {/* Input de stock (visible solo si seleccionado) */}
              {plato.seleccionado && (
                <div
                  className="mt-3 flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <label className="text-xs text-slate-400 whitespace-nowrap">Stock:</label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={plato.stockInput}
                    onChange={(e) => setStock(plato.id, e.target.value)}
                    placeholder="20"
                    className="w-full bg-slate-800 border border-indigo-500/40 text-slate-100
                               rounded-lg px-2 py-1 text-sm font-bold text-center
                               focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-slate-500 whitespace-nowrap">uds.</span>
                </div>
              )}

              {/* Badge stock actual de BD */}
              {!plato.seleccionado && plato.activo_hoy && (
                <div className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
                  <Zap size={10} />
                  <span>Activo · {plato.stock_actual} uds.</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Status */}
      {status && (
        <div className={`flex items-start gap-2.5 p-3.5 rounded-xl text-sm border ${
          status.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
          status.type === "warning" ? "bg-amber-500/10  border-amber-500/30  text-amber-400"   :
                                      "bg-red-500/10    border-red-500/30    text-red-400"
        }`}>
          {status.type === "success"
            ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
            : <AlertCircle  size={15} className="mt-0.5 shrink-0" />
          }
          <span className="flex-1">{status.msg}</span>
          <button onClick={() => setStatus(null)}>
            <X size={13} className="opacity-60 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* Resumen de seleccionados + botón publicar */}
      {platos.some((p) => p.seleccionado) && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">Resumen del menú a publicar</h3>
          <div className="flex flex-wrap gap-2">
            {platos.filter((p) => p.seleccionado).map((p) => (
              <div key={p.id}
                   className="flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/30
                              px-3 py-1.5 rounded-lg text-xs">
                <span className="text-slate-200 font-medium">{p.nombre_plato}</span>
                <span className="text-indigo-400 font-bold">
                  {p.stockInput || "0"} uds
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={handlePublicar}
            disabled={saving}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                       rounded-xl text-white font-bold text-sm transition-colors flex
                       items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            <Zap size={15} />
            {saving ? "Publicando…" : "Publicar Menú del Día"}
          </button>
        </div>
      )}
    </div>
  );
}
