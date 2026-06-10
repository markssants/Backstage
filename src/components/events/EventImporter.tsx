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

  const validateAndSetData = (fileText: string) => {
    const trimmed = fileText.trim();
    const isHtml = trimmed.startsWith('<!') || trimmed.toLowerCase().includes('<html') || trimmed.toLowerCase().includes('</html>');

    if (isHtml) {
      try {
        const domParser = new DOMParser();
        const htmlDoc = domParser.parseFromString(fileText, 'text/html');

        // Strategy A: Check for flawless embedded JSON
        const embeddedScript = htmlDoc.getElementById('beys-arts-backup-data');
        if (embeddedScript && embeddedScript.textContent) {
          try {
            const parsedData = JSON.parse(embeddedScript.textContent);
            if (parsedData.eventInfo && parsedData.eventInfo.name) {
              setImportedData(parsedData);
              setErrorMessage(null);
              toast.success("Relatório HTML com backup incorporado detectado!");
              return;
            }
          } catch (e) {
            console.warn("Found embedded backup script, but failed to parse JSON content.", e);
          }
        }

        // Strategy B: Scrape legacy formatted HTML layout
        const titleEl = htmlDoc.querySelector('header h1');
        const name = titleEl ? titleEl.textContent?.trim() : '';
        if (!name) {
          throw new Error("Não foi possível encontrar o nome do evento no cabeçalho do relatório HTML.");
        }

        const logoImg = htmlDoc.querySelector('header img');
        const logoUrl = logoImg ? logoImg.getAttribute('src') : `https://api.dicebear.com/7.x/initials/svg?seed=${name}`;

        // Get location and metadata
        const flexSpans = Array.from(htmlDoc.querySelectorAll('header span, header div span, header p span'));
        
        let city = '';
        let location = '';
        const locationSpan = flexSpans.find(el => el.textContent?.includes('📍'));
        if (locationSpan) {
          const text = locationSpan.textContent?.replace('📍', '').trim() || '';
          const parts = text.split(/\s*-\s*/);
          city = parts[0] ? parts[0].trim() : '';
          location = parts[1] ? parts[1].trim() : '';
          if (city === 'Sem Cidade') city = '';
          if (location === 'Sem Local') location = '';
        }

        let eventDate = '';
        const dateSpan = flexSpans.find(el => el.textContent?.includes('📅'));
        if (dateSpan) {
          eventDate = dateSpan.textContent?.replace('📅', '').trim() || '';
          if (eventDate === 'Sem Data') eventDate = '';
        }

        let contractorName = '';
        const contractorSpan = flexSpans.find(el => el.textContent?.includes('👤'));
        if (contractorSpan) {
          contractorName = contractorSpan.textContent?.replace('👤', '').replace(/Contratante:\s*/i, '').trim() || '';
          if (contractorName === 'Não especificado') contractorName = '';
        }

        // Event Status
        const statusBadge = htmlDoc.querySelector('header span.tracking-widest') || htmlDoc.querySelector('header span.text-purple-400');
        const statusText = statusBadge ? statusBadge.textContent?.trim() || '' : '';
        let status = 'planning';
        if (statusText.toLowerCase().includes('andamento') || statusText.toLowerCase().includes('execu')) {
          status = 'active';
        } else if (statusText.toLowerCase().includes('concl')) {
          status = 'completed';
        }

        // Arts parsing
        const artsRows = htmlDoc.querySelectorAll('#arts-tab tbody tr');
        const artsList: any[] = [];
        artsRows.forEach((row, index) => {
          const tds = row.querySelectorAll('td');
          if (tds.length < 6) return;
          const artTitle = tds[0].textContent?.trim() || '';
          if (!artTitle || artTitle.includes('Nenhuma arte cadastrada')) return;

          const artDesc = tds[1].getAttribute('title')?.trim() || tds[1].textContent?.trim() || '';
          const categoryText = tds[2].querySelector('span')?.textContent?.trim() || '';
          const priorityText = tds[3].querySelector('span')?.textContent?.trim() || '';
          const deadlineText = tds[4].textContent?.trim() || '';
          const statusText = tds[5].querySelector('span')?.textContent?.trim() || '';

          let category = 'party';
          const catLower = categoryText.toLowerCase();
          if (catLower === 'dj') category = 'dj';
          else if (catLower === 'branding') category = 'branding';

          let priority = 'low';
          const priLower = priorityText.toLowerCase();
          if (priLower === 'urgente' || priLower === 'high' || priLower === 'alta') priority = 'high';
          else if (priLower === 'média' || priLower === 'media' || priLower === 'medium') priority = 'medium';

          let artStatus = 'todo';
          const statLower = statusText.toLowerCase();
          if (statLower.includes('produ')) artStatus = 'production';
          else if (statLower.includes('revis')) artStatus = 'review';
          else if (statLower.includes('entreg')) artStatus = 'delivered';
          else if (statLower.includes('post')) artStatus = 'post';
          else if (statLower.includes('finaliz') || statLower.includes('concl')) artStatus = 'finished';

          let deadline: any = null;
          if (deadlineText && deadlineText !== 'Sem Prazo' && deadlineText !== 'Sem prazo') {
            const parts = deadlineText.split(' ');
            if (parts[0]) {
              const dParts = parts[0].split('/');
              const tParts = (parts[1] || '00:00').split(':');
              if (dParts.length === 3) {
                const d = new Date(parseInt(dParts[2]), parseInt(dParts[1]) - 1, parseInt(dParts[0]), parseInt(tParts[0] || '00'), parseInt(tParts[1] || '00'));
                if (!isNaN(d.getTime())) {
                  deadline = d.toISOString();
                }
              }
            }
          }

          artsList.push({
            title: artTitle === 'Sem título' ? '' : artTitle,
            description: artDesc === 'Sem descrição' ? '' : artDesc,
            category,
            priority,
            deadline,
            status: artStatus,
            position: index * 1000
          });
        });

        // DJs parsing
        const djRows = htmlDoc.querySelectorAll('#djs-tab tbody tr');
        const djsList: any[] = [];
        djRows.forEach((row) => {
          const tds = row.querySelectorAll('td');
          if (tds.length < 5) return;
          const djName = tds[0].textContent?.trim() || '';
          if (!djName || djName.includes('Nenhum DJ cadastrado')) return;

          const presskitStatusText = tds[1].querySelector('span')?.textContent?.trim() || '';
          let presskitStatus = 'pending';
          if (presskitStatusText.includes('✓') || presskitStatusText.toLowerCase().includes('compl')) {
            presskitStatus = 'completed';
          }
          const presskitLinkElement = tds[1].querySelector('a');
          const presskitUrl = presskitLinkElement ? presskitLinkElement.getAttribute('href') : '';

          const musicNameSpan = tds[2].querySelector('span');
          const musicName = (musicNameSpan?.textContent?.trim() === 'Sem Música Demo' ? '' : musicNameSpan?.textContent?.trim()) || '';
          const musicLinkElement = tds[2].querySelector('a');
          const musicUrl = musicLinkElement ? musicLinkElement.getAttribute('href') : '';

          const agencies: any[] = [];
          const labels: any[] = [];
          
          const divsInTd3 = tds[3].querySelectorAll('div');
          if (divsInTd3.length >= 2) {
            const agencyLinks = divsInTd3[0].querySelectorAll('a');
            agencyLinks.forEach(link => {
              const aName = link.textContent?.replace('↗', '').trim() || '';
              const aUrl = link.getAttribute('href') || '';
              agencies.push({ name: aName, link: aUrl });
            });
            
            const labelLinks = divsInTd3[1].querySelectorAll('a');
            labelLinks.forEach(link => {
              const lName = link.textContent?.replace('↗', '').trim() || '';
              const lUrl = link.getAttribute('href') || '';
              labels.push({ name: lName, link: lUrl });
            });
          }

          const flyerLink = Array.from(tds[4].querySelectorAll('a')).find(el => el.textContent?.includes('📸'));
          const flyerPhoto = flyerLink ? flyerLink.getAttribute('href') : '';

          const motionLink = Array.from(tds[4].querySelectorAll('a')).find(el => el.textContent?.includes('🎥'));
          const animationVideo = motionLink ? motionLink.getAttribute('href') : '';

          djsList.push({
            name: djName,
            presskitStatus,
            presskitUrl: presskitUrl || '',
            musicName,
            musicUrl: musicUrl || '',
            agencies,
            labels,
            flyerPhoto: flyerPhoto || '',
            animationVideo: animationVideo || '',
            rating: 0
          });
        });

        // Payments parsing
        const paymentRows = htmlDoc.querySelectorAll('#payments-tab tbody tr');
        const paymentsList: any[] = [];
        paymentRows.forEach((row) => {
          const tds = row.querySelectorAll('td');
          if (tds.length < 5) return;
          const description = tds[0].textContent?.trim() || '';
          if (!description || description.includes('Nenhum pagamento cadastrado')) return;

          const amountText = tds[1].textContent?.replace('R$', '').replace(/\./g, '').replace(',', '.').trim() || '';
          const amount = parseFloat(amountText) || 0;

          const dueDateText = tds[2].textContent?.trim() || '';
          let dueDate: any = null;
          if (dueDateText && dueDateText !== 'Sem vencimento') {
            const p = dueDateText.split('/');
            if (p.length === 3) {
              const d = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
              if (!isNaN(d.getTime())) {
                dueDate = d.toISOString();
              }
            }
          }

          const paidAtText = tds[3].textContent?.trim() || '';
          let paidAt: any = null;
          if (paidAtText && paidAtText !== 'Pendente') {
            const p = paidAtText.split('/');
            if (p.length === 3) {
              const d = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
              if (!isNaN(d.getTime())) {
                paidAt = d.toISOString();
              }
            }
          }

          const statusSpanText = tds[4].querySelector('span')?.textContent?.trim() || '';
          let payStatus = 'pending';
          if (statusSpanText.toLowerCase().includes('pag') || statusSpanText.toLowerCase() === 'pago') {
            payStatus = 'paid';
          } else if (statusSpanText.toLowerCase().includes('atras') || statusSpanText.toLowerCase() === 'atrasado') {
            payStatus = 'overdue';
          }

          paymentsList.push({
            description,
            amount,
            dueDate,
            paidAt,
            status: payStatus
          });
        });

        // Project documents parsing
        const documentsList: any[] = [];
        const documentLinks = Array.from(htmlDoc.querySelectorAll('a')).filter(el => el.textContent?.includes('Visualizar Documento'));
        documentLinks.forEach(linkEl => {
          const url = linkEl.getAttribute('href') || '';
          const block = linkEl.closest('div');
          if (!block) return;
          
          const h4El = block.querySelector('h4');
          const docName = h4El ? h4El.textContent?.trim() : 'Documento';
          if (docName === 'Nenhum documento arquivado') return;

          const pEl = block.querySelector('p');
          const pText = pEl ? pEl.textContent?.trim() || '' : '';
          
          let type = 'other';
          if (pText.toLowerCase().includes('contrato') || pText.toLowerCase().includes('contract')) {
            type = 'contract';
          } else if (pText.toLowerCase().includes('recibo') || pText.toLowerCase().includes('receipt')) {
            type = 'receipt';
          } else if (pText.toLowerCase().includes('proposta') || pText.toLowerCase().includes('proposal')) {
            type = 'proposal';
          }

          let docStatus = 'draft';
          if (pText.toLowerCase().includes('assinado') || pText.toLowerCase().includes('signed')) {
            docStatus = 'signed';
          } else if (pText.toLowerCase().includes('pendente') || pText.toLowerCase().includes('pending')) {
            docStatus = 'pending';
          }

          documentsList.push({
            name: docName,
            url,
            type,
            status: docStatus
          });
        });

        const scrapedData = {
          eventInfo: {
            name,
            logoUrl,
            city,
            location,
            eventDate,
            contractorName,
            status,
            djCount: djsList.length,
            artCount: artsList.length,
            motionCount: 0
          },
          artsList,
          djsList,
          paymentsList,
          documentsList
        };

        setImportedData(scrapedData);
        setErrorMessage(null);
        toast.success("Tabelas analisadas e mapeadas do Relatório HTML!");
      } catch (err: any) {
        setErrorMessage(err.message || "Formato de arquivo HTML inconsistente.");
        setImportedData(null);
        toast.error("Erro ao analisar arquivo HTML");
      }
    } else {
      try {
        const data = JSON.parse(fileText);
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
      const isJson = file.type === "application/json" || file.name.endsWith(".json");
      const isHtml = file.type === "text/html" || file.name.endsWith(".html") || file.name.endsWith(".htm");
      
      if (isJson || isHtml) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            validateAndSetData(event.target.result as string);
          }
        };
        reader.readAsText(file);
      } else {
        toast.error("Por favor, selecione apenas arquivos JSON ou HTML de backup.");
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
            Traga um backup do evento gerado anteriormente pela ferramenta "Exportar Dados". Todos os DJs, entregas de artes, cronograma financeiro e contratos serão restaurados. Aceita arquivos .json e o relatório .html interativo.
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
              accept=".json,.html,.htm"
              className="hidden" 
              onChange={handleFileInput}
            />
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <Upload className="w-7 h-7" />
            </div>
            <div>
              <p className="font-bold text-white text-base">Arraste e solte o arquivo JSON ou HTML de backup</p>
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
