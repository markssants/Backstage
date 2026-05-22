import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EventProject, UserProfile, ArtTask, PaymentItem, OperationType } from "../../types";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError } from "../../firebase";
import { Palette, CheckCircle2, Clock, AlertCircle, CreditCard, Music, MapPin, User, Calendar as CalendarIcon } from "lucide-react";
import { motion } from "motion/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EventSelector } from '../events/EventSelector';

interface OverviewProps {
  event: EventProject;
  profile: UserProfile;
}

export function Overview({ event, profile }: OverviewProps) {
  const [arts, setArts] = useState<ArtTask[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);

  useEffect(() => {
    const artsQ = query(collection(db, 'events', event.id, 'arts'));
    const paymentsQ = query(collection(db, 'events', event.id, 'payments'));

    const unsubscribeArts = onSnapshot(artsQ, (snapshot) => {
      setArts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ArtTask)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `events/${event.id}/arts`);
    });

    const unsubscribePayments = onSnapshot(paymentsQ, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentItem)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `events/${event.id}/payments`);
    });

    return () => {
      unsubscribeArts();
      unsubscribePayments();
    };
  }, [event.id]);

  const finishedArts = arts.filter(a => a.status === 'finished').length;
  const totalArts = arts.length;
  const progress = totalArts > 0 ? (finishedArts / totalArts) * 100 : 0;

  const translateStatus = (statusId: string) => {
    switch (statusId) {
      case 'todo': return 'Para Fazer';
      case 'production': return 'Em Produção';
      case 'review': return 'Revisão';
      case 'delivered': return 'Entregue';
      case 'post': return 'Postar';
      case 'finished': return 'Finalizado';
      default: return statusId;
    }
  };

  const translateCategory = (cat: string) => {
    switch (cat) {
      case 'dj': return 'DJ';
      case 'party': return 'Festa';
      case 'branding': return 'Branding';
      default: return cat;
    }
  };

  const translatePriority = (priority: string) => {
    switch (priority) {
      case 'high': return 'Urgente';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return priority;
    }
  };

  const translateEventStatus = (status: string) => {
    switch (status) {
      case 'planning': return 'Planejamento';
      case 'active': return 'Em Andamento';
      case 'completed': return 'Concluído';
      default: return status;
    }
  };

  const paidAmount = payments.filter(p => p.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
  const pendingAmount = payments.filter(p => p.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0);
  const nextPayment = payments
    .filter(p => p.status === 'pending')
    .sort((a, b) => (a.dueDate?.seconds || 0) - (b.dueDate?.seconds || 0))[0];

  const formatSafeDate = (timestamp: any, formatStr: string) => {
    if (!timestamp || typeof timestamp.toDate !== 'function') return 'Sem Data';
    try {
      return format(timestamp.toDate(), formatStr, { locale: ptBR });
    } catch (e) {
      return 'Data Inválida';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 auto-rows-[minmax(180px,auto)] gap-6 p-6">
      {/* 1. Hero Card - Large (4x2) */}
      <div className="md:col-span-4 md:row-span-2 relative overflow-hidden glass-card rounded-[2.5rem] p-6 md:p-8 text-white flex flex-col justify-between shadow-2xl border-white/5">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600 rounded-full blur-[100px] opacity-10 -mr-48 -mt-48 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-pink-600 rounded-full blur-[100px] opacity-10 -ml-48 -mb-48 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-36 h-36 md:w-44 md:h-44 rounded-3xl bg-white/5 backdrop-blur-md p-0 border-0 shadow-2xl shrink-0 overflow-hidden group">
            <img src={event.logoUrl} alt={event.name} className="w-full h-full object-cover filter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-transform group-hover:scale-110" />
          </div>
          <div className="text-center md:text-left space-y-4 flex-1">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-pink-100 to-slate-400">
                {event.name}
              </h2>
              <EventSelector profile={profile} editEvent={event} onEventUpdated={() => {}} isMinimal />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-2">
              <div className="flex items-center gap-2 text-slate-400">
                <User className="w-3 h-3 text-pink-400" />
                <span className="text-[10px] uppercase font-black tracking-widest">{event.contractorName || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <CalendarIcon className="w-3 h-3 text-pink-400" />
                <span className="text-[10px] uppercase font-black tracking-widest">{event.eventDate || 'Sem Data'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="w-3 h-3 text-pink-400" />
                <span className="text-[10px] uppercase font-black tracking-widest">{event.city || 'Sem Cidade'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Music className="w-3 h-3 text-pink-400" />
                <span className="text-[10px] uppercase font-black tracking-widest">{event.location || 'Sem Local'}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2 justify-center md:justify-start">
              <span className="bg-white/5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 text-slate-300">
                {translateEventStatus(event.status || '')}
              </span>
              <span className="bg-emerald-500/10 text-emerald-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 shadow-[0_0_15px_rgba(52,211,153,0.1)]">
                {Math.round(progress)}% Concluído
              </span>
              <div className="flex gap-2">
                <div className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
                  <Palette className="w-3 h-3 text-pink-400" />
                  <span className="text-[10px] font-bold text-white">{event.artCount || 0} Artes</span>
                </div>
                <div className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
                  <Music className="w-3 h-3 text-purple-400" />
                  <span className="text-[10px] font-bold text-white">{event.djCount || 0} DJs</span>
                </div>
                <div className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
                  <Clock className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] font-bold text-white">{event.motionCount || 0} Motions</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-6 space-y-3">
          <div className="flex justify-between items-end mb-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fluxo de Produção Geral</span>
            <span className="text-2xl font-black text-white">{Math.round(progress)}%</span>
          </div>
          <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.5)]"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500 italic">
              {finishedArts} de {totalArts} artes finalizadas
            </p>
            <div className="flex -space-x-2">
              {[...Array(Math.min(finishedArts, 5))].map((_, i) => (
                <div key={i} className="w-6 h-6 rounded-full border-2 border-[#0a0518] bg-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Total Investment - Small (2x1) */}
      <div className="md:col-span-2 md:row-span-1 glass-card rounded-[2.5rem] p-6 border-white/5 flex flex-col justify-center relative overflow-hidden group">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
        <div className="flex items-center space-x-4 mb-4">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Investimento Total</p>
            <h3 className="text-3xl font-black text-white">R$ {(paidAmount + pendingAmount).toLocaleString()}</h3>
          </div>
        </div>
        <p className="text-[11px] text-emerald-400/60 font-bold">R$ {paidAmount.toLocaleString()} já liquidados</p>
      </div>

      {/* 3. Next Payment - Small (2x1) */}
      <div className="md:col-span-2 md:row-span-1 glass-card rounded-[2.5rem] p-6 border-white/5 flex flex-col justify-center relative overflow-hidden group">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
        <div className="flex items-center space-x-4 mb-4">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Próxima Parcela</p>
            <h3 className="text-3xl font-black text-white">
              {nextPayment ? `R$ ${nextPayment.amount.toLocaleString()}` : "Nenhuma"}
            </h3>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 italic font-bold">
          {nextPayment ? `Vence em ${formatSafeDate(nextPayment.dueDate, "dd/MM/yy")}` : "Tudo em dia"}
        </p>
      </div>

      {/* 4. Recent Arts - Medium (3x2) */}
      <div className="md:col-span-3 md:row-span-2 glass-card rounded-[2.5rem] border-white/5 overflow-hidden flex flex-col text-slate-100">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center text-pink-400">
            <Clock className="mr-3 w-5 h-5" />
            Ultimas Movimentações
          </h3>
          <span className="text-[10px] bg-white/5 px-3 py-1 rounded-full text-slate-400 font-bold">{arts.length} totais</span>
        </div>
        <div className="flex-1 overflow-y-auto max-h-[360px] custom-scrollbar">
          <div className="divide-y divide-white/5">
            {arts.slice(0, 8).map(art => (
              <div key={art.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-all group">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Palette className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-bold text-white tracking-tight leading-none mb-1">{art.title}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider">{translateCategory(art.category)} • {translatePriority(art.priority)}</p>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${
                  art.status === 'finished' ? 'text-emerald-500 bg-emerald-500' :
                  art.status === 'post' ? 'text-pink-500 bg-pink-500' :
                  art.status === 'delivered' ? 'text-purple-500 bg-purple-500' :
                  art.status === 'review' ? 'text-blue-500 bg-blue-500' :
                  art.status === 'production' ? 'text-amber-500 bg-amber-500' :
                  'text-slate-700 bg-slate-700'
                }`} title={translateStatus(art.status)} />
              </div>
            ))}
            {arts.length === 0 && (
              <div className="p-12 text-center text-slate-500 italic font-medium">Nenhuma arte cadastrada.</div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Health Details - Medium (3x2) */}
      <div className="md:col-span-3 md:row-span-2 glass-card rounded-[2.5rem] border-white/5 overflow-hidden p-6 flex flex-col justify-between">
        <div className="space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center text-emerald-400">
            <AlertCircle className="mr-3 w-5 h-5" />
            Agenda de Pagamentos
          </h3>
          <div className="space-y-4">
            {payments.filter(p => p.status === 'pending').slice(0, 4).map(p => (
              <div key={p.id} className="flex justify-between items-center p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-400 text-xs font-black">
                    {formatSafeDate(p.dueDate, "dd")}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-200 block leading-none mb-1">Parcela de {formatSafeDate(p.dueDate, "MMMM")}</span>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Vence em {formatSafeDate(p.dueDate, "dd/MM")}</p>
                  </div>
                </div>
                <p className="text-lg font-black text-white">R$ {p.amount.toLocaleString()}</p>
              </div>
            ))}
            {payments.filter(p => p.status === 'pending').length === 0 && (
              <div className="py-12 text-center text-emerald-400 font-black tracking-widest border border-emerald-500/20 rounded-[2rem] bg-emerald-500/5">
                TODAS AS CONTAS EM DIA ✅
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Status Geral</p>
            <p className="text-white font-bold">Saúde Financeira: <span className="text-emerald-400 uppercase">Ótima</span></p>
          </div>
          <Music className="w-8 h-8 text-white/10" />
        </div>
      </div>
    </div>
  );
}
