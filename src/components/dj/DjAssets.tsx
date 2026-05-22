import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Music, ExternalLink, Clock, Trash2, Loader2, Disc, Calendar, ShieldAlert, BadgeCheck, Pencil, Film, Image, Sparkles, User, Share2, Upload, Paperclip } from "lucide-react";
import { EventProject, UserProfile, DjAsset, ArtTask } from "../../types";
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, getDocs, limit, orderBy, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, handleFirestoreError } from "../../firebase";
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

  const [viewOpen, setViewOpen] = useState(false);
  const [selectedViewAsset, setSelectedViewAsset] = useState<DjAsset | null>(null);

  const handleOpenView = (asset: DjAsset) => {
    setSelectedViewAsset(asset);
    setViewOpen(true);
  };

  // Form
  const [newAsset, setNewAsset] = useState<Partial<DjAsset>>({
    name: '',
    presskitUrl: '',
    presskitType: 'link',
    musicName: '',
    musicUrl: '',
    musicUrlType: 'link',
    musicDuration: '',
    artDeadline: '',
    hasMandatoryLogo: false,
    agencyInfo: '',
    labelInfo: '',
    agencies: [{ name: '', link: '', type: 'link' }],
    labels: [{ name: '', link: '', type: 'link' }],
    flyerPhoto: '',
    flyerPhotoType: 'link',
    animationVideo: '',
    animationVideoType: 'link',
    priority: 'medium',
    presskitStatus: 'pending'
  });

  const [hasVisualMaterial, setHasVisualMaterial] = useState(false);
  const [hasPlaylist, setHasPlaylist] = useState(false);
  const [hasRecordLabel, setHasRecordLabel] = useState(false);
  const [uploadingState, setUploadingState] = useState<Record<string, boolean>>({});

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldKey: string, allowedTypes: string[], maxSizeMB = 50) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!storage) {
      toast.error("O serviço de upload direto (Firebase Storage) não está ativado no Console do Firebase deste projeto. Por favor, use links para os seus arquivos ou ative o Storage.");
      return;
    }

    // Validate size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      toast.error(`O arquivo excede o limite de tamanho de ${maxSizeMB}MB.`);
      return;
    }

    // Dynamic type check check
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    const matchType = allowedTypes.length === 0 || allowedTypes.some(t => {
      if (t.startsWith('.')) {
        return fileExt === t;
      }
      return file.type.includes(t);
    });

    if (!matchType) {
      toast.error(`Tipo de arquivo não permitido. Por favor envie um arquivo do tipo: ${allowedTypes.join(', ')}`);
      return;
    }

    setUploadingState(prev => ({ ...prev, [fieldKey]: true }));

    try {
      const refinedFileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const storagePath = `events/${event.id}/dj_assets/${refinedFileName}`;
      const fileRef = ref(storage, storagePath);
      
      await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(fileRef);
      
      if (fieldKey === 'presskit') {
        setNewAsset(prev => ({ ...prev, presskitUrl: downloadUrl, presskitType: 'file' }));
        toast.success("Documento do presskit (.zip) enviado com sucesso!");
      } else if (fieldKey === 'flyerPhoto') {
        setNewAsset(prev => ({ ...prev, flyerPhoto: downloadUrl, flyerPhotoType: 'file' }));
        toast.success("Foto do flyer enviada com sucesso!");
      } else if (fieldKey === 'animationVideo') {
        setNewAsset(prev => ({ ...prev, animationVideo: downloadUrl, animationVideoType: 'file' }));
        toast.success("Vídeo de animação enviado com sucesso!");
      } else if (fieldKey === 'musicUrl') {
        setNewAsset(prev => ({ ...prev, musicUrl: downloadUrl, musicUrlType: 'file' }));
        toast.success("Música de entrada enviada com sucesso!");
      } else if (fieldKey.startsWith('agency_')) {
        const idx = parseInt(fieldKey.split('_')[1], 10);
        const updated = [...(newAsset.agencies || [])];
        if (updated[idx]) {
          updated[idx] = { ...updated[idx], link: downloadUrl, type: 'file' };
          setNewAsset(prev => ({ ...prev, agencies: updated }));
        }
        toast.success("Logo da agência enviada com sucesso!");
      } else if (fieldKey.startsWith('label_')) {
        const idx = parseInt(fieldKey.split('_')[1], 10);
        const updated = [...(newAsset.labels || [])];
        if (updated[idx]) {
          updated[idx] = { ...updated[idx], link: downloadUrl, type: 'file' };
          setNewAsset(prev => ({ ...prev, labels: updated }));
        }
        toast.success("Logo da gravadora enviada com sucesso!");
      }
    } catch (error) {
      console.error("Erro no upload do arquivo:", error);
      toast.error("Houve um erro ao enviar o arquivo.");
    } finally {
      setUploadingState(prev => ({ ...prev, [fieldKey]: false }));
    }
  };

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
      ? asset.agencies.map(a => ({ 
          ...a, 
          type: a.type || (a.link && a.link.includes('firebasestorage') ? 'file' : 'link') 
        }))
      : [{ name: asset.agencyInfo || '', link: '', type: 'link' as const }];
    
    const labs = asset.labels && asset.labels.length > 0
      ? asset.labels.map(l => ({ 
          ...l, 
          type: l.type || (l.link && l.link.includes('firebasestorage') ? 'file' : 'link') 
        }))
      : [{ name: asset.labelInfo || '', link: '', type: 'link' as const }];

    setNewAsset({ 
      ...asset,
      presskitType: asset.presskitType || (asset.presskitUrl && asset.presskitUrl.includes('firebasestorage') ? 'file' : 'link'),
      flyerPhotoType: asset.flyerPhotoType || (asset.flyerPhoto && asset.flyerPhoto.includes('firebasestorage') ? 'file' : 'link'),
      animationVideoType: asset.animationVideoType || (asset.animationVideo && asset.animationVideo.includes('firebasestorage') ? 'file' : 'link'),
      musicUrlType: asset.musicUrlType || (asset.musicUrl && asset.musicUrl.includes('firebasestorage') ? 'file' : 'link'),
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
        if (!agency.link?.trim()) {
          toast.error(`O link ou arquivo do logo da Agência "${agency.name}" é obrigatório.`);
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
      presskitType: 'link',
      musicName: '', 
      musicUrl: '', 
      musicUrlType: 'link',
      musicDuration: '', 
      artDeadline: '', 
      hasMandatoryLogo: false, 
      agencyInfo: '', 
      labelInfo: '',
      agencies: [{ name: '', link: '', type: 'link' }],
      labels: [{ name: '', link: '', type: 'link' }],
      flyerPhoto: '',
      flyerPhotoType: 'link',
      animationVideo: '',
      animationVideoType: 'link',
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
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-black uppercase tracking-[0.15em] text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 italic">DJs & Presskits</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">Controle de presskits, trilhas e logos obrigatórias</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger render={
            <Button onClick={handleOpenCreate} className="bg-gradient-to-tr from-purple-500 to-pink-500 text-white rounded-2xl h-12 px-6 border-none font-black transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(168,85,247,0.3)] w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar DJ
            </Button>
          } />
          <DialogContent className="rounded-[2rem] sm:max-w-[850px] w-[95vw] glass border-white/10 text-slate-100 p-4 sm:p-8 max-h-[92vh] overflow-hidden flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <Disc className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400 animate-spin" style={{ animationDuration: '6s' }} />
                {editingId ? 'Editar Informações do DJ' : 'Cadastrar Novo DJ / Atração'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 flex flex-col gap-4 sm:gap-6 py-4 sm:py-6 overflow-y-auto px-1 pr-1 sm:pr-3 scrollbar-thin">
              
              {/* 1 - Identificação & Presskit */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-4">
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
                
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                      Como deseja enviar o Presskit?
                    </Label>
                    <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10 w-full sm:w-auto overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setNewAsset({...newAsset, presskitType: 'link'})}
                        className={cn(
                          "flex-1 sm:flex-initial rounded-lg text-[8px] font-black uppercase tracking-widest h-7 px-3 transition-all cursor-pointer truncate",
                          (newAsset.presskitType || 'link') === 'link'
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                            : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        Link / URL
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewAsset({...newAsset, presskitType: 'file'})}
                        className={cn(
                          "flex-1 sm:flex-initial rounded-lg text-[8px] font-black uppercase tracking-widest h-7 px-3 transition-all cursor-pointer truncate",
                          newAsset.presskitType === 'file'
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                            : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        Arquivo .zip
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewAsset({...newAsset, presskitType: 'email', presskitUrl: 'beysarts@gmail.com'})}
                        className={cn(
                          "flex-1 sm:flex-initial rounded-lg text-[8px] font-black uppercase tracking-widest h-7 px-3 transition-all cursor-pointer truncate",
                          newAsset.presskitType === 'email'
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                            : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        Via E-mail
                      </button>
                    </div>
                  </div>

                  {(newAsset.presskitType || 'link') === 'link' ? (
                    <Input 
                      value={newAsset.presskitUrl || ''} 
                      onChange={e => setNewAsset({...newAsset, presskitUrl: e.target.value})} 
                      placeholder="Link com fotos e release (Drive/Dropbox)" 
                      className="rounded-2xl bg-white/5 border-white/10 text-white h-12" 
                    />
                  ) : newAsset.presskitType === 'email' ? (
                    <div className="space-y-3 p-4 rounded-2xl bg-purple-500/5 border border-purple-500/10">
                      <p className="text-[11px] text-purple-300 font-bold leading-relaxed text-center sm:text-left font-sans">
                        📨 O material (Presskit e fotos) deve ser enviado diretamente para o e-mail de nossa produção. Copie o endereço abaixo para enviar ou compartilhar:
                      </p>
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/5 border border-white/10 p-3 rounded-xl">
                        <div className="flex items-center gap-2 text-slate-200">
                          <span className="text-sm">📧</span>
                          <span className="text-xs font-mono font-bold tracking-wider select-all">beysarts@gmail.com</span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText('beysarts@gmail.com');
                            toast.success("E-mail copiado!");
                          }}
                          className="w-full sm:w-auto h-8 rounded-lg text-[9px] font-black uppercase tracking-widest px-3.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/25 transition-all flex items-center justify-center gap-1.5"
                        >
                          Copiar E-mail
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] transition-all rounded-2xl p-4 flex flex-col items-center justify-center min-h-[5rem]">
                      {uploadingState['presskit'] ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                          <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Enviando arquivo (.zip)...</span>
                        </div>
                      ) : newAsset.presskitUrl && newAsset.presskitUrl.includes('firebasestorage') ? (
                        <div className="flex items-center justify-between w-full bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                          <div className="flex items-center space-x-2 truncate">
                            <Paperclip className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="text-xs text-emerald-400 font-bold truncate">Arquivo Presskit Pronto</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor="presskit-file-ref" className="text-[9px] uppercase font-black tracking-widest px-2.5 h-8 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-center cursor-pointer text-purple-400 hover:bg-purple-500/20 transition-all">
                              Alterar
                            </Label>
                            <input
                              id="presskit-file-ref"
                              type="file"
                              accept=".zip"
                              onChange={(e) => handleFileUpload(e, 'presskit', ['.zip'])}
                              className="hidden"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <label htmlFor="presskit-file-input" className="flex flex-col items-center gap-2 cursor-pointer w-full h-full py-4 text-center">
                            <Upload className="w-6 h-6 text-slate-400 hover:text-purple-400 transition-colors" />
                            <span className="text-xs text-slate-300 font-extrabold max-w-[200px] leading-tight">Escolher Presskit (.zip)</span>
                            <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">Clique para selecionar documento</span>
                          </label>
                          <input
                            id="presskit-file-input"
                            type="file"
                            accept=".zip"
                            onChange={(e) => handleFileUpload(e, 'presskit', ['.zip'])}
                            className="hidden"
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>

                {editingId && (
                  <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <p className="text-[10px] uppercase font-black tracking-widest text-purple-400 font-extrabold">
                        Link de Preenchimento Exclusivo para o DJ
                      </p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Envie este link para o próprio DJ preencher suas mídias diretamente, sem precisar de login ou visualizar outras partes do painel!
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        const shareUrl = `${window.location.origin}${window.location.pathname}?djShare=${event.id}_${editingId}`;
                        navigator.clipboard.writeText(shareUrl);
                        toast.success("Link exclusivo copiado com sucesso!");
                      }}
                      className="rounded-xl h-11 sm:h-10 px-4 bg-purple-500 hover:bg-purple-600 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 border-none shrink-0"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Copiar Link
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-4">
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
                    className="rounded-2xl bg-white/5 border-white/10 text-white h-12 [color-scheme:dark] px-3 font-bold w-full max-w-[220px]" 
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
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-4">
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
                            <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white/[0.01] border border-white/5 p-3 rounded-2xl relative">
                              <div className="space-y-1 col-span-1 sm:col-span-2">
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

                              <div className="space-y-2 col-span-1 sm:col-span-2 border-t border-white/5 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <Label className="text-[9px] uppercase font-bold tracking-widest text-slate-400">
                                  Logo da Agência <span className="text-pink-500 font-bold">*</span>
                                </Label>
                                <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10 w-fit">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...newAsset.agencies!];
                                      updated[idx] = { ...updated[idx], type: 'link' };
                                      setNewAsset({ ...newAsset, agencies: updated });
                                    }}
                                    className={cn(
                                      "rounded-lg text-[8px] font-black uppercase tracking-widest h-6 px-2 transition-all cursor-pointer",
                                      (agency.type || 'link') === 'link'
                                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                                        : "text-slate-500 hover:text-slate-300"
                                    )}
                                  >
                                    Link / URL
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...newAsset.agencies!];
                                      updated[idx] = { ...updated[idx], type: 'file' };
                                      setNewAsset({ ...newAsset, agencies: updated });
                                    }}
                                    className={cn(
                                      "rounded-lg text-[8px] font-black uppercase tracking-widest h-6 px-2 transition-all cursor-pointer",
                                      agency.type === 'file'
                                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                                        : "text-slate-500 hover:text-slate-300"
                                    )}
                                  >
                                    Enviar Arquivo (.png, .jpg)
                                  </button>
                                </div>
                              </div>

                              <div className="col-span-1 sm:col-span-2">
                                {(agency.type || 'link') === 'link' ? (
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
                                ) : (
                                  <div className="relative border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] transition-all rounded-xl p-3 flex flex-col items-center justify-center min-h-[4rem]">
                                    {uploadingState[`agency_${idx}`] ? (
                                      <div className="flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                                        <span className="text-[9px] uppercase font-black tracking-widest text-slate-400">Enviando imagem...</span>
                                      </div>
                                    ) : agency.link && agency.link.includes('firebasestorage') ? (
                                      <div className="flex items-center justify-between w-full bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg">
                                        <div className="flex items-center space-x-2 truncate">
                                          <Paperclip className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                          <span className="text-[10px] text-emerald-400 font-bold truncate">Logo Carregado</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 item-center">
                                          <Label htmlFor={`agency-file-${idx}`} className="text-[8px] uppercase font-black tracking-widest px-2 h-7 bg-purple-500/10 border border-purple-500/20 rounded flex items-center justify-center cursor-pointer text-purple-400 hover:bg-purple-500/20 transition-all">
                                            Alterar
                                          </Label>
                                          <input
                                            id={`agency-file-${idx}`}
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleFileUpload(e, `agency_${idx}`, ['.png', '.jpg', '.jpeg', 'image/'])}
                                            className="hidden"
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <label htmlFor={`agency-file-input-${idx}`} className="flex flex-col items-center gap-1.5 cursor-pointer w-full text-center">
                                          <Upload className="w-5 h-5 text-slate-400 hover:text-purple-400 transition-colors" />
                                          <span className="text-[10px] text-slate-300 font-extrabold">Selecionar Logo (.png, .jpg)</span>
                                        </label>
                                        <input
                                          id={`agency-file-input-${idx}`}
                                          type="file"
                                          accept="image/*"
                                          onChange={(e) => handleFileUpload(e, `agency_${idx}`, ['.png', '.jpg', '.jpeg', 'image/'])}
                                          className="hidden"
                                        />
                                      </>
                                    )}
                                  </div>
                                )}
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
                              className="space-y-3 overflow-hidden pt-1 font-bold"
                            >
                              <div className="space-y-3">
                                {newAsset.labels?.map((label, idx) => (
                                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white/[0.01] border border-white/5 p-3 rounded-2xl relative">
                                    <div className="space-y-1 col-span-1 sm:col-span-2">
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

                                    <div className="space-y-2 col-span-1 sm:col-span-2 border-t border-white/5 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <Label className="text-[9px] uppercase font-bold tracking-widest text-slate-400">
                                        Logo da Gravadora
                                      </Label>
                                      <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10 w-fit">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = [...newAsset.labels!];
                                            updated[idx] = { ...updated[idx], type: 'link' };
                                            setNewAsset({ ...newAsset, labels: updated });
                                          }}
                                          className={cn(
                                            "rounded-lg text-[8px] font-black uppercase tracking-widest h-6 px-2 transition-all cursor-pointer",
                                            (label.type || 'link') === 'link'
                                              ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                                              : "text-slate-500 hover:text-slate-300"
                                          )}
                                        >
                                          Link / URL
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = [...newAsset.labels!];
                                            updated[idx] = { ...updated[idx], type: 'file' };
                                            setNewAsset({ ...newAsset, labels: updated });
                                          }}
                                          className={cn(
                                            "rounded-lg text-[8px] font-black uppercase tracking-widest h-6 px-2 transition-all cursor-pointer",
                                            label.type === 'file'
                                              ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                                              : "text-slate-500 hover:text-slate-300"
                                          )}
                                        >
                                          Enviar Logo (.png, .jpg)
                                        </button>
                                      </div>
                                    </div>

                                    <div className="col-span-1 sm:col-span-2">
                                      {(label.type || 'link') === 'link' ? (
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
                                      ) : (
                                        <div className="relative border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] transition-all rounded-xl p-3 flex flex-col items-center justify-center min-h-[4rem]">
                                          {uploadingState[`label_${idx}`] ? (
                                            <div className="flex items-center gap-2">
                                              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                                              <span className="text-[9px] uppercase font-black tracking-widest text-slate-400">Enviando imagem...</span>
                                            </div>
                                          ) : label.link && label.link.includes('firebasestorage') ? (
                                            <div className="flex items-center justify-between w-full bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg">
                                              <div className="flex items-center space-x-2 truncate">
                                                <Paperclip className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                <span className="text-[10px] text-emerald-400 font-bold truncate">Logo Carregado</span>
                                              </div>
                                              <div className="flex items-center gap-1.5 item-center">
                                                <Label htmlFor={`label-file-${idx}`} className="text-[8px] uppercase font-black tracking-widest px-2 h-7 bg-purple-500/10 border border-purple-500/20 rounded flex items-center justify-center cursor-pointer text-purple-400 hover:bg-purple-500/20 transition-all">
                                                  Alterar
                                                </Label>
                                                <input
                                                  id={`label-file-${idx}`}
                                                  type="file"
                                                  accept="image/*"
                                                  onChange={(e) => handleFileUpload(e, `label_${idx}`, ['.png', '.jpg', '.jpeg', 'image/'])}
                                                  className="hidden"
                                                />
                                              </div>
                                            </div>
                                          ) : (
                                            <>
                                              <label htmlFor={`label-file-input-${idx}`} className="flex flex-col items-center gap-1.5 cursor-pointer w-full text-center">
                                                <Upload className="w-5 h-5 text-slate-400 hover:text-purple-400 transition-colors" />
                                                <span className="text-[10px] text-slate-300 font-extrabold">Selecionar Logo (.png, .jpg)</span>
                                              </label>
                                              <input
                                                id={`label-file-input-${idx}`}
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleFileUpload(e, `label_${idx}`, ['.png', '.jpg', '.jpeg', 'image/'])}
                                                className="hidden"
                                              />
                                            </>
                                          )}
                                        </div>
                                      )}
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
                                  updated.push({ name: '', link: '', type: 'link' });
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
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-4">
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
                      <div className="space-y-4">
                        {/* Foto do Flyer */}
                        <div className="space-y-3 border-b border-white/5 pb-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                              Foto para o Flyer <span className="text-pink-500 font-bold">*</span>
                            </Label>
                            <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10 w-fit">
                              <button
                                type="button"
                                onClick={() => setNewAsset({...newAsset, flyerPhotoType: 'link'})}
                                className={cn(
                                  "rounded-lg text-[8px] font-black uppercase tracking-widest h-7 px-2.5 transition-all cursor-pointer",
                                  (newAsset.flyerPhotoType || 'link') === 'link'
                                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                                    : "text-slate-500 hover:text-slate-300"
                                )}
                              >
                                Link / Texto
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewAsset({...newAsset, flyerPhotoType: 'file'})}
                                className={cn(
                                  "rounded-lg text-[8px] font-black uppercase tracking-widest h-7 px-2.5 transition-all cursor-pointer",
                                  newAsset.flyerPhotoType === 'file'
                                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                                    : "text-slate-500 hover:text-slate-300"
                                )}
                              >
                                Enviar Foto (.png, .jpg)
                              </button>
                            </div>
                          </div>

                          {(newAsset.flyerPhotoType || 'link') === 'link' ? (
                            <Input 
                              value={newAsset.flyerPhoto || ''} 
                              onChange={e => setNewAsset({...newAsset, flyerPhoto: e.target.value})} 
                              placeholder="Ex: dj_promo.png ou link da foto" 
                              className="rounded-2xl bg-white/5 border-white/10 text-white h-12" 
                            />
                          ) : (
                            <div className="relative border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] transition-all rounded-2xl p-4 flex flex-col items-center justify-center min-h-[5rem]">
                              {uploadingState['flyerPhoto'] ? (
                                <div className="flex flex-col items-center gap-2">
                                  <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Enviando foto...</span>
                                </div>
                              ) : newAsset.flyerPhoto && newAsset.flyerPhoto.includes('firebasestorage') ? (
                                <div className="flex items-center justify-between w-full bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                                  <div className="flex items-center space-x-2 truncate">
                                    <Paperclip className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span className="text-xs text-emerald-400 font-bold truncate">Foto de Flyer Pronta</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Label htmlFor="flyer-file-ref" className="text-[9px] uppercase font-black tracking-widest px-2.5 h-8 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-center cursor-pointer text-purple-400 hover:bg-purple-500/20 transition-all">
                                      Alterar
                                    </Label>
                                    <input
                                      id="flyer-file-ref"
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handleFileUpload(e, 'flyerPhoto', ['.png', '.jpg', '.jpeg', 'image/'])}
                                      className="hidden"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <label htmlFor="flyer-file-input" className="flex flex-col items-center gap-2 cursor-pointer w-full h-full py-4 text-center">
                                    <Upload className="w-6 h-6 text-slate-400 hover:text-purple-400 transition-colors" />
                                    <span className="text-xs text-slate-300 font-extrabold max-w-[200px] leading-tight">Selecionar Imagem (.png, .jpg)</span>
                                    <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">Clique para selecionar imagem</span>
                                  </label>
                                  <input
                                    id="flyer-file-input"
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleFileUpload(e, 'flyerPhoto', ['.png', '.jpg', '.jpeg', 'image/'])}
                                    className="hidden"
                                  />
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Vídeo do Motion */}
                        <div className="space-y-3 pb-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                              Vídeo para Animação/Motion <span className="text-pink-500 font-bold">*</span>
                            </Label>
                            <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10 w-fit">
                              <button
                                type="button"
                                onClick={() => setNewAsset({...newAsset, animationVideoType: 'link'})}
                                className={cn(
                                  "rounded-lg text-[8px] font-black uppercase tracking-widest h-7 px-2.5 transition-all cursor-pointer",
                                  (newAsset.animationVideoType || 'link') === 'link'
                                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                                    : "text-slate-500 hover:text-slate-300"
                                )}
                              >
                                Link / Texto
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewAsset({...newAsset, animationVideoType: 'file'})}
                                className={cn(
                                  "rounded-lg text-[8px] font-black uppercase tracking-widest h-7 px-2.5 transition-all cursor-pointer",
                                  newAsset.animationVideoType === 'file'
                                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                                    : "text-slate-500 hover:text-slate-300"
                                )}
                              >
                                Enviar Vídeo (.mp4)
                              </button>
                            </div>
                          </div>

                          {(newAsset.animationVideoType || 'link') === 'link' ? (
                            <Input 
                              value={newAsset.animationVideo || ''} 
                              onChange={e => setNewAsset({...newAsset, animationVideo: e.target.value})} 
                              placeholder="Ex: painel_loop.mp4 ou link do drive" 
                              className="rounded-2xl bg-white/5 border-white/10 text-white h-12" 
                            />
                          ) : (
                            <div className="relative border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] transition-all rounded-2xl p-4 flex flex-col items-center justify-center min-h-[5rem]">
                              {uploadingState['animationVideo'] ? (
                                <div className="flex flex-col items-center gap-2">
                                  <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Enviando vídeo (.mp4)...</span>
                                </div>
                              ) : newAsset.animationVideo && newAsset.animationVideo.includes('firebasestorage') ? (
                                <div className="flex items-center justify-between w-full bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                                  <div className="flex items-center space-x-2 truncate">
                                    <Paperclip className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span className="text-xs text-emerald-400 font-bold truncate">Vídeo para Motion Pronto</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Label htmlFor="video-file-ref" className="text-[9px] uppercase font-black tracking-widest px-2.5 h-8 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-center cursor-pointer text-purple-400 hover:bg-purple-500/20 transition-all">
                                      Alterar
                                    </Label>
                                    <input
                                      id="video-file-ref"
                                      type="file"
                                      accept="video/*"
                                      onChange={(e) => handleFileUpload(e, 'animationVideo', ['.mp4', '.mov', '.avi', 'video/'])}
                                      className="hidden"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <label htmlFor="video-file-input" className="flex flex-col items-center gap-2 cursor-pointer w-full h-full py-4 text-center">
                                    <Upload className="w-6 h-6 text-slate-400 hover:text-purple-400 transition-colors" />
                                    <span className="text-xs text-slate-300 font-extrabold max-w-[200px] leading-tight">Selecionar Vídeo (.mp4, .mov)</span>
                                    <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">Clique para selecionar arquivo de vídeo/motion</span>
                                  </label>
                                  <input
                                    id="video-file-input"
                                    type="file"
                                    accept="video/*"
                                    onChange={(e) => handleFileUpload(e, 'animationVideo', ['.mp4', '.mov', '.avi', 'video/'])}
                                    className="hidden"
                                  />
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Escolha qual foto especifica o DJ quer usar no Flyer e qual vídeo especifico usar no Motion de Apresentação</p>
                  )}
                </AnimatePresence>
              </div>

              {/* 5 - Escolher Track */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-4">
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

                      <div className="space-y-4 border-t border-white/5 pt-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                            Link ou Arquivo da Música
                          </Label>
                          <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10 w-fit">
                            <button
                              type="button"
                              onClick={() => setNewAsset({...newAsset, musicUrlType: 'link'})}
                              className={cn(
                                "rounded-lg text-[8px] font-black uppercase tracking-widest h-7 px-2.5 transition-all cursor-pointer",
                                (newAsset.musicUrlType || 'link') === 'link'
                                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                                  : "text-slate-500 hover:text-slate-300"
                              )}
                            >
                              Link / URL
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewAsset({...newAsset, musicUrlType: 'file'})}
                              className={cn(
                                "rounded-lg text-[8px] font-black uppercase tracking-widest h-7 px-2.5 transition-all cursor-pointer",
                                newAsset.musicUrlType === 'file'
                                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                                  : "text-slate-500 hover:text-slate-300"
                              )}
                            >
                              Enviar Áudio (.mp3, .wav)
                            </button>
                          </div>
                        </div>

                        {(newAsset.musicUrlType || 'link') === 'link' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                                Link da Música (Spotify/Youtube)
                              </Label>
                              <Input value={newAsset.musicUrl || ''} onChange={e => setNewAsset({...newAsset, musicUrl: e.target.value})} placeholder="Ex: Link do Spotify/Youtube" className="rounded-2xl bg-white/5 border-white/10 text-white h-12" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                                Duração / Minutos de Corte
                              </Label>
                              <Input value={newAsset.musicDuration || ''} onChange={e => setNewAsset({...newAsset, musicDuration: e.target.value})} placeholder="Ex: 01:20" className="rounded-2xl bg-white/5 border-white/10 text-white h-12" />
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                            <div className="relative border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] transition-all rounded-2xl p-4 flex flex-col items-center justify-center min-h-[5rem]">
                              {uploadingState['musicUrl'] ? (
                                <div className="flex flex-col items-center gap-2">
                                  <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Enviando música...</span>
                                </div>
                              ) : newAsset.musicUrl && newAsset.musicUrl.includes('firebasestorage') ? (
                                <div className="flex items-center justify-between w-full bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                                  <div className="flex items-center space-x-2 truncate">
                                    <Paperclip className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span className="text-xs text-emerald-400 font-bold truncate">Música Pronta</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Label htmlFor="music-file-ref" className="text-[9px] uppercase font-black tracking-widest px-2.5 h-8 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-center cursor-pointer text-purple-400 hover:bg-purple-500/20 transition-all">
                                      Alterar
                                    </Label>
                                    <input
                                      id="music-file-ref"
                                      type="file"
                                      accept="audio/*"
                                      onChange={(e) => handleFileUpload(e, 'musicUrl', ['.mp3', '.wav', '.flac', '.m4a', 'audio/'])}
                                      className="hidden"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <label htmlFor="music-file-input" className="flex flex-col items-center gap-2 cursor-pointer w-full h-full py-4 text-center">
                                    <Upload className="w-6 h-6 text-slate-400 hover:text-purple-400 transition-colors" />
                                    <span className="text-xs text-slate-300 font-extrabold max-w-[200px] leading-tight">Escolher Música (MP3/WAV)</span>
                                    <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wider font-mono">Clique para selecionar áudio</span>
                                  </label>
                                  <input
                                    id="music-file-input"
                                    type="file"
                                    accept="audio/*"
                                    onChange={(e) => handleFileUpload(e, 'musicUrl', ['.mp3', '.wav', '.flac', '.m4a', 'audio/'])}
                                    className="hidden"
                                  />
                                </>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                                Duração / Minutos de Corte
                              </Label>
                              <Input value={newAsset.musicDuration || ''} onChange={e => setNewAsset({...newAsset, musicDuration: e.target.value})} placeholder="Ex: 01:20" className="rounded-2xl bg-white/5 border-white/10 text-white h-12" />
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Escolha qual Música especifica o DJ quer usar no Motion de Apresentação</p>
                  )}
                </AnimatePresence>
              </div>

            </div>
            <DialogFooter className="pt-4 border-t border-white/5 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 shrink-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsOpen(false)} 
                className="w-full sm:w-1/3 rounded-2xl h-12 sm:h-14 border-white/10 hover:bg-white/5 font-black text-slate-300 uppercase tracking-widest text-xs"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={loading} 
                className="w-full sm:w-2/3 bg-pink-500 hover:bg-pink-600 text-white rounded-2xl h-12 sm:h-14 font-black shadow-[0_0_20px_rgba(236,72,153,0.3)] uppercase tracking-widest text-xs flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : editingId ? "Salvar Alterações" : "Adicionar à Programação"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="rounded-[2rem] sm:max-w-[700px] w-[95vw] glass border-white/10 text-slate-100 p-4 sm:p-8 max-h-[92vh] overflow-hidden flex flex-col">
            <DialogHeader className="shrink-0 pb-4 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                    <Disc className="w-5 h-5 text-white animate-spin" style={{ animationDuration: '6s' }} />
                  </div>
                  <div>
                    <DialogTitle className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {selectedViewAsset?.name}
                    </DialogTitle>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Ficha de Informações do DJ / Atração
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full",
                    selectedViewAsset?.presskitStatus === 'completed' ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-slate-400"
                  )}>
                    {selectedViewAsset?.presskitStatus === 'completed' ? 'Preenchido' : 'Pendente'}
                  </span>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-6 space-y-6 pr-1 custom-scrollbar">
              {/* Row 1: Status Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-1">
                  <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">Prioridade da Arte</p>
                  <p className={cn(
                    "text-xs font-black uppercase tracking-wider",
                    selectedViewAsset?.priority === 'urgent' ? "text-rose-400" :
                    selectedViewAsset?.priority === 'medium' ? "text-amber-400" :
                    "text-emerald-400"
                  )}>
                    {selectedViewAsset?.priority === 'low' ? 'Baixa' : selectedViewAsset?.priority === 'medium' ? 'Média' : 'Urgente'}
                  </p>
                </div>

                <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-1">
                  <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">Data de Entrega da Arte</p>
                  <p className="text-xs font-black text-white tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-pink-400" />
                    {selectedViewAsset?.artDeadline || 'Não definida'}
                  </p>
                </div>
              </div>

              {/* Presskit Link */}
              <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl space-y-3">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  Link do Presskit & Fotos
                </p>
                {selectedViewAsset?.presskitUrl ? (
                  <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-2xl border border-white/10">
                    <span className="text-xs font-bold text-slate-200 truncate pr-4">
                      {selectedViewAsset.presskitType === 'email' ? `📨 E-mail: ${selectedViewAsset.presskitUrl}` : selectedViewAsset.presskitUrl}
                    </span>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedViewAsset.presskitUrl || '');
                          toast.success("Copiado com sucesso!");
                        }}
                        className="h-8 rounded-xl text-[10px] uppercase font-black tracking-widest"
                      >
                        Copiar
                      </Button>
                      {selectedViewAsset.presskitType === 'email' ? (
                        selectedViewAsset.presskitUrl.includes('@') ? (
                          <a
                            href={`mailto:${selectedViewAsset.presskitUrl}`}
                            className="inline-flex items-center justify-center h-8 rounded-xl text-[10px] uppercase font-black tracking-widest bg-purple-500 text-white hover:bg-purple-600 px-3 transition-colors"
                          >
                            Enviar E-mail
                          </a>
                        ) : null
                      ) : (
                        <a
                          href={selectedViewAsset.presskitUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center h-8 rounded-xl text-[10px] uppercase font-black tracking-widest bg-pink-500 text-white hover:bg-pink-600 px-3 transition-colors"
                        >
                          Acessar
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-rose-400/80 font-bold italic bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10">
                    Nenhum link fornecido até o momento.
                  </p>
                )}
              </div>

              {/* Logos Mandatórios */}
              {selectedViewAsset?.hasMandatoryLogo ? (
                <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl space-y-4">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                    Logos Obrigatórios para Materiais de Divulgação
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Agencies */}
                    <div className="space-y-2">
                      <p className="text-[9px] uppercase font-black tracking-widest text-amber-400/80">Agência(s)</p>
                      {selectedViewAsset.agencies && selectedViewAsset.agencies.length > 0 ? (
                        <div className="space-y-1.5">
                          {selectedViewAsset.agencies.map((agency, i) => (
                            <div key={i} className="text-xs flex items-center justify-between font-bold text-slate-200 bg-white/5 border border-white/5 rounded-xl px-3 py-2">
                              <span className="truncate">{agency.name || '-'}</span>
                              {agency.link && (
                                <a
                                  href={agency.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-pink-400 hover:text-pink-300 transition-colors"
                                >
                                  Logo
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">Nenhuma agência adicionada.</p>
                      )}
                    </div>

                    {/* Labels */}
                    <div className="space-y-2">
                      <p className="text-[9px] uppercase font-black tracking-widest text-amber-400/80">Gravadora(s)</p>
                      {selectedViewAsset.labels && selectedViewAsset.labels.length > 0 && selectedViewAsset.labels.some(l => l.name?.trim()) ? (
                        <div className="space-y-1.5">
                          {selectedViewAsset.labels.map((label, i) => label.name && (
                            <div key={i} className="text-xs flex items-center justify-between font-bold text-slate-200 bg-white/5 border border-white/5 rounded-xl px-3 py-2">
                              <span className="truncate">{label.name}</span>
                              {label.link && (
                                <a
                                  href={label.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-pink-400 hover:text-pink-300 transition-colors"
                                >
                                  Logo
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">Nenhuma gravadora cadastrada.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                  <p className="text-xs text-slate-500 font-bold italic">Nenhum logo obrigatório exigido.</p>
                </div>
              )}

              {/* Material Visual */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl space-y-3">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                    <Image className="w-3.5 h-3.5 text-blue-400" />
                    Foto p/ Flyer
                  </p>
                  {selectedViewAsset?.flyerPhoto ? (
                    <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex flex-col justify-between h-[84px]">
                      <p className="text-xs font-bold text-slate-200 line-clamp-2 leading-relaxed">{selectedViewAsset.flyerPhoto}</p>
                      {selectedViewAsset.flyerPhoto.startsWith('http') && (
                        <a
                          href={selectedViewAsset.flyerPhoto}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 font-bold mt-1"
                        >
                          Acessar link <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 font-bold italic text-center py-4 bg-white/[0.01] rounded-xl border border-dashed border-white/5">
                      Pendente/Não enviada
                    </p>
                  )}
                </div>

                <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl space-y-3">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-teal-400" />
                    Vídeo p/ Motion
                  </p>
                  {selectedViewAsset?.animationVideo ? (
                    <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex flex-col justify-between h-[84px]">
                      <p className="text-xs font-bold text-slate-200 line-clamp-2 leading-relaxed">{selectedViewAsset.animationVideo}</p>
                      {selectedViewAsset.animationVideo.startsWith('http') && (
                        <a
                          href={selectedViewAsset.animationVideo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-teal-400 hover:text-teal-300 flex items-center gap-0.5 font-bold mt-1"
                        >
                          Acessar link <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 font-bold italic text-center py-4 bg-white/[0.01] rounded-xl border border-dashed border-white/5">
                      Pendente/Não enviado
                    </p>
                  )}
                </div>
              </div>

              {/* Trilha de Entrada */}
              <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl space-y-3">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-pink-400" />
                  Música de Entrada (Track)
                </p>
                {selectedViewAsset?.musicName ? (
                  <div className="p-4 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-[1.5rem] border border-white/5 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-black text-white">{selectedViewAsset.musicName}</p>
                      <div className="flex items-center space-x-2 text-slate-500">
                        <Clock className="w-3 h-3 text-purple-400 animate-pulse" />
                        <span className="text-[10px] font-black uppercase">{selectedViewAsset.musicDuration || "Duração não definida"}</span>
                      </div>
                    </div>
                    {selectedViewAsset.musicUrl && (
                      <a
                        href={selectedViewAsset.musicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-white/10 p-2.5 hover:bg-pink-500 hover:text-white transition-all shadow-lg text-slate-300"
                      >
                        <Music className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 font-bold italic text-center py-4 bg-white/[0.01] rounded-xl border border-dashed border-white/5">
                    Nenhuma trilha fornecida.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-white/5 flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewOpen(false)}
                className="w-full sm:w-1/3 rounded-2xl h-12 border-white/10 hover:bg-white/5 font-black text-slate-300 uppercase tracking-widest text-xs"
              >
                Fechar
              </Button>
              <Button
                onClick={() => {
                  setViewOpen(false);
                  if (selectedViewAsset) {
                    handleOpenEdit(selectedViewAsset);
                  }
                }}
                className="w-full sm:w-2/3 bg-pink-500 hover:bg-pink-600 text-white rounded-2xl h-12 font-black shadow-[0_0_20px_rgba(236,72,153,0.3)] uppercase tracking-widest text-xs flex items-center justify-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                Editar Informações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 backdrop-blur-md">
        {/* View Selector */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic pl-1">Exibição</span>
          <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn(
                "flex-1 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                viewMode === 'grid' ? "bg-white/10 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              Lista
            </button>
            <button 
              onClick={() => setViewMode('calendar')}
              className={cn(
                "flex-1 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                viewMode === 'calendar' ? "bg-white/10 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              Calendário
            </button>
          </div>
        </div>

        {/* Priority Filter */}
        <div className="flex flex-col gap-1.5 flex-[1.4] min-w-[220px]">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic pl-1">Prioridade da Arte</span>
          <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5 font-bold">
            {[
              { value: 'all', label: 'Todas' },
              { value: 'low', label: 'Baixa' },
              { value: 'medium', label: 'Média' },
              { value: 'urgent', label: 'Urgente' }
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => setPriorityFilter(p.value)}
                className={cn(
                  "flex-1 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center cursor-pointer",
                  priorityFilter === p.value
                    ? p.value === 'urgent' ? "bg-rose-500/20 text-rose-400 border border-rose-500/10 shadow-inner" :
                      p.value === 'medium' ? "bg-amber-500/20 text-amber-400 border border-amber-500/10 shadow-inner" :
                      p.value === 'low' ? "bg-blue-500/20 text-blue-400 border border-blue-500/10 shadow-inner" :
                      "bg-white/10 text-white"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex flex-col gap-1.5 flex-[1.2] min-w-[190px]">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic pl-1">Status do Presskit</span>
          <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5 font-bold">
            {[
              { value: 'all', label: 'Todos' },
              { value: 'pending', label: 'Pendentes' },
              { value: 'completed', label: 'Recebidos' }
            ].map((s) => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value as any)}
                className={cn(
                  "flex-1 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center cursor-pointer",
                  statusFilter === s.value
                    ? s.value === 'completed' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/10 shadow-inner" :
                      s.value === 'pending' ? "bg-amber-500/20 text-amber-400 border border-amber-500/10 shadow-inner" :
                      "bg-white/10 text-white"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map(asset => (
            <Card 
              key={asset.id} 
              onClick={() => handleOpenView(asset)}
              className="rounded-[2rem] border-white/5 bg-white/5 backdrop-blur-md shadow-2xl hover:shadow-purple-500/15 hover:bg-white/[0.07] transition-all duration-300 overflow-hidden group border cursor-pointer select-none"
            >
              <div className="bg-white/5 p-6 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center space-x-4 text-white">
                  <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-full flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform shrink-0">
                    <Disc className="w-5 h-5 text-white" />
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
                        const shareUrl = `${window.location.origin}${window.location.pathname}?djShare=${event.id}_${asset.id}`;
                        navigator.clipboard.writeText(shareUrl);
                        toast.success(`Link de preenchimento para ${asset.name} copiado com sucesso!`);
                      }} 
                      className="text-slate-600 hover:text-emerald-400 hover:bg-white/5 rounded-full transition-colors animate-fade-in"
                      title="Copiar Link de Envio para o DJ"
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
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
              <CardContent className="p-6 space-y-5">
                {/* 1 - Link do Presskit & Fotos */}
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Link do Presskit & Fotos
                  </p>
                  {asset.presskitUrl ? (
                    asset.presskitType === 'email' ? (
                      <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-2xl border border-white/10">
                        <div className="flex items-center space-x-3 truncate">
                          <span className="text-xs shrink-0">📨</span>
                          <span className="text-xs font-bold text-slate-200 truncate">E-mail: {asset.presskitUrl}</span>
                        </div>
                        {asset.presskitUrl.includes('@') && (
                          <a 
                            href={`mailto:${asset.presskitUrl}`}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-purple-500/20 hover:bg-purple-500/35 text-purple-300 rounded-lg text-[8px] font-black uppercase tracking-widest h-6 px-2.5 flex items-center transition-colors shrink-0"
                          >
                            Enviar
                          </a>
                        )}
                      </div>
                    ) : (
                      <a 
                        href={asset.presskitUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-between p-3.5 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all group/link"
                      >
                        <div className="flex items-center space-x-3 truncate">
                          <Music className="w-4 h-4 text-pink-400 shrink-0" />
                          <span className="text-xs font-bold text-slate-200 truncate">{asset.presskitUrl}</span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover/link:text-pink-400 transition-colors shrink-0" />
                      </a>
                    )
                  ) : (
                    <div className="p-3.5 bg-rose-500/5 border border-rose-500/10 rounded-2xl flex items-center justify-between">
                      <span className="text-xs text-rose-400/80 font-bold italic">Não fornecido / Pendente</span>
                      <span className="text-[8px] bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest shrink-0">Aguardando DJ</span>
                    </div>
                  )}
                </div>

                {/* 2 - Logos Obrigatórios */}
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                    Logos Obrigatórios (Agências / Gravadoras)
                  </p>
                  {asset.hasMandatoryLogo ? (
                    <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 space-y-3">
                      {/* Agências */}
                      <div>
                        <p className="text-[8px] uppercase font-black tracking-widest text-amber-400/80 mb-1.5">Agência(s):</p>
                        {asset.agencies && asset.agencies.length > 0 ? (
                          <div className="space-y-1">
                            {asset.agencies.map((agency, i) => (
                              <div key={i} className="text-xs flex items-center justify-between font-bold text-slate-200 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-1.5">
                                <span className="truncate">{agency.name || '-'}</span>
                                {agency.link ? (
                                  <a 
                                    href={agency.link} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[10px] text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-0.5 pr-0.5"
                                  >
                                    Logo <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                ) : (
                                  <span className="text-[9px] text-slate-500 italic">Logo no Presskit</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : asset.agencyInfo ? (
                          <p className="text-xs text-slate-300 font-bold bg-white/[0.02] border border-white/5 rounded-xl px-3 py-1.5">{asset.agencyInfo}</p>
                        ) : (
                          <p className="text-xs text-slate-500 italic">Ativo, mas nenhuma agência adicionada</p>
                        )}
                      </div>

                      {/* Gravadoras */}
                      <div>
                        <p className="text-[8px] uppercase font-black tracking-widest text-amber-400/80 mb-1.5">Gravadora(s):</p>
                        {asset.labels && asset.labels.length > 0 && asset.labels.some(l => l.name?.trim()) ? (
                          <div className="space-y-1">
                            {asset.labels.map((label, i) => label.name && (
                              <div key={i} className="text-xs flex items-center justify-between font-bold text-slate-200 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-1.5">
                                <span className="truncate">{label.name}</span>
                                {label.link ? (
                                  <a 
                                    href={label.link} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[10px] text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-0.5 pr-0.5"
                                  >
                                    Logo <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                ) : (
                                  <span className="text-[9px] text-slate-500 italic">Logo no Presskit</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : asset.labelInfo ? (
                          <p className="text-xs text-slate-300 font-bold bg-white/[0.02] border border-white/5 rounded-xl px-3 py-1.5">{asset.labelInfo}</p>
                        ) : (
                          <p className="text-xs text-slate-500 italic">Nenhuma gravadora adicionada</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                      <p className="text-xs text-slate-550 font-bold italic text-slate-500">Nenhum logo obrigatório exigido</p>
                    </div>
                  )}
                </div>

                {/* 3 - Foto Flyer e Vídeo Motion */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Foto p/ Flyer */}
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                      <Image className="w-3.5 h-3.5 text-blue-400" />
                      Foto p/ Flyer
                    </p>
                    {asset.flyerPhoto ? (
                      <div className="bg-white/5 border border-white/10 p-3 rounded-2xl flex flex-col justify-between h-[84px] group/item">
                        <p className="text-xs font-bold text-slate-200 line-clamp-2 leading-relaxed" title={asset.flyerPhoto}>{asset.flyerPhoto}</p>
                        {asset.flyerPhoto.startsWith('http') && (
                          <a 
                            href={asset.flyerPhoto} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 font-bold mt-1 max-w-max"
                          >
                            Acessar link <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl flex items-center justify-center h-[84px] border-dashed">
                        <span className="text-xs text-slate-600 font-bold italic text-center">Pendente / Não enviada</span>
                      </div>
                    )}
                  </div>

                  {/* Vídeo p/ Animação */}
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-teal-400" />
                      Vídeo p/ Motion
                    </p>
                    {asset.animationVideo ? (
                      <div className="bg-white/5 border border-white/10 p-3 rounded-2xl flex flex-col justify-between h-[84px] group/item">
                        <p className="text-xs font-bold text-slate-200 line-clamp-2 leading-relaxed" title={asset.animationVideo}>{asset.animationVideo}</p>
                        {asset.animationVideo.startsWith('http') && (
                          <a 
                            href={asset.animationVideo} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] text-teal-400 hover:text-teal-300 flex items-center gap-0.5 font-bold mt-1 max-w-max"
                          >
                            Acessar link <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl flex items-center justify-center h-[84px] border-dashed">
                        <span className="text-xs text-slate-600 font-bold italic text-center">Pendente / Não enviado</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4 - Trilha de Entrada (Música) */}
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-pink-400" />
                    Música de Entrada (Track)
                  </p>
                  {asset.musicName ? (
                    <div className="p-4 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-[1.5rem] border border-white/5 relative overflow-hidden group/track">
                      <div className="flex items-center justify-between relative z-10">
                        <div className="space-y-1 select-none pr-3 min-w-0">
                          <p className="text-sm font-black text-white truncate max-w-[200px]" title={asset.musicName}>{asset.musicName}</p>
                          <div className="flex items-center space-x-2 text-slate-500">
                            <Clock className="w-3 h-3 text-purple-400 animate-pulse" />
                            <span className="text-[10px] font-black uppercase">{asset.musicDuration || "Duração não definida"}</span>
                          </div>
                        </div>
                        {asset.musicUrl ? (
                          <a 
                            href={asset.musicUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={(e) => e.stopPropagation()}
                            className="hover:scale-110 transition-transform shrink-0"
                            title="Ouvir Música"
                          >
                            <Button size="icon" variant="ghost" className="rounded-full bg-white/10 hover:bg-pink-500 hover:text-white transition-all shadow-lg w-9 h-9">
                              <Music className="w-4 h-4" />
                            </Button>
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic font-bold shrink-0">Sem link</span>
                        )}
                      </div>
                      <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-purple-500/20 rounded-full blur-[20px] transition-all group-hover/track:scale-150 group-hover/track:bg-pink-500/20"></div>
                    </div>
                  ) : (
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl border-dashed py-4 flex flex-col items-center justify-center space-y-1 text-slate-600">
                      <p className="text-xs font-bold italic text-slate-500">Nenhuma trilha fornecida</p>
                      <span className="text-[9px] font-black uppercase text-slate-600">Trilha de entrada livre ou padrão</span>
                    </div>
                  )}
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

          <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
            <div className="grid grid-cols-7 gap-2 min-w-[750px] lg:min-w-0">
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
                        <span className="bg-pink-500 text-[8px] font-black px-1.5 py-0.5 rounded-full text-white uppercase flex items-center justify-center">
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
                          onClick={() => handleOpenView(asset)}
                          className="bg-purple-500/10 border border-purple-500/20 p-2 rounded-xl cursor-grab active:cursor-grabbing hover:bg-purple-500/20 transition-colors group/item text-left"
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
        </div>
      )}
    </div>
  );
}
