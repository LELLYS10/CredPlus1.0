import React, { useState, useEffect, useRef } from 'react';
import { AppData } from '../types';
// @google/genai removido — usando fetch direto para API REST do Gemini
import { MessageSquare, Send, Bot, User, X, Trash2, Mic, MicOff, Volume2 } from 'lucide-react';

// Add SpeechRecognition types for TypeScript
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface AIAssistantProps {
  data: AppData;
  onAddClient: (client: any) => Promise<void>;
  onAddLoan: (loan: any) => Promise<void>;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ data, onAddClient, onAddLoan }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>(() => {
    const saved = localStorage.getItem('cred_chat_history');
    return saved ? JSON.parse(saved) : [
      { role: 'assistant', content: 'E aí! Tudo certo? Sou o Cred. Como posso ajudar com sua carteira hoje?' }
    ];
  });

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'pt-BR';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        if (event.error === 'not-allowed') {
          setErrorMessage('O acesso ao microfone foi negado. Por favor, verifique as permissões do seu navegador.');
        } else if (event.error === 'no-speech') {
          // Silent error
        } else {
          setErrorMessage('Erro no reconhecimento de voz: ' + event.error);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        setErrorMessage('Seu navegador não suporta reconhecimento de voz.');
        return;
      }
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

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

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
      const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + apiKey;

      const getClientName = (id: string) => data.clients.find(c => c.id === id)?.name || 'Desconhecido';
      const activeLoans = data.loans.filter(l => l.status !== 'paid');
      const criticalLoans = activeLoans.filter(l => l.statusBucket === 'critical');
      const overdueLoans = activeLoans.filter(l => l.statusBucket === 'overdue');
      const todayLoans = activeLoans.filter(l => l.statusBucket === 'today');
      const tomorrowLoans = activeLoans.filter(l => l.statusBucket === 'tomorrow');
      const interestPayments = (data.payments || []).filter((p: any) => p.type === 'interest');
      const totalJuros = interestPayments.reduce((acc: number, p: any) => acc + Number(p.amount), 0);
      const totalCapital = (data.payments || []).filter((p: any) => p.type === 'capital').reduce((acc: number, p: any) => acc + Number(p.amount), 0);

      const lastJuros = interestPayments.slice(-10).map((p: any) => {
        const loan = data.loans.find((l: any) => l.id === p.loanId) as any;
        return '- ' + getClientName(loan?.clientId || '') + ' | R$ ' + Number(p.amount).toFixed(2) + ' | ' + (p.date || '');
      });

      const systemText = [
        'Voce e Cred, assistente pessoal do administrador na P&R Solucoes Financeiras. Seja direto, informal e util.',
        'REGRAS: Nunca mostre IDs/UUIDs. Use sempre NOMES. Para cadastrar cliente pergunte nome e whatsapp.',
        '',
        'DADOS: Clientes=' + data.clients.length + ' | Ativos=' + activeLoans.length,
        'Capital ativo=R$' + (data.stats?.totalActiveCapital || 0),
        'Juros recebidos=R$' + totalJuros.toFixed(2) + ' | Capital recuperado=R$' + totalCapital.toFixed(2),
        'Criticos (5+ dias de atraso): ' + (criticalLoans.map(l => getClientName(l.clientId)).join(', ') || 'nenhum'),
        'Em atraso (1 a 4 dias): ' + (overdueLoans.map(l => getClientName(l.clientId)).join(', ') || 'nenhum'),
        'Vencem hoje: ' + (todayLoans.map(l => getClientName(l.clientId)).join(', ') || 'nenhum'),
        'Vencem amanha: ' + (tomorrowLoans.map(l => getClientName(l.clientId)).join(', ') || 'nenhum'),
        '',
        'ULTIMOS JUROS:',
        ...lastJuros,
        '',
        'CLIENTES: ' + data.clients.map(c => c.name).join(', '),
        'IDs INTERNOS (NUNCA MOSTRAR): ' + data.clients.map(c => c.name + '=' + c.id).join(' | '),
      ].join('\n');

      // Build history: skip leading model messages (Gemini requires user first)
      const rawHistory = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      let si = 0;
      while (si < rawHistory.length && rawHistory[si].role === 'model') si++;
      const contents = [
        ...rawHistory.slice(si),
        { role: 'user', parts: [{ text: userMessage }] }
      ];

      const requestBody = {
        system_instruction: { parts: [{ text: systemText }] },
        contents,
        tools: [{
          function_declarations: [
            {
              name: 'register_client',
              description: 'Cadastra novo cliente. Use APENAS com nome e whatsapp reais.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  name: { type: 'STRING', description: 'Nome completo (obrigatorio)' },
                  phone: { type: 'STRING', description: 'WhatsApp (obrigatorio)' },
                  cpf: { type: 'STRING', description: 'CPF' },
                  address: { type: 'STRING', description: 'Endereco' },
                  referredBy: { type: 'STRING', description: 'Indicado por' },
                  notes: { type: 'STRING', description: 'Observacoes' }
                },
                required: ['name', 'phone']
              }
            },
            {
              name: 'register_loan',
              description: 'Cadastra emprestimo para cliente existente.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  clientName: { type: 'STRING', description: 'Nome do cliente' },
                  amount: { type: 'NUMBER', description: 'Capital emprestado' },
                  interestFixedAmount: { type: 'NUMBER', description: 'Juros fixo por ciclo' },
                  loanType: { type: 'STRING', description: 'recurrent ou installments' },
                  loanDate: { type: 'STRING', description: 'Data emprestimo DD/MM/AAAA' },
                  dueDate: { type: 'STRING', description: 'Primeiro vencimento DD/MM/AAAA' },
                  installmentsCount: { type: 'NUMBER', description: 'Parcelas (so parcelado)' }
                },
                required: ['clientName', 'amount', 'interestFixedAmount', 'loanType', 'loanDate', 'dueDate']
              }
            }
          ]
        }],
        generationConfig: { temperature: 0.7 }
      };

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error('API ' + res.status + ': ' + (errJson?.error?.message || res.statusText));
      }

      const resData = await res.json();
      const parts = resData?.candidates?.[0]?.content?.parts || [];
      const funcPart = parts.find((p: any) => p.functionCall);
      const textPart = parts.filter((p: any) => p.text).map((p: any) => p.text).join('');

      if (funcPart) {
        const call = funcPart.functionCall;
        if (call.name === 'register_client') {
          try {
            await onAddClient(call.args);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Pronto! Cadastrei ' + call.args.name + '. Pode conferir na lista.' }]);
          } catch (err: any) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Problema ao cadastrar: ' + err.message }]);
          }
        } else if (call.name === 'register_loan') {
          try {
            const clientName = call.args.clientName as string;
            const client = data.clients.find(c =>
              c.name.toLowerCase().includes(clientName.toLowerCase()) ||
              clientName.toLowerCase().includes(c.name.toLowerCase())
            );
            if (!client) {
              setMessages(prev => [...prev, { role: 'assistant', content: 'Nao encontrei o cliente "' + clientName + '". Verifique o nome.' }]);
            } else {
              const loanArgs = { ...call.args, clientId: client.id };
              delete loanArgs.clientName;
              await onAddLoan(loanArgs);
              setMessages(prev => [...prev, { role: 'assistant', content: 'Emprestimo de R$ ' + call.args.amount + ' cadastrado para ' + client.name + '.' }]);
            }
          } catch (err: any) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Problema ao cadastrar emprestimo: ' + err.message }]);
          }
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: textPart || 'Nao consegui processar.' }]);
      }
    } catch (error: any) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro: ' + (error?.message || 'falha na conexao').slice(0, 150) }]);
    } finally {
      setLoading(false);
    }
  };



  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 md:bottom-6 right-6 w-14 h-14 bg-gold-500 text-white rounded-full shadow-lg shadow-gold-500/40 flex items-center justify-center hover:scale-110 transition-all z-40"
      >
        <Bot size={28} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed inset-x-3 bottom-3 top-20 md:inset-auto md:bottom-20 md:right-6 md:w-96 md:h-[580px] bg-[#0a1629] border border-white/10 shadow-2xl rounded-[24px] flex flex-col z-50 animate-in slide-in-from-bottom-10">
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-10 h-1 bg-white/20 rounded-full"></div>
          </div>
          {errorMessage && (
            <div className="absolute top-0 left-0 right-0 z-[60] px-4 -translate-y-full pb-2 animate-in slide-in-from-bottom-2">
              <div className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase italic text-center shadow-lg border border-white/20">
                {errorMessage}
              </div>
            </div>
          )}
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gold-500/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gold-500 rounded-xl text-white">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black italic text-white uppercase">CRED</h3>
                <p className="text-[10px] text-gold-400 font-bold uppercase tracking-widest">Online</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setMessages([{ role: 'assistant', content: 'E ai! Tudo certo? Sou o Cred. Como posso ajudar com sua carteira hoje?' }]);
                  localStorage.removeItem('cred_chat_history');
                }}
                className="text-white/40 hover:text-red-400 transition-all p-2"
                title="Limpar conversa"
              >
                <Trash2 size={16} />
              </button>
              <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white transition-all p-2" title="Fechar">
                <X size={22} />
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
                    ? 'bg-gold-500 text-white rounded-tr-none' 
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
                    <div className="w-1.5 h-1.5 bg-gold-500 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-gold-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-gold-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="px-4 pt-2 pb-4 border-t border-white/5">
            <div className="flex gap-2">
              <button
                onClick={toggleListening}
                className={`p-4 rounded-2xl flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
                }`}
                title={isListening ? "Parar de ouvir" : "Falar com o Cred"}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={isListening ? "Ouvindo..." : "Pergunte algo..."}
                  className={`w-full bg-black/20 border border-white/5 rounded-2xl py-4 pl-4 pr-14 text-sm font-bold text-white focus:border-gold-500/50 outline-none transition-all ${isListening ? 'border-gold-500/50 ring-2 ring-gold-500/20' : ''}`}
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gold-500 text-white rounded-xl hover:bg-gold-400 transition-all disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
          </div>
        </>
      )}
    </>
  );
};

export default AIAssistant;
