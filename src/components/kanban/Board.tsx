import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical, MessageSquare, Clock, Calendar, Palette, MoreHorizontal, User, ChevronLeft, ChevronRight, Music, PartyPopper, Star, AlertTriangle, List, Layout, GanttChart } from "lucide-react";
import { EventProject, UserProfile, ArtTask, OperationType, PendingChange } from "../../types";
import { collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, deleteDoc, orderBy } from "firebase/firestore";
import { db, handleFirestoreError } from "../../firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, isThisWeek, addWeeks, isSameWeek, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface KanbanBoardProps {
  event: EventProject;
  profile: UserProfile;
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

export function KanbanBoard({ event, profile }: KanbanBoardProps) {
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
    category: 'dj' as const,
    deadline: '',
    color: '#000000',
    status: 'todo' as ColumnId
  });

  const [selectedArt, setSelectedArt] = useState<ArtTask | null>(null);
  const [editArt, setEditArt] = useState<Partial<ArtTask> | null>(null);

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

  const handleAddArt = async () => {
    if (!newArt.title.trim()) return;
    setLoading(true);
    const status = newArt.status;
    const path = `events/${event.id}/arts`;
    
    // Calculate new position
    const columnArts = arts.filter(a => a.status === status);
    const maxPosition = columnArts.length > 0 
      ? Math.max(...columnArts.map(a => a.position || 0))
      : 0;

    try {
      if (profile.role === 'contractor') {
        // Create the art card first
        const docRef = await addDoc(collection(db, 'events', event.id, 'arts'), {
          ...newArt,
          title: newArt.title.trim(),
          description: newArt.description.trim(),
          priority: newArt.priority,
          category: newArt.category,
          deadline: newArt.deadline || null,
          status: status,
          position: maxPosition + 1000,
          isPendingCreate: true, // Mark it as pending
          createdAt: serverTimestamp(),
        });

        // Register the pending change with the target doc ID
        const pendingChangeData = {
          type: 'create',
          proposedData: {
            title: newArt.title.trim(),
            description: newArt.description.trim(),
            priority: newArt.priority,
            category: newArt.category,
            deadline: newArt.deadline || null,
            status: status,
            position: maxPosition + 1000
          },
          originalData: null,
          targetId: docRef.id,
          title: `Criação de nova Arte "${newArt.title}"`,
          contractorName: profile.name || 'Cliente',
          contractorEmail: profile.email,
          status: 'pending',
          createdAt: serverTimestamp()
        };
        await addDoc(collection(db, 'events', event.id, 'pending_changes'), pendingChangeData);
        setIsAddOpen(false);
        setNewArt({ 
          title: '', 
          description: '', 
          priority: 'medium', 
          category: 'dj', 
          deadline: '', 
          color: '#000000',
          status: 'todo'
        });
        toast.info("Nova arte cadastrada e enviada para aprovação do designer!");
      } else {
        await addDoc(collection(db, 'events', event.id, 'arts'), {
          ...newArt,
          eventId: event.id,
          status: status,
          position: maxPosition + 1000, // Large gap for easier reordering if needed
          createdAt: serverTimestamp(),
        });
        setIsAddOpen(false);
        setNewArt({ 
          title: '', 
          description: '', 
          priority: 'medium', 
          category: 'dj', 
          deadline: '', 
          color: '#000000',
          status: 'todo'
        });
        toast.success(`Arte adicionada em ${translateStatus(status)}!`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      toast.error("Erro ao solicitar criação de arte");
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
        // Update the art doc immediately!
        await updateDoc(doc(db, 'events', event.id, 'arts', selectedArt.id), {
          title: editArt.title || selectedArt.title,
          description: editArt.description || '',
          priority: editArt.priority || 'medium',
          category: editArt.category || 'dj',
          deadline: editArt.deadline || null,
          status: editArt.status || 'todo'
        });

        // Register the pending change
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

  const updateArtStatus = async (artId: string, newStatus: string) => {
    const path = `events/${event.id}/arts/${artId}`;
    try {
      if (profile.role === 'contractor') {
        const artToMove = arts.find(a => a.id === artId);
        if (artToMove) {
          // Update immediately!
          await updateDoc(doc(db, 'events', event.id, 'arts', artId), { status: newStatus });

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
          toast.success("Status atualizado e enviado para aprovação do designer!");
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
        const artToDelete = arts.find(a => a.id === artId);
        if (artToDelete) {
          // Set isPendingDelete to true immediately on the art!
          await updateDoc(doc(db, 'events', event.id, 'arts', artId), {
            isPendingDelete: true
          });

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
    return arts.filter(a => {
      const matchesPriority = priorityFilter === 'all' || a.priority === priorityFilter;
      const matchesCategory = categoryFilter === 'all' || a.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
      return matchesPriority && matchesCategory && matchesStatus;
    });
  }, [arts, priorityFilter, categoryFilter, statusFilter]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

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

  const summaryStats = useMemo(() => {
    const now = new Date();
    
    return {
      urgent: filteredArts.filter(a => 
        a.priority === 'high' && 
        !['finished', 'delivered'].includes(a.status) && 
        a.deadline && isThisWeek(parseISO(a.deadline), { weekStartsOn: 0 })
      ).length,
      medium: filteredArts.filter(a => 
        a.priority === 'medium' && 
        !['finished', 'delivered'].includes(a.status) && 
        a.deadline && isSameWeek(parseISO(a.deadline), addWeeks(now, 1), { weekStartsOn: 0 })
      ).length,
      low: filteredArts.filter(a => 
        !['finished', 'delivered'].includes(a.status) && 
        (a.priority === 'low' || !a.deadline || isAfter(parseISO(a.deadline), endOfWeek(addWeeks(now, 1), { weekStartsOn: 0 })))
      ).filter(a => {
        // Exclude those already counted in urgent/medium if they overlap
        const isUrgent = a.priority === 'high' && a.deadline && isThisWeek(parseISO(a.deadline), { weekStartsOn: 0 });
        const isMedium = a.priority === 'medium' && a.deadline && isSameWeek(parseISO(a.deadline), addWeeks(now, 1), { weekStartsOn: 0 });
        return !isUrgent && !isMedium;
      }).length,
      completed: filteredArts.filter(a => ['finished', 'delivered'].includes(a.status)).length
    };
  }, [filteredArts]);

  const timelineDetailArts = useMemo(() => {
    if (!timelineDetail) return [];
    const now = new Date();
    switch (timelineDetail) {
      case 'urgent':
        return filteredArts.filter(a => 
          a.priority === 'high' && 
          !['finished', 'delivered'].includes(a.status) && 
          a.deadline && isThisWeek(parseISO(a.deadline), { weekStartsOn: 0 })
        );
      case 'medium':
        return filteredArts.filter(a => 
          a.priority === 'medium' && 
          !['finished', 'delivered'].includes(a.status) && 
          a.deadline && isSameWeek(parseISO(a.deadline), addWeeks(now, 1), { weekStartsOn: 0 })
        );
      case 'low':
        return filteredArts.filter(a => 
          !['finished', 'delivered'].includes(a.status) && 
          (a.priority === 'low' || !a.deadline || isAfter(parseISO(a.deadline), endOfWeek(addWeeks(now, 1), { weekStartsOn: 0 })))
        ).filter(a => {
          const isUrgent = a.priority === 'high' && a.deadline && isThisWeek(parseISO(a.deadline), { weekStartsOn: 0 });
          const isMedium = a.priority === 'medium' && a.deadline && isSameWeek(parseISO(a.deadline), addWeeks(now, 1), { weekStartsOn: 0 });
          return !isUrgent && !isMedium;
        });
      case 'completed':
        return filteredArts.filter(a => ['finished', 'delivered'].includes(a.status));
      default:
        return [];
    }
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
        await updateDoc(doc(db, 'events', event.id, 'arts', draggableId), {
          deadline: newDate
        });
        toast.success(`Prazo alterado para ${format(parseISO(newDate), "dd/MM")}`);
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
    const columnArts = arts
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
        const artToMove = arts.find(a => a.id === draggableId);
        if (artToMove) {
          // Update immediately!
          await updateDoc(doc(db, 'events', event.id, 'arts', draggableId), {
            status: destStatus,
            position: newPosition
          });

          // Only create pending_changes if it actually changed columns
          if (artToMove.status !== destStatus) {
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
            toast.success("Movimentação aplicada e enviada para aprovação do designer!");
          }
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-black/40 p-2 rounded-[2rem] border border-white/5">
        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-2xl border border-white/5">
          <button 
            onClick={() => setViewMode('kanban')}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              viewMode === 'kanban' ? "bg-white/10 text-white shadow-xl" : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]"
            )}
          >
            <Layout className="w-4 h-4" />
            <span>Quadro</span>
          </button>
          <button 
            onClick={() => setViewMode('calendar')}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              viewMode === 'calendar' ? "bg-white/10 text-white shadow-xl" : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]"
            )}
          >
            <Calendar className="w-4 h-4" />
            <span>Calendário</span>
          </button>
          <button 
            onClick={() => setViewMode('timeline')}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              viewMode === 'timeline' ? "bg-white/10 text-white shadow-xl" : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]"
            )}
          >
            <GanttChart className="w-4 h-4" />
            <span>Timeline</span>
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              viewMode === 'list' ? "bg-white/10 text-white shadow-xl" : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]"
            )}
          >
            <List className="w-4 h-4" />
            <span>Lista</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-white/5 border-white/10 text-slate-400 font-bold uppercase tracking-widest text-[9px] rounded-full px-4 h-10 flex items-center">
            {arts.length} Artes no Total
          </Badge>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 bg-white/[0.02] p-6 rounded-[2.5rem] border border-white/5 shadow-inner">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-1">
            <Palette className="w-3.5 h-3.5 text-pink-500" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Filtrar por Categoria</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button 
              variant={categoryFilter === 'dj' ? "secondary" : "outline"}
              onClick={() => setCategoryFilter(categoryFilter === 'dj' ? 'all' : 'dj')}
              className={cn(
                "rounded-xl text-[10px] font-black uppercase tracking-widest h-9 px-4 transition-all",
                categoryFilter === 'dj' ? "bg-purple-500/20 text-purple-400 border-purple-500/40" : "bg-white/5 border-white/5 text-slate-500 hover:bg-purple-500/10"
              )}
            >
              🎧 DJs
            </Button>
            <Button 
              variant={categoryFilter === 'party' ? "secondary" : "outline"}
              onClick={() => setCategoryFilter(categoryFilter === 'party' ? 'all' : 'party')}
              className={cn(
                "rounded-xl text-[10px] font-black uppercase tracking-widest h-9 px-4 transition-all",
                categoryFilter === 'party' ? "bg-blue-500/20 text-blue-400 border-blue-500/40" : "bg-white/5 border-white/5 text-slate-500 hover:bg-blue-500/10"
              )}
            >
              🎪 Festa
            </Button>
            <Button 
              variant={categoryFilter === 'branding' ? "secondary" : "outline"}
              onClick={() => setCategoryFilter(categoryFilter === 'branding' ? 'all' : 'branding')}
              className={cn(
                "rounded-xl text-[10px] font-black uppercase tracking-widest h-9 px-4 transition-all",
                categoryFilter === 'branding' ? "bg-amber-500/20 text-amber-400 border-amber-500/40" : "bg-white/5 border-white/5 text-slate-500 hover:bg-amber-500/10"
              )}
            >
              ⭐ Branding
            </Button>
          </div>
        </div>

        {(viewMode === 'calendar' || viewMode === 'list') && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1">
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
          <div className="flex flex-col gap-2 md:items-end md:ml-auto">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Prioridade</span>
            <div className="flex items-center bg-black/40 p-1.5 rounded-xl border border-white/5">
              <button 
                onClick={() => setPriorityFilter('all')}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all",
                  priorityFilter === 'all' ? "bg-white/10 text-white" : "text-slate-600 hover:text-slate-400"
                )}
              >
                Todas
              </button>
              <button 
                onClick={() => setPriorityFilter('high')}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all text-[10px] font-black uppercase tracking-tighter",
                  priorityFilter === 'high' ? "bg-red-500/20 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.1)]" : "text-slate-700 hover:text-red-400/50"
                )}
              >
                <span className="text-[12px]">🔴</span>
                <span>Urgente</span>
              </button>
              <button 
                onClick={() => setPriorityFilter('medium')}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all text-[10px] font-black uppercase tracking-tighter",
                  priorityFilter === 'medium' ? "bg-amber-500/20 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.1)]" : "text-slate-700 hover:text-amber-400/50"
                )}
              >
                <span className="text-[12px]">🟡</span>
                <span>Média</span>
              </button>
              <button 
                onClick={() => setPriorityFilter('low')}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all text-[10px] font-black uppercase tracking-tighter",
                  priorityFilter === 'low' ? "bg-emerald-500/20 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.1)]" : "text-slate-700 hover:text-emerald-400/50"
                )}
              >
                <span className="text-[12px]">🟢</span>
                <span>Baixa</span>
              </button>
            </div>
          </div>

          <div className="h-10 w-[1px] bg-white/5 hidden lg:block mx-2" />

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger render={
              <Button 
                onClick={() => setNewArt(prev => ({ ...prev, status: 'todo' }))}
                className="bg-gradient-to-tr from-purple-500 to-pink-500 text-white hover:opacity-90 rounded-2xl w-12 h-12 flex items-center justify-center p-0 shadow-[0_0_15px_rgba(236,72,153,0.3)] border-none font-black transition-all hover:scale-105 active:scale-95"
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
          <div key={column.id} className="flex flex-col space-y-3 rounded-3xl bg-white/5 p-4 border border-white/5 backdrop-blur-md w-[280px] shrink-0 shadow-2xl snap-center transition-transform hover:scale-[1.01]">
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

            <div className="flex-1 space-y-3">
              <Droppable droppableId={column.id}>
                {(provided) => (
                  <div 
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="flex-1 space-y-3 min-h-[100px]"
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
                                      onClick={() => !snapshot.isDragging && setSelectedArt(art)}
                                      className={cn(
                                        "rounded-xl border-white/5 shadow-2xl hover:bg-white/10 transition-all duration-300 group relative overflow-hidden backdrop-blur-md cursor-pointer",
                                        snapshot.isDragging ? "bg-slate-800 border-white/20" : "bg-slate-900/60 border",
                                        art.isPendingDelete && "opacity-50 border-rose-500/30"
                                      )}
                                    >
                                      <div className={`absolute top-0 left-0 w-1 h-full shadow-[2px_0_15px_rgba(255,255,255,0.05)] ${getPriorityColor(art.priority)}`} />
                                      <CardContent className="p-2.5 space-y-2">
                                        <div className="flex justify-between items-start -mb-4 relative z-10 px-1.5 pt-0.5">
                                          <div>
                                            {activeChange ? (
                                              <span className={cn(
                                                "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider inline-flex items-center gap-1 border animate-pulse",
                                                activeChange.type === 'create' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]" :
                                                activeChange.type === 'update' ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                                                activeChange.type === 'status' ? "bg-purple-500/20 text-purple-400 border-purple-500/30" :
                                                "bg-rose-500/20 text-rose-400 border-rose-500/30 font-bold"
                                              )}>
                                                <Clock className="w-2 h-2 animate-pulse" />
                                                {activeChange.type === 'create' ? "Novo" :
                                                 activeChange.type === 'update' ? "Editado" :
                                                 activeChange.type === 'status' ? "Movido" :
                                                 "Excluindo"}
                                              </span>
                                            ) : art.isPendingCreate ? (
                                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider inline-flex items-center gap-1 border bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)] animate-pulse">
                                                <Clock className="w-2 h-2 animate-pulse" />
                                                Novo
                                              </span>
                                            ) : null}
                                          </div>
                                          <span className="text-sm filter drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                                            {art.category === 'dj' && '🎧'}
                                            {art.category === 'party' && '🎪'}
                                            {art.category === 'branding' && '⭐️'}
                                          </span>
                                        </div>

                                        <div className="space-y-0.5 pl-1.5">
                                          <h4 className="font-black text-white text-[12px] leading-tight group-hover:text-pink-300 transition-colors uppercase tracking-tight pr-6">{art.title}</h4>
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
                  className="group relative bg-white/[0.02] hover:bg-white/5 border border-white/5 rounded-2xl p-4 md:p-6 transition-all hover:scale-[1.01] hover:shadow-2xl overflow-hidden cursor-pointer"
                  onClick={() => setSelectedArt(art)}
                >
                  <div className={`absolute top-0 left-0 w-1.5 h-full ${getPriorityColor(art.priority)}`} />
                  <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-4 items-center">
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-white group-hover:text-pink-400 transition-all uppercase italic">{art.title}</h4>
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
        <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 space-y-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between px-2">
            <div className="flex flex-col">
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h3>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.2em] mt-1">
                ENTREGAS E PRAZOS
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/5">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="w-10 h-10 rounded-xl hover:bg-white/10 text-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setCurrentMonth(new Date())}
                className="text-[9px] font-black uppercase tracking-widest px-4 hover:bg-white/10 text-slate-400 hover:text-white"
              >
                Hoje
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="w-10 h-10 rounded-xl hover:bg-white/10 text-white"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
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
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDay = isToday(day);

              return (
                <Droppable droppableId={`date:${dateString}`} key={idx} isDropDisabled={!isCurrentMonth}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "min-h-[140px] p-3 rounded-2xl border transition-all flex flex-col gap-2 relative group",
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
                                  onClick={() => !snapshot.isDragging && setSelectedArt(task)}
                                  className={cn(
                                    "w-full text-left p-2 rounded-lg text-[9px] font-black uppercase tracking-tight border border-white/5 transition-all line-clamp-1",
                                    task.priority === 'high' ? "bg-red-500/20 text-red-400 border-red-500/20" :
                                    task.priority === 'medium' ? "bg-amber-500/20 text-amber-400 border-amber-500/20" :
                                    "bg-emerald-500/20 text-emerald-400 border-emerald-500/20",
                                    snapshot.isDragging && "z-50 shadow-2xl scale-105 rotate-2 brightness-125"
                                  )}
                                >
                                  {task.title}
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

      {viewMode === 'timeline' && (
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
      )}

      <Dialog open={!!selectedArt} onOpenChange={(open) => !open && setSelectedArt(null)}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-[600px] glass border-white/10 text-slate-100 p-0 overflow-hidden">
          {selectedArt && editArt && (
            <div className="flex flex-col">
              <div className={`h-2 w-full ${getPriorityColor(editArt.priority || 'medium')} shadow-[0_4px_10px_rgba(0,0,0,0.3)]`} />
              <div className="p-8 space-y-8">
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
                    className="text-2xl font-black text-white tracking-tight border-none bg-white/5 rounded-2xl h-14 focus:ring-pink-500 uppercase italic px-6"
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
                  {(() => {
                    const activeChange = pendingChanges.find(c => c.targetId === selectedArt.id && c.status === 'pending');
                    if (!activeChange) return null;
                    return (
                      <div className="p-5 rounded-[2rem] bg-amber-500/5 border border-amber-500/10 space-y-3 relative overflow-hidden backdrop-blur-md">
                        <div className="flex items-center gap-2 text-amber-400 font-black text-[10px] uppercase tracking-wider">
                          <Clock className="w-3.5 h-3.5 animate-pulse" />
                          <span>Alterações Ativas Pendentes de Validação</span>
                        </div>
                        <div className="text-[11px] text-slate-300 leading-relaxed font-semibold">
                          Esta tarefa possui as seguintes alterações sugeridas pelo contratante que estão aguardando aprovação do designer:
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                          {activeChange.originalData?.description !== activeChange.proposedData?.description && (
                            <div className="col-span-2 space-y-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Mudança na Descrição:</span>
                              <div className="grid grid-cols-2 gap-3 text-[10px]">
                                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-slate-400 max-h-[140px] overflow-y-auto">
                                  <span className="font-bold block text-red-400 mb-1">Original:</span>
                                  <span className="italic">{activeChange.originalData?.description || "Sem descrição"}</span>
                                </div>
                                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 max-h-[140px] overflow-y-auto">
                                  <span className="font-bold block text-emerald-400 mb-1">Proposto:</span>
                                  <span className="italic">{activeChange.proposedData?.description || "Sem descrição"}</span>
                                </div>
                              </div>
                            </div>
                          )}
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
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-3">
                    <Label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 italic">Descrição & Instruções</Label>
                    <Textarea 
                      value={editArt.description}
                      onChange={e => setEditArt({...editArt, description: e.target.value})}
                      placeholder="Instruções para o designer..."
                      className="p-6 rounded-[2rem] bg-black/40 border border-white/5 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap italic font-medium min-h-[150px] focus:ring-pink-500"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button 
                    onClick={handleSaveArt}
                    disabled={loading}
                    className="flex-1 rounded-[1.5rem] h-14 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 border-none text-white font-black uppercase text-xs tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                  >
                    {loading ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => handleDeleteArt(selectedArt.id)}
                    className="w-14 h-14 rounded-[1.5rem] border-none bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                  >
                    <Palette className="w-5 h-5 rotate-45" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!timelineDetail} onOpenChange={(open) => !open && setTimelineDetail(null)}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-[700px] glass border-white/10 text-slate-100 p-0 overflow-hidden">
          <div className="flex flex-col">
            <div className={cn(
              "h-2 w-full shadow-[0_4px_10px_rgba(0,0,0,0.3)]",
              timelineDetail === 'urgent' ? "bg-red-500" :
              timelineDetail === 'medium' ? "bg-amber-500" :
              timelineDetail === 'low' ? "bg-blue-500" :
              "bg-emerald-500"
            )} />
            <div className="p-8 space-y-6">
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
                        <h4 className="text-sm font-black text-white uppercase italic group-hover:text-pink-400 transition-all">{art.title}</h4>
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
    </DragDropContext>
    </div>
  );
}
