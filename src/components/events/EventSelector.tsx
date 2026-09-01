import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Loader2, 
  Settings2, 
  Share2, 
  Users, 
  UserPlus, 
  Trash2, 
  Mail, 
  Phone, 
  Briefcase, 
  User, 
  Check, 
  Copy,
  MessageSquare
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserProfile, OperationType, EventProject, EventContractor } from "../../types";
import { collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../../firebase";
import { sanitizeForFirestore } from "../../lib/error-handler";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EventSelectorProps {
  profile: UserProfile;
  onEventCreated?: (id: string) => void;
  onEventUpdated?: () => void;
  isMinimal?: boolean;
  editEvent?: EventProject;
}

export function EventSelector({ profile, onEventCreated, onEventUpdated, isMinimal, editEvent }: EventSelectorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [designerEmail, setDesignerEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [city, setCity] = useState('');
  const [date, setDate] = useState<Date>();
  const [djCount, setDjCount] = useState('');
  const [artCount, setArtCount] = useState('');
  const [motionCount, setMotionCount] = useState('');
  const [location, setLocation] = useState('');
  const [paymentValue, setPaymentValue] = useState('');

  // Multi-contractor list state
  const [contractors, setContractors] = useState<EventContractor[]>([
    { name: '', email: '', phone: '', role: 'Produtor Geral' }
  ]);

  const isEditing = !!editEvent;

  useEffect(() => {
    if (editEvent && open) {
      setName(editEvent.name || '');
      setDesignerEmail(editEvent.designerEmail || '');
      setLogoUrl(editEvent.logoUrl || '');
      setDriveUrl(editEvent.driveUrl || '');
      setCity(editEvent.city || '');
      setDjCount(editEvent.djCount?.toString() || '');
      setArtCount(editEvent.artCount?.toString() || '');
      setMotionCount(editEvent.motionCount?.toString() || '');
      setLocation(editEvent.location || '');
      setPaymentValue(editEvent.paymentValue || '');
      
      // Load contractors
      if (Array.isArray(editEvent.contractors) && editEvent.contractors.length > 0) {
        setContractors(editEvent.contractors);
      } else if (editEvent.contractorName || editEvent.contractorEmail) {
        setContractors([
          { 
            id: editEvent.contractorId && editEvent.contractorId !== 'unresolved' ? editEvent.contractorId : '',
            name: editEvent.contractorName || '', 
            email: editEvent.contractorEmail || '', 
            phone: '', 
            role: 'Produtor Principal' 
          }
        ]);
      } else {
        setContractors([{ name: '', email: '', phone: '', role: 'Produtor Geral' }]);
      }
    } else if (!editEvent && open) {
      resetForm();
    }
  }, [editEvent, open]);

  const handleAddContractor = () => {
    setContractors(prev => [
      ...prev,
      { name: '', email: '', phone: '', role: prev.length === 1 ? 'Financeiro / Sócio' : 'Co-Produtor' }
    ]);
  };

  const handleRemoveContractor = (index: number) => {
    if (contractors.length === 1) {
      setContractors([{ name: '', email: '', phone: '', role: 'Produtor Geral' }]);
      return;
    }
    setContractors(prev => prev.filter((_, i) => i !== index));
  };

  const handleContractorChange = (index: number, field: keyof EventContractor, value: string) => {
    setContractors(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      // Clean and sanitize contractors
      const validContractors = contractors
        .filter(c => (c.name && c.name.trim() !== '') || (c.email && c.email.trim() !== ''))
        .map(c => {
          const item: EventContractor = {
            name: (c.name || '').trim(),
            email: (c.email || '').trim().toLowerCase(),
            phone: (c.phone || '').trim(),
            role: (c.role || '').trim() || 'Contratante'
          };
          if (c.id && c.id.trim()) {
            item.id = c.id.trim();
          }
          return item;
        });

      // In case user didn't fill any contractor name, fallback
      const primaryContractor: EventContractor = validContractors[0] || { name: 'Pendente', email: '', role: 'Produtor' };
      const contractorNameSummary = validContractors.length > 0 
        ? validContractors.map(c => c.name).filter(Boolean).join(' • ')
        : 'Pendente';
      
      const contractorEmailsList = Array.from(new Set(validContractors.map(c => c.email).filter(Boolean))) as string[];
      
      let contractorIdsList: string[] = [];
      if (editEvent?.contractorIds && Array.isArray(editEvent.contractorIds)) {
        contractorIdsList = [...editEvent.contractorIds];
      }
      validContractors.forEach(c => {
        if (c.id && !contractorIdsList.includes(c.id)) {
          contractorIdsList.push(c.id);
        }
      });

      const eventData: any = sanitizeForFirestore({
        name: name.trim(),
        logoUrl: logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`,
        driveUrl: driveUrl || '',
        contractorName: primaryContractor.name || contractorNameSummary,
        contractors: validContractors,
        contractorEmails: contractorEmailsList,
        contractorIds: contractorIdsList,
        city: city || '',
        eventDate: date ? format(date, "PPP", { locale: ptBR }) : (editEvent?.eventDate || ''),
        djCount: parseInt(djCount) || 0,
        artCount: parseInt(artCount) || 0,
        motionCount: parseInt(motionCount) || 0,
        location: location || '',
        paymentValue: paymentValue || '',
        contractorEmail: primaryContractor.email || '',
        designerEmail: profile.role === 'designer' ? (profile.email || '') : (designerEmail || ''),
        updatedAt: serverTimestamp(),
      });

      if (isEditing && editEvent) {
        await updateDoc(doc(db, 'events', editEvent.id), eventData);
        onEventUpdated?.();
        toast.success("Evento e contratantes atualizados!");
      } else {
        const createData = sanitizeForFirestore({
          ...eventData,
          contractorId: primaryContractor.id || (profile.role === 'contractor' ? profile.id : 'unresolved'),
          designerId: profile.role === 'designer' ? profile.id : 'unresolved',
          status: 'planning',
          createdAt: serverTimestamp(),
        });
        const docRef = await addDoc(collection(db, 'events'), createData);
        onEventCreated?.(docRef.id);
        toast.success("Evento criado com sucesso!");
      }

      setOpen(false);
      resetForm();
    } catch (err) {
      handleFirestoreError(err, isEditing ? OperationType.UPDATE : OperationType.CREATE, 'events');
      toast.error(`Erro ao ${isEditing ? 'atualizar' : 'criar'} evento`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setLogoUrl('');
    setDriveUrl('');
    setCity('');
    setDate(undefined);
    setDjCount('');
    setArtCount('');
    setMotionCount('');
    setLocation('');
    setPaymentValue('');
    setDesignerEmail('');
    setContractors([{ name: '', email: '', phone: '', role: 'Produtor Geral' }]);
  };

  const isAdmin = profile.email === 'beysarts@gmail.com';

  if (!isAdmin) return null;

  const eventInviteUrl = editEvent ? `${window.location.origin}/?inviteEventId=${editEvent.id}` : '';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button 
          variant={isMinimal ? "ghost" : (isEditing ? "outline" : "default")} 
          className={cn(
            "rounded-2xl transition-all duration-300 font-bold flex items-center justify-center shrink-0",
            isEditing 
                ? "bg-white/5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 h-10 px-2.5 sm:px-4"
                : (isMinimal 
                  ? "bg-white/5 text-white hover:bg-white/10 border border-white/5 h-10 px-2.5 sm:px-4" 
                  : "bg-gradient-to-tr from-purple-500 to-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.3)] hover:scale-105 h-12 px-6")
          )}
        />
      }>
        {isEditing ? (
          <>
            <Settings2 className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline text-xs sm:text-sm">Editar Festa</span>
          </>
        ) : (
          <>
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline text-xs sm:text-sm">Novo Evento</span>
          </>
        )}
      </DialogTrigger>
      <DialogContent className="rounded-[2.5rem] sm:max-w-[650px] glass border-white/10 text-slate-100 p-6 sm:p-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
            {isEditing ? "Editar Festa" : "Cadastrar Festa"}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {isEditing 
              ? "Gerencie as informações da festa e todos os contratantes/produtores com acesso." 
              : "Inicie um novo projeto e defina os contratantes responsáveis pela gestão."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Informações Básicas da Festa */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-pink-400 flex items-center gap-2">
              <span>Informações do Evento</span>
            </h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[10px] uppercase font-black tracking-widest text-slate-400">Nome da Festa</Label>
                <Input 
                  id="name" 
                  placeholder="Ex: Backstage 2026" 
                  className="rounded-2xl bg-white/8 border-white/10 text-white placeholder:text-slate-700 h-11 focus:ring-pink-500 font-semibold"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city" className="text-[10px] uppercase font-black tracking-widest text-slate-400">Cidade - UF</Label>
                <Input 
                  id="city" 
                  placeholder="Ex: São Paulo - SP" 
                  className="rounded-2xl bg-white/8 border-white/10 text-white placeholder:text-slate-700 h-11 focus:ring-pink-500 font-semibold"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Data do Evento</Label>
                <Popover>
                  <PopoverTrigger render={
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full rounded-2xl bg-white/8 border-white/10 text-white h-11 justify-start text-left font-semibold",
                        !date && "text-slate-700"
                      )}
                    />
                  }>
                    <CalendarIcon className="mr-2 h-4 w-4 text-pink-400" />
                    {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 glass border-white/10" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                      locale={ptBR}
                      className="bg-slate-900 text-white rounded-2xl"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="text-[10px] uppercase font-black tracking-widest text-slate-400">Local (Clube / Espaço)</Label>
                <Input 
                  id="location" 
                  placeholder="Ex: Arena Backstage Club" 
                  className="rounded-2xl bg-white/8 border-white/10 text-white placeholder:text-slate-700 h-11 focus:ring-pink-500 font-semibold"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* MULTI-CONTRACTOR SECTION */}
          <div className="space-y-4 bg-purple-950/20 border border-purple-500/20 p-5 rounded-[2rem] relative overflow-hidden shadow-inner">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[30px] pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-500/15 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-purple-300">
                    Contratantes & Produtores Responsáveis
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Adicione 1 ou mais contratantes para gerenciar esta festa
                  </p>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={handleAddContractor}
                className="rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 text-xs font-bold h-8 px-3 flex items-center gap-1.5 self-start sm:self-auto"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Adicionar Contratante</span>
              </Button>
            </div>

            <div className="space-y-3 pt-1">
              {contractors.map((c, idx) => (
                <div 
                  key={idx}
                  className="bg-black/30 border border-white/10 rounded-2xl p-3.5 space-y-3 hover:border-purple-500/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-purple-500/30 text-purple-300 text-[10px] font-black flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-[11px] font-bold text-slate-200">
                        {idx === 0 ? "Contratante Principal" : `Contratante ${idx + 1}`}
                      </span>
                      {c.id && (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                          Conta Conectada
                        </span>
                      )}
                    </div>

                    {contractors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveContractor(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 transition-colors"
                        title="Remover contratante"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                        <User className="w-3 h-3 text-purple-400" /> Nome Completo
                      </Label>
                      <Input
                        placeholder="Ex: João Silva"
                        value={c.name}
                        onChange={(e) => handleContractorChange(idx, 'name', e.target.value)}
                        className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-slate-700 h-9 text-xs font-semibold focus:ring-purple-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                        <Briefcase className="w-3 h-3 text-purple-400" /> Cargo / Função
                      </Label>
                      <Input
                        placeholder="Ex: Produtor Geral, Financeiro..."
                        value={c.role || ''}
                        onChange={(e) => handleContractorChange(idx, 'role', e.target.value)}
                        className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-slate-700 h-9 text-xs focus:ring-purple-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-purple-400" /> Email (para login)
                      </Label>
                      <Input
                        type="email"
                        placeholder="email@cliente.com"
                        value={c.email || ''}
                        onChange={(e) => handleContractorChange(idx, 'email', e.target.value)}
                        className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-slate-700 h-9 text-xs focus:ring-purple-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-purple-400" /> Telefone / WhatsApp
                      </Label>
                      <Input
                        placeholder="Ex: (11) 98765-4321"
                        value={c.phone || ''}
                        onChange={(e) => handleContractorChange(idx, 'phone', e.target.value)}
                        className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-slate-700 h-9 text-xs focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  {/* Share button per contractor when editing */}
                  {isEditing && editEvent && (
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                      {c.phone && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const cleanPhone = (c.phone || '').replace(/\D/g, '');
                            const msg = encodeURIComponent(`Olá ${c.name || 'Produtor'}, aqui está seu acesso para gerenciar a festa *${editEvent.name}* no Backstage: ${eventInviteUrl}`);
                            window.open(`https://wa.me/55${cleanPhone}?text=${msg}`, '_blank');
                          }}
                          className="h-7 text-[10px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-2.5 rounded-lg flex items-center gap-1 font-bold"
                        >
                          <MessageSquare className="w-3 h-3" />
                          Enviar no WhatsApp
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Métricas e Produção */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="djCount" className="text-[10px] uppercase font-black tracking-widest text-slate-400">Quantidade de DJs</Label>
              <Input 
                id="djCount" 
                type="number"
                placeholder="0" 
                className="rounded-2xl bg-white/8 border-white/10 text-white placeholder:text-slate-700 h-11 focus:ring-pink-500 font-semibold"
                value={djCount}
                onChange={(e) => setDjCount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="artCount" className="text-[10px] uppercase font-black tracking-widest text-slate-400">Quantidade de Artes</Label>
              <Input 
                id="artCount" 
                type="number"
                placeholder="0" 
                className="rounded-2xl bg-white/8 border-white/10 text-white placeholder:text-slate-700 h-11 focus:ring-pink-500 font-semibold"
                value={artCount}
                onChange={(e) => setArtCount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="motionCount" className="text-[10px] uppercase font-black tracking-widest text-slate-400">Quantidade de Motions</Label>
              <Input 
                id="motionCount" 
                type="number"
                placeholder="0" 
                className="rounded-2xl bg-white/8 border-white/10 text-white placeholder:text-slate-700 h-11 focus:ring-pink-500 font-semibold"
                value={motionCount}
                onChange={(e) => setMotionCount(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 bg-cyan-950/15 border border-cyan-500/20 p-4 rounded-[1.5rem] relative overflow-hidden shadow-inner">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-[20px]" />
            <Label htmlFor="paymentValue" className="text-[10px] uppercase font-black tracking-widest text-cyan-400">Valor do Pacote / Pagamento ($)</Label>
            <Input 
              id="paymentValue" 
              placeholder="Ex: R$ 5.000,00" 
              className="rounded-2xl bg-white/5 border-white/5 text-cyan-200 placeholder:text-slate-600 h-11 focus:ring-cyan-500 font-bold mt-1"
              value={paymentValue}
              onChange={(e) => setPaymentValue(e.target.value)}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="drive" className="text-[10px] uppercase font-black tracking-widest text-slate-400">Link do Drive (Arquivos)</Label>
              <Input 
                id="drive" 
                placeholder="https://drive.google.com/..." 
                className="rounded-2xl bg-white/8 border-white/10 text-white placeholder:text-slate-700 h-11 focus:ring-pink-500"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo" className="text-[10px] uppercase font-black tracking-widest text-slate-400">Logo URL (Opcional)</Label>
              <Input 
                id="logo" 
                placeholder="https://exemplo.com/logo.png" 
                className="rounded-2xl bg-white/8 border-white/10 text-white placeholder:text-slate-700 h-11 focus:ring-pink-500"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Global Invite Link for all Contractors */}
        {isEditing && (
          <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mt-2">
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase tracking-widest text-purple-300 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5" /> Link de Convite Geral para Contratantes
              </h4>
              <p className="text-[11px] text-slate-400">
                Qualquer contratante ou sócio que acessar este link terá a festa vinculada à sua conta Google automaticamente.
              </p>
            </div>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(eventInviteUrl);
                toast.success("Link de convite copiado com sucesso!");
              }}
              className="rounded-xl h-11 sm:h-10 px-4 bg-purple-500 hover:bg-purple-600 text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 border-none shrink-0 shadow-lg"
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar Link
            </Button>
          </div>
        )}

        <DialogFooter className="mt-6">
          <Button 
            disabled={loading || !name.trim()} 
            onClick={handleSubmit} 
            className={cn(
              "w-full text-white rounded-2xl h-14 font-black shadow-lg transition-all active:scale-95 text-base",
              isEditing ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" : "bg-pink-500 hover:bg-pink-600 shadow-pink-500/20"
            )}
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : (isEditing ? <Settings2 className="mr-2 w-5 h-5" /> : <Plus className="mr-2 w-5 h-5" />)}
            {isEditing ? "Salvar Alterações e Contratantes" : "Criar Evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
