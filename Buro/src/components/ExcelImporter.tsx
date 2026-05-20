"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Building2,
  Upload,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldAlert,
  Info,
} from "lucide-react";
import {
  supabase,
  normalizarPlato,
  type Empresa,
  type PlatoMaster,
} from "@/lib/supabase";

// ─── Tipos locales ─────────────────────────────────────────

type FilaExcel = {
  marca_temporal:  string;
  nombre_empleado: string;
  entrada:         string;
  segundo:         string; // columna [3] raw
  observaciones:   string;
  // procesados:
  segundo_canon:   string; // nombre normalizado
};

type PlatoConsolidado = {
  nombre:    string;
  cantidad:  number;
  precio:    number;
  subtotal:  number;
  stockOk:   boolean; // hay suficiente stock en BD
};

type Status = { type: "success" | "error" | "warning"; msg: string };

// ─── Parser de Excel ───────────────────────────────────────
// Columnas: [0] Marca Temporal, [1] Empleado, [2] Entrada,
//           [3] Plato de Fondo, [4] Observaciones

function parsearExcel(file: File): Promise<FilaExcel[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data     = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb       = XLSX.read(data, { type: "array" });
        const ws       = wb.Sheets[wb.SheetNames[0]];
        // raw: true devuelve arreglos de celdas en lugar de objetos con cabecera
        const rawRows  = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

        const filas: FilaExcel[] = [];
        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i] as unknown[];
          // Saltar filas de cabecera o vacías
          const segundo = String(row[3] ?? "").trim();
          if (!segundo || segundo.toLowerCase().includes("plato")) continue;

          const raw: FilaExcel = {
            marca_temporal:  String(row[0] ?? "").trim(),
            nombre_empleado: String(row[1] ?? "").trim(),
            entrada:         String(row[2] ?? "").trim(),
            segundo,
            observaciones:   String(row[4] ?? "").trim(),
            segundo_canon:   normalizarPlato(segundo),
          };
          if (raw.nombre_empleado) filas.push(raw);
        }
        resolve(filas);
      } catch {
        reject(new Error("No se pudo procesar el archivo Excel"));
      }
    };
    reader.onerror = () => reject(new Error("Error de lectura del archivo"));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Componente ────────────────────────────────────────────

