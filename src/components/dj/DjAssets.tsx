import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Music, ExternalLink, Clock, Trash2, Loader2, Disc, Calendar, ShieldAlert, BadgeCheck, Pencil, Film, Image, Sparkles, User } from "lucide-react";
import { EventProject, UserProfile, DjAsset, ArtTask } from "../../types";
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, getDocs, limit, orderBy, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../../firebase";
import { OperationType } from "../../types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface DjAssetsProps {
  event: EventProject;
  profile: UserProfile;
}

export function DjAssets({ event, profile }: DjAssetsProps) {
  const [assets, setAssets] = useState<DjAsset[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Form
  const [newAsset, setNewAsset] = useState<Partial<DjAsset>>({
    name: '',
    presskitUrl: '',
    musicName: '',
    musicUrl: '',
    musicDuration: '',
    artDeadline: '',
    hasMandatoryLogo: false,
    agencyInfo: '',
    labelInfo: '',
    agencies: [{ name: '', link: '' }],
    labels: [{ name: '', link: '' }],
    flyerPhoto: '',
    animationVideo: '',
    priority: 'medium',
    presskitStatus: 'pending'
  });

  const [hasVisualMaterial, setHasVisualMaterial] = useState(false);
  const [hasPlaylist, setHasPlaylist] = useState(false);
  const [hasRecordLabel, setHasRecordLabel] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'events', event.id, 'dj_assets'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DjAsset)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `events/${event.id}/dj_assets`);
    });
    return () => unsubscribe();
  }, [event.id]);

  const handleOpenEdit = (asset: DjAsset) => {
    setEditingId(asset.id);
    const ags = asset.agencies && asset.agencies.length > 0
      ? asset.agencies.map(a => ({ ...a }))
      : [{ name: asset.agencyInfo || '', link: '' }];
    
    const labs = asset.labels && asset.labels.length > 0
      ? asset.labels.map(l => ({ ...l }))
      : [{ name: asset.labelInfo || '', link: '' }];

    setNewAsset({ 
      ...asset,
      agencies: ags,
      labels: labs
    });
    setHasVisualMaterial(!!(asset.flyerPhoto || asset.animationVideo));
    setHasPlaylist(!!(asset.musicName || asset.musicUrl || asset.musicDuration));
    setHasRecordLabel(!!(asset.labels && asset.labels.length > 0 && asset.labels.some(l => l.name?.trim() || l.link?.trim())));
    setIsOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    clearForm();
    setIsOpen(true);
  };

  const handleSave = async () => {
    // 1. Identificação & Presskit Validation
    if (!newAsset.name?.trim()) {
      toast.error("O campo 'Nome do DJ / Atração' é obrigatório.");
      return;
    }
    if (!newAsset.presskitUrl?.trim()) {
      toast.error("O campo 'Link do Presskit' é obrigatório.");
      return;
    }
    if (!newAsset.priority) {
      toast.error("O campo 'Prioridade da Arte' é obrigatório.");
      return;
    }

    // 2. Prazo de Entrega Validation
    if (!newAsset.artDeadline?.trim()) {
      toast.error("O campo 'Data da Arte' é obrigatório.");
      return;
    }

    // 3. Material Visual Validation (if active)
    if (hasVisualMaterial) {
      if (!newAsset.flyerPhoto?.trim()) {
        toast.error("Faltando campo 'Foto para o Flyer' na seção Material Visual.");
        return;
      }
      if (!newAsset.animationVideo?.trim()) {
        toast.error("Faltando campo 'Vídeo para Animação' na seção Material Visual.");
        return;
      }
    }

    // 4. Marcas & Logos Mandatórios Validation (if active)
    if (newAsset.hasMandatoryLogo) {
      if (!newAsset.agencies || newAsset.agencies.length === 0) {
        toast.error("Adicione pelo menos uma agência na seção Logos Obrigatórios.");
        return;
      }
      for (let i = 0; i < newAsset.agencies.length; i++) {
        const agency = newAsset.agencies[i];
        if (!agency.name?.trim()) {
          toast.error(`O nome da Agência #${i + 1} é obrigatório.`);
          return;
        }
      }

      if (hasRecordLabel) {
        if (!newAsset.labels || newAsset.labels.length === 0) {
          toast.error("Adicione pelo menos uma gravadora na seção Logos Obrigatórios.");
          return;
        }
        for (let i = 0; i < newAsset.labels.length; i++) {
          const label = newAsset.labels[i];
          if (!label.name?.trim()) {
            toast.error(`O nome da Gravadora #${i + 1} é obrigatório.`);
            return;
          }
        }
      }
    }

    // 5. Playlist & Trilha de Entrada Validation (if active)
    if (hasPlaylist) {
      if (!newAsset.musicName?.trim()) {
        toast.error("Faltando campo 'Nome da Música' na seção Trilha de Entrada.");
        return;
      }
      if (!newAsset.musicUrl?.trim()) {
        toast.error("Faltando campo 'Link da Música' na seção Trilha de Entrada.");
        return;
      }
      if (!newAsset.musicDuration?.trim()) {
        toast.error("Faltando campo 'Duração / Minutos de Corte' na seção Trilha de Entrada.");
        return;
      }
    }

    setLoading(true);
    try {
      // Clean up fields based on toggle states
      const payload = {
        ...newAsset,
        flyerPhoto: hasVisualMaterial ? (newAsset.flyerPhoto || '') : '',
        animationVideo: hasVisualMaterial ? (newAsset.animationVideo || '') : '',
        hasMandatoryLogo: !!newAsset.hasMandatoryLogo,
        agencies: newAsset.hasMandatoryLogo ? (newAsset.agencies || []) : [],
        labels: (newAsset.hasMandatoryLogo && hasRecordLabel) ? (newAsset.labels || []) : [],
        agencyInfo: newAsset.hasMandatoryLogo && newAsset.agencies ? newAsset.agencies.map(a => `${a.name} (${a.link})`).join(', ') : '',
        labelInfo: newAsset.hasMandatoryLogo && hasRecordLabel && newAsset.labels ? newAsset.labels.map(l => `${l.name} (${l.link})`).join(', ') : '',
        musicName: hasPlaylist ? (newAsset.musicName || '') : '',
        musicUrl: hasPlaylist ? (newAsset.musicUrl || '') : '',
        musicDuration: hasPlaylist ? (newAsset.musicDuration || '') : '',
      };

      if (editingId) {
        // Update existing asset
        const updateData: any = {};
        Object.entries(payload).forEach(([key, value]) => {
          if (value !== undefined) {
            updateData[key] = value;
          }
        });

        await updateDoc(doc(db, 'events', event.id, 'dj_assets', editingId), {
          ...updateData,
          updatedAt: serverTimestamp(),
        });
        toast.success("Informações do DJ atualizadas!");
      } else {
        // Create new asset
        const assetRef = await addDoc(collection(db, 'events', event.id, 'dj_assets'), {
          ...payload,
          eventId: event.id,
          createdAt: serverTimestamp(),
        });

        // 2. Automatically create Art Task if deadline is set
        if (payload.artDeadline) {
          const artsPath = `events/${event.id}/arts`;
          
          const artsSnap = await getDocs(query(
            collection(db, artsPath),
            limit(500)
          ));
          
          const todoArts = artsSnap.docs
            .map(d => d.data() as ArtTask)
            .filter(a => a.status === 'todo');
            
          const maxPosition = todoArts.length > 0 
            ? Math.max(...todoArts.map(a => a.position || 0))
            : 0;

          await addDoc(collection(db, artsPath), {
            title: `Arte DJ: ${payload.name}`,
            description: `DJ cadastrado via Presskits.\n\nPresskit: ${payload.presskitUrl || 'Não informado'}\nAtração: ${payload.name}\nMúsica: ${payload.musicName || 'Não informada'}\nFoto p/ Flyer: ${payload.flyerPhoto || 'Não informada'}\nVídeo p/ Animação: ${payload.animationVideo || 'Não informado'}${payload.hasMandatoryLogo ? `\n\n⚠️ LOGO OBRIGATÓRIA:\nAgencia: ${payload.agencyInfo || '-'}\nGravadora: ${payload.labelInfo || '-'}` : ''}`,
            priority: payload.priority || 'medium',
            category: 'dj',
            deadline: payload.artDeadline,
            status: 'todo',
            position: maxPosition + 1000,
            eventId: event.id,
            createdAt: serverTimestamp(),
            sourceAssetId: assetRef.id
          });
          
          toast.info("Tarefa de arte criada automaticamente no quadro!");
        }
        toast.success("DJ adicionado!");
      }

      setIsOpen(false);
      clearForm();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar informações.");
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setEditingId(null);
    setNewAsset({ 
      name: '', 
      presskitUrl: '', 
      musicName: '', 
      musicUrl: '', 
      musicDuration: '', 
      artDeadline: '', 
      hasMandatoryLogo: false, 
      agencyInfo: '', 
      labelInfo: '',
      agencies: [{ name: '', link: '' }],
      labels: [{ name: '', link: '' }],
      flyerPhoto: '',
      animationVideo: '',
      priority: 'medium',
      presskitStatus: 'pending'
    });
    setHasVisualMaterial(false);
    setHasPlaylist(false);
    setHasRecordLabel(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'events', event.id, 'dj_assets', id));
      toast.success("Removido");
    } catch (err) {
      console.error(err);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    const leadingDays = firstDay.getDay();
    for (let i = 0; i < leadingDays; i++) {
      days.push(null);
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const calendarDays = getDaysInMonth(currentMonth);
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const monthName = currentMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));

  const handleDragStart = (e: React.DragEvent, assetId: string) => {
    e.dataTransfer.setData('assetId', assetId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const assetId = e.dataTransfer.getData('assetId');
    if (!assetId) return;

    const dateStr = date.toISOString().split('T')[0];
    
    try {
      await updateDoc(doc(db, 'events', event.id, 'dj_assets', assetId), {
        artDeadline: dateStr,
        updatedAt: serverTimestamp()
      });
      toast.success("Deadline atualizada!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar data.");
    }
  };

  const filteredAssets = assets.filter(asset => {
    const matchPriority = priorityFilter === 'all' || asset.priority === priorityFilter;
    const matchStatus = statusFilter === 'all' || asset.presskitStatus === statusFilter;
    return matchPriority && matchStatus;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-purple-400">Presskits & Playlist</h2>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setViewMode('grid')}
              className={cn("h-7 rounded-xl px-4 text-[9px] font-black uppercase tracking-widest", viewMode === 'grid' ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300")}
            >
              Lista
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setViewMode('calendar')}
              className={cn("h-7 rounded-xl px-4 text-[9px] font-black uppercase tracking-widest", viewMode === 'calendar' ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300")}
            >
              Calendário
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            {['all', 'low', 'medium', 'urgent'].map((p) => (
              <Button
                key={p}
                variant="ghost"
                size="sm"
                onClick={() => setPriorityFilter(p)}
                className={cn(
                  "h-6 rounded-lg px-2 text-[8px] font-black uppercase tracking-widest border border-white/5",
                  priorityFilter === p ? "bg-white/10 text-white border-white/20" : "text-slate-600 hover:text-slate-400"
                )}
              >
                {p === 'all' ? 'Todas' : p === 'low' ? 'Baixa' : p === 'medium' ? 'Média' : 'Urgente'}
              </Button>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            {(['all', 'pending', 'completed'] as const).map((s) => (
              <Button
                key={s}
                variant="ghost"
                size="sm"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "h-6 rounded-lg px-2 text-[8px] font-black uppercase tracking-widest border border-white/5",
                  statusFilter === s ? "bg-white/10 text-white border-white/20" : "text-slate-600 hover:text-slate-400"
                )}
              >
                {s === 'all' ? 'Ver Todos' : s === 'pending' ? 'Pendentes' : 'Concluídos'}
              </Button>
            ))}
          </div>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger render={
            <Button onClick={handleOpenCreate} className="bg-white/5 text-white hover:bg-white/10 rounded-2xl h-12 px-6 border border-white/10 backdrop-blur-md font-bold transition-all hover:scale-105 active:scale-95">
              <Plus className="w-4 h-4 mr-2 text-pink-500" />
              Adicionar DJ
            </Button>
          } />
          <DialogContent className="rounded-3xl sm:max-w-[850px] w-[95vw] glass border-white/10 text-slate-100 p-6 md:p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <Disc className="w-6 h-6 text-purple-400 animate-spin" style={{ animationDuration: '6s' }} />
                {editingId ? 'Editar Informações do DJ' : 'Cadastrar Novo DJ / Atração'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-6 py-6 max-h-[70vh] overflow-y-auto px-1 pr-3 scrollbar-thin">
              
              {/* 1 - Identificação & Presskit */}
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                  <User className="w-4 h-4 text-purple-400" />
                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-300">1- Identificação & Presskit</span>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                    Nome do DJ / Atração <span className="text-pink-500 font-bold">*</span>
                  </Label>
                  <Input value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} placeholder="Ex: DJ Alok" className="rounded-2xl bg-white/5 border-white/10 text-white h-12" />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                    Link do Presskit (Drive/Dropbox) <span className="text-pink-500 font-bold">*</span>
                  </Label>
                  <Input value={newAsset.presskitUrl} onChange={e => setNewAsset({...newAsset, presskitUrl: e.target.value})} placeholder="Link com fotos e release" className="rounded-2xl bg-white/5 border-white/10 text-white h-12" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Status do Presskit</Label>
                    <div className="flex gap-1 bg-white/5 p-1 rounded-2xl border border-white/10">
                      {(['pending', 'completed'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setNewAsset({...newAsset, presskitStatus: s})}
                          className={cn(
                            "flex-1 rounded-xl text-[9px] font-black uppercase tracking-widest h-9 transition-all cursor-pointer",
                            newAsset.presskitStatus === s 
                              ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                              : "text-slate-500 hover:text-slate-300"
                          )}
                        >
                          {s === 'pending' ? 'Pendente' : 'Recebido'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                      Prioridade da Arte <span className="text-pink-500 font-bold">*</span>
                    </Label>
                    <div className="flex gap-1 bg-white/5 p-1 rounded-2xl border border-white/10">
                      {(['low', 'medium', 'urgent'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setNewAsset({...newAsset, priority: p})}
                          className={cn(
                            "flex-1 rounded-xl text-[9px] font-black uppercase tracking-widest h-9 transition-all cursor-pointer",
                            newAsset.priority === p 
                              ? p === 'urgent' ? "bg-rose-500/20 text-rose-400 border-rose-500/30" :
                                p === 'medium' ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                                "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "text-slate-500 hover:text-slate-300"
                          )}
                        >
                          {p === 'low' ? 'Baixa' : p === 'medium' ? 'Méd' : 'Urg'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2 - Prazo de Entrega */}
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-300">2- Prazo de Entrega</span>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                    Data da Arte <span className="text-pink-500 font-bold">*</span>
                  </Label>
                  <Input 
                    type="date"
                    value={newAsset.artDeadline || ''} 
                    onChange={e => setNewAsset({...newAsset, artDeadline: e.target.value})} 
                    className="rounded-2xl bg-white/5 border-white/10 text-white h-12 [color-scheme:dark] px-5 font-bold" 
                  />
                </div>

                {newAsset.artDeadline && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-start gap-3">
                    <div className="bg-blue-500/20 p-2 rounded-xl shrink-0 mt-0.5 animate-pulse">
                      <Calendar className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-blue-300 font-extrabold uppercase tracking-widest">
                        Tarefa criada Automaticamente pro Designer
                      </p>
                      <p className="text-[11px] text-blue-200/70 font-medium leading-relaxed italic">
                        O sistema agendará no Calendário de artes para iniciar a criação do flyer.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 3 - Logos Obrigatórios (Agências e Gravadoras) */}
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-300">3- Logos Obrigatórios (Agências e Gravadoras)</span>
                  </div>
                  <Checkbox 
                    id="mandatory-logo" 
                    checked={newAsset.hasMandatoryLogo}
                    onCheckedChange={(checked) => {
                      const isChecked = checked === true;
                      setNewAsset({ 
                        ...newAsset, 
                        hasMandatoryLogo: isChecked,
                        agencies: isChecked && (!newAsset.agencies || newAsset.agencies.length === 0) ? [{ name: '', link: '' }] : newAsset.agencies,
                        labels: isChecked && (!newAsset.labels || newAsset.labels.length === 0) ? [{ name: '', link: '' }] : newAsset.labels
                      });
                    }}
                    className="border-slate-500 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                  />
                </div>

                <AnimatePresence initial={false}>
                  {newAsset.hasMandatoryLogo ? (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-6 overflow-hidden pt-2"
                    >
                      {/* Agências */}
                      <div className="space-y-3">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                          Agência / Bookings Obrigatórias
                        </Label>
                        
                        <div className="space-y-3">
                          {newAsset.agencies?.map((agency, idx) => (
                            <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white/[0.01] border border-white/5 p-3 rounded-2xl relative">
                              <div className="space-y-1">
                                <Label className="text-[9px] uppercase font-bold tracking-widest text-slate-400 flex items-center justify-between">
                                  <span>Nome da Agência <span className="text-pink-500 font-bold">*</span></span>
                                  {newAsset.agencies!.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...newAsset.agencies!];
                                        updated.splice(idx, 1);
                                        setNewAsset({ ...newAsset, agencies: updated });
                                      }}
                                      className="text-slate-500 hover:text-rose-500 transition-colors uppercase font-black text-[8px] tracking-wider"
                                    >
                                      Remover
                                    </button>
                                  )}
                                </Label>
                                <Input 
                                  value={agency.name} 
                                  onChange={e => {
                                    const updated = [...newAsset.agencies!];
                                    updated[idx] = { ...updated[idx], name: e.target.value };
                                    setNewAsset({ ...newAsset, agencies: updated });
                                  }}
                                  placeholder="Nome da Agência"
                                  className="rounded-xl bg-white/5 border-white/10 text-white h-10 px-4"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[9px] uppercase font-bold tracking-widest text-slate-400">
                                  Link do Logo
                                </Label>
                                <Input 
                                  value={agency.link} 
                                  onChange={e => {
                                    const updated = [...newAsset.agencies!];
                                    updated[idx] = { ...updated[idx], link: e.target.value };
                                    setNewAsset({ ...newAsset, agencies: updated });
                                  }}
                                  placeholder="Link ou caminho do arquivo"
                                  className="rounded-xl bg-white/5 border-white/10 text-white h-10 px-4"
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <p className="text-xs text-slate-400 italic mt-1 text-center font-medium mb-2">Caso o link do logo esteja dentro do presskit deixe em branco</p>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            const updated = [...(newAsset.agencies || [])];
                            updated.push({ name: '', link: '' });
                            setNewAsset({ ...newAsset, agencies: updated });
                          }}
                          className="w-full rounded-xl h-10 border-dashed border-white/10 hover:bg-white/5 font-black text-slate-400 uppercase tracking-widest text-[9px] flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5 text-amber-500" />
                          Adicionar Outra Agência
                        </Button>
                      </div>

                      {/* Gravadoras Toggle & Fields */}
                      <div className="pt-4 border-t border-white/5 space-y-3">
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            id="has-record-label-toggle" 
                            checked={hasRecordLabel}
                            onCheckedChange={(checked) => {
                              const isChecked = checked === true;
                              setHasRecordLabel(isChecked);
                              if (isChecked && (!newAsset.labels || newAsset.labels.length === 0)) {
                                setNewAsset({
                                  ...newAsset,
                                  labels: [{ name: '', link: '' }]
                                });
                              }
                            }}
                            className="border-slate-500 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                          />
                          <Label htmlFor="has-record-label-toggle" className="text-[10px] uppercase font-black tracking-widest text-slate-300 cursor-pointer">
                            Gravadoras Obrigatórias
                          </Label>
                        </div>
                        
                        <AnimatePresence initial={false}>
                          {hasRecordLabel && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="space-y-3 overflow-hidden pt-1"
                            >
                              <div className="space-y-3">
                                {newAsset.labels?.map((label, idx) => (
                                  <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white/[0.01] border border-white/5 p-3 rounded-2xl relative">
                                    <div className="space-y-1">
                                      <Label className="text-[9px] uppercase font-bold tracking-widest text-slate-400 flex items-center justify-between">
                                        <span>Nome da Gravadora <span className="text-pink-500 font-bold">*</span></span>
                                        {newAsset.labels!.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updated = [...newAsset.labels!];
                                              updated.splice(idx, 1);
                                              setNewAsset({ ...newAsset, labels: updated });
                                            }}
                                            className="text-slate-500 hover:text-rose-500 transition-colors uppercase font-black text-[8px] tracking-wider"
                                          >
                                            Remover
                                          </button>
                                        )}
                                      </Label>
                                      <Input 
                                        value={label.name} 
                                        onChange={e => {
                                          const updated = [...newAsset.labels!];
                                          updated[idx] = { ...updated[idx], name: e.target.value };
                                          setNewAsset({ ...newAsset, labels: updated });
                                        }}
                                        placeholder="Nome da Gravadora"
                                        className="rounded-xl bg-white/5 border-white/10 text-white h-10 px-4"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[9px] uppercase font-bold tracking-widest text-slate-400">
                                        Link do Logo
                                      </Label>
                                      <Input 
                                        value={label.link} 
                                        onChange={e => {
                                          const updated = [...newAsset.labels!];
                                          updated[idx] = { ...updated[idx], link: e.target.value };
                                          setNewAsset({ ...newAsset, labels: updated });
                                        }}
                                        placeholder="Link ou caminho do arquivo"
                                        className="rounded-xl bg-white/5 border-white/10 text-white h-10 px-4"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <p className="text-xs text-slate-400 italic mt-1 text-center font-medium mb-2">Caso o link do logo esteja dentro do presskit deixe em branco</p>
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                  const updated = [...(newAsset.labels || [])];
                                  updated.push({ name: '', link: '' });
                                  setNewAsset({ ...newAsset, labels: updated });
                                }}
                                className="w-full rounded-xl h-10 border-dashed border-white/10 hover:bg-white/5 font-black text-slate-400 uppercase tracking-widest text-[9px] flex items-center justify-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5 text-amber-500" />
                                Adicionar Outra Gravadora
                              </Button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Nenhum logo de agência ou gravadora obrigatória ativado. Marque para ativar e preencher.</p>
                  )}
                </AnimatePresence>
              </div>

              {/* 4 - Escolher Foto e Vídeo */}
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Image className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-300">4- Escolher Foto e Vídeo</span>
                  </div>
                  <Checkbox 
                    id="has-visual-material" 
                    checked={hasVisualMaterial}
                    onCheckedChange={(checked) => setHasVisualMaterial(checked === true)}
                    className="border-slate-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                  />
                </div>

                <AnimatePresence initial={false}>
                  {hasVisualMaterial ? (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4 overflow-hidden pt-2"
                    >
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                          Foto para o Flyer (Nome do arquivo que tá no drive ou Link) <span className="text-pink-500 font-bold">*</span>
                        </Label>
                        <Input value={newAsset.flyerPhoto || ''} onChange={e => setNewAsset({...newAsset, flyerPhoto: e.target.value})} placeholder="Ex: dj_promo.png ou link da foto" className="rounded-2xl bg-white/5 border-white/10 text-white h-12" />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                          Vídeo para Animação (Nome do arquivo que tá no drive ou Link) <span className="text-pink-500 font-bold">*</span>
                        </Label>
                        <Input value={newAsset.animationVideo || ''} onChange={e => setNewAsset({...newAsset, animationVideo: e.target.value})} placeholder="Ex: painel_loop.mp4 ou link do drive" className="rounded-2xl bg-white/5 border-white/10 text-white h-12" />
                      </div>
                    </motion.div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Escolha qual foto especifica o DJ quer usar no Flyer e qual vídeo especifico usar no Motion de Apresentação</p>
                  )}
                </AnimatePresence>
              </div>

              {/* 5 - Escolher Track */}
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4 text-pink-400" />
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-300">5- Escolher Track</span>
                  </div>
                  <Checkbox 
                    id="has-playlist" 
                    checked={hasPlaylist}
                    onCheckedChange={(checked) => setHasPlaylist(checked === true)}
                    className="border-slate-500 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
                  />
                </div>

                <AnimatePresence initial={false}>
                  {hasPlaylist ? (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4 overflow-hidden pt-2"
                    >
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                          Nome da Música <span className="text-pink-500 font-bold">*</span>
                        </Label>
                        <Input value={newAsset.musicName || ''} onChange={e => setNewAsset({...newAsset, musicName: e.target.value})} placeholder="Ex: Hear Me Now" className="rounded-2xl bg-white/5 border-white/10 text-white h-12" />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                            Link da Música <span className="text-pink-500 font-bold">*</span>
                          </Label>
                          <Input value={newAsset.musicUrl || ''} onChange={e => setNewAsset({...newAsset, musicUrl: e.target.value})} placeholder="Ex: Link do Spotify/Youtube" className="rounded-2xl bg-white/5 border-white/10 text-white h-12" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                            Duração / Minutos de Corte <span className="text-pink-500 font-bold">*</span>
                          </Label>
                          <Input value={newAsset.musicDuration || ''} onChange={e => setNewAsset({...newAsset, musicDuration: e.target.value})} placeholder="Ex: 01:20" className="rounded-2xl bg-white/5 border-white/10 text-white h-12" />
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Escolha qual Música especifica o DJ quer usar no Motion de Apresentação</p>
                  )}
                </AnimatePresence>
              </div>

            </div>
            <DialogFooter className="pt-4 border-t border-white/5 flex flex-col sm:flex-row gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsOpen(false)} 
                className="w-full sm:w-1/3 rounded-2xl h-14 border-white/10 hover:bg-white/5 font-black text-slate-300 uppercase tracking-widest text-xs"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={loading} 
                className="w-full sm:w-2/3 bg-pink-500 hover:bg-pink-600 text-white rounded-2xl h-14 font-black shadow-[0_0_20px_rgba(236,72,153,0.3)] uppercase tracking-widest text-xs flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : editingId ? "Salvar Alterações" : "Adicionar à Programação"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map(asset => (
            <Card 
              key={asset.id} 
              onClick={() => handleOpenEdit(asset)}
              className="rounded-[2rem] border-white/5 bg-white/5 backdrop-blur-md shadow-2xl hover:shadow-purple-500/15 hover:bg-white/[0.07] transition-all duration-300 overflow-hidden group border cursor-pointer select-none"
            >
              <div className="bg-white/5 p-6 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center space-x-4 text-white">
                  <div className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                    <Disc className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg uppercase tracking-tight text-white">{asset.name}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                        asset.presskitStatus === 'completed' ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-slate-400"
                      )}>
                        <BadgeCheck className={cn("w-2.5 h-2.5", asset.presskitStatus === 'completed' ? "text-emerald-400" : "text-slate-600")} />
                        {asset.presskitStatus === 'completed' ? 'Preenchido' : 'Pendente'}
                      </div>
                      {asset.priority && (
                        <div className={cn(
                          "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                          asset.priority === 'urgent' ? "bg-rose-500/20 text-rose-400" :
                          asset.priority === 'medium' ? "bg-amber-500/20 text-amber-400" :
                          "bg-emerald-500/20 text-emerald-400"
                        )}>
                          {asset.priority === 'low' ? 'Baixa' : asset.priority === 'medium' ? 'Média' : 'Urgente'}
                        </div>
                      )}
                      {asset.artDeadline && (
                        <div className="flex items-center gap-1 text-pink-400">
                          <Calendar className="w-2.5 h-2.5" />
                          <span className="text-[9px] font-black uppercase tracking-tighter">Arte p/ {asset.artDeadline}</span>
                        </div>
                      )}
                      {asset.hasMandatoryLogo && (
                        <div className="flex items-center gap-1 text-amber-400">
                          <BadgeCheck className="w-2.5 h-2.5" />
                          <span className="text-[9px] font-black uppercase tracking-tighter">Logo Mandatória</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(asset);
                      }} 
                      className="text-slate-600 hover:text-indigo-400 hover:bg-white/5 rounded-full transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(asset.id);
                      }} 
                      className="text-slate-600 hover:text-rose-500 hover:bg-white/5 rounded-full transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
              </div>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Recursos Visuais</p>
                  <a 
                    href={asset.presskitUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all group/link"
                  >
                    <div className="flex items-center space-x-3">
                      <Music className="w-4 h-4 text-pink-400" />
                      <span className="text-sm font-bold text-slate-200">Ver Presskit & Fotos</span>
                    </div>
                    <ExternalLink className="w-3 h-3 text-slate-500 group-hover/link:text-pink-400 transition-colors" />
                  </a>
                </div>

                {asset.hasMandatoryLogo && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-amber-500/70 font-black uppercase tracking-widest flex items-center">
                      <ShieldAlert className="w-3 h-3 mr-1.5" />
                      Logos Mandatórios
                    </p>
                    <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 space-y-2">
                      {asset.agencyInfo && (
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          <span className="text-amber-500/60 mr-1">Agência:</span> {asset.agencyInfo}
                        </p>
                      )}
                      {asset.labelInfo && (
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          <span className="text-amber-500/60 mr-1">Gravadora:</span> {asset.labelInfo}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {asset.flyerPhoto && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Foto p/ Flyer</p>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <p className="text-sm font-bold text-slate-200 truncate">{asset.flyerPhoto}</p>
                    </div>
                  </div>
                )}

                {asset.animationVideo && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Vídeo p/ Animação</p>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <p className="text-sm font-bold text-slate-200 truncate">{asset.animationVideo}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Música de Entrada</p>
                  <div className="p-5 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-[1.5rem] border border-white/5 relative overflow-hidden group/track">
                    <div className="flex items-center justify-between relative z-10">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-white truncate max-w-[150px]">{asset.musicName || "Não informada"}</p>
                        <div className="flex items-center space-x-2 text-slate-500">
                          <Clock className="w-3 h-3 text-purple-400" />
                          <span className="text-[10px] font-black uppercase">{asset.musicDuration || "--"}</span>
                        </div>
                      </div>
                      {asset.musicUrl && (
                        <a 
                          href={asset.musicUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          onClick={(e) => e.stopPropagation()}
                          className="hover:scale-110 transition-transform"
                        >
                          <Button size="icon" variant="ghost" className="rounded-full bg-white/10 hover:bg-pink-500 hover:text-white transition-all shadow-lg">
                            <Music className="w-4 h-4" />
                          </Button>
                        </a>
                      )}
                    </div>
                    <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-purple-500/20 rounded-full blur-[20px] transition-all group-hover/track:scale-150 group-hover/track:bg-pink-500/20"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {assets.length === 0 && (
            <div className="col-span-full h-64 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center space-y-4 text-slate-600 bg-white/5">
              <Music className="w-12 h-12 opacity-20 text-purple-500" />
              <p className="italic font-bold tracking-tight">Nenhum DJ cadastrado para este evento.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white/5 border border-white/5 rounded-[2rem] p-4 backdrop-blur-md">
            <Button variant="ghost" onClick={prevMonth} className="text-white hover:bg-white/10 rounded-xl">Anterior</Button>
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white italic">{monthName}</h3>
            <Button variant="ghost" onClick={nextMonth} className="text-white hover:bg-white/10 rounded-xl">Próximo</Button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {dayNames.map(day => (
              <div key={day} className="text-center py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">
                {day}
              </div>
            ))}
            {calendarDays.map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} className="bg-transparent h-40" />;
              
              const dateStr = date.toISOString().split('T')[0];
              const dayAssets = filteredAssets.filter(a => a.artDeadline === dateStr);
              const isToday = new Date().toDateString() === date.toDateString();

              return (
                <div 
                  key={dateStr} 
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, date)}
                  className={cn(
                    "min-h-40 bg-white/5 border border-white/5 rounded-3xl p-3 space-y-2 transition-all hover:bg-white/10",
                    isToday && "border-purple-500/50 bg-purple-500/5"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={cn(
                      "text-xs font-black italic",
                      isToday ? "text-purple-400" : "text-slate-500"
                    )}>
                      {date.getDate()}
                    </span>
                    {dayAssets.length > 0 && (
                      <span className="bg-pink-500 text-[8px] font-black px-1.5 py-0.5 rounded-full text-white uppercase">
                        {dayAssets.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5 overflow-y-auto max-h-[120px] scrollbar-hide">
                    {dayAssets.map(asset => (
                      <div 
                        key={asset.id} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, asset.id)}
                        onClick={() => handleOpenEdit(asset)}
                        className="bg-purple-500/10 border border-purple-500/20 p-2 rounded-xl cursor-grab active:cursor-grabbing hover:bg-purple-500/20 transition-colors group/item"
                      >
                        <p className="text-[9px] font-black text-white uppercase tracking-tight leading-tight group-hover/item:text-purple-400 truncate">
                          {asset.name}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Disc className="w-2 h-2 text-indigo-400" />
                          <span className="text-[8px] text-slate-400 font-bold italic truncate">Arte Pendente</span>
                        </div>
                      </div>
                    ))}
                    {dayAssets.length === 0 && (
                      <div className="h-full flex items-center justify-center pt-8">
                        <div className="w-1 h-1 rounded-full bg-white/5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
