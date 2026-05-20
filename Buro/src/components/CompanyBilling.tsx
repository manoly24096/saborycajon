"use client";

import { useEffect, useState } from "react";
import {
  Receipt,
  TrendingUp,
  Users,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
  ShieldAlert,
} from "lucide-react";
import { supabase, type Empresa, type PedidoCorporativo } from "@/lib/supabase";

type ResumenEmpleado = {
  nombre:  string;
  total:   number;
  pedidos: PedidoCorporativo[];
};

type Status = { type: "success" | "error"; msg: string };

export default function CompanyBilling() {
  const [empresas,  setEmpresas]  = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [pedidos,   setPedidos]   = useState<PedidoCorporativo[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [cerrando,  setCerrando]  = useState(false);
  const [status,    setStatus]    = useState<Status | null>(null);
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [verTodos,  setVerTodos]  = useState(false);

  useEffect(() => {
    supabase.from("empresas").select("*").order("nombre_empresa")
      .then(({ data }) => setEmpresas(data ?? []));
  }, []);

  useEffect(() => {
    if (!empresaId) { setPedidos([]); return; }
    setLoading(true);
    supabase
      .from("pedidos_corporativos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("fecha_pedido", { ascending: false })
      .then(({ data }) => {
        setPedidos(data ?? []);
        setLoading(false);
      });
  }, [empresaId]);

  const pendientes  = pedidos.filter((p) => !p.facturado);
  const facturados  = pedidos.filter((p) => p.facturado);
  const deudaTotal  = pendientes.reduce((s, p) => s + p.precio_cobrado, 0);
  const empresa     = empresas.find((e) => e.id === empresaId);
  const alertaLinea = empresa && deudaTotal > empresa.linea_credito * 0.9;

  const resumenEmpleados: ResumenEmpleado[] = Object.values(
    pendientes.reduce<Record<string, ResumenEmpleado>>((acc, p) => {
      if (!acc[p.nombre_empleado]) {
        acc[p.nombre_empleado] = { nombre: p.nombre_empleado, total: 0, pedidos: [] };
      }
      acc[p.nombre_empleado].total  += p.precio_cobrado;
      acc[p.nombre_empleado].pedidos.push(p);
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  const handleCierre = async () => {
    if (!pendientes.length) return;
    setCerrando(true);
    setStatus(null);
    const { error } = await supabase
      .from("pedidos_corporativos")
      .update({ facturado: true })
      .in("id", pendientes.map((p) => p.id));
    setCerrando(false);
    if (error) {
      setStatus({ type: "error", msg: error.message });
    } else {
      setStatus({ type: "success", msg: `Cierre de mes: ${pendientes.length} pedidos facturados.` });
      setPedidos((prev) => prev.map((p) => ({ ...p, facturado: true })));
    }
  };

  // Agrupa pedidos históricos por fecha
  const historialFechas = Array.from(
    new Set(facturados.map((p) => p.fecha_pedido))
  ).slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-600/20 rounded-xl">
          <Receipt className="text-emerald-400" size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-100">Liquidación de Cuentas por Cobrar</h1>
          <p className="text-sm text-slate-400">Deuda acumulada, historial de consumo y cierre mensual</p>
        </div>
      </div>

      {/* Selector empresa */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
        <label className="text-sm font-medium text-slate-300 block mb-2">Empresa</label>
        <select
          value={empresaId}
          onChange={(e) => { setEmpresaId(e.target.value); setStatus(null); }}
          className="w-full max-w-sm bg-slate-800 text-slate-100 rounded-lg px-3 py-2.5 text-sm
                     border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">— Selecciona empresa —</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre_empresa} · {e.dias_credito} días
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-500 text-sm animate-pulse">Cargando…</div>
      )}

      {empresaId && !loading && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Deuda pendiente",
                value: `S/ ${deudaTotal.toFixed(2)}`,
                icon: <TrendingUp size={16} />,
                color: deudaTotal > 0 ? "text-amber-400" : "text-emerald-400",
                bg:    deudaTotal > 0 ? "bg-amber-500/10" : "bg-emerald-500/10",
              },
              {
                label: "Línea de crédito",
                value: `S/ ${(empresa?.linea_credito ?? 0).toFixed(2)}`,
                icon:  <Receipt size={16} />,
                color: "text-indigo-400",
                bg:    "bg-indigo-500/10",
              },
              {
                label: "Empleados activos",
                value: resumenEmpleados.length,
                icon:  <Users size={16} />,
                color: "text-slate-300",
                bg:    "bg-slate-700/50",
              },
              {
                label: "Pedidos pendientes",
                value: pendientes.length,
                icon:  <Calendar size={16} />,
                color: "text-slate-300",
                bg:    "bg-slate-700/50",
              },
            ].map((k) => (
              <div key={k.label}
                   className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${k.bg}`}>
                  <span className={k.color}>{k.icon}</span>
                </div>
                <p className={`text-xl font-black ${k.color}`}>{k.value}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-tight">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Alerta línea de crédito */}
          {alertaLinea && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10
                            border border-amber-500/30 text-amber-400 text-sm">
              <ShieldAlert size={14} />
              La deuda supera el 90% de la línea de crédito asignada a {empresa?.nombre_empresa}.
            </div>
          )}

          {/* Desglose por empleado */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-300">Consumo por empleado (no facturado)</h2>
            </div>

            {resumenEmpleados.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
                <CheckCircle2 size={24} className="text-emerald-500/40" />
                Sin deuda pendiente
              </div>
            ) : (
              <ul className="divide-y divide-slate-800">
                {resumenEmpleados.map((emp) => (
                  <li key={emp.nombre}>
                    <button
                      onClick={() => setExpanded(expanded === emp.nombre ? null : emp.nombre)}
                      className="w-full px-4 py-3 flex items-center gap-3
                                 hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center
                                      justify-center text-indigo-300 text-sm font-black shrink-0">
                        {emp.nombre.charAt(0).toUpperCase()}
                      </div>
                      <span className="flex-1 text-sm text-slate-200 text-left font-medium">
                        {emp.nombre}
                      </span>
                      <span className="text-sm font-bold text-emerald-400 mr-1">
                        S/ {emp.total.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-600">
                        {emp.pedidos.length} pedido{emp.pedidos.length !== 1 ? "s" : ""}
                      </span>
                      {expanded === emp.nombre
                        ? <ChevronUp  size={14} className="text-slate-500" />
                        : <ChevronDown size={14} className="text-slate-500" />
                      }
                    </button>

                    {expanded === emp.nombre && (
                      <div className="bg-slate-950 px-4 pb-3">
                        <table className="w-full text-xs text-slate-400 mt-1">
                          <thead>
                            <tr className="text-slate-600 border-b border-slate-800">
                              <th className="text-left py-1.5 font-medium">Fecha</th>
                              <th className="text-left py-1.5 font-medium">Entrada</th>
                              <th className="text-left py-1.5 font-medium">Segundo</th>
                              <th className="text-left py-1.5 font-medium">Obs.</th>
                              <th className="text-right py-1.5 font-medium">S/</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {emp.pedidos.map((p) => (
                              <tr key={p.id}>
                                <td className="py-1.5">{p.fecha_pedido}</td>
                                <td className="py-1.5 text-slate-500">{p.entrada_pedido || "—"}</td>
                                <td className="py-1.5 text-slate-300">{p.plato_pedido}</td>
                                <td className="py-1.5 text-slate-500 max-w-[100px] truncate">
                                  {p.observaciones || "—"}
                                </td>
                                <td className="py-1.5 text-right font-semibold text-slate-300">
                                  {p.precio_cobrado.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Historial de facturas cerradas */}
          {facturados.length > 0 && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <button
                onClick={() => setVerTodos(!verTodos)}
                className="w-full px-4 py-3 flex items-center justify-between
                           hover:bg-slate-800/40 transition-colors"
              >
                <h2 className="text-sm font-semibold text-slate-400">
                  Historial facturado ({facturados.length} registros)
                </h2>
                {verTodos ? <ChevronUp size={14} className="text-slate-500" />
                           : <ChevronDown size={14} className="text-slate-500" />}
              </button>
              {verTodos && (
                <div className="px-4 pb-4 space-y-2">
                  {historialFechas.map((fecha) => {
                    const items = facturados.filter((p) => p.fecha_pedido === fecha);
                    const sub   = items.reduce((s, p) => s + p.precio_cobrado, 0);
                    return (
                      <div key={fecha}
                           className="flex items-center justify-between py-2
                                      border-b border-slate-800 last:border-0">
                        <span className="text-xs text-slate-400 font-medium">{fecha}</span>
                        <span className="text-xs text-slate-500">{items.length} pedidos</span>
                        <span className="text-xs font-bold text-slate-300">S/ {sub.toFixed(2)}</span>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-500
                                         px-2 py-0.5 rounded-full">FACTURADO</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Status */}
          {status && (
            <div className={`flex items-start gap-2 p-3 rounded-xl text-sm border ${
              status.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10    border-red-500/30    text-red-400"
            }`}>
              {status.type === "success"
                ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                : <AlertCircle  size={14} className="mt-0.5 shrink-0" />
              }
              <span className="flex-1">{status.msg}</span>
              <button onClick={() => setStatus(null)}><X size={13} /></button>
            </div>
          )}

          {/* Botón cierre de mes */}
          <div className="flex justify-end">
            <button
              onClick={handleCierre}
              disabled={cerrando || pendientes.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600
                         hover:bg-emerald-500 disabled:opacity-40 text-white text-sm
                         font-bold transition-colors"
            >
              <CheckCircle2 size={14} />
              {cerrando
                ? "Procesando…"
                : `Cierre de Mes · S/ ${deudaTotal.toFixed(2)}`
              }
            </button>
          </div>
        </>
      )}
    </div>
  );
}