export default function ExcelImporter() {
  const [empresas,    setEmpresas]    = useState<Empresa[]>([]);
  const [platosMap,   setPlatosMap]   = useState<Map<string, PlatoMaster>>(new Map());
  const [empresaId,   setEmpresaId]   = useState("");
  const [filas,       setFilas]       = useState<FilaExcel[]>([]);
  const [consolidado, setConsolidado] = useState<PlatoConsolidado[]>([]);
  const [fileName,    setFileName]    = useState("");
  const [isDragging,  setIsDragging]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [status,      setStatus]      = useState<Status | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Carga empresas y mapa de platos activos
  useEffect(() => {
    supabase.from("empresas").select("*").order("nombre_empresa")
      .then(({ data }) => setEmpresas(data ?? []));

    supabase.from("platos_master").select("*").eq("activo_hoy", true)
      .then(({ data }) => {
        const m = new Map<string, PlatoMaster>();
        (data ?? []).forEach((p: PlatoMaster) => m.set(p.nombre_plato, p));
        setPlatosMap(m);
      });
  }, []);

  // ── Construye consolidado con validación de stock ──────
  const construirConsolidado = useCallback(
    (rows: FilaExcel[]): PlatoConsolidado[] => {
      const mapa = new Map<string, PlatoConsolidado>();
      for (const row of rows) {
        const nombre = row.segundo_canon;
        const plato  = platosMap.get(nombre);
        const precio = plato?.precio ?? 0;
        if (mapa.has(nombre)) {
          const item = mapa.get(nombre)!;
          item.cantidad++;
          item.subtotal += precio;
        } else {
          mapa.set(nombre, {
            nombre,
            cantidad: 1,
            precio,
            subtotal: precio,
            stockOk:  true,
          });
        }
      }
      // Validar stock
      for (const [nombre, item] of mapa) {
        const plato = platosMap.get(nombre);
        item.stockOk = plato ? plato.stock_actual >= item.cantidad : false;
      }
      return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    },
    [platosMap]
  );

  const procesarArchivo = async (file: File) => {
    setFileName(file.name);
    setStatus(null);
    try {
      const rows = await parsearExcel(file);
      setFilas(rows);
      setConsolidado(construirConsolidado(rows));
    } catch (err) {
      setStatus({ type: "error", msg: (err as Error).message });
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) procesarArchivo(file);
  };

  const handleImprimir = () => consolidado.length > 0 && window.print();

  const handleConfirmar = async () => {
    if (!empresaId)         return setStatus({ type: "warning", msg: "Selecciona una empresa." });
    if (!filas.length)      return setStatus({ type: "warning", msg: "Carga un archivo Excel primero." });

    const sinStock = consolidado.filter((c) => !c.stockOk);
    if (sinStock.length > 0) {
      return setStatus({
        type: "error",
        msg: `Stock insuficiente para: ${sinStock.map((c) => c.nombre).join(", ")}`,
      });
    }

    setLoading(true);
    setStatus(null);

    const empresa = empresas.find((e) => e.id === empresaId);
    const inserts = filas.map((r) => ({
      empresa_id:      empresaId,
      fecha_pedido:    new Date().toISOString().split("T")[0],
      nombre_empleado: r.nombre_empleado,
      entrada_pedido:  r.entrada,
      plato_pedido:    r.segundo_canon,
      observaciones:   r.observaciones,
      precio_cobrado:  platosMap.get(r.segundo_canon)?.precio ?? 0,
      facturado:       false,
    }));

    // El trigger de PostgreSQL descontará el stock automáticamente
    const { error } = await supabase.from("pedidos_corporativos").insert(inserts);
    setLoading(false);

    if (error) {
      setStatus({ type: "error", msg: error.message });
    } else {
      setStatus({
        type: "success",
        msg: `${inserts.length} pedidos guardados para ${empresa?.nombre_empresa}. Stock actualizado por trigger.`,
      });
      setFilas([]);
      setConsolidado([]);
      setFileName("");
    }
  };

  const empresa    = empresas.find((e) => e.id === empresaId);
  const totalGen   = consolidado.reduce((s, c) => s + c.subtotal, 0);
  const hayError   = consolidado.some((c) => !c.stockOk);

  return (
    <>
      {/* ═══════════════ VISTA WEB ═══════════════════════ */}
      <div className="no-print space-y-6">
        {/* Encabezado */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 rounded-xl">
            <Building2 className="text-indigo-400" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Delivery Corporativo</h1>
            <p className="text-sm text-slate-400">
              Importa el Excel del formulario, normaliza los platos y genera la comanda
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Panel de carga ───────────────────────────── */}
          <div className="space-y-4">
            {/* Selector empresa */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-2">
              <label className="text-sm font-medium text-slate-300">Empresa cliente</label>
              <select
                value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value)}
                className="w-full bg-slate-800 text-slate-100 rounded-lg px-3 py-2.5 text-sm
                           border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Selecciona empresa —</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre_empresa} · {e.dias_credito} días
                  </option>
                ))}
              </select>
              {empresa && (
                <p className="text-xs text-emerald-400">
                  Línea de crédito: S/ {empresa.linea_credito.toFixed(2)}
                </p>
              )}
            </div>

            {/* Información de columnas esperadas */}
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-semibold mb-2">
                <Info size={12} />
                Formato esperado del Excel
              </div>
              <div className="grid grid-cols-5 gap-1 text-center">
                {["Marca temporal","Empleado","Entrada","Plato Fondo","Observaciones"]
                  .map((col, i) => (
                    <div key={i} className="bg-slate-900 rounded px-1 py-1.5">
                      <div className="text-[10px] font-bold text-indigo-400">[{i}]</div>
                      <div className="text-[9px] text-slate-400 leading-tight mt-0.5">{col}</div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Dropzone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`
                cursor-pointer rounded-xl border-2 border-dashed p-8
                flex flex-col items-center gap-3 transition-all duration-200
                ${isDragging
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-slate-700 bg-slate-900 hover:border-slate-500 hover:bg-slate-800/40"
                }
              `}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) procesarArchivo(f); }}
              />
              <FileSpreadsheet
                size={36}
                className={isDragging ? "text-indigo-400" : "text-slate-500"}
              />
              {fileName ? (
                <div className="text-center">
                  <p className="text-sm font-semibold text-emerald-400">{fileName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {filas.length} empleados cargados
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-300">Arrastra el Excel aquí</p>
                  <p className="text-xs text-slate-500 mt-0.5">o haz clic · .xlsx, .xls</p>
                </div>
              )}
              <Upload size={14} className="text-slate-600" />
            </div>

            {/* Botones acción */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleImprimir}
                disabled={!consolidado.length}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                           bg-slate-700 hover:bg-slate-600 disabled:opacity-40
                           text-sm font-medium text-slate-200 transition-colors"
              >
                <Printer size={14} />
                Imprimir Comanda
              </button>
              <button
                onClick={handleConfirmar}
                disabled={loading || !consolidado.length || !empresaId || hayError}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                           bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40
                           text-sm font-medium text-white transition-colors"
              >
                <CheckCircle2 size={14} />
                {loading ? "Guardando…" : "Confirmar Pedido"}
              </button>
            </div>

            {/* Alerta de stock */}
            {hayError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10
                              border border-red-500/30 text-red-400 text-sm">
                <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                <span>Hay platos sin stock suficiente. No se puede confirmar.</span>
              </div>
            )}

            {/* Status general */}
            {status && (
              <div className={`flex items-start gap-2 p-3 rounded-xl text-sm border ${
                status.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                status.type === "warning" ? "bg-amber-500/10  border-amber-500/30  text-amber-400"   :
                                            "bg-red-500/10    border-red-500/30    text-red-400"
              }`}>
                {status.type === "success"
                  ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                  : <AlertCircle  size={14} className="mt-0.5 shrink-0" />
                }
                <span className="flex-1">{status.msg}</span>
                <button onClick={() => setStatus(null)}><X size={13} /></button>
              </div>
            )}
          </div>

          {/* ── Consolidado de producción ─────────────────── */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex justify-between">
              <h2 className="text-sm font-semibold text-slate-300">Comanda consolidada</h2>
              {consolidado.length > 0 && (
                <span className="text-xs text-slate-500">
                  {consolidado.length} platos distintos
                </span>
              )}
            </div>

            {consolidado.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-600 gap-2">
                <FileSpreadsheet size={30} />
                <p className="text-sm">Carga un Excel para ver el consolidado</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-800">
                  {consolidado.map((p) => (
                    <div key={p.nombre}
                         className={`px-4 py-3 flex items-center gap-3 ${
                           !p.stockOk ? "bg-red-500/5" : ""
                         }`}>
                      {/* Cantidad badge */}
                      <span className={`w-10 h-10 flex items-center justify-center rounded-xl
                                        text-base font-black shrink-0 ${
                        p.stockOk
                          ? "bg-indigo-600/20 text-indigo-300"
                          : "bg-red-500/20 text-red-400"
                      }`}>
                        {p.cantidad}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">
                          {p.nombre}
                        </p>
                        {!p.stockOk && (
                          <p className="text-xs text-red-400 flex items-center gap-1">
                            <ShieldAlert size={10} />
                            Stock insuficiente
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-slate-300 shrink-0">
                        S/ {p.subtotal.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 flex justify-between bg-slate-800/60">
                  <span className="text-sm font-bold text-slate-300">Total</span>
                  <span className="text-base font-black text-emerald-400">
                    S/ {totalGen.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Detalle por empleado */}
        {filas.length > 0 && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-300">
                Detalle por empleado ({filas.length} registros)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500">
                    <th className="text-left px-4 py-2 font-medium">Empleado</th>
                    <th className="text-left px-4 py-2 font-medium">Entrada</th>
                    <th className="text-left px-4 py-2 font-medium">Segundo (raw)</th>
                    <th className="text-left px-4 py-2 font-medium">Normalizado</th>
                    <th className="text-left px-4 py-2 font-medium">Obs.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filas.map((f, i) => (
                    <tr key={i} className="hover:bg-slate-800/30">
                      <td className="px-4 py-2 text-slate-300 font-medium">{f.nombre_empleado}</td>
                      <td className="px-4 py-2 text-slate-500">{f.entrada || "—"}</td>
                      <td className="px-4 py-2 text-slate-500 max-w-[180px] truncate">{f.segundo}</td>
                      <td className="px-4 py-2">
                        <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded text-[11px] font-medium">
                          {f.segundo_canon}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-500">{f.observaciones || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════ TICKET DE IMPRESIÓN 80mm ════════ */}
      <div className="only-print w-[80mm] font-mono text-black bg-white">
        {/* Cabecera */}
        <div className="text-center mb-2">
          <p className="text-xl font-black">★ BURO RESTAURANTE ★</p>
          <p className="text-sm">━━━━━━━━━━━━━━━━━━━━━━</p>
          <p className="text-sm font-bold">COMANDA DE PRODUCCIÓN</p>
          <p className="text-xs">{new Date().toLocaleString("es-PE")}</p>
          {empresa && (
            <p className="text-base font-black mt-1 border-t-2 border-black pt-1">
              {empresa.nombre_empresa.toUpperCase()}
            </p>
          )}
        </div>

        <p className="text-sm text-center">━━━━━━━━━━━━━━━━━━━━━━</p>

        {/* Platos en tamaño grande */}
        <div className="space-y-2 my-2">
          {consolidado.map((p) => (
            <div key={p.nombre} className="flex items-baseline gap-2">
              <span className="text-3xl font-black w-12 text-right shrink-0 leading-none">
                {p.cantidad}
              </span>
              <span className="text-xl font-black uppercase leading-tight">
                {p.nombre}
              </span>
            </div>
          ))}
        </div>

        <p className="text-sm text-center">━━━━━━━━━━━━━━━━━━━━━━</p>
        <div className="flex justify-between text-base font-black mt-1">
          <span>TOTAL PORCIONES</span>
          <span>{filas.length}</span>
        </div>
        <div className="text-center mt-3 text-xs">
          <p>— COCINA —</p>
          <p className="text-[10px] mt-1">{new Date().toLocaleDateString("es-PE")}</p>
        </div>
      </div>
    </>
  );
}
