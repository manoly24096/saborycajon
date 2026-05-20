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
  Plus,
  Pencil,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
  Edit3,
  PackageX,
} from "lucide-react";
import { supabase, type PlatoMaster } from "@/lib/supabase";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type PlatoLocal = PlatoMaster & {
  seleccionado: boolean;
  stockInput:   string;
};

type FormPlato = {
  nombre_plato: string;
  precio:       string;
  descripcion:  string;
};

const FORM_VACIO: FormPlato = { nombre_plato: "", precio: "", descripcion: "" };

type Status = { type: "success" | "error" | "warning"; msg: string };

const MAX_ACTIVOS = 6;

// ─── Componente ───────────────────────────────────────────────────────────────

export default function MenuConfig() {
  const [platos,          setPlatos]          = useState<PlatoLocal[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [status,          setStatus]          = useState<Status | null>(null);
  const [modoEdicion,     setModoEdicion]     = useState(false); // true = editando menú publicado

  // CRUD modal
  const [modalAbierto,    setModalAbierto]    = useState(false);
  const [editando,        setEditando]        = useState<PlatoMaster | null>(null);
  const [form,            setForm]            = useState<FormPlato>(FORM_VACIO);
  const [formError,       setFormError]       = useState<string | null>(null);
  const [guardandoForm,   setGuardandoForm]   = useState(false);

  // Confirmar eliminación
  const [eliminando,      setEliminando]      = useState<PlatoMaster | null>(null);
  const [confirmando,     setConfirmando]     = useState(false);

  // Catálogo colapsado
  const [catalogoAbierto, setCatalogoAbierto] = useState(true);

  // ── Carga ────────────────────────────────────────────────
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

  // ── Derivados ────────────────────────────────────────────
  const activosCount     = platos.filter((p) => p.seleccionado).length;
  const limitAlcanzado   = activosCount >= MAX_ACTIVOS;
  const hayMenuPublicado = platos.some((p) => p.activo_hoy);
  const enEdicion        = modoEdicion || !hayMenuPublicado;

  // ── Selección de platos ──────────────────────────────────
  const togglePlato = (id: string) => {
    if (!enEdicion) return;
    setPlatos((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (!p.seleccionado && limitAlcanzado) return p;
        return {
          ...p,
          seleccionado: !p.seleccionado,
          stockInput:   !p.seleccionado ? "20" : "",
        };
      })
    );
  };

  const setStock = (id: string, val: string) => {
    setPlatos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stockInput: val.replace(/\D/g, "") } : p))
    );
  };

  // ── Publicar / Actualizar menú ───────────────────────────
  const handlePublicar = async () => {
    const sel = platos.filter((p) => p.seleccionado);
    if (!sel.length)
      return setStatus({ type: "warning", msg: "Selecciona al menos un plato." });

    const inv = sel.find((p) => !p.stockInput || parseInt(p.stockInput) <= 0);
    if (inv)
      return setStatus({ type: "warning", msg: `Stock inválido en "${inv.nombre_plato}".` });

    setSaving(true);
    setStatus(null);

    // Reset todos
    const { error: errReset } = await supabase
      .from("platos_master")
      .update({ activo_hoy: false, stock_actual: 0 })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (errReset) {
      setStatus({ type: "error", msg: errReset.message });
      setSaving(false);
      return;
    }

    // Activar seleccionados
    for (const p of sel) {
      const { error } = await supabase
        .from("platos_master")
        .update({ activo_hoy: true, stock_actual: parseInt(p.stockInput) })
        .eq("id", p.id);
      if (error) {
        setStatus({ type: "error", msg: `Error en "${p.nombre_plato}": ${error.message}` });
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setModoEdicion(false);
    setStatus({
      type: "success",
      msg: `✓ Menú ${hayMenuPublicado ? "actualizado" : "publicado"} con ${sel.length} platos activos.`,
    });
    cargarPlatos();
  };

  // ── CRUD: modal ──────────────────────────────────────────
  const abrirCrear = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setFormError(null);
    setModalAbierto(true);
  };

  const abrirEditar = (plato: PlatoMaster, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditando(plato);
    setForm({ nombre_plato: plato.nombre_plato, precio: String(plato.precio), descripcion: plato.descripcion });
    setFormError(null);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditando(null);
    setForm(FORM_VACIO);
    setFormError(null);
  };

  const handleGuardar = async () => {
    const nombre = form.nombre_plato.trim();
    const precio = parseFloat(form.precio);
    if (!nombre)               return setFormError("El nombre es obligatorio.");
    if (isNaN(precio) || precio < 0) return setFormError("Ingresa un precio válido.");

    setGuardandoForm(true);
    setFormError(null);

    if (editando) {
      const { error } = await supabase
        .from("platos_master")
        .update({ nombre_plato: nombre, precio, descripcion: form.descripcion.trim() })
        .eq("id", editando.id);
      if (error) { setFormError(error.message); setGuardandoForm(false); return; }
      setStatus({ type: "success", msg: `"${nombre}" actualizado.` });
    } else {
      const { error } = await supabase
        .from("platos_master")
        .insert({ nombre_plato: nombre, precio, descripcion: form.descripcion.trim(), activo_hoy: false, stock_actual: 0 });
      if (error) {
        setFormError(error.code === "23505" ? `Ya existe un plato llamado "${nombre}".` : error.message);
        setGuardandoForm(false);
        return;
      }
      setStatus({ type: "success", msg: `"${nombre}" añadido al catálogo.` });
    }

    setGuardandoForm(false);
    cerrarModal();
    cargarPlatos();
  };

  // ── CRUD: eliminar ───────────────────────────────────────
  const handleEliminar = async () => {
    if (!eliminando) return;
    setConfirmando(true);
    const { error } = await supabase.from("platos_master").delete().eq("id", eliminando.id);
    setConfirmando(false);
    setEliminando(null);
    if (error) {
      setStatus({ type: "error", msg: error.message });
    } else {
      setStatus({ type: "success", msg: `"${eliminando.nombre_plato}" eliminado.` });
      cargarPlatos();
    }
  };

  // ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────── */}
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
        <div className="flex items-center gap-2">
          <button
            onClick={abrirCrear}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600
                       hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
          >
            <Plus size={14} />
            Nuevo plato
          </button>
          <button
            onClick={cargarPlatos}
            disabled={loading}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800
                       transition-colors disabled:opacity-40"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ── Status ──────────────────────────────────────── */}
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

      {/* ══ BANNER: Menú ya publicado ══════════════════════ */}
      {hayMenuPublicado && !modoEdicion && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl
                        bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
              <CheckCircle2 className="text-emerald-400" size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-300">Menú del día publicado</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                {platos.filter((p) => p.activo_hoy).map((p) => p.nombre_plato).join(" · ")}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setModoEdicion(true); setStatus(null); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20
                       hover:bg-emerald-600/40 text-emerald-300 text-sm font-semibold
                       border border-emerald-500/30 transition-colors shrink-0"
          >
            <Edit3 size={13} />
            Editar menú
          </button>
        </div>
      )}

      {/* ══ BANNER: Modo edición activo ════════════════════ */}
      {hayMenuPublicado && modoEdicion && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl
                        bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
              <Edit3 className="text-amber-400" size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-300">Editando menú publicado</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Modifica la selección y el stock, luego presiona "Actualizar Menú"
              </p>
            </div>
          </div>
          <button
            onClick={() => { setModoEdicion(false); cargarPlatos(); setStatus(null); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800
                       hover:bg-slate-700 text-slate-300 text-sm font-semibold
                       transition-colors shrink-0"
          >
            <X size={13} />
            Cancelar
          </button>
        </div>
      )}

      {/* ══ CATÁLOGO MAESTRO ════════════════════════════════ */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <button
          onClick={() => setCatalogoAbierto(!catalogoAbierto)}
          className="w-full px-5 py-4 flex items-center justify-between
                     hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-200">Catálogo Maestro</span>
            <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
              {platos.length} platos
            </span>
          </div>
          {catalogoAbierto
            ? <ChevronUp  size={15} className="text-slate-500" />
            : <ChevronDown size={15} className="text-slate-500" />
          }
        </button>

        {catalogoAbierto && (
          <div className="border-t border-slate-800">
            {loading ? (
              <div className="divide-y divide-slate-800">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                    <div className="h-4 bg-slate-800 rounded w-48" />
                    <div className="h-4 bg-slate-800 rounded w-20 ml-auto" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {platos.map((plato) => {
                  const agotado = plato.activo_hoy && plato.stock_actual === 0;
                  return (
                    <div
                      key={plato.id}
                      className="px-5 py-3.5 flex items-center gap-4
                                 hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-200 truncate">
                            {plato.nombre_plato}
                          </p>
                          {agotado && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded
                                             bg-red-500/20 text-red-400 tracking-wider shrink-0">
                              AGOTADO
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {plato.descripcion || "—"}
                        </p>
                      </div>

                      {/* Precio */}
                      <span className="text-sm font-bold text-emerald-400 shrink-0 w-20 text-right">
                        S/ {plato.precio.toFixed(2)}
                      </span>

                      {/* Estado */}
                      {agotado ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full
                                         bg-red-500/15 text-red-400 shrink-0 w-24 text-center
                                         tracking-wider">
                          AGOTADO
                        </span>
                      ) : plato.activo_hoy ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full
                                         bg-indigo-500/15 text-indigo-400 shrink-0 w-24 text-center">
                          Activo · {plato.stock_actual} uds
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full
                                         bg-slate-800 text-slate-600 shrink-0 w-24 text-center">
                          Inactivo
                        </span>
                      )}

                      {/* Acciones hover */}
                      <div className="flex items-center gap-1 shrink-0
                                      opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => abrirEditar(plato, e)}
                          className="p-1.5 rounded-lg hover:bg-indigo-500/15 text-slate-500
                                     hover:text-indigo-400 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEliminando(plato); }}
                          className="p-1.5 rounded-lg hover:bg-red-500/15 text-slate-500
                                     hover:text-red-400 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button
                  onClick={abrirCrear}
                  className="w-full px-5 py-3.5 flex items-center gap-2 text-slate-600
                             hover:text-indigo-400 hover:bg-slate-800/30 transition-colors text-sm"
                >
                  <Plus size={14} />
                  Agregar nuevo plato al catálogo
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ SELECCIÓN DEL MENÚ DEL DÍA ══════════════════════ */}
      {enEdicion && (
        <div className="space-y-4">
          {/* Contador */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700
                            px-3 py-1.5 rounded-full">
              <Hash size={13} className="text-indigo-400" />
              <span className="text-sm text-slate-300">
                <span className={`font-bold ${limitAlcanzado ? "text-amber-400" : "text-indigo-400"}`}>
                  {activosCount}
                </span>
                <span className="text-slate-500"> / {MAX_ACTIVOS} platos activos hoy</span>
              </span>
            </div>
            {limitAlcanzado && (
              <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30
                               px-2.5 py-1 rounded-full">
                Límite diario alcanzado
              </span>
            )}
          </div>

          <p className="text-sm text-slate-500">
            Selecciona los platos disponibles hoy e ingresa el stock inicial:
          </p>

          {/* Grid de selección */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-24 bg-slate-900 rounded-xl border border-slate-800 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {platos.map((plato) => {
                const agotado = plato.activo_hoy && plato.stock_actual === 0 && plato.seleccionado;
                return (
                  <div
                    key={plato.id}
                    onClick={() => togglePlato(plato.id)}
                    className={`
                      relative rounded-xl border-2 p-4 cursor-pointer
                      transition-all duration-200 select-none
                      ${plato.seleccionado
                        ? agotado
                          ? "bg-red-500/5 border-red-500/40"
                          : "bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-500/10"
                        : limitAlcanzado
                          ? "bg-slate-900 border-slate-800 opacity-50 cursor-not-allowed"
                          : "bg-slate-900 border-slate-800 hover:border-slate-600 hover:bg-slate-800/50"
                      }
                    `}
                  >
                    {/* Checkbox */}
                    <div className={`
                      absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center
                      transition-all ${
                        plato.seleccionado
                          ? agotado ? "bg-red-500 border-red-400" : "bg-indigo-600 border-indigo-500"
                          : "border-slate-600"
                      }
                    `}>
                      {plato.seleccionado && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8"
                                strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-slate-200 pr-6 leading-tight">
                      {plato.nombre_plato}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{plato.descripcion}</p>

                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-sm font-bold text-emerald-400">
                        S/ {plato.precio.toFixed(2)}
                      </p>
                      {/* Badge AGOTADO en la card del menú del día */}
                      {agotado && (
                        <span className="flex items-center gap-1 text-[10px] font-black
                                         text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded
                                         tracking-wider">
                          <PackageX size={9} />
                          AGOTADO
                        </span>
                      )}
                    </div>

                    {/* Input stock */}
                    {plato.seleccionado && (
                      <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <label className="text-xs text-slate-400 whitespace-nowrap">Stock:</label>
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={plato.stockInput}
                          onChange={(e) => setStock(plato.id, e.target.value)}
                          placeholder="20"
                          className={`w-full rounded-lg px-2 py-1 text-sm font-bold text-center
                                      focus:outline-none focus:ring-2 ${
                            agotado
                              ? "bg-red-500/10 border border-red-500/40 text-red-400 focus:ring-red-500"
                              : "bg-slate-800 border border-indigo-500/40 text-slate-100 focus:ring-indigo-500"
                          }`}
                        />
                        <span className="text-xs text-slate-500 whitespace-nowrap">uds.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Resumen + botón publicar/actualizar */}
          {platos.some((p) => p.seleccionado) && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300">
                  {hayMenuPublicado ? "Menú a actualizar" : "Menú a publicar"}
                </h3>
                <span className="text-xs text-slate-500">
                  Edita la cantidad directamente en cada plato
                </span>
              </div>

              {/* Chips editables */}
              <div className="flex flex-wrap gap-2">
                {platos.filter((p) => p.seleccionado).map((p) => {
                  const agotado = p.stockInput === "0" || p.stockInput === "";
                  return (
                    <div
                      key={p.id}
                      className={`group flex items-center gap-2 border rounded-xl
                                  px-3 py-2 transition-all ${
                        agotado
                          ? "bg-red-500/10 border-red-500/40"
                          : "bg-indigo-600/10 border-indigo-500/30 hover:border-indigo-400"
                      }`}
                    >
                      {/* Nombre */}
                      <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
                        {p.nombre_plato}
                      </span>

                      {/* Separador */}
                      <span className="text-slate-700">·</span>

                      {/* Input de stock inline */}
                      <div className="flex items-center gap-1">
                        {/* Botón − */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const cur = parseInt(p.stockInput || "0");
                            if (cur > 0) setStock(p.id, String(cur - 1));
                          }}
                          className="w-5 h-5 flex items-center justify-center rounded-md
                                     bg-slate-700 hover:bg-slate-600 text-slate-300
                                     text-xs font-black transition-colors"
                        >
                          −
                        </button>

                        {/* Número editable */}
                        <input
                          type="number"
                          min={0}
                          max={999}
                          value={p.stockInput}
                          onChange={(e) => setStock(p.id, e.target.value)}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          className={`w-10 text-center text-sm font-black rounded-lg
                                      border focus:outline-none focus:ring-2 px-1 py-0.5
                                      bg-transparent transition-colors ${
                            agotado
                              ? "text-red-400 border-red-500/40 focus:ring-red-500/50"
                              : "text-indigo-300 border-indigo-500/30 focus:ring-indigo-500/50"
                          }`}
                        />

                        {/* Botón + */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const cur = parseInt(p.stockInput || "0");
                            setStock(p.id, String(cur + 1));
                          }}
                          className="w-5 h-5 flex items-center justify-center rounded-md
                                     bg-indigo-600 hover:bg-indigo-500 text-white
                                     text-xs font-black transition-colors"
                        >
                          +
                        </button>

                        <span className={`text-[10px] font-medium whitespace-nowrap ${
                          agotado ? "text-red-500" : "text-slate-500"
                        }`}>
                          {agotado ? "AGOTADO" : "uds"}
                        </span>
                      </div>

                      {/* Quitar plato del menú */}
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePlato(p.id); }}
                        className="ml-1 text-slate-600 hover:text-red-400 transition-colors"
                        title="Quitar del menú"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handlePublicar}
                disabled={saving}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                           rounded-xl text-white font-bold text-sm transition-colors flex
                           items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
              >
                <Zap size={15} />
                {saving
                  ? "Guardando…"
                  : hayMenuPublicado
                    ? "Actualizar Menú del Día"
                    : "Publicar Menú del Día"
                }
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══ MODAL CREAR / EDITAR ════════════════════════════ */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={cerrarModal} />
          <div className="relative z-10 w-full max-w-md bg-slate-900 rounded-2xl border
                          border-slate-700 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-slate-100">
                {editando ? "Editar plato" : "Nuevo plato"}
              </h2>
              <button onClick={cerrarModal}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200
                                 hover:bg-slate-800 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {[
                { key: "nombre_plato", label: "Nombre del plato *", type: "text",   ph: "Ej: Lomo Saltado" },
                { key: "precio",       label: "Precio (S/) *",       type: "number", ph: "0.00" },
                { key: "descripcion",  label: "Descripción",         type: "text",   ph: "Ej: Con arroz y papas fritas" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-slate-400 block mb-1.5">{f.label}</label>
                  <input
                    type={f.type}
                    value={form[f.key as keyof FormPlato]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.ph}
                    step={f.key === "precio" ? "0.50" : undefined}
                    min={f.key === "precio" ? 0 : undefined}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100
                               rounded-xl px-4 py-2.5 text-sm focus:outline-none
                               focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600"
                  />
                </div>
              ))}

              {formError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10
                                border border-red-500/30 text-red-400 text-sm">
                  <AlertCircle size={13} className="shrink-0" />
                  {formError}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-5 pb-5">
              <button onClick={cerrarModal}
                      className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700
                                 text-slate-300 text-sm font-semibold transition-colors">
                Cancelar
              </button>
              <button onClick={handleGuardar} disabled={guardandoForm}
                      className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500
                                 disabled:opacity-50 text-white text-sm font-bold transition-colors
                                 flex items-center justify-center gap-2">
                <Save size={14} />
                {guardandoForm ? "Guardando…" : editando ? "Guardar cambios" : "Crear plato"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL CONFIRMAR ELIMINACIÓN ═════════════════════ */}
      {eliminando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"
               onClick={() => setEliminando(null)} />
          <div className="relative z-10 w-full max-w-sm bg-slate-900 rounded-2xl border
                          border-slate-700 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Eliminar plato</h3>
                <p className="text-xs text-slate-500 mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-slate-400">
              ¿Seguro que quieres eliminar{" "}
              <span className="font-bold text-slate-200">"{eliminando.nombre_plato}"</span>{" "}
              del catálogo maestro?
            </p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEliminando(null)} disabled={confirmando}
                      className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700
                                 text-slate-300 text-sm font-semibold transition-colors">
                Cancelar
              </button>
              <button onClick={handleEliminar} disabled={confirmando}
                      className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500
                                 disabled:opacity-50 text-white text-sm font-bold transition-colors
                                 flex items-center justify-center gap-2">
                <Trash2 size={13} />
                {confirmando ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
