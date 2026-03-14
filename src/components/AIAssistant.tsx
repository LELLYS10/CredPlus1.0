import React, { useState, useEffect, useRef } from 'react';
import { AppData } from '../types';
import { GoogleGenAI } from "@google/genai";
import { MessageSquare, Send, Bot, User, X, Trash2 } from 'lucide-react';

interface AIAssistantProps {
  data: AppData;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>(() => {
    const saved = localStorage.getItem('cred_chat_history');
    return saved ? JSON.parse(saved) : [
      { role: 'assistant', content: 'Olá! Sou o CREDPLUS, seu assistente de crédito. Como posso ajudar com sua carteira hoje?' }
    ];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Save messages to localStorage
  useEffect(() => {
    localStorage.setItem('cred_chat_history', JSON.stringify(messages));
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, isOpen]);

  const handleClear = () => {
    if (window.confirm('Deseja limpar todo o histórico da conversa?')) {
      const initialMessage = [
        { role: 'assistant', content: 'Olá! Sou o CREDPLUS, seu assistente de crédito. Como posso ajudar com sua carteira hoje?' }
      ];
      setMessages(initialMessage as any);
      localStorage.removeItem('cred_chat_history');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";
      
      const context = `
        Seu nome é CREDPLUS. Você é um assistente especializado em gestão de crédito e empréstimos recorrentes e parcelados.
        Seu objetivo é ajudar o administrador a entender a saúde financeira da carteira.
        
        Dados atuais do sistema:
        - Total de Clientes: ${data.clients.length}
        - Clientes Ativos: ${data.stats?.activeClientsCount || 0}
        - Empréstimos Ativos: ${data.loans.filter(l => l.status !== 'paid').length}
        - Capital Total Investido: R$ ${data.stats?.totalActiveCapital || 0}
        - Total de Juros Acumulados: R$ ${data.stats?.totalInterestAccumulated || 0}
        - Empréstimos em Atraso: ${data.stats?.overdueCount || 0}
        - Vencimentos Hoje: ${data.stats?.dueTodayCount || 0}
        - Vencimentos Amanhã: ${data.stats?.dueTomorrowCount || 0}
        
        Instruções:
        1. Identifique-se como CREDPLUS quando apropriado.
        2. Seja profissional, direto e use um tom executivo.
        3. Se o usuário perguntar sobre inadimplência, foque nos dados de 'Atrasados'.
        4. Se perguntar sobre lucro, foque nos 'Juros Acumulados'.
        5. Responda sempre em Português do Brasil.
        6. Use formatação Markdown para destacar valores (ex: **R$ 1.000,00**).
      `;

      const response = await ai.models.generateContent({
        model,
        contents: [
          { role: 'user', parts: [{ text: context + "\n\nHistórico da conversa:\n" + messages.map(m => `${m.role}: ${m.content}`).join('\n') + "\n\nPergunta atual: " + userMessage }] }
        ],
      });

      const text = response.text || "Desculpe, não consegui processar sua solicitação.";
      setMessages(prev => [...prev, { role: 'assistant', content: text }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Erro ao conectar com a inteligência artificial." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-500/40 flex items-center justify-center hover:scale-110 transition-all z-40"
      >
        <Bot size={28} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 md:inset-auto md:bottom-24 md:right-6 md:w-96 md:h-[600px] bg-[#0a1629] border border-white/10 shadow-2xl rounded-t-[32px] md:rounded-[32px] flex flex-col z-50 animate-in slide-in-from-bottom-10">
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-emerald-500/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500 rounded-xl text-white">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black italic text-white uppercase">CREDPLUS</h3>
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Online</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleClear}
                title="Limpar conversa"
                className="text-white/20 hover:text-red-400 transition-all p-2"
              >
                <Trash2 size={18} />
              </button>
              <button onClick={() => setIsOpen(false)} className="text-white/20 hover:text-white transition-all p-2">
                <X size={20} />
              </button>
            </div>
          </div>

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar scroll-smooth"
          >
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-4 rounded-2xl text-sm font-medium leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-emerald-500 text-white rounded-tr-none' 
                    : 'bg-white/5 text-white/80 rounded-tl-none border border-white/5'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/5 p-4 rounded-2xl rounded-tl-none border border-white/5">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-white/5">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Pergunte algo..."
                className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 pl-4 pr-14 text-sm font-bold text-white focus:border-emerald-500/50 outline-none transition-all"
              />
              <button
                onClick={handleSend}
                disabled={loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
