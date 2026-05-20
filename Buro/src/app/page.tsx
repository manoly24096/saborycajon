"use client";

import { useState } from "react";
import {
  SlidersHorizontal,
  Building2,
  Receipt,
  Bike,
  UtensilsCrossed,
} from "lucide-react";
import MenuConfig     from "@/components/MenuConfig";
import ExcelImporter  from "@/components/ExcelImporter";
import CompanyBilling from "@/components/CompanyBilling";
import MenuVecino     from "@/components/MenuVecino";
import SalonControl   from "@/components/SalonControl";

type Tab = "menu" | "corporativo" | "cobranzas" | "vecinos" | "salon";

const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
  { id: "menu",        label: "Menú del Día",  icon: <SlidersHorizontal size={15} />, badge: "AM" },
  { id: "corporativo", label: "Corporativo",   icon: <Building2 size={15} />         },
  { id: "cobranzas",   label: "Cobranzas",     icon: <Receipt size={15} />           },
  { id: "vecinos",     label: "Delivery",      icon: <Bike size={15} />              },
  { id: "salon",       label: "Salón",         icon: <UtensilsCrossed size={15} />   },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("menu");

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      {/* ── Navbar ─────────────────────────────────────────── */}
      <header className="no-print sticky top-0 z-50 bg-slate-900/95 backdrop-blur
                         border-b border-slate-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <UtensilsCrossed size={14} className="text-white" />
            </div>
            <span className="font-black text-slate-100 tracking-tight text-sm sm:text-base">
              BURO<span className="text-indigo-400">·ERP</span>
            </span>
          </div>

          {/* Tabs */}
          <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg
                  text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150
                  ${activeTab === tab.id
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }
                `}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge && (
                  <span className="hidden sm:inline text-[9px] font-black px-1 py-0.5
                                   bg-amber-500/20 text-amber-400 rounded">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-6">
        {activeTab === "menu"        && <MenuConfig />}
        {activeTab === "corporativo" && <ExcelImporter />}
        {activeTab === "cobranzas"   && <CompanyBilling />}
        {activeTab === "vecinos"     && <MenuVecino />}
        {activeTab === "salon"       && <SalonControl />}
      </main>
    </div>
  );
}
