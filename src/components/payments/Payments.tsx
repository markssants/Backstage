import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, CreditCard, Calendar, CheckCircle2, AlertCircle, 
  Trash2, Loader2, Landmark, Clock, Pencil, Paperclip, 
  Image as ImageIcon, FileText, ExternalLink, Eye, Upload, 
  Check, ArrowUpRight 
} from "lucide-react";
import { EventProject, UserProfile, PaymentItem, OperationType, PaymentReceipt } from "../../types";
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../../firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PaymentReceiptUploader, ReceiptData } from "./PaymentReceiptUploader";
import { PaymentReceiptModal } from "./PaymentReceiptModal";

export function Payments({ event, profile }: { event: EventProject, profile: UserProfile }) {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [newPayment, setNewPayment] = useState<{ 
    description: string; 
    amount: string; 
    dueDate: string; 
    installments: number; 
    status: 'paid' | 'pending' | 'overdue';
    receipt: ReceiptData | null;
  }>({ 
    description: '',
    amount: '', 
    dueDate: '', 
    installments: 1,
    status: 'pending',
    receipt: null
  });

  const [editingPayment, setEditingPayment] = useState<PaymentItem | null>(null);
  const [editForm, setEditForm] = useState<{ 
    description: string; 
    amount: string; 
    dueDate: string; 
    status: 'paid' | 'pending' | 'overdue';
    receipt: ReceiptData | null;
  }>({
    description: '',
    amount: '',
    dueDate: '',
    status: 'pending',
    receipt: null
  });

  // Modal for Viewing Receipt in Full Lightbox
  const [viewingReceiptPayment, setViewingReceiptPayment] = useState<PaymentItem | null>(null);
  
  // Quick Upload for a specific payment from the table
  const quickFileInputRef = useRef<HTMLInputElement>(null);
  const [quickUploadTarget, setQuickUploadTarget] = useState<PaymentItem | null>(null);
  const [isQuickUploading, setIsQuickUploading] = useState<string | null>(null);

  useEffect(() => {
    const path = `events/${event.id}/payments`;
    const q = query(collection(db, path));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentItem)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsubscribe();
  }, [event.id]);

  const handleAdd = async () => {
    if (!newPayment.description || !newPayment.amount || !newPayment.dueDate) return;
    const path = `events/${event.id}/payments`;
    setLoading(true);
    try {
      const totalAmount = parseFloat(newPayment.amount);
      const installmentCount = Math.max(1, newPayment.installments);
      const amountPerInstallment = totalAmount / installmentCount;
      const baseDate = new Date(newPayment.dueDate);

      for (let i = 0; i < installmentCount; i++) {
        const dueDate = addMonths(baseDate, i);
        const description = installmentCount > 1 
          ? `${newPayment.description} (${i + 1}/${installmentCount})`
          : newPayment.description;

        // If multiple installments, only attach receipt to the first one unless 1 installment
        const receiptToAttach = (i === 0 && newPayment.receipt) ? newPayment.receipt : null;

        await addDoc(collection(db, path), {
          description,
          amount: amountPerInstallment,
          dueDate,
          status: newPayment.status,
          eventId: event.id,
          receiptUrl: receiptToAttach?.url || null,
          receiptName: receiptToAttach?.name || null,
          receiptType: receiptToAttach?.type || null,
          receipts: receiptToAttach ? [{
            id: `receipt_${Date.now()}`,
            url: receiptToAttach.url,
            name: receiptToAttach.name,
            type: receiptToAttach.type,
            size: receiptToAttach.size,
            uploadedAt: new Date()
          }] : [],
          createdAt: serverTimestamp(),
        });
      }

      setIsOpen(false);
      setNewPayment({ 
        description: '', 
        amount: '', 
        dueDate: '', 
        installments: 1, 
        status: 'pending',
        receipt: null 
      });
      toast.success(installmentCount > 1 ? `${installmentCount} parcelas geradas!` : "Pagamento agendado!");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      toast.error("Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  const cycleStatus = async (p: PaymentItem) => {
    const path = `events/${event.id}/payments/${p.id}`;
    let nextStatus: 'pending' | 'overdue' | 'paid';
    
    if (p.status === 'pending') nextStatus = 'overdue';
    else if (p.status === 'overdue') nextStatus = 'paid';
    else nextStatus = 'pending';

    try {
      await updateDoc(doc(db, path), {
        status: nextStatus,
        paidAt: nextStatus === 'paid' ? serverTimestamp() : null,
        updatedAt: serverTimestamp()
      });
      toast.success(`Status: ${nextStatus === 'paid' ? 'Recebido' : nextStatus === 'overdue' ? 'Pendente' : 'A Receber'}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleEditOpen = (p: PaymentItem) => {
    setEditingPayment(p);
    
    // Determine existing receipt data
    const existingReceipt = p.receiptUrl ? {
      url: p.receiptUrl,
      name: p.receiptName || 'Comprovante',
      type: p.receiptType || (p.receiptUrl.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image')
    } : (p.receipts && p.receipts.length > 0 ? {
      url: p.receipts[0].url,
      name: p.receipts[0].name,
      type: p.receipts[0].type,
      size: p.receipts[0].size
    } : null);

    setEditForm({
      description: p.description || '',
      amount: p.amount?.toString() || '0',
      dueDate: p.dueDate ? format(p.dueDate.toDate(), 'yyyy-MM-dd') : '',
      status: p.status || 'pending',
      receipt: existingReceipt
    });
  };

  const handleUpdate = async () => {
    if (!editingPayment || !editForm.description || !editForm.amount || !editForm.dueDate) return;
    const path = `events/${event.id}/payments/${editingPayment.id}`;
    setLoading(true);
    try {
      const receiptToSave = editForm.receipt;

      await updateDoc(doc(db, path), {
        description: editForm.description,
        amount: parseFloat(editForm.amount),
        dueDate: new Date(editForm.dueDate),
        status: editForm.status,
        receiptUrl: receiptToSave?.url || null,
        receiptName: receiptToSave?.name || null,
        receiptType: receiptToSave?.type || null,
        receipts: receiptToSave ? [{
          id: `receipt_${Date.now()}`,
          url: receiptToSave.url,
          name: receiptToSave.name,
          type: receiptToSave.type,
          size: receiptToSave.size,
          uploadedAt: new Date()
        }] : [],
        updatedAt: serverTimestamp(),
        paidAt: editForm.status === 'paid' ? (editingPayment.paidAt || serverTimestamp()) : null
      });
      setEditingPayment(null);
      toast.success("Pagamento atualizado!");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      toast.error("Erro ao atualizar");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const path = `events/${event.id}/payments/${id}`;
    try {
      await deleteDoc(doc(db, path));
      toast.success("Pagamento removido");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Quick Direct Upload for a row
  const handleQuickUploadClick = (p: PaymentItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickUploadTarget(p);
    quickFileInputRef.current?.click();
  };

  const handleQuickFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !quickUploadTarget) return;

    const targetPayment = quickUploadTarget;
    setIsQuickUploading(targetPayment.id);

    try {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      const fileType: 'image' | 'pdf' | 'file' = isImage ? 'image' : isPdf ? 'pdf' : 'file';

      const url = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/upload?filename=${encodeURIComponent(file.name)}`);
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data.url);
            } catch (err) {
              reject(new Error("Resposta inválida do servidor"));
            }
          } else {
            reject(new Error(`Erro no upload (${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error("Falha na conexão de rede"));
        xhr.send(file);
      });

      const path = `events/${event.id}/payments/${targetPayment.id}`;
      await updateDoc(doc(db, path), {
        receiptUrl: url,
        receiptName: file.name,
        receiptType: fileType,
        receipts: [{
          id: `receipt_${Date.now()}`,
          url,
          name: file.name,
          type: fileType,
          size: file.size,
          uploadedAt: new Date()
        }],
        updatedAt: serverTimestamp()
      });

      toast.success("Print do comprovante anexado com sucesso!");
    } catch (err: any) {
      console.error("Quick upload error:", err);
      toast.error(err.message || "Erro ao anexar comprovante");
    } finally {
      setIsQuickUploading(null);
      setQuickUploadTarget(null);
      if (quickFileInputRef.current) {
        quickFileInputRef.current.value = '';
      }
    }
  };

  // Lightbox Modal Action Handlers
  const handleDeleteReceiptFromModal = async (payment: PaymentItem) => {
    const path = `events/${event.id}/payments/${payment.id}`;
    try {
      await updateDoc(doc(db, path), {
        receiptUrl: null,
        receiptName: null,
        receiptType: null,
        receipts: [],
        updatedAt: serverTimestamp()
      });
      setViewingReceiptPayment(null);
      toast.success("Comprovante removido.");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      toast.error("Erro ao remover comprovante");
    }
  };

  const handleUploadNewReceiptFromModal = async (payment: PaymentItem, file: File) => {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const fileType: 'image' | 'pdf' | 'file' = isImage ? 'image' : isPdf ? 'pdf' : 'file';

    const url = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/upload?filename=${encodeURIComponent(file.name)}`);
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data.url);
          } catch (err) {
            reject(new Error("Resposta inválida"));
          }
        } else {
          reject(new Error(`Status ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error("Erro de conexão"));
      xhr.send(file);
    });

    const path = `events/${event.id}/payments/${payment.id}`;
    const newReceiptItem: PaymentReceipt = {
      id: `receipt_${Date.now()}`,
      url,
      name: file.name,
      type: fileType,
      size: file.size,
      uploadedAt: new Date()
    };

    await updateDoc(doc(db, path), {
      receiptUrl: url,
      receiptName: file.name,
      receiptType: fileType,
      receipts: [newReceiptItem],
      updatedAt: serverTimestamp()
    });

    setViewingReceiptPayment(prev => prev ? {
      ...prev,
      receiptUrl: url,
      receiptName: file.name,
      receiptType: fileType,
      receipts: [newReceiptItem]
    } : null);

    toast.success("Comprovante atualizado!");
  };

  const total = payments.reduce((acc, curr) => acc + curr.amount, 0);
  const received = payments.filter(p => p.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
  const pendingValue = payments.filter(p => p.status === 'overdue').reduce((acc, curr) => acc + curr.amount, 0);
  const toReceive = payments.filter(p => p.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0);

  const paidCount = payments.filter(p => p.status === 'paid').length;
  const overdueCount = payments.filter(p => p.status === 'overdue').length;
  const pendingCount = payments.filter(p => p.status === 'pending').length;
  const percentage = total > 0 ? Math.round((received / total) * 100) : 0;

  return (
    <div className="space-y-8 p-4 sm:p-6 font-sans">
      {/* Hidden input for 1-click quick row upload */}
      <input
        ref={quickFileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleQuickFileSelected}
        className="hidden"
      />

      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
        <div className="space-y-1">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-cyan-400">Fluxo Financeiro</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic flex items-center">
            <Landmark className="w-3 h-3 mr-2 text-cyan-500/50" />
            Gestão de parcelas, comprovantes e recebimentos do evento
          </p>
        </div>

        {/* Modal: Novo Pagamento */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger render={
            <Button className="bg-white/5 text-white hover:bg-white/10 rounded-2xl h-12 px-6 border border-white/10 backdrop-blur-md font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(34,211,238,0.1)]">
              <Plus className="w-4 h-4 mr-2 text-cyan-500" />
              Registrar Pagamento
            </Button>
          } />
          <DialogContent className="rounded-[2.5rem] sm:max-w-[520px] max-h-[92vh] overflow-y-auto glass border-white/10 text-slate-100 p-6 sm:p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-white tracking-tight">Novo Pagamento</DialogTitle>
            </DialogHeader>
            <div className="grid gap-5 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Título / Descrição</Label>
                <Input 
                  value={newPayment.description} 
                  onChange={e => setNewPayment({...newPayment, description: e.target.value})} 
                  placeholder="Ex: Parcela 1/3 - DJ" 
                  className="rounded-2xl bg-white/5 border-white/10 text-white h-12" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Total Bruto (R$)</Label>
                <Input 
                  type="number" 
                  value={newPayment.amount} 
                  onChange={e => setNewPayment({...newPayment, amount: e.target.value})} 
                  placeholder="0.00" 
                  className="rounded-2xl bg-white/5 border-white/10 text-white h-12" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Número de Parcelas</Label>
                <div className="grid grid-cols-6 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNewPayment({...newPayment, installments: n})}
                      className={cn(
                        "h-10 rounded-xl border text-[10px] font-black transition-all",
                        newPayment.installments === n 
                          ? "bg-cyan-500 border-cyan-500 text-white shadow-[0_0_10px_rgba(34,211,238,0.3)]" 
                          : "border-white/5 bg-white/5 text-slate-500 hover:bg-white/10"
                      )}
                    >
                      {n}x
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Data de Vencimento</Label>
                <Input 
                  type="date" 
                  value={newPayment.dueDate} 
                  onChange={e => setNewPayment({...newPayment, dueDate: e.target.value})} 
                  className="rounded-2xl bg-white/5 border-white/10 text-white h-12" 
                />
              </div>
              <div className="space-y-2 uppercase">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Status Inicial</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'pending', label: 'A Receber', color: 'border-amber-500/50 bg-amber-500/10 text-amber-500' },
                    { id: 'overdue', label: 'Pendente', color: 'border-rose-500/50 bg-rose-500/10 text-rose-500' },
                    { id: 'paid', label: 'Recebido', color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500' }
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setNewPayment({...newPayment, status: s.id as any})}
                      className={cn(
                        "py-3 px-1 rounded-xl border text-[9px] font-black tracking-widest transition-all",
                        newPayment.status === s.id ? s.color : "border-white/5 bg-white/5 text-slate-500 hover:bg-white/10"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Anexar Comprovante / Print */}
              <div className="pt-2 border-t border-white/5">
                <PaymentReceiptUploader
                  receipt={newPayment.receipt}
                  onChange={(receipt) => setNewPayment({...newPayment, receipt})}
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button onClick={handleAdd} disabled={loading} className="w-full bg-cyan-500 hover:bg-cyan-600 rounded-2xl h-14 font-black shadow-[0_0_20px_rgba(34,211,238,0.3)] text-white">
                {loading ? <Loader2 className="animate-spin mr-2" /> : <Landmark className="mr-2 w-4 h-4" />}
                Confirmar Agendamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cards de Resumo Financeiro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-[2rem] border-amber-500/30 bg-amber-500/15 backdrop-blur-md shadow-2xl relative overflow-hidden group border">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-[40px] group-hover:scale-150 transition-transform" />
          <CardContent className="p-7 relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/80 mb-2">A Receber</p>
            <h3 className="text-3xl font-black text-amber-400 tracking-tight">R$ {toReceive.toLocaleString()}</h3>
          </CardContent>
        </Card>
        
        <Card className="rounded-[2rem] border-rose-500/30 bg-rose-500/15 backdrop-blur-md shadow-2xl relative overflow-hidden group border">
          <div className="absolute top-0 left-0 w-24 h-24 bg-rose-500/10 rounded-full blur-[40px] group-hover:scale-150 transition-transform" />
          <CardContent className="p-7 relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500/80 mb-2">Pendente/Atrasado</p>
            <h3 className="text-3xl font-black text-rose-400 tracking-tight">R$ {pendingValue.toLocaleString()}</h3>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-emerald-500/30 bg-emerald-500/15 backdrop-blur-md shadow-2xl relative overflow-hidden group border">
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-[40px] group-hover:scale-150 transition-transform" />
          <CardContent className="p-7 relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/80 mb-2">Recebido</p>
            <h3 className="text-3xl font-black text-emerald-400 tracking-tight">R$ {received.toLocaleString()}</h3>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-violet-500/30 bg-violet-500/15 backdrop-blur-md shadow-2xl relative overflow-hidden group border">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 rounded-full blur-[40px] group-hover:scale-150 transition-transform" />
          <CardContent className="p-7 relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-500/80 mb-2">Valor Total</p>
            <h3 className="text-3xl font-black text-violet-400 tracking-tight">R$ {total.toLocaleString()}</h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 flex items-center justify-between group hover:bg-emerald-500/20 transition-colors duration-500">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Concluído</p>
            <h4 className="text-2xl font-black text-white">{paidCount} Parcelas Pagas</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
        </div>
        
        <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 flex items-center justify-between group hover:bg-rose-500/20 transition-colors duration-500">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Aguardando</p>
            <h4 className="text-2xl font-black text-white">{overdueCount + pendingCount} Parcelas Pendentes</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 group-hover:scale-110 transition-transform">
            <Clock className="w-6 h-6 text-rose-500" />
          </div>
        </div>

        <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 flex items-center justify-between group hover:bg-cyan-500/20 transition-colors duration-500 overflow-hidden relative">
          <div className="space-y-1 relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Progresso Recebido</p>
            <h4 className="text-2xl font-black text-white">{percentage}% Recebido</h4>
          </div>
          <div className="relative z-10 w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 group-hover:scale-110 transition-transform">
            <span className="text-[10px] font-black text-cyan-400">{percentage}%</span>
          </div>
          <div 
            className="absolute bottom-0 left-0 h-1 bg-cyan-500/20 transition-all duration-1000" 
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Timeline Financeira & Lista de Parcelas */}
      <div className="bg-white/5 rounded-[2.5rem] shadow-2xl border border-white/5 backdrop-blur-md overflow-hidden">
        <header className="px-8 py-7 bg-white/5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-pink-500/10 rounded-2xl flex items-center justify-center border border-pink-500/20">
              <Calendar className="w-5 h-5 text-pink-500" />
            </div>
            <div>
              <h3 className="font-black text-white tracking-tight text-xl">Timeline Financeira</h3>
              <p className="text-xs text-slate-400 font-medium">Controle de parcelas e comprovantes bancários</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-white/5 border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
            {payments.length} Parcelas
          </Badge>
        </header>

        <div className="divide-y divide-white/5 font-sans">
          {/* Header das Colunas Desktop */}
          <div className="hidden lg:grid grid-cols-12 px-8 py-4 bg-white/[0.02] text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span className="col-span-4">Título / Descrição</span>
            <span className="col-span-2">Valor (R$)</span>
            <span className="col-span-2">Vencimento</span>
            <span className="col-span-2">Comprovante / Print</span>
            <span className="col-span-2 text-right pr-2">Status & Ações</span>
          </div>

          {payments
            .sort((a, b) => (a.dueDate?.seconds || 0) - (b.dueDate?.seconds || 0))
            .map((p, idx) => {
              const hasReceipt = Boolean(p.receiptUrl || (p.receipts && p.receipts.length > 0));
              const receiptUrl = p.receiptUrl || p.receipts?.[0]?.url;
              const isImage = receiptUrl && (p.receiptType === 'image' || !receiptUrl.toLowerCase().endsWith('.pdf'));

              return (
                <div 
                  key={p.id} 
                  onClick={() => handleEditOpen(p)}
                  className={cn(
                    "p-5 sm:p-6 lg:px-8 lg:py-5 grid grid-cols-1 lg:grid-cols-12 items-center gap-4 lg:gap-0 transition-all group relative cursor-pointer",
                    p.status === 'paid' ? "bg-emerald-500/5 hover:bg-emerald-500/10" :
                    p.status === 'overdue' ? "bg-rose-500/5 hover:bg-rose-500/10" :
                    "bg-amber-500/5 hover:bg-amber-500/10"
                  )}
                >
                  {/* Descrição & Número da Parcela (Col 4) */}
                  <div className="lg:col-span-4 flex items-center space-x-3.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-800/80 flex items-center justify-center font-black text-slate-400 text-xs border border-white/5 shadow-md group-hover:text-cyan-400 transition-colors shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-white tracking-tight line-clamp-1 group-hover:text-cyan-300 transition-colors">
                        {p.description || `Parcela #${idx + 1}`}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium sm:hidden">
                        Vencimento: {p.dueDate ? format(p.dueDate.toDate(), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Valor (Col 2) */}
                  <div className="lg:col-span-2">
                    <p className="text-base sm:text-lg font-black text-white tracking-tight">
                      R$ {p.amount.toLocaleString()}
                    </p>
                  </div>

                  {/* Data de Vencimento (Col 2) */}
                  <div className="hidden lg:block lg:col-span-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-2 text-pink-500 opacity-70" />
                      {p.dueDate ? format(p.dueDate.toDate(), "dd 'de' MMMM", { locale: ptBR }) : '-'}
                    </p>
                  </div>

                  {/* Comprovante / Print do Pagamento (Col 2) */}
                  <div className="lg:col-span-2 flex items-center">
                    {hasReceipt ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingReceiptPayment(p);
                        }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:text-white transition-all shadow-sm group/receipt active:scale-95"
                        title="Clique para visualizar o comprovante"
                      >
                        {isImage && receiptUrl ? (
                          <div className="w-5 h-5 rounded-md bg-black/40 overflow-hidden shrink-0 border border-cyan-400/30">
                            <img src={receiptUrl} alt="Print" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-cyan-400" />
                        )}
                        <span className="text-[11px] font-bold tracking-tight">Ver Print</span>
                        <Eye className="w-3 h-3 opacity-60 group-hover/receipt:opacity-100" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleQuickUploadClick(p, e)}
                        disabled={isQuickUploading === p.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-dashed border-white/15 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-all text-[11px] font-bold active:scale-95"
                        title="Anexar print do comprovante"
                      >
                        {isQuickUploading === p.id ? (
                          <><Loader2 className="w-3 h-3 animate-spin text-cyan-400" /> Enviando...</>
                        ) : (
                          <><Paperclip className="w-3 h-3 text-slate-400" /> + Anexar Print</>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Status & Ações (Col 2) */}
                  <div className="lg:col-span-2 flex items-center justify-between lg:justify-end gap-2">
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); cycleStatus(p); }}
                      className={cn(
                        "rounded-2xl h-9 sm:h-10 px-4 sm:px-5 font-black text-[9px] uppercase tracking-[0.15em] transition-all border shrink-0 flex items-center active:scale-95",
                        p.status === 'paid' 
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
                          : p.status === 'overdue'
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                      )}
                      title="Clique para alternar o status"
                    >
                      {p.status === 'paid' ? (
                        <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Recebido</>
                      ) : p.status === 'overdue' ? (
                        <><Clock className="w-3.5 h-3.5 mr-1.5" /> Pendente</>
                      ) : (
                        <><Calendar className="w-3.5 h-3.5 mr-1.5" /> A Receber</>
                      )}
                    </button>

                    <div className="flex items-center lg:opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => { e.stopPropagation(); handleEditOpen(p); }} 
                        className="text-slate-400 hover:text-white hover:bg-white/10 rounded-full h-8 w-8"
                        title="Editar Pagamento"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} 
                        className="text-slate-400 hover:text-rose-500 hover:bg-white/10 rounded-full h-8 w-8"
                        title="Excluir Pagamento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

          {payments.length === 0 && (
            <div className="p-16 text-center text-slate-600 flex flex-col items-center">
              <Landmark className="w-16 h-16 mb-4 opacity-10 text-cyan-500" />
              <p className="italic font-bold tracking-tight uppercase text-xs tracking-[0.2em]">Cofre Financeiro Vazio</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Edição de Pagamento */}
      <Dialog open={!!editingPayment} onOpenChange={(open) => { if (!open) setEditingPayment(null); }}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-[520px] max-h-[92vh] overflow-y-auto glass border-white/10 text-slate-100 p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-white tracking-tight">Editar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Título / Descrição</Label>
              <Input 
                value={editForm.description} 
                onChange={e => setEditForm({...editForm, description: e.target.value})} 
                className="rounded-2xl bg-white/5 border-white/10 text-white h-12" 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Valor (R$)</Label>
              <Input 
                type="number" 
                value={editForm.amount} 
                onChange={e => setEditForm({...editForm, amount: e.target.value})} 
                className="rounded-2xl bg-white/5 border-white/10 text-white h-12" 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Data de Vencimento</Label>
              <Input 
                type="date" 
                value={editForm.dueDate} 
                onChange={e => setEditForm({...editForm, dueDate: e.target.value})} 
                className="rounded-2xl bg-white/5 border-white/10 text-white h-12" 
              />
            </div>
            <div className="space-y-2 uppercase">
              <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Status</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'pending', label: 'A Receber', color: 'border-amber-500/50 bg-amber-500/10 text-amber-500' },
                  { id: 'overdue', label: 'Pendente', color: 'border-rose-500/50 bg-rose-500/10 text-rose-500' },
                  { id: 'paid', label: 'Recebido', color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' }
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setEditForm({...editForm, status: s.id as any})}
                    className={cn(
                      "py-3 px-1 rounded-xl border text-[9px] font-black tracking-widest transition-all",
                      editForm.status === s.id ? s.color : "border-white/5 bg-white/5 text-slate-500 hover:bg-white/10"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Anexar / Gerenciar Comprovante */}
            <div className="pt-2 border-t border-white/5">
              <PaymentReceiptUploader
                receipt={editForm.receipt}
                onChange={(receipt) => setEditForm({...editForm, receipt})}
                onPreview={() => {
                  if (editingPayment && editForm.receipt) {
                    setViewingReceiptPayment({
                      ...editingPayment,
                      receiptUrl: editForm.receipt.url,
                      receiptName: editForm.receipt.name,
                      receiptType: editForm.receipt.type
                    });
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button onClick={handleUpdate} disabled={loading} className="w-full bg-cyan-500 hover:bg-cyan-600 rounded-2xl h-14 font-black text-white shadow-[0_0_20px_rgba(34,211,238,0.3)]">
              {loading ? <Loader2 className="animate-spin mr-2" /> : <Pencil className="mr-2 w-4 h-4" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox Modal de Visualização Completa do Comprovante */}
      <PaymentReceiptModal
        payment={viewingReceiptPayment}
        isOpen={!!viewingReceiptPayment}
        onClose={() => setViewingReceiptPayment(null)}
        onDeleteReceipt={handleDeleteReceiptFromModal}
        onUploadNewReceipt={handleUploadNewReceiptFromModal}
      />
    </div>
  );
}
