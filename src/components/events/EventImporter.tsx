import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Loader2, FileJson, CheckCircle2, AlertCircle, X, Download } from "lucide-react";
import { UserProfile, OperationType } from "../../types";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db, handleFirestoreError } from "../../firebase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EventImporterProps {
  profile: UserProfile;
  onEventImported?: (id: string) => void;
  isMinimal?: boolean;
}

export function EventImporter({ profile, onEventImported, isMinimal = false }: EventImporterProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [importedData, setImportedData] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = profile.email === 'beysarts@gmail.com';

  if (!isAdmin) return null;

  // Resilient Firebase Timestamp Parser
  const parseToFirestoreTimestamp = (value: any): any => {
    if (!value) return null;
    if (typeof value === 'object' && value !== null) {
      if ('seconds' in value) {
        return new Timestamp(value.seconds, value.nanoseconds || 0);
      }
      if ('_seconds' in value) {
        return new Timestamp(value._seconds, value._nanoseconds || 0);
      }
    }
    if (typeof value === 'string') {
      try {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
          return Timestamp.fromDate(d);
        }
      } catch (e) {
        console.error("Error parsing string to date", e);
      }
    }
    return value;
  };

  const validateAndSetData = (jsonText: string) => {
    try {
      const data = JSON.parse(jsonText);
      if (!data.eventInfo || !data.eventInfo.name) {
        throw new Error("O arquivo JSON não é um backup de evento válido ou está corrompido.");
      }
      
      setImportedData(data);
      setErrorMessage(null);
      toast.success("Arquivo de backup validado com sucesso!");
    } catch (err: any) {
      setErrorMessage(err.message || "Formato de arquivo inválido. Por favor, forneça o JSON exportado.");
      setImportedData(null);
      toast.error("Erro ao processar arquivo");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/json" || file.name.endsWith(".json")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            validateAndSetData(event.target.result as string);
          }
        };
        reader.readAsText(file);
      } else {
        toast.error("Por favor, selecione apenas arquivos JSON de backup.");
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          validateAndSetData(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleImportSubmit = async () => {
    if (!importedData) return;
    setLoading(true);

    try {
      const { eventInfo, artsList = [], djsList = [], paymentsList = [], documentsList = [] } = importedData;

      // 1. Prepare main Event document
      const eventData = {
        name: eventInfo.name,
        logoUrl: eventInfo.logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${eventInfo.name}`,
        driveUrl: eventInfo.driveUrl || '',
        contractorName: eventInfo.contractorName || '',
        city: eventInfo.city || '',
        eventDate: eventInfo.eventDate || '',
        djCount: parseInt(eventInfo.djCount) || djsList.length || 0,
        artCount: parseInt(eventInfo.artCount) || artsList.length || 0,
        motionCount: parseInt(eventInfo.motionCount) || 0,
        location: eventInfo.location || '',
        contractorEmail: eventInfo.contractorEmail || '',
        designerEmail: eventInfo.designerEmail || '',
        contractorId: profile.role === 'contractor' ? profile.id : (eventInfo.contractorId || 'unresolved'),
        designerId: profile.role === 'designer' ? profile.id : (eventInfo.designerId || 'unresolved'),
        status: eventInfo.status || 'planning',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Create Event document
      const eventDocRef = await addDoc(collection(db, 'events'), eventData);
      const newEventId = eventDocRef.id;

      // Helper to strip local 'id' and configure properties
      const prepareSubdocument = (item: any) => {
        const clean = { ...item };
        delete clean.id; // Strip original ID to let Firebase auto-generate
        clean.eventId = newEventId;

        // Clean & restore specific timestamps
        if ('createdAt' in clean) clean.createdAt = parseToFirestoreTimestamp(clean.createdAt) || serverTimestamp();
        if ('updatedAt' in clean) clean.updatedAt = parseToFirestoreTimestamp(clean.updatedAt) || serverTimestamp();
        if ('deadline' in clean) clean.deadline = parseToFirestoreTimestamp(clean.deadline);
        if ('dueDate' in clean) clean.dueDate = parseToFirestoreTimestamp(clean.dueDate);
        if ('paidAt' in clean) clean.paidAt = parseToFirestoreTimestamp(clean.paidAt);

        // Ensure number datatypes on critical fields
        if ('position' in clean && typeof clean.position !== 'number') {
          clean.position = parseInt(clean.position) || 0;
        }
        if ('amount' in clean && typeof clean.amount !== 'number') {
          clean.amount = parseFloat(clean.amount) || 0;
        }

        return clean;
      };

      // 2. Import subcollections sequentially or concurrently
      // Import Arts
      for (const art of artsList) {
        const cleanArt = prepareSubdocument(art);
        await addDoc(collection(db, 'events', newEventId, 'arts'), cleanArt);
      }

      // Import DJs
      for (const dj of djsList) {
        const cleanDj = prepareSubdocument(dj);
        await addDoc(collection(db, 'events', newEventId, 'dj_assets'), cleanDj);
      }

      // Import Payments
      for (const payment of paymentsList) {
        const cleanPayment = prepareSubdocument(payment);
        await addDoc(collection(db, 'events', newEventId, 'payments'), cleanPayment);
      }

      // Import Documents
      for (const docItem of documentsList) {
        const cleanDoc = prepareSubdocument(docItem);
        await addDoc(collection(db, 'events', newEventId, 'documents'), cleanDoc);
      }

      toast.success("Evento e todos os dados importados com sucesso!");
      setOpen(false);
      
      // Select the newly imported event
      if (onEventImported) {
        onEventImported(newEventId);
      }

      resetState();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'events');
      toast.error("Erro crítico ao importar os dados do backup.");
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setImportedData(null);
    setErrorMessage(null);
    setDragActive(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetState(); }}>
      <DialogTrigger render={
        <Button 
          variant="outline" 
          className={cn(
            "rounded-2xl bg-white/5 border-purple-500/20 hover:bg-purple-500/10 text-purple-400 transition-all duration-300 font-bold flex items-center justify-center shrink-0 cursor-pointer",
            isMinimal 
              ? "h-10 px-2.5 sm:px-4 text-xs sm:text-sm" 
              : "h-12 px-6 hover:scale-105 shadow-[0_0_15px_rgba(168,85,247,0.15)] text-sm sm:text-base"
          )}
        />
      }>
        <Upload className="w-4 h-4 sm:mr-2" />
        <span className="hidden sm:inline text-xs sm:text-sm">Importar Evento</span>
      </DialogTrigger>
      
      <DialogContent className="rounded-[2.5rem] sm:max-w-[600px] glass border-white/10 text-slate-100 p-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-3xl font-black text-white tracking-tighter flex items-center gap-2">
            <Download className="w-7 h-7 text-purple-400" />
            <span>Importação de Evento</span>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Traga um backup do evento gerado anteriormente pela ferramenta "Exportar Dados". Todos os DJs, entregas de artes, cronograma financeiro e contratos serão restaurados.
          </DialogDescription>
        </DialogHeader>

        {/* Drag-and-drop zone */}
        {!importedData && (
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            className={cn(
              "border-2 border-dashed rounded-[1.8rem] p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-4 min-h-[220px]",
              dragActive 
                ? "border-purple-500 bg-purple-500/5 shadow-[0_0_20px_rgba(168,85,247,0.15)]" 
                : "border-white/10 bg-white/[0.01] hover:border-white/20 hover:bg-white/[0.03]"
            )}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".json"
              className="hidden" 
              onChange={handleFileInput}
            />
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <Upload className="w-7 h-7" />
            </div>
            <div>
              <p className="font-bold text-white text-base">Arraste e solte o arquivo JSON do backup</p>
              <p className="text-xs text-slate-500 mt-1">ou clique para navegar nos seus arquivos locais</p>
            </div>
          </div>
        )}

        {/* Display Validation Error */}
        {errorMessage && (
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="space-y-1">
              <p className="font-bold">Arquivo Inválido</p>
              <p className="opacity-90">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Import Preview */}
        {importedData && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <FileJson className="w-8 h-8 text-indigo-400" />
                <div>
                  <h4 className="font-black text-white text-base">{importedData.eventInfo.name}</h4>
                  <p className="text-xs text-slate-500">{importedData.eventInfo.city || 'Sem cidade'} • {importedData.eventInfo.eventDate || 'Sem data'}</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={resetState} 
                className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 text-center">
                <p className="text-2xl font-black text-pink-400">{(importedData.artsList || []).length}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Entregas de Arte</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 text-center">
                <p className="text-2xl font-black text-purple-400">{(importedData.djsList || []).length}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">DJs / Presskits</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 text-center">
                <p className="text-2xl font-black text-amber-400">{(importedData.paymentsList || []).length}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Parcelas Financeiras</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 text-center">
                <p className="text-2xl font-black text-indigo-400">{(importedData.documentsList || []).length}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Documentos / Contratos</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-[11px] text-emerald-400 font-semibold justify-center">
              <CheckCircle2 className="w-4 h-4" />
              <span>O backup é compatível e está pronto para ser restaurado na nuvem.</span>
            </div>
          </div>
        )}

        <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2">
          {importedData && (
            <Button 
              disabled={loading} 
              onClick={handleImportSubmit} 
              className="w-full bg-gradient-to-tr from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-2xl h-14 font-black shadow-lg shadow-pink-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin mr-2" />
                  <span>Restauração em Andamento...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-1" />
                  <span>Confirmar & Restaurar</span>
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
