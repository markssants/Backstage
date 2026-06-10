import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical, MessageSquare, Clock, Calendar, Palette, MoreHorizontal, User, ChevronLeft, ChevronRight, Music, PartyPopper, Star, AlertTriangle, List, Layout, GanttChart, Pencil, Trash2, Move, ArrowRight, RotateCcw, History, Check, X, Disc, ExternalLink, ShieldAlert, Film, Sparkles, Share2, Paperclip, Image as ImageIcon, Loader2 } from "lucide-react";
import { EventProject, UserProfile, ArtTask, OperationType, PendingChange, DjAsset } from "../../types";
import { collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, deleteDoc, orderBy, setDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../../firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, isThisWeek, addWeeks, subWeeks, addDays, subDays, isSameWeek, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface KanbanBoardProps {
  event: EventProject;
  profile: UserProfile;
  onNavigateToDjAssets?: (djAssetId: string) => void;
  initialSelectedDjId?: string | null;
  onClearInitialSelectedDj?: () => void;
}

type ColumnId = 'todo' | 'production' | 'review' | 'delivered' | 'post' | 'finished';

const COLUMNS: { id: ColumnId; title: string; color: string; textColor: string }[] = [
  { id: 'todo', title: 'Para Fazer', color: 'bg-white', textColor: 'text-white' },
  { id: 'production', title: 'Em Produção', color: 'bg-amber-500', textColor: 'text-amber-500' },
  { id: 'review', title: 'Revisão', color: 'bg-blue-500', textColor: 'text-blue-500' },
  { id: 'delivered', title: 'Entregue', color: 'bg-purple-500', textColor: 'text-purple-500' },
  { id: 'post', title: 'Postar', color: 'bg-pink-500', textColor: 'text-pink-500' },
  { id: 'finished', title: 'Finalizado', color: 'bg-emerald-500', textColor: 'text-emerald-500' },
];

export function KanbanBoard({ event, profile, onNavigateToDjAssets, initialSelectedDjId, onClearInitialSelectedDj }: KanbanBoardProps) {
  const [viewMode, setViewMode] = useState<'kanban' | 'calendar' | 'timeline' | 'list'>(() => {
    const saved = localStorage.getItem('artsViewMode');
    if (saved && (saved === 'kanban' || saved === 'calendar')) {
      return saved as any;
    }
    return 'kanban';
  });

  useEffect(() => {
    if (viewMode === 'kanban' || viewMode === 'calendar') {
      localStorage.setItem('artsViewMode', viewMode);
    }
  }, [viewMode]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarSubView, setCalendarSubView] = useState<'month' | 'week' | 'day'>('month');
  const [arts, setArts] = useState<ArtTask[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'dj' | 'party' | 'branding'>('all');
  const [statusFilter, setStatusFilter] = useState<ColumnId | 'all'>('all');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Form states
  const [newArt, setNewArt] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    category: 'party' as const,
    deadline: '',
    color: '#000000',
    status: 'todo' as ColumnId
  });

  const isMasterDesigner = profile.email === 'beysarts@gmail.com';
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [isValidationDialogOpen, setIsValidationDialogOpen] = useState(false);

  const [selectedArt, setSelectedArt] = useState<ArtTask | null>(null);
  const [editArt, setEditArt] = useState<Partial<ArtTask> | null>(null);

  const [djAssets, setDjAssets] = useState<DjAsset[]>([]);
  const [selectedDjAssetForView, setSelectedDjAssetForView] = useState<DjAsset | null>(null);
  const [isDjViewOpen, setIsDjViewOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'events', event.id, 'dj_assets'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DjAsset));
      setDjAssets(fetched);
    }, (error) => {
      console.error("Erro ao escutar dj_assets em Board:", error);
    });
    return () => unsubscribe();
  }, [event.id]);

  const findConnectedDjAsset = (art: ArtTask): DjAsset | undefined => {
    if (!art) return undefined;
    const sourceId = (art as any).sourceAssetId;
    if (sourceId) {
      const found = djAssets.find(d => d.id === sourceId);
      if (found) return found;
    }
    const title = art.title || '';
    const djNameClean = title.replace(/^Arte DJ:\s*/i, '').trim().toLowerCase();
    if (djNameClean) {
      const foundByName = djAssets.find(d => d.name?.trim().toLowerCase() === djNameClean);
      if (foundByName) return foundByName;

      const foundByPartial = djAssets.find(d => {
        const name = d.name?.trim().toLowerCase() || '';
        return name && (djNameClean.includes(name) || name.includes(djNameClean));
      });
      if (foundByPartial) return foundByPartial;
    }
    return undefined;
  };

  const handleCardClick = (art: ArtTask) => {
    if (art.category === 'dj') {
      const connected = findConnectedDjAsset(art);
      if (connected) {
        setSelectedDjAssetForView(connected);
        setIsDjViewOpen(true);
        return;
      }
    }
    setSelectedArt(art);
  };

  const [isEditingDjAsset, setIsEditingDjAsset] = useState(false);
  const [editDjForm, setEditDjForm] = useState<Partial<DjAsset>>({});

  const handleStartEditDj = () => {
    if (!selectedDjAssetForView) return;
    setEditDjForm({ ...selectedDjAssetForView });
    setIsEditingDjAsset(true);
  };

  const handleSaveDjAsset = async (updatedData: Partial<DjAsset>) => {
    if (!selectedDjAssetForView) return;
    try {
      const assetRef = doc(db, 'events', event.id, 'dj_assets', selectedDjAssetForView.id);
      await updateDoc(assetRef, updatedData);
      toast.success("Informações do DJ atualizadas com sucesso!");
      setIsEditingDjAsset(false);
      setSelectedDjAssetForView(prev => prev ? { ...prev, ...updatedData } : null);
    } catch (error) {
      console.error("Erro ao atualizar DJ asset:", error);
      toast.error("Erro ao salvar as alterações do DJ.");
    }
  };

  const [timelineDetail, setTimelineDetail] = useState<'urgent' | 'medium' | 'low' | 'completed' | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'events', event.id, 'pending_changes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedChanges = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingChange));
      setPendingChanges(fetchedChanges);
    }, (error) => {
      console.error("Erro ao escutar alterações do evento:", error);
    });
    return () => unsubscribe();
  }, [event.id]);

  useEffect(() => {
    if (selectedArt) {
      setEditArt({ ...selectedArt });
      setActiveTab('details');
    } else {
      setEditArt(null);
    }
  }, [selectedArt]);

  useEffect(() => {
    const q = query(collection(db, 'events', event.id, 'arts'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedArts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ArtTask));
      // Sort in memory: position first, then createdAt
      fetchedArts.sort((a, b) => {
        const posA = a.position ?? 0;
        const posB = b.position ?? 0;
        if (posA !== posB) return posA - posB;
        return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
      });
      setArts(fetchedArts);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `events/${event.id}/arts`);
    });
    return () => unsubscribe();
  }, [event.id]);

  useEffect(() => {
    if (initialSelectedDjId && arts.length > 0 && djAssets.length > 0) {
      const djAsset = djAssets.find(d => d.id === initialSelectedDjId);
      if (djAsset) {
        let foundArt = arts.find((art: any) => art.sourceAssetId === initialSelectedDjId);
        
        if (!foundArt) {
          const djNameClean = djAsset.name?.trim().toLowerCase();
          if (djNameClean) {
            foundArt = arts.find(art => {
              const title = art.title || '';
              const artNameClean = title.replace(/^Arte DJ:\s*/i, '').trim().toLowerCase();
              return artNameClean === djNameClean || artNameClean.includes(djNameClean) || djNameClean.includes(artNameClean);
            });
          }
        }
        
        if (foundArt) {
          setSelectedArt(foundArt);
          onClearInitialSelectedDj?.();
        } else {
          toast.info(`Nenhum card de arte correspondente para ${djAsset.name} foi encontrado.`);
          onClearInitialSelectedDj?.();
        }
      }
    }
  }, [initialSelectedDjId, arts, djAssets, onClearInitialSelectedDj]);

  const visibleArts = useMemo(() => {
    // 1. If designer/admin, we only show approved/original database arts.
    // Specifically, any art that isPendingCreate: true is hidden from the board until approved.
    if (profile.role !== 'contractor') {
      return arts.filter(art => !art.isPendingCreate);
    }

    // 2. If contractor, we construct their apparent view:
    // Start with all database arts
    const artsMap = new Map<string, ArtTask>();
    arts.forEach(art => {
      artsMap.set(art.id, { ...art });
    });

    const activeChanges = pendingChanges.filter(c => c.status === 'pending');

    // Apply updates and statuses
    activeChanges.forEach(change => {
      if (change.type === 'update' && change.proposedData) {
        const art = artsMap.get(change.targetId);
        if (art) {
          art.title = change.proposedData.title || art.title;
          art.description = change.proposedData.description || art.description;
          art.priority = change.proposedData.priority || art.priority;
          art.category = change.proposedData.category || art.category;
          art.deadline = change.proposedData.deadline || art.deadline;
        }
      }
      else if (change.type === 'status' && change.proposedData) {
        const art = artsMap.get(change.targetId);
        if (art) {
          art.status = change.proposedData.status || art.status;
          if (change.proposedData.position !== undefined) {
            art.position = change.proposedData.position;
          }
        }
      }
      else if (change.type === 'delete') {
        const art = artsMap.get(change.targetId);
        if (art) {
          art.isPendingDelete = true;
        }
      }
    });

    // Sort or filter the visible arts
    const result = Array.from(artsMap.values());
    
    // Sort so position is respected
    result.sort((a, b) => {
      const posA = a.position ?? 0;
      const posB = b.position ?? 0;
      if (posA !== posB) return posA - posB;
      return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    });

    return result;
  }, [arts, pendingChanges, profile.role]);

  const renderPendingBadge = (art: ArtTask, isMinimal = false) => {
    const activeChanges = pendingChanges.filter(c => c.targetId === art.id && c.status === 'pending');
    if (activeChanges.length === 0 && !art.isPendingCreate && !art.isPendingDelete) return null;

    // Grab the latest one (newest first)
    const activeChange = activeChanges.sort((a, b) => {
      const tA = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
      const tB = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
      return tB - tA; // Newest first
    })[0];

    // Resolve type
    const type = activeChange
      ? activeChange.type
      : art.isPendingDelete
      ? 'delete'
      : 'create';

    // Icons, labels and styles based on type
    let config = {
      colorClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.25)]",
      icon: <Plus className="w-2.5 h-2.5 animate-pulse" />,
      label: "Novo"
    };

    if (type === 'update') {
      config = {
        colorClass: "text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.25)]",
        icon: <Pencil className="w-2.5 h-2.5" />,
        label: "Editado"
      };
    } else if (type === 'status') {
      config = {
        colorClass: "text-purple-400 bg-purple-500/10 border-purple-500/20 shadow-[0_0_8px_rgba(168,85,247,0.25)]",
        icon: <Move className="w-2.5 h-2.5" />,
        label: "Movido"
      };
    } else if (type === 'delete') {
      config = {
        colorClass: "text-rose-400 bg-rose-500/10 border-rose-500/20 shadow-[0_0_8px_rgba(244,63,94,0.25)]",
        icon: <Trash2 className="w-2.5 h-2.5" />,
        label: "Excluindo"
      };
    }

    if (isMinimal) {
      return (
        <div className="flex items-center gap-1 border border-white/5 bg-black/40 rounded-full p-0.5 px-1 tracking-tight backdrop-blur-sm shrink-0">
          <Clock className="w-2.5 h-2.5 text-slate-400 animate-pulse" />
          <span className={cn("p-0.5 rounded-full border flex items-center justify-center", config.colorClass)}>
            {config.icon}
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 border border-white/5 bg-black/40 rounded-full p-1 pl-1.5 pr-2.5 tracking-tight backdrop-blur-sm shrink-0">
        <Clock className="w-3 h-3 text-slate-400 animate-pulse" />
        <span className={cn("p-1 rounded-full border flex items-center justify-center", config.colorClass)}>
          {config.icon}
        </span>
        <span className={cn("text-[9px] font-black uppercase tracking-wider", 
          type === 'create' ? 'text-emerald-400' :
          type === 'update' ? 'text-amber-400' :
          type === 'status' ? 'text-purple-400' :
          'text-rose-400'
        )}>
          {config.label}
        </span>
      </div>
    );
  };

  const handleAddArt = async () => {
    if (!newArt.title.trim()) return;
    setLoading(true);
    const status = newArt.status;
    const path = `events/${event.id}/arts`;
    
    // Calculate new position
    const columnArts = visibleArts.filter(a => a.status === status);
    const maxPosition = columnArts.length > 0 
      ? Math.max(...columnArts.map(a => a.position || 0))
      : 0;

    try {
      await addDoc(collection(db, 'events', event.id, 'arts'), {
        ...newArt,
        eventId: event.id,
        title: newArt.title.trim(),
        description: newArt.description.trim(),
        priority: newArt.priority,
        category: newArt.category,
        deadline: newArt.deadline || null,
        status: status,
        position: maxPosition + 1000, // Large gap for easier reordering if needed
        createdAt: serverTimestamp(),
      });
      setIsAddOpen(false);
      setNewArt({ 
        title: '', 
        description: '', 
        priority: 'medium', 
        category: 'party', 
        deadline: '', 
        color: '#000000',
        status: 'todo'
      });
      toast.success(`Arte adicionada em ${translateStatus(status)}!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      toast.error("Erro ao cadastrar criação de arte");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveArt = async () => {
    if (!editArt || !selectedArt) return;
    setLoading(true);
    const path = `events/${event.id}/arts/${selectedArt.id}`;
    try {
      if (profile.role === 'contractor') {
        // Register the pending change without modifying the live database document
        const pendingChangeData = {
          type: 'update',
          proposedData: {
            title: editArt.title || selectedArt.title,
            description: editArt.description || '',
            priority: editArt.priority || 'medium',
            category: editArt.category || 'dj',
            deadline: editArt.deadline || null,
            status: editArt.status || 'todo'
          },
          originalData: {
            title: selectedArt.title,
            description: selectedArt.description || '',
            priority: selectedArt.priority || 'medium',
            category: selectedArt.category || 'dj',
            deadline: selectedArt.deadline || null,
            status: selectedArt.status || 'todo'
          },
          targetId: selectedArt.id,
          title: `Alteração na Arte "${selectedArt.title}"`,
          contractorName: profile.name || 'Cliente',
          contractorEmail: profile.email,
          status: 'pending',
          createdAt: serverTimestamp()
        };
        await addDoc(collection(db, 'events', event.id, 'pending_changes'), pendingChangeData);
        toast.info("Alteração salva e enviada para aprovação do designer!");
        setSelectedArt(null);
      } else {
        await updateDoc(doc(db, 'events', event.id, 'arts', selectedArt.id), {
          title: editArt.title || selectedArt.title,
          description: editArt.description || '',
          priority: editArt.priority || 'medium',
          category: editArt.category || 'dj',
          deadline: editArt.deadline || null,
          status: editArt.status || 'todo'
        });
        toast.success("Alterações salvas!");
        setSelectedArt(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      toast.error("Erro ao salvar alterações");
    } finally {
      setLoading(false);
    }
  };

  const handleDirectRevert = async (change: PendingChange) => {
    if (!selectedArt || !change.originalData) return;
    setLoading(true);
    const path = `events/${event.id}/arts/${selectedArt.id}`;
    try {
      await updateDoc(doc(db, 'events', event.id, 'arts', selectedArt.id), {
        ...change.originalData,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'events', event.id, 'pending_changes'), {
        type: 'revert',
        targetId: selectedArt.id,
        title: `Reversão direta de Atividade por ${profile.name}`,
        contractorName: profile.name || 'Cliente',
        contractorEmail: profile.email,
        status: 'reverted',
        proposedData: {
          restoreData: change.originalData,
          changeType: change.type,
          historicalChangeId: change.id
        },
        originalData: {
          title: selectedArt.title,
          description: selectedArt.description || '',
          priority: selectedArt.priority || 'medium',
          category: selectedArt.category || 'dj',
          deadline: selectedArt.deadline || null,
          status: selectedArt.status || 'todo'
        },
        createdAt: serverTimestamp()
      });

      toast.success("Atividade revertida com sucesso para a versão antiga!");
      setSelectedArt(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      toast.error("Erro ao reverter atividade.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRevert = async (change: PendingChange) => {
    if (!selectedArt || !change.originalData) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'events', event.id, 'pending_changes'), {
        type: 'revert',
        targetId: selectedArt.id,
        title: `Solicitação de Reversão de Atividade`,
        contractorName: profile.name || 'Cliente',
        contractorEmail: profile.email,
        status: 'pending',
        proposedData: {
          restoreData: change.originalData,
          changeType: change.type,
          historicalChangeId: change.id
        },
        originalData: {
          title: selectedArt.title,
          description: selectedArt.description || '',
          priority: selectedArt.priority || 'medium',
          category: selectedArt.category || 'dj',
          deadline: selectedArt.deadline || null,
          status: selectedArt.status || 'todo'
        },
        createdAt: serverTimestamp()
      });

      toast.success("Solicitação de reversão enviada para aprovação do designer mestre!");
      setSelectedArt(null);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao solicitar reversão para aprovação.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePendingChange = async (change: PendingChange) => {
    setLoading(true);
    try {
      const artDocRef = doc(db, 'events', event.id, 'arts', change.targetId);

      if (change.type === 'create') {
        await setDoc(artDocRef, {
          ...change.proposedData,
          eventId: event.id,
          isPendingCreate: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success(`Nova arte "${change.proposedData?.title || ''}" criada com sucesso!`);
      } 
      else if (change.type === 'update') {
        await updateDoc(artDocRef, {
          ...change.proposedData,
          updatedAt: serverTimestamp()
        });
        toast.success(`Mudanças na arte "${change.proposedData?.title || ''}" aprovadas e aplicadas!`);
      } 
      else if (change.type === 'status') {
        await updateDoc(artDocRef, {
          status: change.proposedData.status,
          position: change.proposedData.position !== undefined ? change.proposedData.position : 1000,
          updatedAt: serverTimestamp()
        });
        toast.success(`Movimentação para "${translateStatus(change.proposedData.status)}" aprovada!`);
      } 
      else if (change.type === 'delete') {
        await deleteDoc(artDocRef);
        toast.success(`Exclusão da arte aprovada com sucesso!`);
      }
      else if (change.type === 'revert') {
        const { restoreData, changeType, historicalChangeId } = change.proposedData;
        
        if (changeType === 'create') {
          await deleteDoc(artDocRef);
          toast.success(`Criação revertida: A arte foi removida.`);
        }
        else if (changeType === 'update') {
          if (!restoreData) {
            toast.error("Sem dados para esta reversão.");
            return;
          }
          await updateDoc(artDocRef, {
            ...restoreData,
            updatedAt: serverTimestamp()
          });
          toast.success(`Alterações revertidas com sucesso!`);
        }
        else if (changeType === 'status') {
          if (!restoreData) {
            toast.error("Sem dados para esta reversão.");
            return;
          }
          await updateDoc(artDocRef, {
            status: restoreData.status,
            position: restoreData.position !== undefined ? restoreData.position : 1000,
            updatedAt: serverTimestamp()
          });
          toast.success(`Posição/Status revertido com sucesso!`);
        }
      }

      // Mark proposal as approved
      const changeDocRef = doc(db, 'events', event.id, 'pending_changes', change.id);
      await updateDoc(changeDocRef, {
        status: 'approved',
        updatedAt: serverTimestamp()
      });

      // Refetch / update selectedArt to match approved data
      if (selectedArt && selectedArt.id === change.targetId) {
        if (change.type === 'delete') {
          setSelectedArt(null);
        } else if (change.type === 'revert' && change.proposedData?.changeType === 'create') {
          setSelectedArt(null);
        } else {
          // Merge local change
          const updatedProposed = change.type === 'revert' ? change.proposedData?.restoreData : change.proposedData;
          setSelectedArt(prev => prev ? { ...prev, ...updatedProposed } : null);
        }
      }

    } catch (err) {
      console.error(err);
      toast.error("Erro ao aprovar a alteração.");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectPendingChange = async (change: PendingChange) => {
    setLoading(true);
    try {
      const changeDocRef = doc(db, 'events', event.id, 'pending_changes', change.id);
      await updateDoc(changeDocRef, {
        status: 'rejected',
        updatedAt: serverTimestamp()
      });

      // Cleanup newly created card from database if its creation was rejected
      if (change.type === 'create' && change.targetId) {
        await deleteDoc(doc(db, 'events', event.id, 'arts', change.targetId));
      }

      toast.info("Alteração rejeitada e arquivada.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao rejeitar a alteração.");
    } finally {
      setLoading(false);
    }
  };

  const updateArtStatus = async (artId: string, newStatus: string) => {
    const path = `events/${event.id}/arts/${artId}`;
    try {
      if (profile.role === 'contractor') {
        const artToMove = visibleArts.find(a => a.id === artId);
        if (artToMove) {
          const pendingChangeData = {
            type: 'status',
            proposedData: {
              status: newStatus
            },
            originalData: {
              status: artToMove.status
            },
            targetId: artId,
            title: `Mudar status de "${artToMove.title}" para ${translateStatus(newStatus)}`,
            contractorName: profile.name || 'Cliente',
            contractorEmail: profile.email,
            status: 'pending',
            createdAt: serverTimestamp()
          };
          await addDoc(collection(db, 'events', event.id, 'pending_changes'), pendingChangeData);
          toast.success("Status de coluna enviado para aprovação do designer!");
        }
      } else {
        await updateDoc(doc(db, 'events', event.id, 'arts', artId), { status: newStatus });
        toast.success("Status atualizado!");
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      toast.error("Erro ao atualizar status");
    }
  };

  const handleDeleteArt = async (artId: string) => {
    if (!confirm("Tem certeza que deseja solicitar a exclusão desta arte?")) return;
    const path = `events/${event.id}/arts/${artId}`;
    try {
      if (profile.role === 'contractor') {
        const artToDelete = visibleArts.find(a => a.id === artId);
        if (artToDelete) {
          const pendingChangeData = {
            type: 'delete',
            proposedData: null,
            originalData: artToDelete ? { title: artToDelete.title } : null,
            targetId: artId,
            title: `Solicitação de Exclusão da Arte "${artToDelete.title}"`,
            contractorName: profile.name || 'Cliente',
            contractorEmail: profile.email,
            status: 'pending',
            createdAt: serverTimestamp()
          };
          await addDoc(collection(db, 'events', event.id, 'pending_changes'), pendingChangeData);
          toast.info("Solicitação de exclusão enviada para aprovação do designer!");
          setSelectedArt(null);
        }
      } else {
        await deleteDoc(doc(db, 'events', event.id, 'arts', artId));
        setSelectedArt(null);
        toast.success("Arte excluída!");
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
      toast.error("Erro ao excluir arte");
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-rose-500';
      case 'medium': return 'bg-amber-500';
      case 'low': return 'bg-emerald-500';
      default: return 'bg-zinc-500';
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

  const translateStatus = (statusId: string) => {
    const col = COLUMNS.find(c => c.id === statusId);
    return col ? col.title : statusId;
  };

  const getStatusColorClasses = (statusId: string) => {
    switch (statusId) {
      case 'todo': return 'bg-white/20 text-white border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.1)]';
      case 'production': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'review': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'delivered': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'post': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
      case 'finished': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-white/5 text-slate-400 border-white/10';
    }
  };

  const getStatusIconColor = (statusId: string) => {
    switch (statusId) {
      case 'todo': return 'text-white';
      case 'production': return 'text-amber-400';
      case 'review': return 'text-blue-400';
      case 'delivered': return 'text-purple-400';
      case 'post': return 'text-pink-400';
      case 'finished': return 'text-emerald-400';
      default: return 'text-blue-400';
    }
  };

  const filteredArts = useMemo(() => {
    return visibleArts.filter(a => {
      const matchesPriority = priorityFilter === 'all' || a.priority === priorityFilter;
      const matchesCategory = categoryFilter === 'all' || a.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
      return matchesPriority && matchesCategory && matchesStatus;
    });
  }, [visibleArts, priorityFilter, categoryFilter, statusFilter]);

  const calendarDays = useMemo(() => {
    if (calendarSubView === 'month') {
      const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
      const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    } else if (calendarSubView === 'week') {
      const start = startOfWeek(currentMonth, { weekStartsOn: 0 });
      const end = endOfWeek(currentMonth, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    } else {
      return [currentMonth];
    }
  }, [currentMonth, calendarSubView]);

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const timelineData = useMemo(() => {
    const grouped = filteredArts.reduce((acc, art) => {
      const date = art.deadline || 'Sem Prazo';
      if (!acc[date]) acc[date] = [];
      acc[date].push(art);
      return acc;
    }, {} as Record<string, ArtTask[]>);

    return Object.entries(grouped).sort(([a], [b]) => {
      if (a === 'Sem Prazo') return 1;
      if (b === 'Sem Prazo') return -1;
      return new Date(a).getTime() - new Date(b).getTime();
    });
  }, [filteredArts]);

  const getArtCategory = (art: ArtTask, now: Date): 'urgent' | 'medium' | 'low' | 'completed' => {
    if (['finished', 'delivered'].includes(art.status)) {
      return 'completed';
    }

    if (!art.deadline) {
      return 'low';
    }

    let parsedDate: Date;
    try {
      parsedDate = parseISO(art.deadline);
    } catch {
      return 'low';
    }

    const endOfCurrentWeek = endOfWeek(now, { weekStartsOn: 0 }).getTime();
    const endOfNextWeek = endOfWeek(addWeeks(now, 1), { weekStartsOn: 0 }).getTime();

    const isThisWeekOrOverdue = parsedDate.getTime() <= endOfCurrentWeek;
    const isNextWeek = parsedDate.getTime() > endOfCurrentWeek && parsedDate.getTime() <= endOfNextWeek;

    // 1. High priority tasks due this week or overdue are URGENT
    if (art.priority === 'high' && isThisWeekOrOverdue) {
      return 'urgent';
    }

    // 2. Medium priority tasks due this week/overdue OR next week, and
    //    High priority tasks due next week are MEDIUM
    if (
      (art.priority === 'medium' && isThisWeekOrOverdue) ||
      (art.priority === 'high' && isNextWeek) ||
      (art.priority === 'medium' && isNextWeek)
    ) {
      return 'medium';
    }

    // 3. Simple/low priority or distant deadlines default to LOW
    return 'low';
  };

  const summaryStats = useMemo(() => {
    const now = new Date();
    
    let urgent = 0;
    let medium = 0;
    let low = 0;
    let completed = 0;

    filteredArts.forEach(art => {
      const category = getArtCategory(art, now);
      if (category === 'urgent') urgent++;
      else if (category === 'medium') medium++;
      else if (category === 'low') low++;
      else if (category === 'completed') completed++;
    });

    return { urgent, medium, low, completed };
  }, [filteredArts]);

  const timelineDetailArts = useMemo(() => {
    if (!timelineDetail) return [];
    const now = new Date();
    return filteredArts.filter(art => getArtCategory(art, now) === timelineDetail);
  }, [timelineDetail, filteredArts]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 350;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Handle Calendar Date Drop
    if (destination.droppableId.startsWith('date:')) {
      const newDate = destination.droppableId.replace('date:', '');
      const path = `events/${event.id}/arts/${draggableId}`;
      try {
        if (profile.role === 'contractor') {
          const artToMove = visibleArts.find(a => a.id === draggableId);
          if (artToMove) {
            const pendingChangeData = {
              type: 'update',
              proposedData: {
                title: artToMove.title,
                description: artToMove.description || '',
                priority: artToMove.priority || 'medium',
                category: artToMove.category || 'dj',
                deadline: newDate,
                status: artToMove.status || 'todo'
              },
              originalData: {
                title: artToMove.title,
                description: artToMove.description || '',
                priority: artToMove.priority || 'medium',
                category: artToMove.category || 'dj',
                deadline: artToMove.deadline || null,
                status: artToMove.status || 'todo'
              },
              targetId: draggableId,
              title: `Definir prazo de "${artToMove.title}" para ${format(parseISO(newDate), "dd/MM")}`,
              contractorName: profile.name || 'Cliente',
              contractorEmail: profile.email,
              status: 'pending',
              createdAt: serverTimestamp()
            };
            await addDoc(collection(db, 'events', event.id, 'pending_changes'), pendingChangeData);
            toast.success(`Prazo proposto para ${format(parseISO(newDate), "dd/MM")} (aguardando aprovação)`);
          }
        } else {
          await updateDoc(doc(db, 'events', event.id, 'arts', draggableId), {
            deadline: newDate
          });
          toast.success(`Prazo alterado para ${format(parseISO(newDate), "dd/MM")}`);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
        toast.error("Erro ao atualizar data");
      }
      return;
    }

    const sourceStatus = source.droppableId;
    const destStatus = destination.droppableId;
    const destIndex = destination.index;

    // Get all items in the destination column (excluding the one being moved if it's already there)
    const columnArts = visibleArts
      .filter(a => a.status === destStatus)
      .filter(a => a.id !== draggableId)
      .sort((a, b) => {
        const posA = a.position ?? 0;
        const posB = b.position ?? 0;
        if (posA !== posB) return posA - posB;
        return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
      });

    let newPosition: number;

    if (columnArts.length === 0) {
      // Empty column
      newPosition = 1000;
    } else if (destIndex === 0) {
      // Move to top
      newPosition = (columnArts[0].position ?? 0) - 1000;
    } else if (destIndex >= columnArts.length) {
      // Move to bottom
      newPosition = (columnArts[columnArts.length - 1].position ?? 0) + 1000;
    } else {
      // Move between two items
      const prevPos = columnArts[destIndex - 1].position ?? 0;
      const nextPos = columnArts[destIndex].position ?? 0;
      
      if (prevPos === nextPos) {
        newPosition = prevPos + 0.5;
      } else {
        newPosition = (prevPos + nextPos) / 2;
      }
    }

    const path = `events/${event.id}/arts/${draggableId}`;
    try {
      if (profile.role === 'contractor') {
        const artToMove = visibleArts.find(a => a.id === draggableId);
        if (artToMove && artToMove.status !== destStatus) {
          const pendingChangeData = {
            type: 'status',
            proposedData: {
              status: destStatus,
              position: newPosition
            },
            originalData: {
              status: artToMove.status,
              position: artToMove.position ?? 0
            },
            targetId: draggableId,
            title: `Mover "${artToMove.title}" para ${translateStatus(destStatus)}`,
            contractorName: profile.name || 'Cliente',
            contractorEmail: profile.email,
            status: 'pending',
            createdAt: serverTimestamp()
          };
          await addDoc(collection(db, 'events', event.id, 'pending_changes'), pendingChangeData);
          toast.success("Movimentação de coluna enviada para aprovação do designer!");
        }
      } else {
        await updateDoc(doc(db, 'events', event.id, 'arts', draggableId), {
          status: destStatus,
          position: newPosition
        });
        // No toast here to keep it smooth
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      toast.error("Erro ao reordenar arte");
    }
  };

  return (
    <div className="space-y-8 p-6">
      <DragDropContext onDragEnd={onDragEnd}>
        {/* View Switcher Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-black/40 p-2 rounded-[1.5rem] sm:rounded-[2rem] border border-white/5">
        <div className="flex items-center justify-center gap-1 p-1 bg-white/5 rounded-2xl border border-white/5 overflow-x-auto w-full sm:w-auto shrink-0">
          <button 
            onClick={() => setViewMode('kanban')}
            className={cn(
              "flex items-center justify-center w-10 h-10 sm:w-auto sm:h-10 p-0 sm:px-6 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all shrink-0 sm:gap-2",
              viewMode === 'kanban' ? "bg-white/10 text-white shadow-xl" : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]"
            )}
          >
            <Layout className="w-5 h-5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Quadro</span>
          </button>
          <button 
            onClick={() => setViewMode('calendar')}
            className={cn(
              "flex items-center justify-center w-10 h-10 sm:w-auto sm:h-10 p-0 sm:px-6 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all shrink-0 sm:gap-2",
              viewMode === 'calendar' ? "bg-white/10 text-white shadow-xl" : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]"
            )}
          >
            <Calendar className="w-5 h-5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Calendário</span>
          </button>
          <button 
            onClick={() => setViewMode('timeline')}
            className={cn(
              "flex items-center justify-center w-10 h-10 sm:w-auto sm:h-10 p-0 sm:px-6 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all shrink-0 sm:gap-2",
              viewMode === 'timeline' ? "bg-white/10 text-white shadow-xl" : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]"
            )}
          >
            <GanttChart className="w-5 h-5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Timeline</span>
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={cn(
              "flex items-center justify-center w-10 h-10 sm:w-auto sm:h-10 p-0 sm:px-6 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all shrink-0 sm:gap-2",
              viewMode === 'list' ? "bg-white/10 text-white shadow-xl" : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]"
            )}
          >
            <List className="w-5 h-5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Lista</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 p-1 sm:p-0 bg-white/5 sm:bg-transparent rounded-2xl sm:rounded-none border border-white/5 sm:border-none w-full sm:w-auto shrink-0">
          <Badge variant="outline" className="bg-transparent border-none sm:bg-white/5 sm:border-white/10 text-slate-400 font-bold uppercase tracking-widest text-[9px] rounded-xl sm:rounded-full px-3 sm:px-4 h-10 flex items-center shrink-0">
            {visibleArts.length} Artes no Total
          </Badge>
          <Button 
            onClick={() => {
              setNewArt(prev => ({ ...prev, status: 'todo' }));
              setIsAddOpen(true);
            }}
            className="md:hidden bg-gradient-to-tr from-purple-500 to-pink-500 text-white hover:opacity-90 rounded-xl h-10 px-3.5 flex items-center justify-center gap-1 shadow-[0_0_15px_rgba(236,72,153,0.3)] border-none font-black transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-wider">Nova Tarefa</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 bg-white/[0.02] p-6 rounded-[2.5rem] border border-white/5 shadow-inner">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-1">
            <Palette className="w-3.5 h-3.5 text-pink-500" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Filtrar por Categoria</h2>
          </div>
          <div className="grid grid-cols-3 gap-1.5 w-full sm:flex sm:items-center sm:gap-2.5 sm:w-auto">
            <Button 
              variant={categoryFilter === 'dj' ? "secondary" : "outline"}
              onClick={() => setCategoryFilter(categoryFilter === 'dj' ? 'all' : 'dj')}
              className={cn(
                "rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-normal sm:tracking-widest h-9 px-1 sm:px-4 transition-all text-center flex items-center justify-center",
                categoryFilter === 'dj' ? "bg-purple-500/20 text-purple-400 border-purple-500/40" : "bg-white/5 border-white/5 text-slate-500 hover:bg-purple-500/10"
              )}
            >
              🎧 DJs
            </Button>
            <Button 
              variant={categoryFilter === 'party' ? "secondary" : "outline"}
              onClick={() => setCategoryFilter(categoryFilter === 'party' ? 'all' : 'party')}
              className={cn(
                "rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-normal sm:tracking-widest h-9 px-1 sm:px-4 transition-all text-center flex items-center justify-center",
                categoryFilter === 'party' ? "bg-blue-500/20 text-blue-400 border-blue-500/40" : "bg-white/5 border-white/5 text-slate-500 hover:bg-blue-500/10"
              )}
            >
              🎪 Festa
            </Button>
            <Button 
              variant={categoryFilter === 'branding' ? "secondary" : "outline"}
              onClick={() => setCategoryFilter(categoryFilter === 'branding' ? 'all' : 'branding')}
              className={cn(
                "rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-normal sm:tracking-widest h-9 px-1 sm:px-4 transition-all text-center flex items-center justify-center",
                categoryFilter === 'branding' ? "bg-amber-500/20 text-amber-400 border-amber-500/40" : "bg-white/5 border-white/5 text-slate-500 hover:bg-amber-500/10"
              )}
            >
              ⭐ Branding
            </Button>
          </div>
        </div>

        {(viewMode === 'calendar' || viewMode === 'list') && (
          <div className="flex flex-col items-center sm:items-start gap-4 w-full sm:w-auto">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1 w-full sm:w-auto">
              <Layout className="w-3.5 h-3.5 text-blue-500" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Filtrar por Status</h2>
            </div>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[180px] rounded-xl bg-white/5 border-white/5 text-[10px] font-black uppercase tracking-widest h-9 px-4 text-slate-300 focus:ring-pink-500">
                <SelectValue placeholder="Todos os Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-slate-900 border-white/10 text-white">
                <SelectItem value="all" className="text-[10px] uppercase font-black tracking-widest">Todos os Status</SelectItem>
                {COLUMNS.map(col => (
                  <SelectItem key={col.id} value={col.id} className="text-[10px] uppercase font-black tracking-widest">
                    {col.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-end gap-6 lg:items-center">
          <div className="flex flex-col gap-2 w-full sm:w-auto md:items-end md:ml-auto">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 text-center sm:text-right">Prioridade</span>
            <div className="grid grid-cols-3 gap-1 w-full bg-black/40 p-1 rounded-xl border border-white/5 sm:flex sm:items-center sm:w-auto">
              <button 
                onClick={() => setPriorityFilter(priorityFilter === 'high' ? 'all' : 'high')}
                className={cn(
                  "flex items-center justify-center gap-1 sm:gap-1.5 px-1 py-2 sm:px-4 rounded-lg transition-all text-[9px] sm:text-[10px] font-black uppercase tracking-normal sm:tracking-tighter w-full sm:w-auto shrink-0",
                  priorityFilter === 'high' ? "bg-red-500/20 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.1)]" : "text-slate-700 hover:text-red-400/50"
                )}
              >
                <span className="text-[10px] sm:text-[12px]">🔴</span>
                <span>Urgente</span>
              </button>
              <button 
                onClick={() => setPriorityFilter(priorityFilter === 'medium' ? 'all' : 'medium')}
                className={cn(
                  "flex items-center justify-center gap-1 sm:gap-1.5 px-1 py-2 sm:px-4 rounded-lg transition-all text-[9px] sm:text-[10px] font-black uppercase tracking-normal sm:tracking-tighter w-full sm:w-auto shrink-0",
                  priorityFilter === 'medium' ? "bg-amber-500/20 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.1)]" : "text-slate-700 hover:text-amber-400/50"
                )}
              >
                <span className="text-[10px] sm:text-[12px]">🟡</span>
                <span>Média</span>
              </button>
              <button 
                onClick={() => setPriorityFilter(priorityFilter === 'low' ? 'all' : 'low')}
                className={cn(
                  "flex items-center justify-center gap-1 sm:gap-1.5 px-1 py-2 sm:px-4 rounded-lg transition-all text-[9px] sm:text-[10px] font-black uppercase tracking-normal sm:tracking-tighter w-full sm:w-auto shrink-0",
                  priorityFilter === 'low' ? "bg-emerald-500/20 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.1)]" : "text-slate-700 hover:text-emerald-400/50"
                )}
              >
                <span className="text-[10px] sm:text-[12px]">🟢</span>
                <span>Baixa</span>
              </button>
            </div>
          </div>

          <div className="h-10 w-[1px] bg-white/5 hidden lg:block mx-2" />

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger render={
              <Button 
                onClick={() => setNewArt(prev => ({ ...prev, status: 'todo' }))}
                className="hidden md:flex bg-gradient-to-tr from-purple-500 to-pink-500 text-white hover:opacity-90 rounded-2xl w-12 h-12 items-center justify-center p-0 shadow-[0_0_15px_rgba(236,72,153,0.3)] border-none font-black transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="w-5 h-5" />
              </Button>
            } />
            <DialogContent className="rounded-3xl sm:max-w-[500px] glass border-white/10 text-slate-100">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-white tracking-tight">Nova Solicitação de Arte</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Título da Arte</Label>
                  <Input 
                    placeholder="Ex: Lineup Completo" 
                    value={newArt.title} 
                    onChange={e => setNewArt({...newArt, title: e.target.value})}
                    className="rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-12 focus:ring-pink-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Status Inicial</Label>
                  <Select onValueChange={(v: any) => setNewArt({...newArt, status: v})} value={newArt.status}>
                    <SelectTrigger className="rounded-2xl bg-white/5 border-white/10 text-white h-12 capitalize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl bg-slate-900 border-white/10 text-white">
                      {COLUMNS.map(col => (
                        <SelectItem key={col.id} value={col.id} className="capitalize">{col.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Prioridade</Label>
                  <Select onValueChange={(v: any) => setNewArt({...newArt, priority: v})} value={newArt.priority}>
                    <SelectTrigger className="rounded-2xl bg-white/5 border-white/10 text-white h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl bg-slate-900 border-white/10 text-white">
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Categoria</Label>
                  <Select onValueChange={(v: any) => setNewArt({...newArt, category: v})} value={newArt.category}>
                    <SelectTrigger className="rounded-2xl bg-white/5 border-white/10 text-white h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl bg-slate-900 border-white/10 text-white">
                      <SelectItem value="dj">DJ</SelectItem>
                      <SelectItem value="party">Festa</SelectItem>
                      <SelectItem value="branding">Branding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Prazo (Opcional)</Label>
                <Input 
                  type="date" 
                  value={newArt.deadline} 
                  onChange={e => setNewArt({...newArt, deadline: e.target.value})}
                  className="rounded-2xl bg-white/5 border-white/10 text-white h-12"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Descrição / Referências</Label>
                <Textarea 
                  placeholder="Instruções para o designer..." 
                  value={newArt.description} 
                  onChange={e => setNewArt({...newArt, description: e.target.value})}
                  className="rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-24 focus:ring-pink-500"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddArt} disabled={loading} className="w-full bg-pink-500 hover:bg-pink-600 rounded-2xl h-14 font-black shadow-[0_0_20px_rgba(236,72,153,0.3)]">
                {loading ? "Cadastrando..." : "Adicionar ao Quadro"}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {viewMode === 'kanban' && (
      <div className="relative group/scroll">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 pointer-events-none">
          <Button
            variant="outline"
            size="icon"
            onClick={() => scroll('left')}
            className="w-12 h-12 rounded-full glass border-white/20 text-white shadow-2xl hover:scale-110 active:scale-90 pointer-events-auto bg-black/40 backdrop-blur-md"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </div>
        
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 pointer-events-none">
          <Button
            variant="outline"
            size="icon"
            onClick={() => scroll('right')}
            className="w-12 h-12 rounded-full glass border-white/20 text-white shadow-2xl hover:scale-110 active:scale-90 pointer-events-auto bg-black/40 backdrop-blur-md"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>

        <div 
          ref={scrollContainerRef}
          className="flex overflow-x-auto pb-8 gap-6 min-h-[600px] custom-scrollbar snap-x px-2"
        >
          {COLUMNS.map(column => (
          <div key={column.id} className="flex flex-col space-y-3 rounded-3xl bg-white/5 p-4 border border-white/5 backdrop-blur-md w-[280px] shrink-0 shadow-2xl snap-center">
            <div className="flex items-center justify-between px-1 mb-6">
              <div className="flex items-center space-x-3">
                <div className={cn("w-2 h-2 rounded-full shadow-[0_0_10px_currentColor]", column.color)} />
                <h3 className={cn("font-black uppercase text-[10px] tracking-[0.2em]", column.textColor)}>{column.title}</h3>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-white/5 border-white/10 text-slate-400 text-[9px] rounded-full px-2 py-0.5 h-4 flex items-center">
                  {filteredArts.filter(a => a.status === column.id).length}
                </Badge>
                <button 
                  onClick={() => {
                    setNewArt(prev => ({ ...prev, status: column.id }));
                    setIsAddOpen(true);
                  }}
                  className="w-5 h-5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all active:scale-90"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <Droppable droppableId={column.id}>
                {(provided) => (
                  <div 
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="flex-1 flex flex-col space-y-3 min-h-[450px] pb-32"
                  >
                    <AnimatePresence mode="popLayout">
                      {filteredArts.filter(a => a.status === column.id).map((art, index) => {
                        const activeChange = pendingChanges.find(c => c.targetId === art.id && c.status === 'pending');
                        return (
                          <Draggable key={art.id} draggableId={art.id} index={index}>
                            {(provided, snapshot) => {
                              const child = (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  style={{
                                    ...provided.draggableProps.style,
                                    cursor: snapshot.isDragging ? 'grabbing' : 'pointer'
                                  }}
                                  className={cn(
                                    "relative",
                                    snapshot.isDragging && "z-[9999]"
                                  )}
                                >
                                  <motion.div
                                    key={art.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ 
                                      opacity: 1, 
                                      scale: snapshot.isDragging ? 1.05 : 1, 
                                      y: 0,
                                      rotate: snapshot.isDragging ? 2 : 0,
                                    }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ 
                                      type: "spring", 
                                      damping: 25, 
                                      stiffness: 350
                                    }}
                                  >
                                    <Card 
                                      onClick={() => !snapshot.isDragging && handleCardClick(art)}
                                      className={cn(
                                        "rounded-xl border-white/5 shadow-2xl hover:bg-white/10 transition-all duration-300 group relative overflow-hidden backdrop-blur-md cursor-pointer",
                                        snapshot.isDragging ? "bg-slate-800 border-white/20" : "bg-slate-900/60 border",
                                        art.isPendingDelete && "opacity-50 border-rose-500/30"
                                      )}
                                    >
                                      <div className={`absolute top-0 left-0 w-1 h-full shadow-[2px_0_15px_rgba(255,255,255,0.05)] ${getPriorityColor(art.priority)}`} />
                                      {(() => {
                                        const activeChange = pendingChanges.find(c => c.targetId === art.id && c.status === 'pending');
                                        const hasBadge = !!activeChange || art.isPendingCreate || art.isPendingDelete;
                                        return (
                                          <CardContent className={cn("p-2.5 space-y-2", hasBadge && "pt-1.5")}>
                                            {hasBadge ? (
                                              <div className="flex justify-between items-center mb-3 relative z-10 px-1.5 pt-0">
                                                <div>
                                                  {renderPendingBadge(art)}
                                                </div>
                                                <span className="text-sm filter drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                                                  {art.category === 'dj' && '🎧'}
                                                  {art.category === 'party' && '🎪'}
                                                  {art.category === 'branding' && '⭐️'}
                                                </span>
                                              </div>
                                            ) : (
                                              <div className="flex justify-end items-start -mb-4 relative z-10 pr-1.5">
                                                <span className="text-sm filter drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                                                  {art.category === 'dj' && '🎧'}
                                                  {art.category === 'party' && '🎪'}
                                                  {art.category === 'branding' && '⭐️'}
                                                </span>
                                              </div>
                                            )}

                                        <div className="space-y-0.5 pl-1.5">
                                          <h4 className="font-black text-white text-[12px] leading-tight group-hover:text-pink-300 transition-colors tracking-tight pr-6">{art.title}</h4>
                                          {art.description && (
                                            <p className="text-[9px] text-slate-400 line-clamp-2 italic font-medium leading-[1.4] opacity-70 group-hover:opacity-100 transition-opacity">
                                              {art.description}
                                            </p>
                                          )}
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-white/5 px-1.5">
                                          <div className="flex items-center space-x-2 text-slate-500">
                                            {art.priority === 'high' && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                                            {art.priority === 'medium' && <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />}
                                            {art.priority === 'low' && <Clock className="w-3.5 h-3.5 text-emerald-400" />}
                                            <span className="text-[10px] font-black uppercase tracking-[0.1em]">{translatePriority(art.priority)}</span>
                                          </div>
                                          {art.deadline ? (
                                            <div className="flex items-center space-x-1 text-slate-400">
                                              <Calendar className="w-2.5 h-2.5 text-blue-400" />
                                              <span className="text-[8px] font-black tracking-tighter">
                                                {format(parseISO(art.deadline), "dd/MM", { locale: ptBR })}
                                              </span>
                                            </div>
                                          ) : (
                                            <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest border border-white/5 px-2 py-0.5 rounded-full bg-white/[0.02]">
                                              S/ Prazo
                                            </span>
                                          )}
                                        </div>
                                      </CardContent>
                                    );
                                  })()}
                                </Card>
                                  </motion.div>
                                </div>
                              );

                            if (snapshot.isDragging) {
                              return createPortal(child, document.body);
                            }
                            return child;
                          }}
                        </Draggable>
                      );
                    })}
                    </AnimatePresence>
                    {provided.placeholder}
                    {filteredArts.filter(a => a.status === column.id).length === 0 && (
                      <div className="h-32 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-slate-700/50 text-[9px] font-black uppercase tracking-widest bg-white/[0.01]">
                        <Palette className="w-6 h-6 mb-2 opacity-20" />
                        Sem Tarefas
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          </div>
        ))}
        </div>
      </div>
      )}

      {viewMode === 'list' && (
        <div className="space-y-4">
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-4 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 pb-2 border-b border-white/5">
            <span>Título / Descrição</span>
            <span className="text-center">Status</span>
            <span className="text-center">Categoria</span>
            <span className="text-center">Prioridade</span>
            <span className="text-center">Prazo</span>
            <span className="text-right">Ações</span>
          </div>
          <div className="space-y-2">
            {filteredArts.length > 0 ? (
              filteredArts.map(art => (
                <motion.div
                  key={art.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "group relative bg-white/[0.02] hover:bg-white/5 border border-white/5 rounded-2xl p-4 md:p-6 transition-all hover:scale-[1.01] hover:shadow-2xl overflow-hidden cursor-pointer",
                    art.isPendingDelete && "opacity-50 border-rose-500/30"
                  )}
                  onClick={() => handleCardClick(art)}
                >
                  <div className={`absolute top-0 left-0 w-1.5 h-full ${getPriorityColor(art.priority)}`} />
                  
                  {/* Desktop View */}
                  <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-4 items-center">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-white group-hover:text-pink-400 transition-all italic">{art.title}</h4>
                        {renderPendingBadge(art)}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 italic">{art.description || 'Sem descrição'}</p>
                    </div>
                    <div className="flex justify-center">
                      <Badge className={cn("text-[9px] font-black uppercase tracking-widest rounded-full px-3 py-1", getStatusColorClasses(art.status))}>
                        {translateStatus(art.status)}
                      </Badge>
                    </div>
                    <div className="flex justify-center gap-2 items-center text-[10px] font-bold text-slate-400 uppercase tracking-tighter bg-white/5 px-3 py-1 rounded-full border border-white/5">
                      {art.category === 'dj' && '🎧'}
                      {art.category === 'party' && '🎪'}
                      {art.category === 'branding' && '⭐️'}
                      <span>{translateCategory(art.category)}</span>
                    </div>
                    <div className="flex justify-center">
                      <div className={cn("text-[9px] font-black uppercase tracking-widest h-6 px-3 rounded-full flex items-center", getPriorityColor(art.priority) + "/10 " + getPriorityColor(art.priority).replace('bg-', 'text-'))}>
                        {translatePriority(art.priority)}
                      </div>
                    </div>
                    <div className="flex justify-center items-center gap-2 text-[10px] font-black text-slate-300 bg-black/20 px-3 py-1 rounded-full border border-white/5">
                      <Calendar className="w-3 h-3 text-blue-400" />
                      {art.deadline ? format(parseISO(art.deadline), "dd/MM/yyyy") : 'S/ Prazo'}
                    </div>
                    <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-pink-500 hover:text-white">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Mobile View */}
                  <div className="flex flex-col gap-3 md:hidden">
                    {/* Top: Category (left), Priority (right) */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-tighter bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                        {art.category === 'dj' && '🎧'}
                        {art.category === 'party' && '🎪'}
                        {art.category === 'branding' && '⭐️'}
                        <span>{translateCategory(art.category)}</span>
                      </div>
                      <div className={cn("text-[9px] font-black uppercase tracking-widest h-6 px-2.5 rounded-full flex items-center", getPriorityColor(art.priority) + "/10 " + getPriorityColor(art.priority).replace('bg-', 'text-'))}>
                        {translatePriority(art.priority)}
                      </div>
                    </div>

                    {/* Middle: Title & optional Description */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h4 className="text-xs font-black text-white group-hover:text-pink-400 transition-all italic">{art.title}</h4>
                        {renderPendingBadge(art)}
                      </div>
                      {art.description && (
                        <p className="text-[10px] text-slate-500 line-clamp-1 italic font-medium">{art.description}</p>
                      )}
                    </div>

                    {/* Bottom: Status (left), Date (right) */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.03]">
                      <Badge className={cn("text-[8px] font-black uppercase tracking-widest rounded-full px-2 py-0.5", getStatusColorClasses(art.status))}>
                        {translateStatus(art.status)}
                      </Badge>
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-300 bg-black/20 px-2.5 py-1 rounded-full border border-white/5">
                        <Calendar className="w-2.5 h-2.5 text-blue-400" />
                        <span>{art.deadline ? format(parseISO(art.deadline), "dd/MM") : 'S/ Prazo'}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center p-20 bg-white/[0.01] rounded-3xl border border-dashed border-white/5">
                <Palette className="w-12 h-12 text-slate-800 mb-4" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Nenhuma arte encontrada com os filtros selecionados</span>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'calendar' && (
        <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-4 sm:p-8 space-y-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-2">
            <div className="flex flex-col text-center lg:text-left">
              <h3 className="text-xl sm:text-2xl font-black text-white uppercase italic tracking-tighter">
                {calendarSubView === 'month' && format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                {calendarSubView === 'week' && (
                  `${format(startOfWeek(currentMonth, { weekStartsOn: 0 }), 'dd/MM')} - ${format(endOfWeek(currentMonth, { weekStartsOn: 0 }), 'dd/MM')} (${format(currentMonth, 'MMMM yyyy', { locale: ptBR })})`
                )}
                {calendarSubView === 'day' && format(currentMonth, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </h3>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.2em] mt-1">
                ENTREGAS E PRAZOS
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full lg:w-auto">
              <div className="flex items-center gap-0.5 p-1 bg-white/5 rounded-2xl border border-white/5 w-full sm:w-auto justify-center">
                <button
                  type="button"
                  onClick={() => setCalendarSubView('month')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all w-full sm:w-auto text-center",
                    calendarSubView === 'month' ? "bg-pink-500 text-white shadow-lg shadow-pink-500/20" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  Mês
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarSubView('week')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all w-full sm:w-auto text-center",
                    calendarSubView === 'week' ? "bg-pink-500 text-white shadow-lg shadow-pink-500/20" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  Semana
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarSubView('day')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all w-full sm:w-auto text-center",
                    calendarSubView === 'day' ? "bg-pink-500 text-white shadow-lg shadow-pink-500/20" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  Dia
                </button>
              </div>

              <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-2xl border border-white/5 w-full sm:w-auto justify-center">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    if (calendarSubView === 'month') {
                      setCurrentMonth(subMonths(currentMonth, 1));
                    } else if (calendarSubView === 'week') {
                      setCurrentMonth(subWeeks(currentMonth, 1));
                    } else {
                      setCurrentMonth(subDays(currentMonth, 1));
                    }
                  }}
                  className="w-10 h-10 rounded-xl hover:bg-white/10 text-white shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setCurrentMonth(new Date())}
                  className="text-[9px] font-black uppercase tracking-widest px-4 h-10 hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  Hoje
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    if (calendarSubView === 'month') {
                      setCurrentMonth(addMonths(currentMonth, 1));
                    } else if (calendarSubView === 'week') {
                      setCurrentMonth(addWeeks(currentMonth, 1));
                    } else {
                      setCurrentMonth(addDays(currentMonth, 1));
                    }
                  }}
                  className="w-10 h-10 rounded-xl hover:bg-white/10 text-white shrink-0"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          {calendarSubView === 'day' ? (
            <div className="space-y-4 max-w-2xl mx-auto py-4">
              {(() => {
                const dateString = format(currentMonth, "yyyy-MM-dd");
                const dayTasks = filteredArts.filter(art => art.deadline === dateString);
                return dayTasks.length === 0 ? (
                  <div className="text-center py-12 bg-white/[0.01] border border-white/5 rounded-3xl p-6">
                    <p className="text-slate-500 font-bold text-sm">Nenhuma arte ou entrega agendada para este dia.</p>
                    <Button 
                      onClick={() => {
                        setNewArt(prev => ({ ...prev, status: 'todo', deadline: dateString }));
                        setIsAddOpen(true);
                      }}
                      className="mt-4 bg-gradient-to-tr from-purple-500 to-pink-500 text-white rounded-xl text-xs font-black uppercase tracking-widest px-4 py-2"
                    >
                      <Plus className="w-4 h-4 mr-1 inline-block" /> Agendar Nova Arte
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {dayTasks.map((task) => (
                      <div 
                        key={task.id}
                        onClick={() => handleCardClick(task)}
                        className={cn(
                          "p-5 rounded-2xl border bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all cursor-pointer flex items-center justify-between gap-4"
                        )}
                      >
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full",
                              task.priority === 'high' ? "bg-red-500/10 text-red-400" :
                              task.priority === 'medium' ? "bg-amber-500/10 text-amber-400" :
                              "bg-emerald-500/10 text-emerald-400"
                            )}>
                              {task.priority === 'high' ? "Urgente" : task.priority === 'medium' ? "Média" : "Baixa"}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">
                              {task.category === 'dj' ? 'DJ' : task.category === 'party' ? 'Festa' : 'Branding'}
                            </span>
                          </div>
                          <h5 className="text-sm font-black text-white tracking-tight truncate">{task.title}</h5>
                          {task.description && (
                            <p className="text-xs text-slate-400 line-clamp-2 font-medium">{task.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border border-white/5 bg-black/20",
                            task.status === 'finished' || task.status === 'delivered' ? "text-emerald-400" : "text-pink-400"
                          )}>
                            {task.status === 'todo' ? 'A Fazer' :
                             task.status === 'production' ? 'Produção' :
                             task.status === 'review' ? 'Revisão' :
                             task.status === 'delivered' ? 'Entregue' :
                             task.status === 'post' ? 'Postado' : 'Finalizado'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
              <div className="grid grid-cols-7 gap-2 min-w-[750px] lg:min-w-0">
                {weekDays.map(day => (
                  <div key={day} className="text-center py-4 text-[10px] font-black uppercase tracking-widest text-slate-600">
                    {day}
                  </div>
                ))}
                {calendarDays.map((day, idx) => {
                  const dateString = format(day, "yyyy-MM-dd");
                  const dayTasks = filteredArts.filter(art => 
                    art.deadline === dateString
                  );
                  const isCurrentMonth = calendarSubView === 'week' || isSameMonth(day, currentMonth);
                  const isTodayDay = isToday(day);

                  return (
                    <Droppable droppableId={`date:${dateString}`} key={idx} isDropDisabled={!isCurrentMonth}>
                      {(provided, snapshot) => (
                        <div 
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            "p-3 rounded-2xl border transition-all flex flex-col gap-2 relative group min-w-[80px] sm:min-w-0",
                            calendarSubView === 'week' ? "min-h-[200px] md:min-h-[500px]" : "min-h-[140px]",
                            isCurrentMonth ? "bg-white/[0.02] border-white/5" : "bg-transparent border-transparent opacity-20 pointer-events-none",
                            isTodayDay && "ring-2 ring-pink-500/50 bg-pink-500/5 border-pink-500/20",
                            snapshot.isDraggingOver && "bg-pink-500/10 border-pink-500/40"
                          )}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className={cn(
                              "text-xs font-black tracking-tight",
                              isTodayDay ? "text-pink-500" : "text-slate-400"
                            )}>
                              {format(day, 'd')}
                            </span>
                            {isCurrentMonth && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNewArt(prev => ({ ...prev, status: 'todo', deadline: dateString }));
                                  setIsAddOpen(true);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-md bg-pink-500/10 text-pink-500 hover:bg-pink-500 hover:text-white transition-all shadow-[0_0_10px_rgba(236,72,153,0.2)]"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          
                          <div className="flex flex-col gap-1.5 overflow-hidden flex-1">
                            {dayTasks.map((task, taskIdx) => (
                              <Draggable key={task.id} draggableId={task.id} index={taskIdx}>
                                {(provided, snapshot) => {
                                  const child = (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      onClick={() => !snapshot.isDragging && handleCardClick(task)}
                                      className={cn(
                                        "w-full text-left p-2 rounded-lg text-[9px] font-black tracking-tight border border-white/5 transition-all flex items-center justify-between gap-1 min-w-0",
                                        task.priority === 'high' ? "bg-red-500/20 text-red-400 border-red-500/20" :
                                        task.priority === 'medium' ? "bg-amber-500/20 text-amber-400 border-amber-500/20" :
                                        "bg-emerald-500/20 text-emerald-400 border-emerald-500/20",
                                        task.isPendingDelete && "opacity-50 border-rose-500/30",
                                        snapshot.isDragging && "z-50 shadow-2xl scale-105 rotate-2 brightness-125"
                                      )}
                                    >
                                      <span className="truncate flex-1">{task.title}</span>
                                      {renderPendingBadge(task, true)}
                                    </div>
                                  );
                                  if (snapshot.isDragging) {
                                    return createPortal(child, document.body);
                                  }
                                  return child;
                                }}
                              </Draggable>
                            ))}
                          </div>
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === 'timeline' && (
        <div className="space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setTimelineDetail('urgent')}
              className="group relative bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 hover:bg-white/5 transition-all hover:scale-[1.02] cursor-pointer shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_20px_#ef4444]" />
              <div className="space-y-4">
                <div className="flex flex-col">
                  <span className="text-sm font-black text-red-500 uppercase italic tracking-tighter">Urgente</span>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">esta semana</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-black text-white italic tracking-tighter">{summaryStats.urgent}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">artes</span>
                </div>
                <p className="text-xs text-slate-500 italic">com prazo próximo e alta prioridade no cronograma atual</p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onClick={() => setTimelineDetail('medium')}
              className="group relative bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 hover:bg-white/5 transition-all hover:scale-[1.02] cursor-pointer shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 shadow-[0_0_20px_#f59e0b]" />
              <div className="space-y-4">
                <div className="flex flex-col">
                  <span className="text-sm font-black text-amber-500 uppercase italic tracking-tighter">Média</span>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">semana que vem</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-black text-white italic tracking-tighter">{summaryStats.medium}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">artes</span>
                </div>
                <p className="text-xs text-slate-500 italic">programadas para entrega no próximo ciclo de produção</p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={() => setTimelineDetail('low')}
              className="group relative bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 hover:bg-white/5 transition-all hover:scale-[1.02] cursor-pointer shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 shadow-[0_0_20px_#3b82f6]" />
              <div className="space-y-4">
                <div className="flex flex-col">
                  <span className="text-sm font-black text-blue-500 uppercase italic tracking-tighter">Baixa</span>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">próximas semanas</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-black text-white italic tracking-tighter">{summaryStats.low}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">artes</span>
                </div>
                <p className="text-xs text-slate-500 italic">no pipeline de criação e aguardando definição de prazo</p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onClick={() => setTimelineDetail('completed')}
              className="group relative bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 hover:bg-white/5 transition-all hover:scale-[1.02] cursor-pointer shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 shadow-[0_0_20px_#10b981]" />
              <div className="space-y-4">
                <div className="flex flex-col">
                  <span className="text-sm font-black text-emerald-500 uppercase italic tracking-tighter">Concluídas</span>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">entregas realizadas</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-black text-white italic tracking-tighter">{summaryStats.completed}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">artes</span>
                </div>
                <p className="text-xs text-slate-500 italic">finalizadas e entregues com sucesso para o cliente</p>
              </div>
            </motion.div>
          </div>

          <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h3 className="text-lg font-black text-white italic tracking-tight uppercase">Cronograma de Atividades</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Distribuição cronológica das artes agendadas</p>
              </div>
            </div>

            {timelineData.length === 0 ? (
              <div className="text-center py-16 text-slate-500 bg-white/[0.01] rounded-[2.5rem] border border-dashed border-white/5 flex flex-col items-center justify-center">
                <Calendar className="w-12 h-12 text-slate-600 mb-3" />
                <p className="text-xs font-black uppercase tracking-widest">Nenhuma atividade agendada</p>
                <p className="text-[10px] text-slate-600 mt-1 max-w-[280px]">Defina prazos ou crie novos cards para visualizá-los ordenados no tempo.</p>
              </div>
            ) : (
              <div className="relative pl-6 sm:pl-8 border-l border-white/5 space-y-8 py-2 ml-4">
                {timelineData.map(([dateKey, artsForDate]) => {
                  const isNoDeadline = dateKey === 'Sem Prazo';
                  let formattedDate = dateKey;
                  if (!isNoDeadline) {
                    try {
                      formattedDate = format(parseISO(dateKey), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
                    } catch {
                      formattedDate = dateKey;
                    }
                  }

                  return (
                    <div key={dateKey} className="relative group/day">
                      <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-4 h-4 rounded-full bg-zinc-950 border-2 border-pink-500 z-10 flex items-center justify-center group-hover/day:scale-125 transition-all shadow-[0_0_10px_rgba(236,72,153,0.3)]">
                        <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                          <h4 className="text-sm font-black text-pink-400 tracking-wider uppercase italic">
                            {isNoDeadline ? "Sem Prazo" : formattedDate}
                          </h4>
                          <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">
                            ({artsForDate.length} {artsForDate.length === 1 ? 'Arte' : 'Artes'})
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {artsForDate.map(art => (
                            <div
                              key={art.id}
                              onClick={() => handleCardClick(art)}
                              className="group/card p-5 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[120px] shadow-lg relative overflow-hidden"
                            >
                              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getPriorityColor(art.priority)}`} />
                              
                              <div className="space-y-2 pl-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-white/5 px-2 py-0.5 rounded-full">
                                    {translateCategory(art.category)}
                                  </span>
                                  <Badge className={cn("text-[8px] font-black uppercase tracking-widest border-none shrink-0 px-2 py-0.5", getPriorityColor(art.priority))}>
                                    {translatePriority(art.priority)}
                                  </Badge>
                                </div>
                                <h5 className="text-xs font-black text-white italic group-hover/card:text-pink-400 transition-all line-clamp-2">
                                  {art.title}
                                </h5>
                              </div>

                              <div className="flex items-center justify-between pt-4 border-t border-white/[0.03] text-[9px] font-extrabold uppercase text-slate-400 pl-2">
                                <span className="px-2 py-0.5 rounded-full bg-white/5 text-slate-300 font-bold border border-white/5">
                                  {translateStatus(art.status)}
                                </span>
                                {art.deadline && (
                                  <span className="flex items-center gap-1 select-none text-slate-500">
                                    <Clock className="w-3 h-3 text-pink-500" />
                                    {format(parseISO(art.deadline), "dd/MM")}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={!!selectedArt} onOpenChange={(open) => !open && setSelectedArt(null)}>
        <DialogContent className="rounded-[2rem] sm:rounded-[2.5rem] w-[95vw] sm:max-w-[600px] glass border-white/10 text-slate-100 p-0 max-h-[90vh] overflow-y-auto custom-scrollbar">
          {selectedArt && editArt && (
            <div className="flex flex-col">
              <div className={`h-2 w-full ${getPriorityColor(editArt.priority || 'medium')} shadow-[0_4px_10px_rgba(0,0,0,0.3)]`} />
              <div className="p-4 sm:p-8 space-y-4 sm:space-y-6">
                {activeTab === 'details' && (
                  <div className="space-y-6">
                    {(() => {
                  const activeChangesForArt = pendingChanges
                    .filter(c => c.targetId === selectedArt.id && c.status === 'pending')
                    .sort((a, b) => {
                      const tA = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
                      const tB = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
                      return tA - tB; // Oldest first to show chain of history chronologically
                    });

                  if (activeChangesForArt.length === 0) return null;

                  const formatSafeDate = (timestamp: any) => {
                    if (!timestamp) return 'Agora';
                    const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
                    try {
                      return format(date, "dd/MM 'às' HH:mm", { locale: ptBR });
                    } catch {
                      return 'Sem data';
                    }
                  };

                  return (
                    <div className="p-4 rounded-2xl sm:rounded-[2rem] bg-amber-500/5 border border-amber-500/10 space-y-2.5 relative overflow-hidden backdrop-blur-md">
                      <div className="flex items-center gap-2 text-amber-400 font-black text-[10px] uppercase tracking-wider">
                        <Clock className="w-3.5 h-3.5 animate-pulse" />
                        <span>Alterações Ativas Pendentes de Validação ({activeChangesForArt.length})</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                        <div className="text-[10px] text-slate-400 leading-normal font-semibold">
                          Alterações aguardando aprovação do designer:
                        </div>
                        {profile.role !== 'contractor' && (
                          <Button 
                            type="button"
                            onClick={() => setIsValidationDialogOpen(true)}
                            className="h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-500 hover:bg-amber-600 text-black flex items-center justify-center gap-1 shadow-lg shadow-amber-500/10 border-none transition-all select-none self-start"
                          >
                            <Palette className="w-3 h-3" />
                            Validar Alterações
                          </Button>
                        )}
                      </div>
                      
                      <div className="space-y-4 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                        {activeChangesForArt.map((activeChange, index) => {
                          const isUpdate = activeChange.type === 'update';
                          return (
                            <div key={activeChange.id} className="pt-2.5 border-t border-white/5 space-y-2.5">
                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                                <span className="bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-wider text-[9px]">
                                  Solicitação #{index + 1}
                                </span>
                                <span>{formatSafeDate(activeChange.createdAt)} • por {activeChange.contractorName || 'Cliente'}</span>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 text-[10px]">
                                {(activeChange.type === 'update' || activeChange.type === 'status') && (
                                  <>
                                    {/* 1. Categoria */}
                                    {activeChange.originalData?.category !== activeChange.proposedData?.category && (
                                      <div className="col-span-2 flex items-center gap-2">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mr-2">Categoria:</span>
                                        <span className="line-through text-slate-500">{translateCategory(activeChange.originalData?.category)}</span>
                                        <ArrowRight className="w-3 h-3 text-slate-500" />
                                        <span className="text-amber-400 font-bold">{translateCategory(activeChange.proposedData?.category)}</span>
                                      </div>
                                    )}

                                    {/* 2. Prioridade */}
                                    {activeChange.originalData?.priority !== activeChange.proposedData?.priority && (
                                      <div className="col-span-2 flex items-center gap-2">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mr-2">Prioridade:</span>
                                        <span className="line-through text-slate-500">{translatePriority(activeChange.originalData?.priority)}</span>
                                        <ArrowRight className="w-3 h-3 text-slate-500" />
                                        <span className="text-amber-400 font-bold">{translatePriority(activeChange.proposedData?.priority)}</span>
                                      </div>
                                    )}

                                    {/* 3. Titulo */}
                                    {activeChange.originalData?.title !== activeChange.proposedData?.title && (
                                      <div className="col-span-2 space-y-1">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Mudança no Título:</span>
                                        <div className="grid grid-cols-2 gap-3 text-[10px]">
                                          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-slate-400">
                                            <span className="font-bold block text-slate-500 mb-1">Original:</span>
                                            <span>{activeChange.originalData?.title}</span>
                                          </div>
                                          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
                                            <span className="font-bold block text-amber-400 mb-1">Proposto:</span>
                                            <span>{activeChange.proposedData?.title}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* 4. Status */}
                                    {activeChange.originalData?.status !== activeChange.proposedData?.status && (
                                      <div className="col-span-2 flex items-center gap-2">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mr-2">Status:</span>
                                        <span className="line-through text-slate-500">{translateStatus(activeChange.originalData?.status)}</span>
                                        <ArrowRight className="w-3 h-3 text-slate-500" />
                                        <span className="text-amber-400 font-bold">{translateStatus(activeChange.proposedData?.status)}</span>
                                      </div>
                                    )}

                                    {/* 5. Data (Prazo) */}
                                    {activeChange.originalData?.deadline !== activeChange.proposedData?.deadline && (
                                      <div className="col-span-2 flex items-center gap-2">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mr-4">Prazo:</span>
                                        <span className="line-through text-slate-500">
                                          {activeChange.originalData?.deadline ? format(parseISO(activeChange.originalData?.deadline), "dd/MM/yyyy") : 'Sem prazo'}
                                        </span>
                                        <ArrowRight className="w-3 h-3 text-slate-500" />
                                        <span className="text-amber-400 font-bold">
                                          {activeChange.proposedData?.deadline ? format(parseISO(activeChange.proposedData?.deadline), "dd/MM/yyyy") : 'Sem prazo'}
                                        </span>
                                      </div>
                                    )}

                                    {/* 6. Descrição */}
                                    {activeChange.originalData?.description !== activeChange.proposedData?.description && (
                                      <div className="col-span-2 space-y-1">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Mudança na Descrição:</span>
                                        <div className="grid grid-cols-2 gap-3 text-[10px]">
                                          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-slate-400 max-h-[60px] overflow-y-auto custom-scrollbar">
                                            <span className="font-bold block text-red-400 mb-0.5">Original:</span>
                                            <span className="italic">{activeChange.originalData?.description || "Sem descrição"}</span>
                                          </div>
                                          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 max-h-[60px] overflow-y-auto custom-scrollbar">
                                            <span className="font-bold block text-emerald-400 mb-0.5">Proposto:</span>
                                            <span className="italic">{activeChange.proposedData?.description || "Sem descrição"}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                                {activeChange.type === 'delete' && (
                                  <div className="col-span-2 text-rose-400 font-bold italic">
                                    Solicitação de exclusão permanente deste card.
                                  </div>
                                )}
                                {activeChange.type === 'create' && (
                                  <div className="col-span-2 text-emerald-400 font-bold italic">
                                    Solicitação de criação para este novo card.
                                  </div>
                                )}
                                {activeChange.type === 'revert' && (
                                  <div className="col-span-2 space-y-3">
                                    <div className="text-amber-400 font-black italic text-[11px] border-b border-white/5 pb-1 flex items-center gap-1.5 uppercase tracking-wide">
                                      <RotateCcw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                                      Solicitação de Reversão de {
                                        activeChange.proposedData?.changeType === 'create' ? "Criação" :
                                        activeChange.proposedData?.changeType === 'update' ? "Editição de Dados" :
                                        activeChange.proposedData?.changeType === 'status' ? "Movimentação" :
                                        activeChange.proposedData?.changeType === 'delete' ? "Exclusão" : "Alteração"
                                      }
                                    </div>

                                    {activeChange.proposedData?.changeType === 'create' && (
                                      <div className="text-rose-400 font-bold italic">
                                        Reverter a criação removerá e excluirá permanentemente este card do board.
                                      </div>
                                    )}

                                    {activeChange.proposedData?.changeType === 'delete' && (
                                      <div className="text-emerald-400 font-bold italic">
                                        Reverter a exclusão restaurará permanentemente este card de volta ao board.
                                      </div>
                                    )}

                                    {activeChange.proposedData?.changeType === 'status' && activeChange.proposedData?.restoreData && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mr-2">Reverter Status:</span>
                                        <span className="line-through text-slate-500">
                                          {translateStatus(activeChange.originalData?.status || selectedArt.status)}
                                        </span>
                                        <ArrowRight className="w-3 h-3 text-slate-500" />
                                        <span className="text-emerald-400 font-bold">
                                          {translateStatus(activeChange.proposedData.restoreData.status)}
                                        </span>
                                      </div>
                                    )}

                                    {activeChange.proposedData?.changeType === 'update' && activeChange.proposedData?.restoreData && (
                                      <div className="space-y-2">
                                        {/* Categoria */}
                                        {activeChange.originalData?.category !== activeChange.proposedData.restoreData.category && (
                                          <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mr-2">Reverter Categoria:</span>
                                            <span className="line-through text-slate-500">{translateCategory(activeChange.originalData?.category)}</span>
                                            <ArrowRight className="w-3 h-3 text-slate-500" />
                                            <span className="text-emerald-400 font-bold">{translateCategory(activeChange.proposedData.restoreData.category)}</span>
                                          </div>
                                        )}

                                        {/* Prioridade */}
                                        {activeChange.originalData?.priority !== activeChange.proposedData.restoreData.priority && (
                                          <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mr-2">Reverter Prioridade:</span>
                                            <span className="line-through text-slate-500">{translatePriority(activeChange.originalData?.priority)}</span>
                                            <ArrowRight className="w-3 h-3 text-slate-500" />
                                            <span className="text-emerald-400 font-bold">{translatePriority(activeChange.proposedData.restoreData.priority)}</span>
                                          </div>
                                        )}

                                        {/* Título */}
                                        {activeChange.originalData?.title !== activeChange.proposedData.restoreData.title && (
                                          <div className="space-y-1">
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Reverter Título para:</span>
                                            <div className="grid grid-cols-2 gap-3 text-[10px]">
                                              <div className="p-2 rounded-xl bg-white/5 border border-white/5 text-slate-500">
                                                <span className="font-bold block text-slate-600 mb-0.5">Atual:</span>
                                                <span>{activeChange.originalData?.title}</span>
                                              </div>
                                              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                                                <span className="font-bold block text-emerald-400 mb-0.5">Restaurado:</span>
                                                <span>{activeChange.proposedData.restoreData.title}</span>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* Status */}
                                        {activeChange.originalData?.status !== activeChange.proposedData.restoreData.status && (
                                          <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mr-2">Reverter Status:</span>
                                            <span className="line-through text-slate-500">{translateStatus(activeChange.originalData?.status)}</span>
                                            <ArrowRight className="w-3 h-3 text-slate-500" />
                                            <span className="text-emerald-400 font-bold">{translateStatus(activeChange.proposedData.restoreData.status)}</span>
                                          </div>
                                        )}

                                        {/* Prazo */}
                                        {activeChange.originalData?.deadline !== activeChange.proposedData.restoreData.deadline && (
                                          <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mr-4">Reverter Prazo:</span>
                                            <span className="line-through text-slate-500">
                                              {activeChange.originalData?.deadline ? format(parseISO(activeChange.originalData.deadline), "dd/MM/yyyy") : 'Sem prazo'}
                                            </span>
                                            <ArrowRight className="w-3 h-3 text-slate-500" />
                                            <span className="text-emerald-400 font-bold">
                                              {activeChange.proposedData.restoreData.deadline ? format(parseISO(activeChange.proposedData.restoreData.deadline), "dd/MM/yyyy") : 'Sem prazo'}
                                            </span>
                                          </div>
                                        )}

                                        {/* Descrição */}
                                        {activeChange.originalData?.description !== activeChange.proposedData.restoreData.description && (
                                          <div className="space-y-1">
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Reverter Descrição para:</span>
                                            <div className="grid grid-cols-2 gap-3 text-[10px]">
                                              <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-slate-400 max-h-[60px] overflow-y-auto custom-scrollbar">
                                                <span className="font-bold block text-red-400 mb-0.5">Atual:</span>
                                                <span className="italic">{activeChange.originalData?.description || "Sem descrição"}</span>
                                              </div>
                                              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 max-h-[60px] overflow-y-auto custom-scrollbar">
                                                <span className="font-bold block text-emerald-400 mb-0.5">Restaurado:</span>
                                                <span className="italic">{activeChange.proposedData.restoreData.description || "Sem descrição"}</span>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <DialogHeader className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                       <Select onValueChange={(v: any) => setEditArt({...editArt, category: v})} value={editArt.category}>
                        <SelectTrigger className="h-8 rounded-full border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest px-4 flex items-center gap-2 min-w-[80px]">
                          {editArt.category === 'dj' && <Music className="w-3 h-3 text-purple-400" />}
                          {editArt.category === 'party' && <PartyPopper className="w-3 h-3 text-blue-400" />}
                          {editArt.category === 'branding' && <Star className="w-3 h-3 text-amber-400" />}
                          <span>{translateCategory(editArt.category || '')}</span>
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl bg-slate-900 border-white/10 text-white">
                          <SelectItem value="dj" className="flex items-center gap-2"><Music className="w-3 h-3 inline mr-2" /> DJ</SelectItem>
                          <SelectItem value="party" className="flex items-center gap-2"><PartyPopper className="w-3 h-3 inline mr-2" /> Festa</SelectItem>
                          <SelectItem value="branding" className="flex items-center gap-2"><Star className="w-3 h-3 inline mr-2" /> Branding</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select onValueChange={(v: any) => setEditArt({...editArt, priority: v})} value={editArt.priority}>
                        <SelectTrigger className="h-8 rounded-full border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest px-4 flex items-center gap-2 min-w-[80px]">
                          {editArt.priority === 'low' && <Clock className="w-3 h-3 text-emerald-400" />}
                          {editArt.priority === 'medium' && <AlertTriangle className="w-3 h-3 text-yellow-500" />}
                          {editArt.priority === 'high' && <AlertTriangle className="w-3 h-3 text-red-500" />}
                          <span>{translatePriority(editArt.priority || '')}</span>
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl bg-slate-900 border-white/10 text-white">
                          <SelectItem value="low"><Clock className="w-3 h-3 inline mr-2 text-emerald-400" /> Baixa</SelectItem>
                          <SelectItem value="medium"><AlertTriangle className="w-3 h-3 inline mr-2 text-yellow-400" /> Média</SelectItem>
                          <SelectItem value="high"><AlertTriangle className="w-3 h-3 inline mr-2 text-red-400" /> Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Input 
                    value={editArt.title} 
                    onChange={e => setEditArt({...editArt, title: e.target.value})}
                    className="text-lg sm:text-2xl font-black text-white tracking-tight border-none bg-white/5 rounded-2xl h-12 sm:h-14 focus:ring-pink-500 italic px-4 sm:px-6"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Select onValueChange={(v: any) => setEditArt({...editArt, status: v})} value={editArt.status}>
                      <SelectTrigger className={cn(
                        "h-8 rounded-full border text-[10px] font-black uppercase tracking-widest px-4 flex items-center gap-2 min-w-[80px] transition-all",
                        getStatusColorClasses(editArt.status || '')
                      )}>
                        <Palette className={cn("w-3 h-3", getStatusIconColor(editArt.status || ''))} />
                        <span>{translateStatus(editArt.status || '')}</span>
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl bg-slate-900 border-white/10 text-white">
                        {COLUMNS.map(col => (
                          <SelectItem key={col.id} value={col.id} className="rounded-xl focus:bg-white/10 font-bold uppercase text-[10px] tracking-widest">
                            {col.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="relative group/date">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Calendar className="w-3 h-3 text-pink-400" />
                      </div>
                      <Input 
                        type="date"
                        value={editArt.deadline || ''}
                        onChange={e => setEditArt({...editArt, deadline: e.target.value})}
                        className="h-8 rounded-full border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest pl-8 pr-4 w-[130px] focus:ring-0 focus:border-white/20 cursor-pointer"
                      />
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-6">

                  <div className="space-y-3">
                    <Label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 italic">Descrição & Instruções</Label>
                    <Textarea 
                      value={editArt.description}
                      onChange={e => setEditArt({...editArt, description: e.target.value})}
                      placeholder="Instruções para o designer..."
                      className="p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] bg-black/40 border border-white/5 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap italic font-medium min-h-[150px] focus:ring-pink-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button 
                    onClick={handleSaveArt}
                    disabled={loading}
                    className="w-full sm:flex-1 rounded-2xl sm:rounded-[1.5rem] h-12 sm:h-14 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 border-none text-white font-black uppercase text-xs tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                  >
                    {loading ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      type="button"
                      onClick={() => setActiveTab('history')}
                      className="flex-1 sm:flex-initial sm:px-6 rounded-2xl sm:rounded-[1.5rem] h-12 sm:h-14 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 shrink-0 pr-6 pl-4"
                    >
                      <History className="w-4 h-4 text-pink-500" />
                      <span>Histórico</span>
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => handleDeleteArt(selectedArt.id)}
                      className="w-12 sm:w-14 h-12 sm:h-14 rounded-2xl sm:rounded-[1.5rem] border-none bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-[0_0_15px_rgba(239,68,68,0.1)] shrink-0 flex items-center justify-center"
                    >
                      <Palette className="w-5 h-5 rotate-45" />
                    </Button>
                  </div>
                </div>
                </div>
                )}

                {/* HISTORY TIMELINE TAB */}
                {activeTab === 'history' && (
                  <div className="space-y-6">
                    <div className="flex flex-col">
                      <h3 className="text-lg font-black text-white italic tracking-tight uppercase">Histórico de Alterações</h3>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                        Versões salvas e aprovadas para esta atividade
                      </span>
                    </div>

                    {(() => {
                      const artHistory = pendingChanges
                        .filter(c => c.targetId === selectedArt.id && ['approved', 'reverted'].includes(c.status))
                        .sort((a, b) => {
                          const tA = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
                          const tB = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
                          return tB - tA; // Newest first!
                        });

                      if (artHistory.length === 0) {
                        return (
                          <div className="text-center py-12 text-slate-500 bg-white/[0.01] rounded-3xl border border-dashed border-white/5">
                            <History className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma alteração registrada no histórico</p>
                            <p className="text-[9px] text-slate-600 mt-1 max-w-xs mx-auto leading-normal">Modificações aprovadas ou revertidas aparecerão aqui para serem restauradas.</p>
                          </div>
                        );
                      }

                      const formatSafeDateLocal = (timestamp: any) => {
                        if (!timestamp) return 'Agora';
                        const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
                        try {
                          return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
                        } catch {
                          return 'Sem data';
                        }
                      };

                      return (
                        <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1 custom-scrollbar">
                          {artHistory.map((change) => {
                            const isRevertible = change.originalData && Object.keys(change.originalData).length > 0;
                            return (
                              <div key={change.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3 relative overflow-hidden">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className={cn(
                                      "p-1.5 rounded-full text-xs font-bold",
                                      change.status === 'reverted' ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"
                                    )}>
                                      {change.status === 'reverted' ? <RotateCcw className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <span className="text-xs font-black text-white block truncate max-w-[200px]">{change.title || 'Alteração de Valores'}</span>
                                      <span className="text-[9px] text-slate-400 font-bold block leading-none">
                                        por {change.contractorName} • {formatSafeDateLocal(change.createdAt)}
                                      </span>
                                    </div>
                                  </div>
                                  <Badge className={cn(
                                    "text-[8px] font-black uppercase tracking-widest shrink-0",
                                    change.status === 'reverted' ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                  )}>
                                    {change.status === 'reverted' ? 'Revertido' : 'Ativo'}
                                  </Badge>
                                </div>

                                <div className="bg-black/30 p-3 rounded-xl border border-white/[0.03] text-[10px] space-y-2 font-medium">
                                  {change.type === 'update' && change.originalData && change.proposedData && (
                                    <div className="space-y-1.5 text-slate-300">
                                      {change.originalData.title !== change.proposedData.title && (
                                        <div>
                                          <span className="text-slate-500 text-[8px] font-black uppercase block">Título alterado:</span>
                                          <span className="line-through text-slate-500">{change.originalData.title}</span>
                                          <ArrowRight className="w-2.5 h-2.5 inline mx-1.5 text-slate-500" />
                                          <span className="text-white font-bold">{change.proposedData.title}</span>
                                        </div>
                                      )}
                                      
                                      {change.originalData.description !== change.proposedData.description && (
                                        <div>
                                          <span className="text-slate-500 text-[8px] font-black uppercase block">Breve alterado:</span>
                                          <div className="grid grid-cols-2 gap-2 mt-0.5">
                                            <span className="text-slate-500 line-through truncate block">{change.originalData.description || '(Vazio)'}</span>
                                            <span className="text-slate-200 block truncate font-bold">{change.proposedData.description || '(Vazio)'}</span>
                                          </div>
                                        </div>
                                      )}

                                      {change.originalData.status !== change.proposedData.status && (
                                        <div>
                                          <span className="text-slate-500 text-[8px] font-black uppercase block">Status alterado:</span>
                                          <span className="line-through text-slate-500">{translateStatus(change.originalData.status)}</span>
                                          <ArrowRight className="w-2.5 h-2.5 inline mx-1.5 text-slate-500" />
                                          <span className="text-white font-bold">{translateStatus(change.proposedData.status)}</span>
                                        </div>
                                      )}

                                      {change.originalData.priority !== change.proposedData.priority && (
                                        <div>
                                          <span className="text-slate-500 text-[8px] font-black uppercase block">Prioridade alterada:</span>
                                          <span className="line-through text-slate-500">{translatePriority(change.originalData.priority)}</span>
                                          <ArrowRight className="w-2.5 h-2.5 inline mx-1.5 text-slate-500" />
                                          <span className="text-white font-bold">{translatePriority(change.proposedData.priority)}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {change.type === 'status' && change.originalData && change.proposedData && (
                                    <div className="text-slate-300">
                                      <span className="text-slate-500 text-[8px] font-black uppercase block">Movimentação no Kanban:</span>
                                      <span className="line-through text-slate-500">{translateStatus(change.originalData.status)}</span>
                                      <ArrowRight className="w-2.5 h-2.5 inline mx-1.5 text-slate-500" />
                                      <span className="text-white font-bold">{translateStatus(change.proposedData.status)}</span>
                                    </div>
                                  )}

                                  {change.type === 'create' && (
                                    <span className="text-emerald-400 block font-bold">Criação inicial de atividade.</span>
                                  )}

                                  {change.type === 'revert' && (
                                    <span className="text-amber-400 block font-bold">Reversão de atividade restaurando valores antigos.</span>
                                  )}
                                </div>

                                {isRevertible && change.status !== 'reverted' && (
                                  <div className="flex justify-end pt-1">
                                    {isMasterDesigner ? (
                                      <Button
                                        type="button"
                                        onClick={() => handleDirectRevert(change)}
                                        disabled={loading}
                                        className="h-8 rounded-xl text-[10px] font-black bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1 shadow-md shadow-amber-500/10"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Reverter para esta versão
                                      </Button>
                                    ) : (
                                      <Button
                                        type="button"
                                        onClick={() => handleRequestRevert(change)}
                                        disabled={loading}
                                        className="h-8 rounded-xl text-[10px] font-black bg-sky-500 hover:bg-sky-600 text-white flex items-center gap-1 shadow-md shadow-sky-500/10"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Solicitar Reversão
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    <div className="flex gap-4 pt-4 border-t border-white/5 font-bold">
                      <Button
                        type="button"
                        onClick={() => setActiveTab('details')}
                        className="w-full rounded-[1.5rem] h-14 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 border-none text-white font-black uppercase text-xs tracking-widest transition-all shadow-[0_0_20px_rgba(236,72,153,0.2)] flex items-center justify-center gap-2"
                      >
                        <ArrowRight className="w-4 h-4 rotate-180" />
                        <span>Voltar para Detalhes</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isValidationDialogOpen} onOpenChange={setIsValidationDialogOpen}>
        <DialogContent className="rounded-[2rem] sm:rounded-[2.5rem] w-[95vw] sm:max-w-[650px] glass border-white/10 text-slate-100 p-0 max-h-[90vh] overflow-hidden flex flex-col">
          <div className="h-2 w-full bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_4px_10px_rgba(0,0,0,0.3)] shrink-0" />
          <div className="p-4 sm:p-8 pb-2 sm:pb-4 shrink-0">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xl font-black text-white italic tracking-tight uppercase flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
                Validar Alterações Pendentes
              </DialogTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Exibindo alterações ativas para a arte: <span className="text-pink-400 italic font-black">{selectedArt?.title || ''}</span>
              </p>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-4 sm:pb-8 space-y-4 sm:space-y-6 custom-scrollbar">
            {(() => {
              const activeChangesForArt = pendingChanges
                .filter(c => c.targetId === selectedArt?.id && c.status === 'pending')
                .sort((a, b) => {
                  const tA = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
                  const tB = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
                  return tA - tB;
                });

              if (activeChangesForArt.length === 0) {
                return (
                  <div className="text-center py-12 text-slate-500 bg-white/[0.01] rounded-3xl border border-dashed border-white/5">
                    <Check className="w-12 h-12 text-emerald-500 mx-auto mb-3 animate-bounce" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Tudo Validado com Sucesso!</p>
                    <p className="text-[9px] text-slate-600 mt-1">Nenhuma alteração pendente sobrou para essa arte.</p>
                  </div>
                );
              }

              const formatSafeDateLocal = (timestamp: any) => {
                if (!timestamp) return 'Agora';
                const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
                try {
                  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
                } catch {
                  return 'Sem data';
                }
              };

              return (
                <div className="space-y-6">
                  {activeChangesForArt.map((change, idx) => {
                    return (
                      <div key={change.id} className="p-5 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4 relative overflow-hidden">
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                          <span className="bg-amber-500/10 text-amber-300 px-3 py-1 rounded-full border border-amber-500/20 uppercase tracking-widest text-[9px] font-black">
                            Solicitação #{idx + 1}
                          </span>
                          <span className="text-[9px] text-slate-400 font-extrabold uppercase">
                            por {change.contractorName} • {formatSafeDateLocal(change.createdAt)}
                          </span>
                        </div>

                        <div className="space-y-3.5">
                          {(change.type === 'update' || change.type === 'status') && (
                            <div className="space-y-3 text-[11px]">
                              {/* 1. Categoria */}
                              {change.originalData?.category !== change.proposedData?.category && (
                                <div className="p-3.5 rounded-2xl bg-black/30 border border-white/[0.03] flex items-center justify-between gap-3">
                                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-bold">Categoria</span>
                                  <div className="flex items-center gap-3">
                                    <span className="line-through text-slate-500 font-bold">{translateCategory(change.originalData?.category)}</span>
                                    <ArrowRight className="w-3 select-none h-3 text-slate-500" />
                                    <span className="text-amber-400 font-black uppercase">{translateCategory(change.proposedData?.category)}</span>
                                  </div>
                                </div>
                              )}

                              {/* 2. Prioridade */}
                              {change.originalData?.priority !== change.proposedData?.priority && (
                                <div className="p-3.5 rounded-2xl bg-black/30 border border-white/[0.03] flex items-center justify-between gap-3">
                                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-bold">Prioridade</span>
                                  <div className="flex items-center gap-3">
                                    <span className="line-through text-slate-500 font-bold">{translatePriority(change.originalData?.priority)}</span>
                                    <ArrowRight className="w-3 select-none h-3 text-slate-500" />
                                    <span className="text-amber-400 font-black uppercase">{translatePriority(change.proposedData?.priority)}</span>
                                  </div>
                                </div>
                              )}

                              {/* 3. Título */}
                              {change.originalData?.title !== change.proposedData?.title && (
                                <div className="p-3.5 rounded-2xl bg-black/30 border border-white/[0.03] space-y-2">
                                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block pb-1 font-bold">Título</span>
                                  <div className="grid grid-cols-2 gap-3 text-[10px]">
                                    <div className="p-2.5 rounded-xl bg-white/5 text-slate-400">
                                      <span className="font-bold block text-slate-500 mb-1">Original:</span>
                                      <span>{change.originalData?.title}</span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-300">
                                      <span className="font-bold block text-amber-400 mb-1">Proposto:</span>
                                      <span className="font-black">{change.proposedData?.title}</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* 4. Status */}
                              {change.originalData?.status !== change.proposedData?.status && (
                                <div className="p-3.5 rounded-2xl bg-black/30 border border-white/[0.03] flex items-center justify-between gap-3">
                                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-bold">Status (Coluna)</span>
                                  <div className="flex items-center gap-3">
                                    <span className="line-through text-slate-500 font-bold">{translateStatus(change.originalData?.status)}</span>
                                    <ArrowRight className="w-3 h-3 text-slate-500" />
                                    <span className="text-amber-400 font-black uppercase">{translateStatus(change.proposedData?.status)}</span>
                                  </div>
                                </div>
                              )}

                              {/* 5. Data */}
                              {change.originalData?.deadline !== change.proposedData?.deadline && (
                                <div className="p-3.5 rounded-2xl bg-black/30 border border-white/[0.03] flex items-center justify-between gap-3">
                                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-bold">Prazo (Data)</span>
                                  <div className="flex items-center gap-3">
                                    <span className="line-through text-slate-500 font-bold">
                                      {change.originalData?.deadline ? format(parseISO(change.originalData?.deadline), "dd/MM/yyyy") : 'Sem prazo'}
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-slate-500" />
                                    <span className="text-amber-400 font-black">
                                      {change.proposedData?.deadline ? format(parseISO(change.proposedData?.deadline), "dd/MM/yyyy") : 'Sem prazo'}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* 6. Descrição */}
                              {change.originalData?.description !== change.proposedData?.description && (
                                <div className="p-3.5 rounded-2xl bg-black/30 border border-white/[0.03] space-y-2">
                                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block pb-1 font-bold">Descrição</span>
                                  <div className="grid grid-cols-2 gap-3 text-[10px]">
                                    <div className="p-2.5 rounded-xl bg-red-500/10 text-slate-400 max-h-[100px] overflow-y-auto custom-scrollbar">
                                      <span className="font-bold block text-red-400 mb-1">Original:</span>
                                      <span className="italic">{change.originalData?.description || "Sem descrição"}</span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-300 max-h-[100px] overflow-y-auto custom-scrollbar">
                                      <span className="font-bold block text-emerald-400 mb-1">Proposto:</span>
                                      <span className="italic font-bold">{change.proposedData?.description || "Sem descrição"}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {change.type === 'delete' && (
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold leading-relaxed text-center">
                              ⚠️ Esta solicitação é para EXCLUIR permanentemente esta atividade.
                            </div>
                          )}

                          {change.type === 'create' && (
                            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold leading-relaxed text-center">
                              ✨ Esta solicitação é para CRIAR esta nova atividade com as informações propostas.
                            </div>
                          )}

                          {change.type === 'revert' && (
                            <div className="space-y-3.5">
                              <div className="text-amber-400 font-extrabold italic text-sm pb-1 flex items-center gap-1.5 uppercase tracking-wide">
                                <RotateCcw className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
                                Reversão Solicitada de {
                                  change.proposedData?.changeType === 'create' ? "Criação" :
                                  change.proposedData?.changeType === 'update' ? "Edição de Dados" :
                                  change.proposedData?.changeType === 'status' ? "Movimentação" :
                                  change.proposedData?.changeType === 'delete' ? "Exclusão" : "Alteração"
                                }
                              </div>

                              {change.proposedData?.changeType === 'create' && (
                                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold leading-relaxed">
                                  Reverter esta criação removerá e excluirá permanentemente este card do board.
                                </div>
                              )}

                              {change.proposedData?.changeType === 'delete' && (
                                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold leading-relaxed">
                                  Reverter esta exclusão restaurará permanentemente este card de volta ao board.
                                </div>
                              )}

                              {change.proposedData?.changeType === 'status' && change.proposedData?.restoreData && (
                                <div className="p-3.5 rounded-2xl bg-black/30 border border-white/[0.03] flex items-center gap-2 text-xs">
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mr-2">Reverter Status:</span>
                                  <span className="line-through text-slate-500">
                                    {translateStatus(change.originalData?.status || selectedArt?.status)}
                                  </span>
                                  <ArrowRight className="w-3 h-3 text-slate-400" />
                                  <span className="text-emerald-400 font-bold">
                                    {translateStatus(change.proposedData.restoreData.status)}
                                  </span>
                                </div>
                              )}

                              {change.proposedData?.changeType === 'update' && change.proposedData?.restoreData && (
                                <div className="space-y-3 text-[11px]">
                                  {/* Categoria */}
                                  {change.originalData?.category !== change.proposedData.restoreData.category && (
                                    <div className="p-3 rounded-2xl bg-black/30 border border-white/[0.03] flex items-center justify-between gap-3">
                                      <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">Reverter Categoria</span>
                                      <div className="flex items-center gap-2">
                                        <span className="line-through text-slate-500">{translateCategory(change.originalData?.category)}</span>
                                        <ArrowRight className="w-3 h-3 text-slate-400" />
                                        <span className="text-emerald-400 font-bold">{translateCategory(change.proposedData.restoreData.category)}</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Prioridade */}
                                  {change.originalData?.priority !== change.proposedData.restoreData.priority && (
                                    <div className="p-3 rounded-2xl bg-black/30 border border-white/[0.03] flex items-center justify-between gap-3">
                                      <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">Reverter Prioridade</span>
                                      <div className="flex items-center gap-2">
                                        <span className="line-through text-slate-500">{translatePriority(change.originalData?.priority)}</span>
                                        <ArrowRight className="w-3 h-3 text-slate-400" />
                                        <span className="text-emerald-400 font-bold">{translatePriority(change.proposedData.restoreData.priority)}</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Título */}
                                  {change.originalData?.title !== change.proposedData.restoreData.title && (
                                    <div className="p-3 rounded-2xl bg-black/30 border border-white/[0.03] space-y-2">
                                      <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block pb-1">Reverter Título</span>
                                      <div className="grid grid-cols-2 gap-3 text-[10.5px]">
                                        <div className="p-2 rounded-xl bg-white/5 border border-white/5 text-slate-400">
                                          <span className="font-bold block text-slate-500 mb-0.5">Atual:</span>
                                          <span>{change.originalData?.title}</span>
                                        </div>
                                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                                          <span className="font-bold block text-emerald-400 mb-0.5">Restaurado:</span>
                                          <span>{change.proposedData.restoreData.title}</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Status */}
                                  {change.originalData?.status !== change.proposedData.restoreData.status && (
                                    <div className="p-3 rounded-2xl bg-black/30 border border-white/[0.03] flex items-center justify-between gap-3">
                                      <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">Reverter Status (Coluna)</span>
                                      <div className="flex items-center gap-2">
                                        <span className="line-through text-slate-500">{translateStatus(change.originalData?.status)}</span>
                                        <ArrowRight className="w-3 h-3 text-slate-400" />
                                        <span className="text-emerald-400 font-bold">{translateStatus(change.proposedData.restoreData.status)}</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Prazo */}
                                  {change.originalData?.deadline !== change.proposedData.restoreData.deadline && (
                                    <div className="p-3 rounded-2xl bg-black/30 border border-white/[0.03] flex items-center justify-between gap-3">
                                      <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">Reverter Prazo</span>
                                      <div className="flex items-center gap-2">
                                        <span className="line-through text-slate-500">
                                          {change.originalData?.deadline ? format(parseISO(change.originalData.deadline), "dd/MM/yyyy") : 'Sem prazo'}
                                        </span>
                                        <ArrowRight className="w-3 h-3 text-slate-400" />
                                        <span className="text-emerald-400 font-bold">
                                          {change.proposedData.restoreData.deadline ? format(parseISO(change.proposedData.restoreData.deadline), "dd/MM/yyyy") : 'Sem prazo'}
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Descrição */}
                                  {change.originalData?.description !== change.proposedData.restoreData.description && (
                                    <div className="p-3 rounded-2xl bg-black/30 border border-white/[0.03] space-y-2">
                                      <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block pb-1">Reverter Descrição</span>
                                      <div className="grid grid-cols-2 gap-3 text-[10.5px]">
                                        <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-slate-400 max-h-[85px] overflow-y-auto custom-scrollbar">
                                          <span className="font-bold block text-red-400 mb-0.5">Atual:</span>
                                          <span className="italic">{change.originalData?.description || "Sem descrição"}</span>
                                        </div>
                                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 max-h-[85px] overflow-y-auto custom-scrollbar">
                                          <span className="font-bold block text-emerald-400 mb-0.5">Restaurado:</span>
                                          <span className="italic">{change.proposedData.restoreData.description || "Sem descrição"}</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Approved & Reject Actions for this Change */}
                        <div className="flex gap-3 pt-2 justify-end">
                          <Button 
                            type="button"
                            onClick={() => handleRejectPendingChange(change)}
                            disabled={loading}
                            className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest px-4 h-9 border-none transition-all flex items-center gap-1 shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                            Rejeitar
                          </Button>
                          <Button 
                            type="button"
                            onClick={() => handleApprovePendingChange(change)}
                            disabled={loading}
                            className="bg-emerald-500 hover:bg-emerald-600 text-black rounded-xl text-[10px] font-black uppercase tracking-widest px-4 h-9 border-none transition-all flex items-center gap-1 shadow-lg shadow-emerald-500/10 shrink-0 select-none"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Aprovar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          
          <div className="p-4 sm:p-8 pt-4 border-t border-white/5 bg-black/20 text-right shrink-0">
            <Button 
              type="button"
              onClick={() => setIsValidationDialogOpen(false)}
              className="px-6 rounded-xl h-10 bg-white/5 hover:bg-white/10 text-white font-black uppercase text-[10px] tracking-widest transition-all"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!timelineDetail} onOpenChange={(open) => !open && setTimelineDetail(null)}>
        <DialogContent className="rounded-[2rem] sm:rounded-[2.5rem] w-[95vw] sm:max-w-[700px] glass border-white/10 text-slate-100 p-0 overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
          <div className="flex flex-col">
            <div className={cn(
              "h-2 w-full shadow-[0_4px_10px_rgba(0,0,0,0.3)]",
              timelineDetail === 'urgent' ? "bg-red-500" :
              timelineDetail === 'medium' ? "bg-amber-500" :
              timelineDetail === 'low' ? "bg-blue-500" :
              "bg-emerald-500"
            )} />
            <div className="p-4 sm:p-8 space-y-4 sm:space-y-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black text-white tracking-tight uppercase italic">
                  {timelineDetail === 'urgent' && "Solicitações Urgentes"}
                  {timelineDetail === 'medium' && "Solicitações Médias"}
                  {timelineDetail === 'low' && "Solicitações Baixas"}
                  {timelineDetail === 'completed' && "Solicitações Concluídas"}
                </DialogTitle>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {timelineDetailArts.length} artes encontradas nesta categoria
                </p>
              </DialogHeader>

              <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                {timelineDetailArts.length > 0 ? (
                  timelineDetailArts.map(art => (
                    <div 
                      key={art.id}
                      onClick={() => {
                        setSelectedArt(art);
                        setTimelineDetail(null);
                      }}
                      className="group p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex flex-col gap-1">
                        <h4 className="text-sm font-black text-white italic group-hover:text-pink-400 transition-all">{art.title}</h4>
                        <div className="flex items-center gap-3">
                           <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full">
                            {translateStatus(art.status)}
                          </span>
                          {art.deadline && (
                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5 text-blue-400" />
                              {format(parseISO(art.deadline), "dd/MM/yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge className={cn("text-[8px] font-black uppercase tracking-widest", getPriorityColor(art.priority))}>
                        {translatePriority(art.priority)}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-slate-600 bg-white/[0.01] rounded-3xl border border-dashed border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma arte encontrada</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DJ Asset Presskit Modal */}
      <Dialog open={isDjViewOpen} onOpenChange={(open) => {
        setIsDjViewOpen(open);
        if (!open) {
          setIsEditingDjAsset(false);
          setSelectedDjAssetForView(null);
        }
      }}>
        <DialogContent className="rounded-[2rem] sm:max-w-[700px] w-[95vw] bg-slate-950/90 backdrop-blur-xl border border-white/10 text-slate-100 p-4 sm:p-8 max-h-[92vh] overflow-hidden flex flex-col shadow-2xl z-[99999]">
          {!isEditingDjAsset ? (
            // --- VIEW MODE ---
            <>
              <DialogHeader className="shrink-0 pb-4 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                      <Disc className="w-5 h-5 text-white animate-spin" style={{ animationDuration: '6s' }} />
                    </div>
                    <div className="text-left">
                      <DialogTitle className="text-xl sm:text-2xl font-black text-white tracking-tight">
                        {selectedDjAssetForView?.name}
                      </DialogTitle>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Ficha de Informações do DJ / Atração
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full",
                      selectedDjAssetForView?.presskitStatus === 'completed' ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-slate-400"
                    )}>
                      {selectedDjAssetForView?.presskitStatus === 'completed' ? 'Preenchido' : 'Pendente'}
                    </span>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto py-6 space-y-6 pr-1 custom-scrollbar">
                {/* Link de Preenchimento Exclusivo para o DJ */}
                {selectedDjAssetForView && (
                  <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="space-y-0.5 text-left">
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
                        const shareUrl = `${window.location.origin}${window.location.pathname}?djShare=${event.id}_${selectedDjAssetForView.id}`;
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

                {/* Row 1: Status Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                  <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-1">
                    <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">Prioridade da Arte</p>
                    <p className={cn(
                      "text-xs font-black uppercase tracking-wider",
                      selectedDjAssetForView?.priority === 'urgent' ? "text-rose-400" :
                      selectedDjAssetForView?.priority === 'medium' ? "text-amber-400" :
                      "text-emerald-400"
                    )}>
                      {selectedDjAssetForView?.priority === 'low' ? 'Baixa' : selectedDjAssetForView?.priority === 'medium' ? 'Média' : 'Urgente'}
                    </p>
                  </div>

                  <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-1">
                    <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">Data de Entrega da Arte</p>
                    <p className="text-xs font-black text-white tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-pink-400" />
                      {selectedDjAssetForView?.artDeadline || 'Não definida'}
                    </p>
                  </div>
                </div>

                {/* Presskit Link */}
                <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl space-y-3 text-left">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Link do Presskit & Fotos
                  </p>
                  {selectedDjAssetForView?.presskitUrl ? (
                    <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-2xl border border-white/10">
                      <span className="text-xs font-bold text-slate-200 truncate pr-4">
                        {selectedDjAssetForView.presskitType === 'email' ? `📨 E-mail: ${selectedDjAssetForView.presskitUrl}` : selectedDjAssetForView.presskitUrl}
                      </span>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedDjAssetForView.presskitUrl || '');
                            toast.success("Copiado com sucesso!");
                          }}
                          className="h-8 rounded-xl text-[10px] uppercase font-black tracking-widest"
                        >
                          Copiar
                        </Button>
                        {selectedDjAssetForView.presskitType === 'email' ? (
                          selectedDjAssetForView.presskitUrl.includes('@') ? (
                            <a
                              href={`mailto:${selectedDjAssetForView.presskitUrl}`}
                              className="inline-flex items-center justify-center h-8 rounded-xl text-[10px] uppercase font-black tracking-widest bg-purple-500 text-white hover:bg-purple-600 px-3 transition-colors"
                            >
                              Enviar E-mail
                            </a>
                          ) : null
                        ) : (
                          <a
                            href={selectedDjAssetForView.presskitUrl}
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
                {selectedDjAssetForView?.hasMandatoryLogo ? (
                  <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl space-y-4 text-left">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                      Logos Obrigatórios para Materiais de Divulgação
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Agencies */}
                      <div className="space-y-2">
                        <p className="text-[9px] uppercase font-black tracking-widest text-amber-400/80">Agência(s)</p>
                        {selectedDjAssetForView.agencies && selectedDjAssetForView.agencies.length > 0 ? (
                          <div className="space-y-1.5">
                            {selectedDjAssetForView.agencies.map((agency, i) => (
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
                        {selectedDjAssetForView.labels && selectedDjAssetForView.labels.length > 0 && selectedDjAssetForView.labels.some(l => l.name?.trim()) ? (
                          <div className="space-y-1.5">
                            {selectedDjAssetForView.labels.map((label, i) => label.name && (
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
                  <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl text-left">
                    <p className="text-xs text-slate-500 font-bold italic">Nenhum logo obrigatório exigido.</p>
                  </div>
                )}

                {/* Material Visual */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                  <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl space-y-3">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                      Foto p/ Flyer
                    </p>
                    {selectedDjAssetForView?.flyerPhoto ? (
                      <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex flex-col justify-between h-[84px]">
                        <p className="text-xs font-bold text-slate-200 line-clamp-2 leading-relaxed">{selectedDjAssetForView.flyerPhoto}</p>
                        {selectedDjAssetForView.flyerPhoto.startsWith('http') && (
                          <a
                            href={selectedDjAssetForView.flyerPhoto}
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
                    {selectedDjAssetForView?.animationVideo ? (
                      <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex flex-col justify-between h-[84px]">
                        <p className="text-xs font-bold text-slate-200 line-clamp-2 leading-relaxed">{selectedDjAssetForView.animationVideo}</p>
                        {selectedDjAssetForView.animationVideo.startsWith('http') && (
                          <a
                            href={selectedDjAssetForView.animationVideo}
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
                <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl space-y-3 text-left">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-pink-400" />
                    Música de Entrada (Track)
                  </p>
                  {selectedDjAssetForView?.musicName ? (
                    <div className="p-4 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-[1.5rem] border border-white/5 flex items-center justify-between">
                      <div className="space-y-1 text-left">
                        <p className="text-sm font-black text-white">{selectedDjAssetForView.musicName}</p>
                        <div className="flex items-center space-x-2 text-slate-500">
                          <Clock className="w-3 h-3 text-purple-400 animate-pulse" />
                          <span className="text-[10px] font-black uppercase">{selectedDjAssetForView.musicDuration || "Duração não definida"}</span>
                        </div>
                      </div>
                      {selectedDjAssetForView.musicUrl && (
                        <a
                          href={selectedDjAssetForView.musicUrl}
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
                  onClick={() => setIsDjViewOpen(false)}
                  className="w-full sm:flex-1 rounded-2xl h-12 border-white/10 hover:bg-white/5 font-black text-slate-300 uppercase tracking-widest text-xs"
                >
                  Fechar
                </Button>
                {onNavigateToDjAssets && selectedDjAssetForView && (
                  <Button
                    type="button"
                    onClick={() => {
                      setIsDjViewOpen(false);
                      onNavigateToDjAssets(selectedDjAssetForView.id);
                    }}
                    className="w-full sm:flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-505 text-white border border-purple-500/20 rounded-2xl h-12 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_0_20px_rgba(147,51,234,0.3)]"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Ver em DJs
                  </Button>
                )}
                <Button
                  onClick={handleStartEditDj}
                  className="w-full sm:flex-1 bg-pink-500 hover:bg-pink-600 text-white rounded-2xl h-12 font-black shadow-[0_0_20px_rgba(236,72,153,0.3)] uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Editar Informações
                </Button>
              </DialogFooter>
            </>
          ) : (
            // --- EDIT MODE ---
            <>
              <DialogHeader className="shrink-0 pb-4 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-tr from-pink-500 to-rose-500 rounded-full flex items-center justify-center shadow-lg">
                      <Pencil className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <DialogTitle className="text-xl sm:text-2xl font-black text-white tracking-tight">
                        Editar DJ: {selectedDjAssetForView?.name}
                      </DialogTitle>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Atualizar Ficha de Informações do DJ
                      </p>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto py-6 space-y-6 pr-1 custom-scrollbar text-left">
                {/* Nome do DJ */}
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Nome do DJ / Atração</Label>
                  <Input
                    value={editDjForm.name || ''}
                    onChange={(e) => setEditDjForm(prev => ({ ...prev, name: e.target.value }))}
                    className="rounded-xl border-white/10 bg-white/5 text-white h-11 text-xs"
                  />
                </div>

                {/* Prioridade e Data */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Prioridade da Arte</Label>
                    <Select
                      value={editDjForm.priority || 'medium'}
                      onValueChange={(val: any) => setEditDjForm(prev => ({ ...prev, priority: val }))}
                    >
                      <SelectTrigger className="rounded-xl border-white/10 bg-white/5 text-white h-11 text-xs">
                        <SelectValue placeholder="Prioridade" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Data de Entrega da Arte</Label>
                    <Input
                      type="date"
                      value={editDjForm.artDeadline || ''}
                      onChange={(e) => setEditDjForm(prev => ({ ...prev, artDeadline: e.target.value }))}
                      className="rounded-xl border-white/10 bg-white/5 text-white h-11 text-xs"
                    />
                  </div>
                </div>

                {/* Link do Presskit */}
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Link do Presskit & Fotos</Label>
                  <Input
                    value={editDjForm.presskitUrl || ''}
                    onChange={(e) => setEditDjForm(prev => ({ ...prev, presskitUrl: e.target.value }))}
                    className="rounded-xl border-white/10 bg-white/5 text-white h-11 text-xs"
                    placeholder="https://drive.google.com/..."
                  />
                </div>

                {/* Foto p/ Flyer e Vídeo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Link Foto p/ Flyer</Label>
                    <Input
                      value={editDjForm.flyerPhoto || ''}
                      onChange={(e) => setEditDjForm(prev => ({ ...prev, flyerPhoto: e.target.value }))}
                      className="rounded-xl border-white/10 bg-white/5 text-white h-11 text-xs"
                      placeholder="URL ou Nome da Imagem"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Link Vídeo p/ Motion</Label>
                    <Input
                      value={editDjForm.animationVideo || ''}
                      onChange={(e) => setEditDjForm(prev => ({ ...prev, animationVideo: e.target.value }))}
                      className="rounded-xl border-white/10 bg-white/5 text-white h-11 text-xs"
                      placeholder="Link do vídeo ou instrução"
                    />
                  </div>
                </div>

                {/* Música de Entrada Info */}
                <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-4">
                  <p className="text-[10px] text-pink-400 font-black uppercase tracking-widest">Trilha de Entrada (Áudio)</p>
                  
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Nome da Música</Label>
                    <Input
                      value={editDjForm.musicName || ''}
                      onChange={(e) => setEditDjForm(prev => ({ ...prev, musicName: e.target.value }))}
                      className="rounded-xl border-white/10 bg-white/5 text-white h-11 text-xs"
                      placeholder="Ex: Alok - Hear Me Now"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Link de Download / Player</Label>
                      <Input
                        value={editDjForm.musicUrl || ''}
                        onChange={(e) => setEditDjForm(prev => ({ ...prev, musicUrl: e.target.value }))}
                        className="rounded-xl border-white/10 bg-white/5 text-white h-11 text-xs"
                        placeholder="https://gdrive.com/..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Duração / Drop Marcado</Label>
                      <Input
                        value={editDjForm.musicDuration || ''}
                        onChange={(e) => setEditDjForm(prev => ({ ...prev, musicDuration: e.target.value }))}
                        className="rounded-xl border-white/10 bg-white/5 text-white h-11 text-xs"
                        placeholder="Ex: 01:15 - 01:45"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-4 border-t border-white/5 flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditingDjAsset(false)}
                  className="w-full sm:w-1/3 rounded-2xl h-12 border-white/10 hover:bg-white/5 font-black text-slate-300 uppercase tracking-widest text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => handleSaveDjAsset(editDjForm)}
                  className="w-full sm:w-2/3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl h-12 font-black shadow-[0_0_20px_rgba(16,185,129,0.3)] uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Salvar Alterações
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DragDropContext>
    </div>
  );
}
