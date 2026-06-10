import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Gavel, Download, Trash2, Loader2, Link as LinkIcon, ShieldCheck, Pencil, FileCheck, Receipt, Lightbulb, CheckCircle2, Clock, Calendar } from "lucide-react";
import { EventProject, UserProfile, ProjectDocument, OperationType } from "../../types";
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../../firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function Corregedoria({ event, profile }: { event: EventProject, profile: UserProfile }) {
  const [docs, setDocs] = useState<ProjectDocument[]>([]);
  const [filter, setFilter] = useState<'all' | 'contract' | 'receipt' | 'proposal'>('all');
  const [isOpen, setIsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newDoc, setNewDoc] = useState({ name: '', url: '', type: 'contract' as const, status: 'pending' as const, thumbnailUrl: '' });
  const [editingDoc, setEditingDoc] = useState<ProjectDocument | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'events', event.id, 'documents'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDocs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectDocument)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `events/${event.id}/documents`);
    });
    return () => unsubscribe();
  }, [event.id]);

  const getDirectImageUrl = (url: string) => {
    if (!url) return '';
    try {
      // Google Drive
      if (url.includes('drive.google.com')) {
        const fileId = url.match(/\/d\/([^/]+)/)?.[1] || url.match(/id=([^&]+)/)?.[1];
        if (fileId) return `https://drive.google.com/uc?export=view&id=${fileId}`;
      }
      // Dropbox
      if (url.includes('dropbox.com')) {
        return url.replace('dl=0', 'raw=1').replace('www.dropbox.com', 'dl.dropboxusercontent.com');
      }
      return url;
    } catch (e) {
      return url;
    }
  };

  const handleAdd = async () => {
    if (!newDoc.name.trim() || !newDoc.url.trim()) return;
    const path = `events/${event.id}/documents`;
    setLoading(true);
    try {
      await addDoc(collection(db, path), {
        ...newDoc,
        eventId: event.id,
        createdAt: serverTimestamp(),
      });
      setIsOpen(false);
      setNewDoc({ name: '', url: '', type: 'contract', status: 'pending', thumbnailUrl: '' });
      toast.success("Documento armazenado!");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      toast.error("Erro ao salvar documento");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingDoc || !editingDoc.name.trim() || !editingDoc.url.trim()) return;
    const path = `events/${event.id}/documents/${editingDoc.id}`;
    setLoading(true);
    try {
      const docRef = doc(db, path);
      await updateDoc(docRef, {
        name: editingDoc.name,
        url: editingDoc.url,
        type: editingDoc.type || 'contract',
        status: editingDoc.status || 'pending',
        thumbnailUrl: editingDoc.thumbnailUrl || null,
        updatedAt: serverTimestamp(),
      });
      setIsEditOpen(false);
      setEditingDoc(null);
      toast.success("Documento atualizado!");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      toast.error("Erro ao atualizar documento");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const path = `events/${event.id}/documents/${id}`;
    try {
      await deleteDoc(doc(db, path));
      toast.success("Documento removido");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
      toast.error("Erro ao excluir documento");
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Disponível em breve';
    try {
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, "dd 'de' MMM, yyyy", { locale: ptBR });
    } catch (e) {
      return 'Data inválida';
    }
  };

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
        <div className="space-y-1">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-400">COFRE DE DOCUMENTOS</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">Armazenamento seguro de arquivos do evento</p>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 bg-white/5 p-1 sm:p-1.5 rounded-2xl border border-white/5 backdrop-blur-md w-full sm:w-auto justify-between sm:justify-start">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              "hidden sm:block px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              filter === 'all' ? "bg-white/10 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
            )}
          >
            Tudo
          </button>
          <button
            onClick={() => setFilter('contract')}
            className={cn(
              "flex-1 sm:flex-initial text-center px-2.5 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              filter === 'contract' ? "bg-indigo-500/20 text-indigo-400 shadow-lg" : "text-slate-500 hover:text-slate-300"
            )}
          >
            Contratos
          </button>
          <button
            onClick={() => setFilter('receipt')}
            className={cn(
              "flex-1 sm:flex-initial text-center px-2.5 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              filter === 'receipt' ? "bg-emerald-500/20 text-emerald-400 shadow-lg" : "text-slate-500 hover:text-slate-300"
            )}
          >
            Recibos
          </button>
          <button
            onClick={() => setFilter('proposal')}
            className={cn(
              "flex-1 sm:flex-initial text-center px-2.5 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              filter === 'proposal' ? "bg-amber-500/20 text-amber-400 shadow-lg" : "text-slate-500 hover:text-slate-300"
            )}
          >
            Propostas
          </button>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger render={
            <Button className="bg-white/5 text-white hover:bg-white/10 rounded-2xl h-12 px-6 border border-white/10 backdrop-blur-md font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(52,211,153,0.1)]">
              <Plus className="w-4 h-4 mr-2 text-emerald-500" />
              Anexar Arquivo
            </Button>
          } />
          <DialogContent className="rounded-3xl sm:max-w-[425px] glass border-white/10 text-slate-100">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-white tracking-tight">Anexar Documento</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-6">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Nome do Arquivo</Label>
                <Input value={newDoc.name} onChange={e => setNewDoc({...newDoc, name: e.target.value})} placeholder="Ex: Contrato assinado.pdf" className="rounded-2xl bg-white/5 border-white/10 text-white h-12" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Tipo</Label>
                <Select onValueChange={(v: any) => setNewDoc({...newDoc, type: v})} value={newDoc.type}>
                  <SelectTrigger className="rounded-2xl bg-white/5 border-white/10 text-white h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-slate-900 border-white/10 text-white">
                    <SelectItem value="contract">Contrato</SelectItem>
                    <SelectItem value="receipt">Recibo / Comprovante</SelectItem>
                    <SelectItem value="proposal">Proposta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Status</Label>
                <Select onValueChange={(v: any) => setNewDoc({...newDoc, status: v})} value={newDoc.status}>
                  <SelectTrigger className="rounded-2xl bg-white/5 border-white/10 text-white h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-slate-900 border-white/10 text-white">
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="signed">Assinado / Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">URL do Arquivo (Link)</Label>
                <Input value={newDoc.url} onChange={e => setNewDoc({...newDoc, url: e.target.value})} placeholder="Link do Google Drive / Dropbox" className="rounded-2xl bg-white/5 border-white/10 text-white h-12" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Miniatura (Opcional - link de imagem)</Label>
                <div className="flex gap-4 items-start">
                  <Input 
                    value={newDoc.thumbnailUrl} 
                    onChange={e => setNewDoc({...newDoc, thumbnailUrl: e.target.value})} 
                    placeholder="https://exemplo.com/imagem.jpg" 
                    className="rounded-2xl bg-white/5 border-white/10 text-white h-12 flex-1" 
                  />
                  {newDoc.thumbnailUrl && (
                    <div className="w-12 h-12 rounded-xl border border-white/10 overflow-hidden bg-white/5 shrink-0">
                      <img 
                        src={getDirectImageUrl(newDoc.thumbnailUrl)} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Invalid+Link';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAdd} disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-2xl h-14 font-black shadow-[0_0_20px_rgba(16,185,129,0.3)] text-white">
                {loading ? <Loader2 className="animate-spin mr-2" /> : <ShieldCheck className="mr-2 w-4 h-4" />}
                Armazenar com Segurança
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
        {docs.filter(d => filter === 'all' || d.type === filter).map(doc => (
          <Card key={doc.id} className="rounded-[2.5rem] border-white/5 bg-white/5 backdrop-blur-md shadow-2xl hover:shadow-emerald-500/10 transition-all duration-500 group overflow-hidden border flex flex-col h-full">
            <CardContent className="p-0 flex flex-col h-full">
              {/* Top Banner / Color Strip */}
              <div className={cn(
                "h-1.5 w-full",
                doc.type === 'contract' ? 'bg-indigo-500' : 
                doc.type === 'receipt' ? 'bg-emerald-500' : 'bg-amber-500'
              )} />
              
              {/* Thumbnail / Header Area */}
              <div className="relative h-44 w-full overflow-hidden bg-white/5 group-hover:h-48 transition-all duration-500">
                {doc.thumbnailUrl && doc.thumbnailUrl.trim() !== "" ? (
                  <img 
                    src={getDirectImageUrl(doc.thumbnailUrl)} 
                    alt={doc.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // Fallback if image fails to load
                      const img = e.target as HTMLImageElement;
                      if (!img.dataset.triedFallback) {
                        img.dataset.triedFallback = 'true';
                        img.src = 'https://placehold.co/400x300?text=Imagem+Nao+Encontrada';
                      }
                    }}
                  />
                ) : (
                  <div className={cn(
                    "w-full h-full flex items-center justify-center opacity-40 group-hover:opacity-60 transition-opacity",
                    doc.type === 'contract' ? 'bg-indigo-500/5 text-indigo-400' : 
                    doc.type === 'receipt' ? 'bg-emerald-500/5 text-emerald-400' :
                    'bg-amber-500/5 text-amber-400'
                  )}>
                    {doc.type === 'contract' && <FileCheck className="w-16 h-16" />}
                    {doc.type === 'receipt' && <Receipt className="w-16 h-16" />}
                    {doc.type === 'proposal' && <Lightbulb className="w-16 h-16" />}
                  </div>
                )}
                
                {/* Floating Shadow Overlay for actions */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Floating Actions */}
                <div className="absolute top-4 right-4 flex gap-1 transform translate-y-[-10px] group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300 delay-75">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      setEditingDoc(doc);
                      setIsEditOpen(true);
                    }} 
                    className="bg-white/10 hover:bg-blue-500 text-white rounded-full transition-all backdrop-blur-md border border-white/10"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDelete(doc.id)} 
                    className="bg-white/10 hover:bg-rose-500 text-white rounded-full transition-all backdrop-blur-md border border-white/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Floating Type Badge */}
                <div className={cn(
                  "absolute bottom-4 left-4 px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest text-white backdrop-blur-md border border-white/10 shadow-lg flex items-center",
                  doc.type === 'contract' ? 'bg-indigo-500/40 text-indigo-100' : 
                  doc.type === 'receipt' ? 'bg-emerald-500/40 text-emerald-100' : 'bg-amber-500/40 text-amber-100'
                )}>
                  {doc.type === 'contract' ? 'Contrato' : doc.type === 'receipt' ? 'Recibo' : 'Proposta'}
                </div>

                {/* Status Badge */}
                <div className={cn(
                  "absolute bottom-4 right-4 px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest text-white backdrop-blur-md border border-white/10 shadow-lg flex items-center gap-1.5",
                  doc.status === 'signed' ? 'bg-emerald-500/40 text-emerald-300' : 'bg-rose-500/40 text-rose-300'
                )}>
                  {doc.status === 'signed' ? (
                    <><CheckCircle2 className="w-3 h-3" /> Assinado</>
                  ) : (
                    <><Clock className="w-3 h-3" /> Pendente</>
                  )}
                </div>
              </div>

              {/* Content Area */}
              <div className="p-7 space-y-5 flex-grow flex flex-col">
                <div 
                  onClick={() => {
                    setEditingDoc(doc);
                    setIsEditOpen(true);
                  }}
                  className="cursor-pointer group/title flex-grow"
                >
                  <h3 className="font-bold text-white tracking-tight text-xl line-clamp-1 group-hover/title:text-pink-400 transition-colors uppercase italic">{doc.name}</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 italic flex items-center">
                    <span className={cn(
                      "w-1 h-1 rounded-full mr-2",
                      doc.type === 'contract' ? 'bg-indigo-500' : doc.type === 'receipt' ? 'bg-emerald-500' : 'bg-amber-500'
                    )} />
                    {doc.type === 'contract' ? 'Documentação Legal' : doc.type === 'receipt' ? 'Processamento Financeiro' : 'Planejamento Criativo'}
                  </p>
                  <div className="flex items-center gap-2 mt-3 text-slate-400">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest italic">{formatDate(doc.createdAt)}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <a href={doc.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="secondary" className="w-full rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-100 font-bold group/btn h-14 shadow-inner">
                      <Download className="mr-3 w-5 h-5 text-emerald-400 group-hover/btn:translate-y-0.5 transition-transform" />
                      Acessar Arquivo
                    </Button>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {docs.length === 0 && (
          <div className="col-span-full h-56 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center space-y-4 text-slate-600 bg-white/5">
            <ShieldCheck className="w-10 h-10 opacity-20 text-emerald-500" />
            <p className="italic font-bold tracking-tight">Nenhum documento anexado nesta categoria.</p>
          </div>
        )}
      </div>

      <div className="glass-card rounded-[2.5rem] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-8 border-white/5 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[60px] group-hover:scale-150 transition-transform duration-1000" />
        <div className="space-y-3 text-center md:text-left relative z-10">
          <h4 className="text-2xl font-black tracking-tight flex items-center justify-center md:justify-start">
            <ShieldCheck className="mr-3 w-7 h-7 text-emerald-500" />
            Segurança Backstage
          </h4>
          <p className="text-slate-400 text-sm max-w-lg leading-relaxed font-medium italic">
            Todos os documentos são armazenados em links externos seguros. O Backstage não hospeda arquivos físicos, garantindo que você tenha controle total sobre seu armazenamento.
          </p>
        </div>
        <div className="flex -space-x-4 relative z-10">
          {[
            { icon: FileCheck, color: "text-indigo-400" },
            { icon: Receipt, color: "text-emerald-400" },
            { icon: Lightbulb, color: "text-amber-400" }
          ].map((item, i) => (
            <div key={i} className="w-12 h-12 rounded-full bg-slate-900 border-2 border-white/10 flex items-center justify-center shadow-2xl transform hover:-translate-y-2 transition-transform">
              <item.icon className={cn("w-5 h-5", item.color)} />
            </div>
          ))}
        </div>
      </div>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="rounded-3xl sm:max-w-[425px] glass border-white/10 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-white tracking-tight">Editar Documento</DialogTitle>
          </DialogHeader>
          {editingDoc && (
            <div className="grid gap-6 py-6">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Nome do Arquivo</Label>
                <Input value={editingDoc.name || ''} onChange={e => setEditingDoc({...editingDoc, name: e.target.value})} placeholder="Ex: Contrato assinado.pdf" className="rounded-2xl bg-white/5 border-white/10 text-white h-12" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Tipo</Label>
                <Select onValueChange={(v: any) => setEditingDoc({...editingDoc, type: v})} value={editingDoc.type || 'contract'}>
                  <SelectTrigger className="rounded-2xl bg-white/5 border-white/10 text-white h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-slate-900 border-white/10 text-white">
                    <SelectItem value="contract">Contrato</SelectItem>
                    <SelectItem value="receipt">Recibo / Comprovante</SelectItem>
                    <SelectItem value="proposal">Proposta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Status</Label>
                <Select onValueChange={(v: any) => setEditingDoc({...editingDoc, status: v})} value={editingDoc.status || 'pending'}>
                  <SelectTrigger className="rounded-2xl bg-white/5 border-white/10 text-white h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-slate-900 border-white/10 text-white">
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="signed">Assinado / Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">URL do Arquivo (Link)</Label>
                <Input value={editingDoc.url || ''} onChange={e => setEditingDoc({...editingDoc, url: e.target.value})} placeholder="Link do Google Drive / Dropbox" className="rounded-2xl bg-white/5 border-white/10 text-white h-12" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Miniatura (Opcional)</Label>
                <div className="flex gap-4 items-start">
                  <Input 
                    value={editingDoc.thumbnailUrl || ''} 
                    onChange={e => setEditingDoc({...editingDoc, thumbnailUrl: e.target.value})} 
                    placeholder="https://exemplo.com/imagem.jpg" 
                    className="rounded-2xl bg-white/5 border-white/10 text-white h-12 flex-1" 
                  />
                  {editingDoc.thumbnailUrl && (
                    <div className="w-12 h-12 rounded-xl border border-white/10 overflow-hidden bg-white/5 shrink-0">
                      <img 
                        src={getDirectImageUrl(editingDoc.thumbnailUrl)} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Invalid+Link';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleUpdate} disabled={loading} className="w-full bg-blue-500 hover:bg-blue-600 rounded-2xl h-14 font-black shadow-[0_0_20px_rgba(59,130,246,0.3)] text-white">
              {loading ? <Loader2 className="animate-spin mr-2" /> : <ShieldCheck className="mr-2 w-4 h-4" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
