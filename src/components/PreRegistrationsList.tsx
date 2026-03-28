import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";

interface PreReg {
  id: string;
  name: string;
  phone: string;
  cpf: string;
  referred_by: string;
  notes: string;
  desired_amount: string;
  created_at: string;
}

interface Props {
  onSelect: (pr: PreReg) => void;
  onClose: () => void;
}

export default function PreRegistrationsList({ onSelect, onClose }: Props) {
  const [regs, setRegs] = useState<PreReg[]>([]);
  const [load, setLoad] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("pre_registrations")
        .select("*")
        .order("created_at", { ascending: false });
      setRegs((data || []) as PreReg[]);
      setLoad(false);
    })();
  }, []);

  const fmt = (d: string) => new Date(d).toLocaleDateString("pt-BR");

  return (
    <div className="bg-[#0a1629] min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-white">Pré-Cadastros</h2>
          <button onClick={onClose} className="text-white/60 text-2xl">X</button>
        </div>

        {load ? (
          <p className="text-white/60">Carregando...</p>
        ) : regs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-white/60">Nenhum pré-cadastro.</p>
            <p className="text-white/30 text-sm mt-2">Envie o link para seus clientes.</p>
          </div>
        ) : (
          regs.map(pr => (
            <div
              key={pr.id}
              onClick={() => onSelect(pr)}
              className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-3 cursor-pointer hover:border-emerald-500/50 transition-all"
            >
              <h3 className="font-black text-white">{pr.name}</h3>
              <p className="text-emerald-400 text-sm font-bold mt-1">{pr.phone}</p>
              {pr.cpf && <p className="text-white/40 text-xs mt-1">CPF: {pr.cpf}</p>}
              {pr.desired_amount && (
                <p className="text-emerald-400 text-xs font-bold mt-1">Valor: R$ {pr.desired_amount}</p>
              )}
              {pr.referred_by && (
                <p className="text-white/40 text-xs mt-1 italic">Indicado por: {pr.referred_by}</p>
              )}
              {pr.notes && (
                <p className="text-white/40 text-xs mt-1 italic line-clamp-2">{pr.notes}</p>
              )}
              <p className="text-white/20 text-xs mt-2">{fmt(pr.created_at)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
