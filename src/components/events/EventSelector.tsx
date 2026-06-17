import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Plus, Loader2, Image as ImageIcon, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserProfile, OperationType, EventProject } from "../../types";
import { collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../../firebase";
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
  const [contractorEmail, setContractorEmail] = useState('');
  const [designerEmail, setDesignerEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [contractorName, setContractorName] = useState('');
  const [city, setCity] = useState('');
  const [date, setDate] = useState<Date>();
  const [djCount, setDjCount] = useState('');
  const [artCount, setArtCount] = useState('');
  const [motionCount, setMotionCount] = useState('');
  const [location, setLocation] = useState('');
  const [paymentValue, setPaymentValue] = useState('');

  const isEditing = !!editEvent;

  useEffect(() => {
    if (editEvent && open) {
      setName(editEvent.name || '');
      setContractorEmail(editEvent.contractorEmail || '');
      setDesignerEmail(editEvent.designerEmail || '');
      setLogoUrl(editEvent.logoUrl || '');
      setDriveUrl(editEvent.driveUrl || '');
      setContractorName(editEvent.contractorName || '');
      setCity(editEvent.city || '');
      setDjCount(editEvent.djCount?.toString() || '');
      setArtCount(editEvent.artCount?.toString() || '');
      setMotionCount(editEvent.motionCount?.toString() || '');
      setLocation(editEvent.location || '');
      setPaymentValue(editEvent.paymentValue || '');
      
      if (editEvent.eventDate) {
        try {
          // Attempt to parse or just leave empty if it's descriptive text
          // If it's descriptive text like "15 de Outubro", it might fail basic parsing
          // We'll trust the date picker for new selections
        } catch (e) {
          console.error("Failed to parse date", e);
        }
      }
    }
  }, [editEvent, open]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const eventData = {
        name,
        logoUrl: logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${name}`,
        driveUrl,
        contractorName,
        city,
        eventDate: date ? format(date, "PPP", { locale: ptBR }) : (editEvent?.eventDate || ''),
        djCount: parseInt(djCount) || 0,
        artCount: parseInt(artCount) || 0,
        motionCount: parseInt(motionCount) || 0,
        location,
        paymentValue,
        contractorEmail: profile.role === 'contractor' ? profile.email : contractorEmail,
        designerEmail: profile.role === 'designer' ? profile.email : designerEmail,
        updatedAt: serverTimestamp(),
      };

      if (isEditing && editEvent) {
        await updateDoc(doc(db, 'events', editEvent.id), eventData);
        onEventUpdated?.();
        toast.success("Evento atualizado!");
      } else {
        const createData = {
          ...eventData,
          contractorId: profile.role === 'contractor' ? profile.id : 'unresolved',
          designerId: profile.role === 'designer' ? profile.id : 'unresolved',
          status: 'planning',
          createdAt: serverTimestamp(),
        };
        const docRef = await addDoc(collection(db, 'events'), createData);
        onEventCreated?.(docRef.id);
        toast.success("Evento criado!");
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
    setContractorName('');
    setCity('');
    setDate(undefined);
    setDjCount('');
    setArtCount('');
    setMotionCount('');
    setLocation('');
    setPaymentValue('');
    setContractorEmail('');
    setDesignerEmail('');
  };

  const isAdmin = profile.email === 'beysarts@gmail.com';

  if (!isAdmin) return null;

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
            <span className="hidden sm:inline text-xs sm:text-sm">Editar Dados</span>
          </>
        ) : (
          <>
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline text-xs sm:text-sm">Novo Evento</span>
          </>
        )}
      </DialogTrigger>
      <DialogContent className="rounded-[2.5rem] sm:max-w-[550px] glass border-white/10 text-slate-100 p-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-3xl font-black text-white tracking-tighter">
            {isEditing ? "Editar Festa" : "Cadastrar Festa"}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {isEditing ? "Atualize as informações principais do evento selecionado." : "Inicie um novo projeto preenchendo as informações básicas."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Nome da Festa</Label>
              <Input 
                id="name" 
                placeholder="Ex: Backstage 2026" 
                className="rounded-2xl bg-white/8 border-white/10 text-white placeholder:text-slate-700 h-11 focus:ring-pink-500 transition-all font-semibold"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cname" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Nome do Contratante</Label>
              <Input 
                id="cname" 
                placeholder="Ex: João Silva" 
                className="rounded-2xl bg-white/8 border-white/10 text-white placeholder:text-slate-700 h-11 focus:ring-pink-500 transition-all font-semibold"
                value={contractorName}
                onChange={(e) => setContractorName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Cidade</Label>
              <Input 
                id="city" 
                placeholder="Ex: São Paulo - SP" 
                className="rounded-2xl bg-white/8 border-white/10 text-white placeholder:text-slate-700 h-11 focus:ring-pink-500"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Data do Evento</Label>
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
                  <CalendarIcon className="mr-2 h-4 w-4" />
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
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="djCount" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Quantidade de DJs</Label>
              <Input 
                id="djCount" 
                type="number"
                placeholder="0" 
                className="rounded-2xl bg-white/8 border-white/10 text-white placeholder:text-slate-700 h-11 focus:ring-pink-500"
                value={djCount}
                onChange={(e) => setDjCount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="artCount" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Quantidade de Artes</Label>
              <Input 
                id="artCount" 
                type="number"
                placeholder="0" 
                className="rounded-2xl bg-white/8 border-white/10 text-white placeholder:text-slate-700 h-11 focus:ring-pink-500"
                value={artCount}
                onChange={(e) => setArtCount(e.target.value)}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="motionCount" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Quantidade de Motions</Label>
              <Input 
                id="motionCount" 
                type="number"
                placeholder="0" 
                className="rounded-2xl bg-white/8 border-white/10 text-white placeholder:text-slate-700 h-11 focus:ring-pink-500"
                value={motionCount}
                onChange={(e) => setMotionCount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Local (Clube/Espaço)</Label>
              <Input 
                id="location" 
                placeholder="Ex: Arena Backstage Club" 
                className="rounded-2xl bg-white/8 border-white/10 text-white placeholder:text-slate-700 h-11 focus:ring-pink-500"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 bg-cyan-950/15 border border-cyan-500/20 p-4 rounded-[1.5rem] relative overflow-hidden shadow-inner">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-[20px]" />
            <Label htmlFor="paymentValue" className="text-[10px] uppercase font-black tracking-widest text-cyan-400">Valor do Pagamento ($)</Label>
            <Input 
              id="paymentValue" 
              placeholder="Ex: R$ 5.000,00" 
              className="rounded-2xl bg-white/5 border-white/5 text-cyan-200 placeholder:text-slate-600 h-11 focus:ring-cyan-500 font-bold mt-1"
              value={paymentValue}
              onChange={(e) => setPaymentValue(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="drive" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Link do Drive (Arquivos)</Label>
            <Input 
              id="drive" 
              placeholder="https://drive.google.com/..." 
              className="rounded-2xl bg-white/8 border-white/10 text-white placeholder:text-slate-700 h-11 focus:ring-pink-500"
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Logo URL (Opcional)</Label>
            <Input 
              id="logo" 
              placeholder="https://exemplo.com/logo.png" 
              className="rounded-2xl bg-white/8 border-white/10 text-white placeholder:text-slate-700 h-11 focus:ring-pink-500"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
          </div>

          {profile.role === 'designer' ? (
            <div className="space-y-2">
              <Label htmlFor="cemail" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Email do Contratante</Label>
              <Input 
                id="cemail" 
                placeholder="email@cliente.com" 
                className="rounded-2xl bg-white/8 border-white/10 text-white placeholder:text-slate-700 h-11"
                value={contractorEmail}
                onChange={(e) => setContractorEmail(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="demail" className="text-[10px] uppercase font-black tracking-widest text-slate-500">Email do Designer (Backstage)</Label>
              <Input 
                id="demail" 
                placeholder="beysarts@gmail.com" 
                className="rounded-2xl bg-white/8 border-white/10 text-white placeholder:text-slate-700 h-11"
                value={designerEmail}
                onChange={(e) => setDesignerEmail(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button 
            disabled={loading || !name.trim()} 
            onClick={handleSubmit} 
            className={cn(
              "w-full text-white rounded-2xl h-14 font-black shadow-lg transition-all active:scale-95",
              isEditing ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" : "bg-pink-500 hover:bg-pink-600 shadow-pink-500/20"
            )}
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : (isEditing ? <Settings2 className="mr-2 w-5 h-5" /> : <Plus className="mr-2 w-5 h-5" />)}
            {isEditing ? "Salvar Alterações" : "Criar Evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
