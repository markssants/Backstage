import { useState, useEffect } from 'react';
import { db } from "../../firebase";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { UserProfile, EventProject, PendingChange } from "../../types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Bell, Check, X, ArrowRight, Trash2, Calendar, Palette, 
  Plus, Edit, Move, Clock, HelpCircle, Eye, AlertTriangle 
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

interface PendingChangesManagerProps {
  profile: UserProfile;
  selectedEventId: string | null;
}

export function PendingChangesManager({ profile, selectedEventId }: PendingChangesManagerProps) {
  const [open, setOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [historyChanges, setHistoryChanges] = useState<PendingChange[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  const isDesigner = profile.role === 'designer' || profile.email === 'beysarts@gmail.com';

  useEffect(() => {
    if (!selectedEventId) {
      setPendingChanges([]);
      setHistoryChanges([]);
      return;
    }

    const colRef = collection(db, 'events', selectedEventId, 'pending_changes');
    
    // Query active pending requests
    const qPending = query(
      colRef,
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribePending = onSnapshot(qPending, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingChange));
      setPendingChanges(items);
    }, (error) => {
      console.error("Erro ao escutar notificações pendentes:", error);
    });

    // Query historic requests (approved or rejected)
    const qHistory = query(
      colRef,
      where('status', 'in', ['approved', 'rejected']),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeHistory = onSnapshot(qHistory, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingChange));
      setHistoryChanges(items.slice(0, 30)); // limit history count
    }, (error) => {
      console.error("Erro ao escutar histórico de notificações:", error);
    });

    return () => {
      unsubscribePending();
      unsubscribeHistory();
    };
  }, [selectedEventId]);

  // Translate helpers
  const translatePriority = (priority: string) => {
    switch (priority) {
      case 'high': return 'Urgente';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return priority;
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

  const formatSafeDate = (timestamp: any) => {
    if (!timestamp) return 'Agora';
    const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
    try {
      return format(date, "dd/MM 'às' HH:mm", { locale: ptBR });
    } catch {
      return 'Sem data';
    }
  };

  // Approval logic inside transaction/sequence
  const handleApprove = async (change: PendingChange) => {
    if (!selectedEventId) return;
    setLoadingId(change.id);
    try {
      const artDocRef = doc(db, 'events', selectedEventId, 'arts', change.targetId);
      const artsColRef = collection(db, 'events', selectedEventId, 'arts');

      if (change.type === 'create') {
        // Add new art task to the arts subcollection
        await addDoc(artsColRef, {
          ...change.proposedData,
          eventId: selectedEventId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success(`Nova arte "${change.proposedData.title}" criada com sucesso!`);
      } 
      else if (change.type === 'update') {
        // Update existing doc
        await updateDoc(artDocRef, {
          ...change.proposedData,
          updatedAt: serverTimestamp()
        });
        toast.success(`Mudanças na arte "${change.proposedData.title}" aprovadas e aplicadas!`);
      } 
      else if (change.type === 'status') {
        // Move column status
        await updateDoc(artDocRef, {
          status: change.proposedData.status,
          position: change.proposedData.position !== undefined ? change.proposedData.position : 1000,
          updatedAt: serverTimestamp()
        });
        toast.success(`Movimentação para "${translateStatus(change.proposedData.status)}" aprovada!`);
      } 
      else if (change.type === 'delete') {
        // Delete task
        await deleteDoc(artDocRef);
        toast.success(`Exclusão da arte aprovada com sucesso!`);
      }

      // Mark proposal as approved
      const changeDocRef = doc(db, 'events', selectedEventId, 'pending_changes', change.id);
      await updateDoc(changeDocRef, {
        status: 'approved',
        updatedAt: serverTimestamp()
      });

    } catch (err) {
      console.error(err);
      toast.error("Erro crítico ao aprovar e aplicar esta alteração.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (change: PendingChange) => {
    if (!selectedEventId) return;
    setLoadingId(change.id);
    try {
      const changeDocRef = doc(db, 'events', selectedEventId, 'pending_changes', change.id);
      await updateDoc(changeDocRef, {
        status: 'rejected',
        updatedAt: serverTimestamp()
      });
      toast.info("Alteração rejeitada e arquivada.");
    } catch (err) {
      console.error(err);
      toast.error("Ocorreu um erro ao rejeitar a alteração.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <button 
          className={cn(
            "relative w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all",
            pendingChanges.length > 0 && "text-pink-400 bg-pink-500/10 border-pink-500/20 shadow-[0_0_15px_rgba(236,72,153,0.15)]"
          )}
        />
      }>
        <div className="relative">
          <Bell className="w-5 h-5" />
          {pendingChanges.length > 0 && (
            <>
              <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-pink-500 text-[10px] font-black text-white flex items-center justify-center animate-bounce">
                {pendingChanges.length}
              </span>
              <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-pink-500/30 animate-ping pointer-events-none" />
            </>
          )}
        </div>
      </DialogTrigger>

      <DialogContent className="rounded-[2.5rem] sm:max-w-[650px] glass border-white/10 text-slate-100 p-8 max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-black text-white tracking-tighter flex items-center gap-3">
                <Bell className="w-6 h-6 text-pink-400 animate-pulse" />
                {isDesigner ? "Alterações do Cliente" : "Suas Solicitações"}
              </DialogTitle>
              <p className="text-xs text-slate-400 mt-1">
                {isDesigner 
                  ? "Revise, aprove ou recuse as solicitações de briefing enviadas pelo contratante abaixo."
                  : "Acompanhe abaixo o status e histórico de todas as alterações sugeridas para o designer."}
              </p>
            </div>
            
            {/* Tab Swappers */}
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setActiveTab('pending')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                  activeTab === 'pending' ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                )}
              >
                Pendentes ({pendingChanges.length})
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                  activeTab === 'history' ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                )}
              >
                Histórico
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* List Areas */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4 space-y-4">
          <AnimatePresence mode="popLayout">
            {activeTab === 'pending' ? (
              pendingChanges.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="py-16 text-center flex flex-col items-center justify-center space-y-3"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl font-bold mb-2">
                    <Check className="w-8 h-8" />
                  </div>
                  <h4 className="text-white font-black tracking-tight">Tudo em ordem!</h4>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Nenhuma alteração de briefing pendente de aprovação no momento para esta festa.
                  </p>
                </motion.div>
              ) : (
                pendingChanges.map((change) => (
                  <motion.div
                    key={change.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-5 rounded-[2rem] bg-white/5 border border-white/5 flex flex-col hover:bg-white/8 transition-all gap-4"
                  >
                    {/* Header bar of Proposal */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className={cn(
                          "p-3 rounded-xl flex items-center justify-center text-white shrink-0 mt-0.5",
                          change.type === 'create' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                          change.type === 'update' ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                          change.type === 'status' ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" :
                          "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        )}>
                          {change.type === 'create' && <Plus className="w-4 h-4" />}
                          {change.type === 'update' && <Edit className="w-4 h-4" />}
                          {change.type === 'status' && <Move className="w-4 h-4" />}
                          {change.type === 'delete' && <Trash2 className="w-4 h-4" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white hover:text-pink-400 leading-normal mb-0.5">
                            {change.title}
                          </h4>
                          <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                            Solicitado por <span className="text-white">{change.contractorName}</span> • {formatSafeDate(change.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Data Difference box */}
                    <div className="bg-black/40 rounded-2xl p-4 border border-white/5 text-xs space-y-3 font-medium">
                      
                      {/* TYPE CREATE DETAILS */}
                      {change.type === 'create' && change.proposedData && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-slate-500 uppercase tracking-widest text-[9px] font-black block">Título Sugerido</span>
                            <span className="text-white font-bold block">{change.proposedData.title}</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-slate-500 uppercase tracking-widest text-[9px] font-black block">Categoria / Prioridade</span>
                            <span className="text-slate-300 font-bold block">
                              {translateCategory(change.proposedData.category)} • 
                              <span className={cn(
                                "ml-1.5 px-2 py-0.5 rounded text-[10px]",
                                change.proposedData.priority === 'high' ? 'bg-rose-500/20 text-rose-400' :
                                change.proposedData.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-emerald-500/20 text-emerald-400'
                              )}>
                                {translatePriority(change.proposedData.priority)}
                              </span>
                            </span>
                          </div>
                          {change.proposedData.deadline && (
                            <div className="space-y-1 col-span-2">
                              <span className="text-slate-500 uppercase tracking-widest text-[9px] font-black block">Prazo Solicitado</span>
                              <span className="text-white font-bold block">{change.proposedData.deadline}</span>
                            </div>
                          )}
                          {change.proposedData.description && (
                            <div className="space-y-1 col-span-2 pt-2 border-t border-white/5">
                              <span className="text-slate-500 uppercase tracking-widest text-[9px] font-black block">Briefing (Informações)</span>
                              <p className="text-slate-300 italic whitespace-pre-wrap mt-1 leading-relaxed bg-white/5 p-2 rounded-xl text-xs">{change.proposedData.description}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* TYPE STATUS DETAILS */}
                      {change.type === 'status' && change.proposedData && change.originalData && (
                        <div className="flex items-center gap-4 py-1">
                          <div className="bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-xl flex-1 text-center">
                            <span className="text-slate-500 text-[9px] uppercase font-black tracking-wider block mb-0.5">Status Anterior</span>
                            <span className="text-red-400 font-bold">{translateStatus(change.originalData.status)}</span>
                          </div>
                          <ArrowRight className="w-5 h-5 text-slate-600 shrink-0" />
                          <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl flex-1 text-center">
                            <span className="text-slate-500 text-[9px] uppercase font-black tracking-wider block mb-0.5">Novo Status Sugerido</span>
                            <span className="text-emerald-400 font-bold">{translateStatus(change.proposedData.status)}</span>
                          </div>
                        </div>
                      )}

                      {/* TYPE EXCLUDE DETAILS */}
                      {change.type === 'delete' && (
                        <div className="flex items-center gap-3 text-rose-400/80 leading-snug">
                          <AlertTriangle className="w-5 h-5 shrink-0" />
                          <span>Esta ação excluirá permanentemente o card da arte correspondente se for aceito.</span>
                        </div>
                      )}

                      {/* TYPE UPDATE COMPARISON */}
                      {change.type === 'update' && change.proposedData && change.originalData && (
                        <div className="space-y-3">
                          {/* Title altered */}
                          {change.originalData.title !== change.proposedData.title && (
                            <div className="space-y-1">
                              <span className="text-slate-500 uppercase tracking-widest text-[9px] font-black block">Modificação de Título</span>
                              <div className="flex items-center gap-2">
                                <span className="line-through text-slate-500">{change.originalData.title}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-white font-bold">{change.proposedData.title}</span>
                              </div>
                            </div>
                          )}

                          {/* Category or Priority altered */}
                          {(change.originalData.category !== change.proposedData.category || change.originalData.priority !== change.proposedData.priority) && (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div>
                                <span className="text-slate-500 uppercase tracking-widest text-[9px] font-black block mb-0.5">Original</span>
                                <span className="text-slate-400">{translateCategory(change.originalData.category)} ({translatePriority(change.originalData.priority)})</span>
                              </div>
                              <div>
                                <span className="text-slate-500 uppercase tracking-widest text-[9px] font-black block mb-0.5">Proposta</span>
                                <span className="text-white font-black">{translateCategory(change.proposedData.category)} ({translatePriority(change.proposedData.priority)})</span>
                              </div>
                            </div>
                          )}

                          {/* Deadline Altered */}
                          {change.originalData.deadline !== change.proposedData.deadline && (
                            <div className="space-y-1">
                              <span className="text-slate-500 uppercase tracking-widest text-[9px] font-black block">Alteração de Prazo</span>
                              <div className="flex items-center gap-2 text-xs leading-none">
                                <span className="line-through text-slate-500">{change.originalData.deadline || 'Sem Prazo'}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-white font-black">{change.proposedData.deadline || 'Retirar Prazo'}</span>
                              </div>
                            </div>
                          )}

                          {/* Description briefing Altered */}
                          {change.originalData.description !== change.proposedData.description && (
                            <div className="space-y-2 pt-2 border-t border-white/5">
                              <span className="text-slate-500 uppercase tracking-widest text-[9px] font-black block">Mudança no Briefing</span>
                              <div className="grid md:grid-cols-2 gap-3 text-[11px] leading-relaxed">
                                <div className="bg-red-500/5 p-2.5 rounded-xl border border-red-500/10">
                                  <span className="text-[9px] font-black text-red-400 uppercase tracking-wider block mb-1">Briefing Anterior:</span>
                                  <p className="text-slate-400 line-through truncate max-h-[80px] overflow-hidden whitespace-pre-wrap">{change.originalData.description || '(Vazio)'}</p>
                                </div>
                                <div className="bg-emerald-500/5 p-2.5 rounded-xl border border-emerald-500/10">
                                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider block mb-1">Novo Briefing Sugerido:</span>
                                  <p className="text-slate-200 font-bold whitespace-pre-wrap">{change.proposedData.description || '(Vazio)'}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Approve / Reject buttons */}
                    {isDesigner ? (
                      <div className="flex items-center gap-3 justify-end pt-1">
                        <Button
                          variant="ghost"
                          disabled={loadingId === change.id}
                          onClick={() => handleReject(change)}
                          className="rounded-xl text-xs font-black text-rose-400 hover:text-white hover:bg-rose-600/20"
                        >
                          <X className="w-4 h-4 mr-1.5" />
                          Recusar
                        </Button>
                        <Button
                          disabled={loadingId === change.id}
                          onClick={() => handleApprove(change)}
                          className="rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/10"
                        >
                          <Check className="w-4 h-4 mr-1.5" />
                          Aprovar Alteração
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end pt-1">
                        <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 animate-spin-slow" />
                          Aguardando validação do designer
                        </span>
                      </div>
                    )}
                  </motion.div>
                ))
              )
            ) : (
              historyChanges.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center justify-center text-slate-500 italic text-xs">
                  Sem decisões recentes registradas no histórico.
                </div>
              ) : (
                historyChanges.map((change) => (
                  <motion.div
                    key={change.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "p-2 rounded-lg text-xs font-bold",
                        change.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      )}>
                        {change.status === 'approved' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block leading-tight">{change.title}</span>
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mt-0.5">
                          Iniciado por {change.contractorName} • {change.status === 'approved' ? 'Aprovado' : 'Recusado'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-600 font-semibold">{formatSafeDate(change.createdAt)}</span>
                  </motion.div>
                ))
              )
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
