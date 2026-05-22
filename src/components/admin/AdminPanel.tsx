import { useState, useEffect } from 'react';
import { UserProfile, EventProject, OperationType, ViewType } from '../../types';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { db, handleFirestoreError } from '../../firebase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Users, Palette, Calendar, Shield, Trash2, Edit, Plus, Search, 
  UserCheck, MapPin, Mail, ExternalLink, Filter, HelpCircle, 
  CheckCircle2, Clock, Check, RefreshCw, Layers, Sparkles, Settings
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "motion/react";

interface AdminPanelProps {
  profile: UserProfile;
}

export function AdminPanel({ profile }: AdminPanelProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<EventProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'events'>('users');
  
  // Search & Filter
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [eventSearch, setEventSearch] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState<string>('all');

  // Modals state
  const [isUserEditOpen, setIsUserEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'contractor' as 'designer' | 'contractor' });
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  // Custom Confirmation Dialog state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    description: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const customConfirm = (title: string, description: string, onConfirm: () => void | Promise<void>) => {
    setConfirmConfig({ title, description, onConfirm });
    setIsConfirmOpen(true);
  };

  // Event Edit / Designate Modal state
  const [isEventEditOpen, setIsEventEditOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventProject | null>(null);
  const [eventForm, setEventForm] = useState({
    name: '',
    city: '',
    location: '',
    status: 'planning' as 'planning' | 'ongoing' | 'completed',
    contractorId: '',
    designerId: '',
    contractorEmail: '',
    designerEmail: '',
    driveUrl: ''
  });

  // Load real-time data
  useEffect(() => {
    setLoading(true);
    
    const unsubscribeUsers = onSnapshot(query(collection(db, 'users')), (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as UserProfile));
      setUsers(usersList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubscribeEvents = onSnapshot(query(collection(db, 'events')), (snapshot) => {
      const eventsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as EventProject));
      setEvents(eventsList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });

    return () => {
      unsubscribeUsers();
      unsubscribeEvents();
    };
  }, []);



  // User Crud Handlers
  const handleOpenEditUser = (u: UserProfile) => {
    setSelectedUser(u);
    setUserForm({
      name: u.name,
      email: u.email,
      role: u.role
    });
    setIsUserEditOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), {
        name: userForm.name,
        role: userForm.role,
        email: userForm.email
      });
      toast.success(`Usuário ${userForm.name} atualizado com sucesso!`);
      setIsUserEditOpen(false);
    } catch (err) {
      toast.error("Erro ao atualizar o usuário.");
      console.error(err);
    }
  };

  const handleOpenAddUser = () => {
    setUserForm({ name: '', email: '', role: 'contractor' });
    setIsAddUserOpen(true);
  };

  const handleCreateUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim()) {
      toast.error("Por favor preencha todos os campos.");
      return;
    }
    try {
      // Create with a generated doc ID or email md5 prefix, typical firestore generated is fine
      const fakeId = doc(collection(db, 'users')).id;
      const newUserDoc = {
        id: fakeId,
        name: userForm.name.trim(),
        email: userForm.email.trim().toLowerCase(),
        role: userForm.role,
        createdAt: serverTimestamp()
      };
      await setDoc(doc(db, 'users', fakeId), newUserDoc);
      toast.success(`Usuário ${userForm.name} pré-cadastrado!`);
      setIsAddUserOpen(false);
    } catch (err) {
      toast.error("Erro ao cadastrar usuário.");
      console.error(err);
    }
  };

  const handleDeleteUser = async (userToDelete: UserProfile) => {
    if (userToDelete.email === 'beysarts@gmail.com') {
      toast.error("O Administrador mestre não pode ser removido!");
      return;
    }
    customConfirm(
      "Excluir Usuário",
      `Tem certeza que deseja excluir o usuário "${userToDelete.name}" (${userToDelete.email})? Esta ação é irreversível.`,
      async () => {
        try {
          await deleteDoc(doc(db, 'users', userToDelete.id));
          toast.success("Usuário removido da base de dados.");
        } catch (err) {
          toast.error("Erro ao excluir usuário.");
          console.error(err);
        }
      }
    );
  };

  // Event Assign Handlers
  const handleOpenEditEvent = (ev: EventProject) => {
    setSelectedEvent(ev);
    setEventForm({
      name: ev.name || '',
      city: ev.city || '',
      location: ev.location || '',
      status: ev.status || 'planning',
      contractorId: ev.contractorId || '',
      designerId: ev.designerId || '',
      contractorEmail: ev.contractorEmail || '',
      designerEmail: ev.designerEmail || '',
      driveUrl: ev.driveUrl || ''
    });
    setIsEventEditOpen(true);
  };

  const handleUpdateEventAssignment = async () => {
    if (!selectedEvent) return;
    try {
      const selectedContractor = users.find(u => u.id === eventForm.contractorId);
      const selectedDesigner = users.find(u => u.id === eventForm.designerId);

      const updatedPayload: Partial<EventProject> = {
        name: eventForm.name,
        city: eventForm.city,
        location: eventForm.location,
        status: eventForm.status,
        driveUrl: eventForm.driveUrl,
        contractorId: eventForm.contractorId,
        designerId: eventForm.designerId,
        contractorEmail: selectedContractor ? selectedContractor.email : eventForm.contractorEmail,
        designerEmail: selectedDesigner ? selectedDesigner.email : eventForm.designerEmail,
        contractorName: selectedContractor ? selectedContractor.name : (eventForm.contractorId === 'unresolved' ? 'Pendente' : 'Usuário Externo'),
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'events', selectedEvent.id), updatedPayload);
      toast.success("Festa atualizada e vinculada com sucesso!");
      setIsEventEditOpen(false);
    } catch (err) {
      toast.error("Erro ao atualizar o evento.");
      console.error(err);
    }
  };

  const handleDeleteEvent = async (ev: EventProject) => {
    customConfirm(
      "Apagar Evento/Festa",
      `ATENÇÃO: Deseja apagar o evento "${ev.name}"? Isso não removerá as artes criadas nem os arquivos associados, mas removerá o projeto da listagem definitivamente.`,
      async () => {
        try {
          await deleteDoc(doc(db, 'events', ev.id));
          toast.success("Evento apagado com sucesso.");
        } catch (err) {
          toast.error("Erro ao apagar evento.");
          console.error(err);
        }
      }
    );
  };

  // Safe formatting helpers
  const formatSafeDate = (time: any) => {
    if (!time) return 'Não registrado';
    try {
      if (typeof time.toDate === 'function') {
        return format(time.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      }
      return format(new Date(time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch (e) {
      return 'Formato inválido';
    }
  };

  // Filter lists
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
                          u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  const filteredEvents = events.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(eventSearch.toLowerCase()) ||
                          e.city?.toLowerCase().includes(eventSearch.toLowerCase()) ||
                          e.location?.toLowerCase().includes(eventSearch.toLowerCase()) ||
                          e.contractorEmail?.toLowerCase().includes(eventSearch.toLowerCase()) ||
                          e.designerEmail?.toLowerCase().includes(eventSearch.toLowerCase());
    const matchesStatus = eventStatusFilter === 'all' || e.status === eventStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Roles Count Stats
  const stats = {
    totalUsers: users.length,
    designers: users.filter(u => u.role === 'designer').length,
    contractors: users.filter(u => u.role === 'contractor').length,
    totalEvents: events.length,
    planningEvents: events.filter(e => e.status === 'planning').length,
    activeEvents: events.filter(e => e.status === 'ongoing').length,
    completedEvents: events.filter(e => e.status === 'completed').length,
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-10 h-10 animate-spin text-pink-500" />
        <p className="text-slate-400 font-bold">Carregando dados da central...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      {/* Admin Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 glass-card p-6 md:p-8 rounded-3xl relative overflow-hidden border-pink-500/10 shadow-[0_0_30px_rgba(236,72,153,0.05)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-black tracking-widest uppercase">
            <Shield className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Painel Master Control</span>
          </div>
          <h2 className="text-4xl font-black text-white tracking-tight leading-none font-outfit">
            Central de Gerenciamento
          </h2>
          <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
            Painel administrativo do Backstage para associar e mediar contratantes, designers, convites e controle completo de festas criadas.
          </p>
        </div>

        <div className="shrink-0 flex flex-wrap gap-3">
          <Button
            onClick={handleOpenAddUser}
            className="rounded-2xl h-11 text-xs font-black bg-pink-500 hover:bg-pink-600 text-white shadow-lg shadow-pink-500/20 border-none transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Pré-Cadastrar Usuário
          </Button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-5 rounded-2xl border-white/5 bg-white/5 relative">
          <div className="absolute top-4 right-4 w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">Total Usuários</p>
          <h3 className="text-3xl font-black text-white mt-1">{stats.totalUsers}</h3>
          <p className="text-[10px] text-slate-400 mt-2">Registrados na plataforma</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5 rounded-2xl border-white/5 bg-white/5 relative">
          <div className="absolute top-4 right-4 w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
            <UserCheck className="w-5 h-5" />
          </div>
          <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">Contratantes</p>
          <h3 className="text-3xl font-black text-white mt-1">{stats.contractors}</h3>
          <p className="text-[10px] text-emerald-400 mt-2">Clientes associados</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-5 rounded-2xl border-white/5 bg-white/5 relative">
          <div className="absolute top-4 right-4 w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
            <Palette className="w-5 h-5" />
          </div>
          <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">Designers</p>
          <h3 className="text-3xl font-black text-white mt-1">{stats.designers}</h3>
          <p className="text-[10px] text-indigo-400 mt-2">Criadores / Freelancers</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5 rounded-2xl border-white/5 bg-white/5 relative">
          <div className="absolute top-4 right-4 w-10 h-10 bg-pink-500/10 rounded-xl flex items-center justify-center text-pink-400">
            <Calendar className="w-5 h-5" />
          </div>
          <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">Total Festas</p>
          <h3 className="text-3xl font-black text-white mt-1">{stats.totalEvents}</h3>
          <p className="text-[10px] text-pink-400 mt-2">
            {stats.activeEvents} em andamento • {stats.planningEvents} p/ fazer
          </p>
        </motion.div>
      </div>

      {/* Tabs Selection Bar */}
      <div className="flex border-b border-white/5 pb-px">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center space-x-2 px-6 py-4 border-b-2 font-black tracking-tight text-sm transition-all relative ${
            activeTab === 'users' 
              ? 'border-pink-500 text-white bg-pink-500/5' 
              : 'border-transparent text-slate-500 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Usuários Cadastrados ({users.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`flex items-center space-x-2 px-6 py-4 border-b-2 font-black tracking-tight text-sm transition-all relative ${
            activeTab === 'events' 
              ? 'border-pink-500 text-white bg-pink-500/5' 
              : 'border-transparent text-slate-500 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Festas e Designações ({events.length})</span>
        </button>
      </div>

      {/* USERS MANAGEMENT TAB CONTENT */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* SEARCH FILTERS */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
              <Input
                placeholder="Pesquisar por nome ou email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-11 bg-white/5 border-white/10 rounded-2xl text-white h-11 w-full"
              />
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto shrink-0">
              <Filter className="w-4 h-4 text-slate-500 shrink-0" />
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="bg-[#120b28] border border-white/10 text-white rounded-2xl px-4 h-11 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-pink-500 w-full md:w-44"
              >
                <option value="all">Filtro: Todos</option>
                <option value="designer">Designer</option>
                <option value="contractor">Contratante</option>
              </select>
            </div>
          </div>

          {/* TABLE OF USERS */}
          <div className="glass-card overflow-hidden rounded-2xl border-white/5">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/2 text-slate-500 text-[10px] uppercase font-black tracking-widest">
                    <th className="py-4 px-6">Usuário / Avatar</th>
                    <th className="py-4 px-6">Email Oficial</th>
                    <th className="py-4 px-6">Função/Cargo</th>
                    <th className="py-4 px-6">Cadastro</th>
                    <th className="py-4 px-6 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500 font-bold">
                        Nenhum usuário correspondente aos filtros.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-white/2 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500/20 to-purple-500/20 flex items-center justify-center text-pink-400 font-bold text-sm shrink-0 border border-pink-500/10">
                              {u.name ? u.name.substring(0, 2).toUpperCase() : 'US'}
                            </div>
                            <div>
                              <p className="font-bold text-white leading-none mb-1">{u.name}</p>
                              <p className="text-[9px] text-slate-500 font-mono select-all">{u.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm font-semibold text-slate-300 font-mono">{u.email}</span>
                        </td>
                        <td className="py-4 px-6">
                          {u.role === 'designer' ? (
                            <Badge variant="outline" className="bg-indigo-500/10 border-indigo-400/20 text-indigo-400 py-1 px-2 text-[10px] font-black uppercase">
                              Designer
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-500/10 border-emerald-400/20 text-emerald-400 py-1 px-2 text-[10px] font-black uppercase">
                              Contratante
                            </Badge>
                          )}
                        </td>
                        <td className="py-4 px-6 text-xs text-slate-400 font-medium">
                          {formatSafeDate(u.createdAt)}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEditUser(u)}
                              className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteUser(u)}
                              disabled={u.email === 'beysarts@gmail.com'}
                              className="w-8 h-8 rounded-lg hover:bg-destructive/10 text-slate-500 hover:text-destructive disabled:opacity-30"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EVENTS MANAGEMENT TAB CONTENT */}
      {activeTab === 'events' && (
        <div className="space-y-6">
          {/* SEARCH FILTERS */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
              <Input
                placeholder="Pesquisar festas por nome, cidade ou responsável..."
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                className="pl-11 bg-white/5 border-white/10 rounded-2xl text-white h-11 w-full"
              />
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto shrink-0">
              <Filter className="w-4 h-4 text-slate-500 shrink-0" />
              <select
                value={eventStatusFilter}
                onChange={(e) => setEventStatusFilter(e.target.value)}
                className="bg-[#120b28] border border-white/10 text-white rounded-2xl px-4 h-11 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-pink-500 w-full md:w-48"
              >
                <option value="all">Satus: Todos</option>
                <option value="planning">Planejamento</option>
                <option value="ongoing">Em Andamento</option>
                <option value="completed">Concluídos</option>
              </select>
            </div>
          </div>

          {/* TABLE OF EVENTS */}
          <div className="glass-card overflow-hidden rounded-2xl border-white/5">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/2 text-slate-500 text-[10px] uppercase font-black tracking-widest">
                    <th className="py-4 px-6">Nome / Logo</th>
                    <th className="py-4 px-6">Contratante Responsável</th>
                    <th className="py-4 px-6">Designer Associado</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6">Data & Local</th>
                    <th className="py-4 px-6 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 font-bold">
                        Nenhum evento correspondente encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredEvents.map((e) => {
                      // Get assigned contractor user info
                      const cUser = users.find(u => u.id === e.contractorId);
                      // Get assigned designer user info
                      const dUser = users.find(u => u.id === e.designerId);

                      return (
                        <tr key={e.id} className="hover:bg-white/2 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 p-0.5 shrink-0 overflow-hidden shadow-lg">
                                <img
                                  src={e.logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${e.name}`}
                                  alt="Logo"
                                  className="w-full h-full object-cover rounded-[10px]"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div>
                                <p className="font-bold text-white leading-none mb-1">{e.name}</p>
                                {e.driveUrl ? (
                                  <a 
                                    href={e.driveUrl} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="text-[10px] text-pink-400 hover:underline flex items-center gap-1 font-semibold"
                                  >
                                    Drive <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                ) : (
                                  <span className="text-[10px] text-slate-600 font-semibold">Sem Link</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {e.contractorId === 'unresolved' ? (
                              <div className="space-y-0.5">
                                <Badge variant="outline" className="bg-amber-500/10 border-amber-500/20 text-amber-500 py-0 px-2 text-[9px] font-black uppercase">
                                  Pendente
                                </Badge>
                                <p className="text-xs text-slate-400 font-semibold truncate max-w-[150px]">{e.contractorEmail || 'Sem email informado'}</p>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <p className="text-sm font-bold text-slate-200">{cUser?.name || e.contractorName || 'Carregando...'}</p>
                                <p className="text-[10px] text-slate-500 font-mono truncate max-w-[150px]">{e.contractorEmail || cUser?.email}</p>
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            {e.designerId === 'unresolved' ? (
                              <div className="space-y-0.5">
                                <Badge variant="outline" className="bg-amber-500/10 border-amber-500/20 text-amber-500 py-0 px-2 text-[9px] font-black uppercase">
                                  Pendente
                                </Badge>
                                <p className="text-xs text-slate-400 font-semibold truncate max-w-[150px]">{e.designerEmail || 'Sem email informado'}</p>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <p className="text-sm font-bold text-slate-200">{dUser?.name || 'Designer'}</p>
                                <p className="text-[10px] text-slate-500 font-mono truncate max-w-[150px]">{e.designerEmail || dUser?.email}</p>
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            {e.status === 'planning' ? (
                              <Badge className="bg-blue-500/10 border-blue-400/20 text-blue-400 py-1 px-2 text-[10px] font-black uppercase">
                                <Clock className="w-3 h-3 mr-1" /> Planejamento
                              </Badge>
                            ) : e.status === 'ongoing' ? (
                              <Badge className="bg-emerald-500/10 border-emerald-400/20 text-emerald-400 py-1 px-2 text-[10px] font-black uppercase animate-pulse">
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Em Andamento
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-500/10 border-slate-400/20 text-slate-400 py-1 px-2 text-[10px] font-black uppercase">
                                <Check className="w-3 h-3 mr-1" /> Concluído
                              </Badge>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-slate-300 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-500" /> {e.eventDate || 'Sem data'}
                              </p>
                              <p className="text-[10px] text-slate-500 flex items-center gap-1 truncate max-w-[140px]">
                                <MapPin className="w-3 h-3 text-slate-600" /> {e.location || e.city || 'Sem local'}
                              </p>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-center space-x-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEditEvent(e)}
                                className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white"
                                title="Editar Evento e Designações"
                              >
                                <Settings className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteEvent(e)}
                                className="w-8 h-8 rounded-lg hover:bg-destructive/10 text-slate-500 hover:text-destructive"
                                title="Apagar Registro"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* USER EDIT MODAL */}
      <Dialog open={isUserEditOpen} onOpenChange={setIsUserEditOpen}>
        <DialogContent className="rounded-[2rem] sm:max-w-md glass border-white/10 text-slate-100 p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Edit className="w-5 h-5 text-pink-500" />
              Editar Cadastro
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Modifique os dados ou o nível de acesso do usuário registrado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Nome Completo</Label>
              <Input
                type="text"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                className="rounded-2xl bg-white/5 border-white/10 text-white h-11 h-12"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Email Oficial</Label>
              <Input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                className="rounded-2xl bg-white/5 border-white/10 text-white h-11 h-12"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Cargo / Função</Label>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'designer' | 'contractor' })}
                disabled={selectedUser?.email === 'beysarts@gmail.com'}
                className="bg-[#120b28] border border-white/10 text-white rounded-2xl p-3 w-full h-12 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500"
              >
                <option value="contractor">Contratante (Visualiza suas festas, paga, curte, aprova)</option>
                <option value="designer">Designer (Cria, executa briefings, gerencia andamento)</option>
              </select>
              {selectedUser?.email === 'beysarts@gmail.com' && (
                <p className="text-[10px] text-amber-500 font-semibold mt-1">Este é o administrador mestre, sua função não pode ser alterada.</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsUserEditOpen(false)}
              className="rounded-xl h-12 text-slate-400"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleUpdateUser}
              className="rounded-xl h-12 bg-pink-500 hover:bg-pink-600 text-white font-bold"
            >
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* USER PRE-ADD MODAL */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="rounded-[2rem] sm:max-w-md glass border-white/10 text-slate-100 p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-white tracking-tight flex items-center gap-2 font-outfit">
              <Sparkles className="w-5 h-5 text-pink-500 animate-pulse" />
              Pré-Cadastrar Usuário
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Registre o email e role do contratante ou designer antes mesmo do primeiro login para que o sistema o identifique de imediato.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Nome Oficial</Label>
              <Input
                type="text"
                placeholder="Ex e.g. Carlos Araújo"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                className="rounded-2xl bg-white/5 border-white/10 text-white h-12 placeholder:text-slate-700"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Email Gmail / Google Login</Label>
              <Input
                type="email"
                placeholder="Ex e.g. carlos@gmail.com"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                className="rounded-2xl bg-white/5 border-white/10 text-white h-12 placeholder:text-slate-700"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Função de Ingressante</Label>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'designer' | 'contractor' })}
                className="bg-[#120b28] border border-white/10 text-white rounded-2xl p-3 w-full h-12 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500"
              >
                <option value="contractor">Contratante (Cliente externo)</option>
                <option value="designer">Designer (Organização oficial)</option>
              </select>
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsAddUserOpen(false)}
              className="rounded-xl h-12 text-slate-400"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateUser}
              className="rounded-xl h-12 bg-pink-500 hover:bg-pink-600 text-white font-bold"
            >
              Pré-Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EVENT ASSIGN AND MANAGE FULL DIALOG */}
      <Dialog open={isEventEditOpen} onOpenChange={setIsEventEditOpen}>
        <DialogContent className="rounded-[2rem] sm:max-w-lg glass border-white/10 text-slate-100 p-8 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Settings className="w-5 h-5 text-pink-500" />
              Gerenciar e Designar Festa
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Modifique informações do evento e faça a vinculação direta de usuários do sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Nome do Evento</Label>
                <Input
                  type="text"
                  value={eventForm.name}
                  onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                  className="rounded-2xl bg-white/5 border-white/10 text-white h-11"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Cidade</Label>
                <Input
                  type="text"
                  value={eventForm.city}
                  onChange={(e) => setEventForm({ ...eventForm, city: e.target.value })}
                  className="rounded-2xl bg-white/5 border-white/10 text-white h-11"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Clube / Local físico</Label>
                <Input
                  type="text"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  className="rounded-2xl bg-white/5 border-white/10 text-white h-11"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Estado / Progresso</Label>
                <select
                  value={eventForm.status}
                  onChange={(e) => setEventForm({ ...eventForm, status: e.target.value as any })}
                  className="bg-[#120b28] border border-white/10 text-white rounded-2xl px-3 h-11 w-full text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-pink-500"
                >
                  <option value="planning">Planejamento</option>
                  <option value="ongoing">Em Andamento</option>
                  <option value="completed">Concluído</option>
                </select>
              </div>
            </div>

            {/* DESIGNATING CONTRACTOR DROPDOWN */}
            <div className="space-y-2 border-t border-white/5 pt-4">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Vincular Contratante (Cliente)</Label>
                {eventForm.contractorId === 'unresolved' && (
                  <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/10 text-[9px] uppercase font-bold py-0.5">Pendente de Vínculo</Badge>
                )}
              </div>
              <select
                value={eventForm.contractorId}
                onChange={(e) => setEventForm({ ...eventForm, contractorId: e.target.value })}
                className="bg-[#120b28] border border-white/10 text-white rounded-2xl p-3 w-full h-11 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-pink-500"
              >
                <option value="unresolved">-- Não vinculado (Pendente) --</option>
                {users.filter(u => u.role === 'contractor').map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
              <div className="space-y-1">
                <Label className="text-[9px] text-slate-500 font-mono">Email do Contratante de referência (usado para autovincular no login):</Label>
                <Input
                  type="text"
                  placeholder="Email de segurança..."
                  value={eventForm.contractorEmail}
                  onChange={(e) => setEventForm({ ...eventForm, contractorEmail: e.target.value })}
                  className="rounded-xl bg-white/5 border-white/10 text-white h-9 text-xs"
                />
              </div>
            </div>

            {/* DESIGNATING DESIGNER DROPDOWN */}
            <div className="space-y-2 border-t border-white/5 pt-4">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Vincular Designer Responsável</Label>
                {eventForm.designerId === 'unresolved' && (
                  <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/10 text-[9px] uppercase font-bold py-0.5">Pendente de Vínculo</Badge>
                )}
              </div>
              <select
                value={eventForm.designerId}
                onChange={(e) => setEventForm({ ...eventForm, designerId: e.target.value })}
                className="bg-[#120b28] border border-white/10 text-white rounded-2xl p-3 w-full h-11 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-pink-500"
              >
                <option value="unresolved">-- Não vinculado (Pendente) --</option>
                {users.filter(u => u.role === 'designer').map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.email})
                  </option>
                ))}
              </select>
              <div className="space-y-1">
                <Label className="text-[9px] text-slate-500 font-mono">Email do Designer de referência (usado para autovincular no login):</Label>
                <Input
                  type="text"
                  placeholder="Email de segurança..."
                  value={eventForm.designerEmail}
                  onChange={(e) => setEventForm({ ...eventForm, designerEmail: e.target.value })}
                  className="rounded-xl bg-white/5 border-white/10 text-white h-9 text-xs"
                />
              </div>
            </div>

            {/* DRIVE LINK */}
            <div className="space-y-2 border-t border-white/5 pt-4">
              <Label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Link da Pasta do Drive</Label>
              <Input
                type="text"
                placeholder="https://drive.google.com/..."
                value={eventForm.driveUrl}
                onChange={(e) => setEventForm({ ...eventForm, driveUrl: e.target.value })}
                className="rounded-2xl bg-white/5 border-white/10 text-white h-11 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-3 border-t border-white/5 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsEventEditOpen(false)}
              className="rounded-xl h-12 text-slate-400"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleUpdateEventAssignment}
              className="rounded-xl h-12 bg-pink-500 hover:bg-pink-600 text-white font-bold"
            >
              Confirmar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="rounded-[2rem] sm:max-w-md glass border-white/10 text-slate-100 p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-rose-500 tracking-tight">
              {confirmConfig?.title || 'Confirmação'}
            </DialogTitle>
            <DialogDescription className="text-slate-300 font-medium leading-relaxed pt-2">
              {confirmConfig?.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsConfirmOpen(false)}
              className="rounded-xl h-12 text-slate-400"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (confirmConfig?.onConfirm) {
                  await confirmConfig.onConfirm();
                }
                setIsConfirmOpen(false);
              }}
              className="rounded-xl h-12 bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
