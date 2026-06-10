import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EventProject, UserProfile, ArtTask, PaymentItem, DjAsset, ProjectDocument, OperationType } from "../../types";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError } from "../../firebase";
import { Palette, CheckCircle2, Clock, AlertCircle, CreditCard, Music, MapPin, User, Calendar as CalendarIcon, Download, FileText, FileSpreadsheet, FileJson, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EventSelector } from '../events/EventSelector';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OverviewProps {
  event: EventProject;
  profile: UserProfile;
}

export function Overview({ event, profile }: OverviewProps) {
  const [arts, setArts] = useState<ArtTask[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [djAssets, setDjAssets] = useState<DjAsset[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [isExportOpen, setIsExportOpen] = useState(false);

  useEffect(() => {
    const artsQ = query(collection(db, 'events', event.id, 'arts'));
    const paymentsQ = query(collection(db, 'events', event.id, 'payments'));
    const djAssetsQ = query(collection(db, 'events', event.id, 'dj_assets'));
    const documentsQ = query(collection(db, 'events', event.id, 'documents'));

    const unsubscribeArts = onSnapshot(artsQ, (snapshot) => {
      setArts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ArtTask)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `events/${event.id}/arts`);
    });

    const unsubscribePayments = onSnapshot(paymentsQ, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentItem)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `events/${event.id}/payments`);
    });

    const unsubscribeDjAssets = onSnapshot(djAssetsQ, (snapshot) => {
      setDjAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DjAsset)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `events/${event.id}/dj_assets`);
    });

    const unsubscribeDocuments = onSnapshot(documentsQ, (snapshot) => {
      setDocuments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectDocument)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `events/${event.id}/documents`);
    });

    return () => {
      unsubscribeArts();
      unsubscribePayments();
      unsubscribeDjAssets();
      unsubscribeDocuments();
    };
  }, [event.id]);

  const finishedArts = arts.filter(a => a.status === 'finished').length;
  const totalArts = arts.length;
  const progress = totalArts > 0 ? (finishedArts / totalArts) * 100 : 0;

  const translateStatus = (statusId: string) => {
    switch (statusId) {
      case 'todo': return 'Para Fazer';
      case 'production': return 'Em Produção';
      case 'review': return 'Revisão';
      case 'delivered': return 'Entregue';
      case 'post': return 'Postar';
      case 'finished': return 'Finalizado';
      default: return statusId;
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

  const translateEventStatus = (status: string) => {
    switch (status) {
      case 'planning': return 'Planejamento';
      case 'active': return 'Em Andamento';
      case 'completed': return 'Concluído';
      default: return status;
    }
  };

  const paidAmount = payments.filter(p => p.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
  const pendingAmount = payments.filter(p => p.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0);
  const nextPayment = payments
    .filter(p => p.status === 'pending')
    .sort((a, b) => (a.dueDate?.seconds || 0) - (b.dueDate?.seconds || 0))[0];

  const formatSafeDate = (timestamp: any, formatStr: string) => {
    if (!timestamp || typeof timestamp.toDate !== 'function') return 'Sem Data';
    try {
      return format(timestamp.toDate(), formatStr, { locale: ptBR });
    } catch (e) {
      return 'Data Inválida';
    }
  };

  // Helper function to trigger browser download
  const triggerDownload = (content: string, fileName: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const data = {
      eventInfo: {
        id: event.id,
        name: event.name,
        city: event.city || '',
        location: event.location || '',
        eventDate: event.eventDate || '',
        contractorName: event.contractorName || '',
        contractorEmail: event.contractorEmail || '',
        designerEmail: event.designerEmail || '',
        status: event.status,
        driveUrl: event.driveUrl || '',
        logoUrl: event.logoUrl || ''
      },
      artsList: arts,
      djsList: djAssets,
      paymentsList: payments,
      documentsList: documents,
      exportedAt: new Date().toISOString()
    };
    triggerDownload(
      JSON.stringify(data, null, 2), 
      `dados_festa_${event.name.toLowerCase().replace(/\s+/g, '_')}.json`, 
      'application/json;charset=utf-8'
    );
  };

  const handleExportArtsCSV = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM for Excel matching accent formatting
    const headers = ["ID da Arte", "Título", "Descrição", "Categoria", "Prioridade", "Prazo", "Status"];
    csvContent += headers.join(";") + "\n";

    arts.forEach(art => {
      const row = [
        art.id,
        art.title || "",
        (art.description || "").replace(/[\r\n]+/g, " "),
        translateCategory(art.category || ""),
        translatePriority(art.priority || ""),
        art.deadline ? formatSafeDate(art.deadline, "dd/MM/yyyy HH:mm") : "Sem Prazo",
        translateStatus(art.status || "")
      ];
      csvContent += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";") + "\n";
    });

    triggerDownload(
      csvContent, 
      `artes_festa_${event.name.toLowerCase().replace(/\s+/g, '_')}.csv`, 
      'text/csv;charset=utf-8'
    );
  };

  const handleExportDjsCSV = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM for Excel compatibility
    const headers = [
      "ID do DJ",
      "Nome do DJ",
      "Status do Presskit",
      "Presskit Link",
      "Música de Trabalho",
      "Link da Música",
      "Duração",
      "Prazo Arte",
      "Agências",
      "Gravadoras",
      "Material Visual",
      "Prioridade",
      "Link Foto do Flyer",
      "Link Animação"
    ];
    csvContent += headers.join(";") + "\n";

    djAssets.forEach(dj => {
      const agenciesStr = dj.agencies?.map(a => `${a.name} (${a.link})`).join(', ') || dj.agencyInfo || '';
      const labelsStr = dj.labels?.map(l => `${l.name} (${l.link})`).join(', ') || dj.labelInfo || '';
      const visualTypeStr = dj.visualMaterialType === 'both' ? 'Foto e Vídeo' : dj.visualMaterialType === 'photo' ? 'Apenas Foto' : dj.visualMaterialType === 'video' ? 'Apenas Vídeo' : 'Não especificado';

      const row = [
        dj.id,
        dj.name || "",
        dj.presskitStatus === 'completed' ? 'Completo' : 'Pendente',
        dj.presskitUrl || "",
        dj.musicName || "",
        dj.musicUrl || "",
        dj.musicDuration || "",
        dj.artDeadline || "",
        agenciesStr,
        labelsStr,
        visualTypeStr,
        dj.priority === 'urgent' ? 'Urgente' : dj.priority === 'medium' ? 'Médio' : 'Baixo',
        dj.flyerPhoto || "",
        dj.animationVideo || ""
      ];
      csvContent += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";") + "\n";
    });

    triggerDownload(
      csvContent, 
      `djs_festa_${event.name.toLowerCase().replace(/\s+/g, '_')}.csv`, 
      'text/csv;charset=utf-8'
    );
  };

  const handleExportPaymentsCSV = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM for Excel compatibility
    const headers = ["ID da Parcela", "Descrição", "Valor (R$)", "Vencimento", "Data de Liquidação", "Status"];
    csvContent += headers.join(";") + "\n";

    payments.forEach(p => {
      const row = [
        p.id,
        p.description || "",
        p.amount || 0,
        p.dueDate ? formatSafeDate(p.dueDate, "dd/MM/yyyy") : "Sem Vencimento",
        p.paidAt ? formatSafeDate(p.paidAt, "dd/MM/yyyy HH:mm") : "Pendente",
        p.status === 'paid' ? 'Pago' : p.status === 'pending' ? 'Pendente' : 'Atrasado'
      ];
      csvContent += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";") + "\n";
    });

    triggerDownload(
      csvContent, 
      `financeiro_festa_${event.name.toLowerCase().replace(/\s+/g, '_')}.csv`, 
      'text/csv;charset=utf-8'
    );
  };

  const handleExportInteractiveHTML = () => {
    const backupData = {
      eventInfo: {
        id: event.id,
        name: event.name,
        city: event.city || '',
        location: event.location || '',
        eventDate: event.eventDate || '',
        contractorName: event.contractorName || '',
        contractorEmail: event.contractorEmail || '',
        contractorId: event.contractorId || '',
        designerEmail: event.designerEmail || '',
        designerId: event.designerId || '',
        logoUrl: event.logoUrl || '',
        driveUrl: event.driveUrl || '',
        status: event.status || 'planning',
        djCount: event.djCount || 0,
        artCount: event.artCount || 0,
        motionCount: event.motionCount || 0
      },
      artsList: arts,
      djsList: djAssets,
      paymentsList: payments,
      documentsList: documents
    };
    const safeBackupPayload = JSON.stringify(backupData, null, 2).replace(/<\/script>/g, '<\\/script>');

    const finishedArtsCount = arts.filter(a => a.status === 'finished').length;
    const progressPercent = arts.length > 0 ? Math.round((finishedArtsCount / arts.length) * 100) : 0;
    const paidSum = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
    const pendingSum = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
    const totalSum = paidSum + pendingSum;

    // Building table rows dynamically for export html structure
    const artsHtmlRows = arts.map(art => {
      const deadlineStr = art.deadline ? formatSafeDate(art.deadline, "dd/MM/yyyy HH:mm") : 'Sem Prazo';
      return `
        <tr class="hover:bg-white/[0.02] border-b border-white/[0.04] transition-colors">
          <td class="px-6 py-4 font-bold text-white text-sm">${art.title || 'Sem título'}</td>
          <td class="px-6 py-4 text-xs text-slate-400 max-w-sm truncate" title="${art.description || ''}">${art.description || 'Sem descrição'}</td>
          <td class="px-6 py-4 text-xs">
            <span class="px-2 py-0.5 rounded bg-white/5 text-slate-300 font-semibold uppercase tracking-wider text-[10px]">${translateCategory(art.category || '')}</span>
          </td>
          <td class="px-6 py-4 text-xs">
            <span class="px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider ${
              art.priority === 'high' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
              art.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
              'bg-slate-500/10 text-slate-400 border border-slate-500/20'
            }">${translatePriority(art.priority || '')}</span>
          </td>
          <td class="px-6 py-4 text-xs text-slate-300">${deadlineStr}</td>
          <td class="px-6 py-4 text-xs">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              art.status === 'finished' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(52,211,153,0.1)]' :
              art.status === 'post' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' :
              art.status === 'delivered' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
              art.status === 'review' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
              art.status === 'production' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
              'bg-slate-500/10 text-slate-400'
            }">${translateStatus(art.status || '')}</span>
          </td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="6" class="px-6 py-12 text-center text-slate-500 italic text-sm">Nenhuma arte cadastrada</td></tr>`;

    const djsHtmlRows = djAssets.map(dj => {
      const agenciesList = dj.agencies?.map(a => `<a href="${a.link}" target="_blank" class="text-purple-400 hover:underline inline-block bg-white/5 border border-white/5 rounded-md px-1.5 py-0.5">${a.name} ↗</a>`).join(' ') || dj.agencyInfo || 'Nenhuma';
      const labelsList = dj.labels?.map(l => `<a href="${l.link}" target="_blank" class="text-purple-400 hover:underline inline-block bg-white/5 border border-white/5 rounded-md px-1.5 py-0.5">${l.name} ↗</a>`).join(' ') || dj.labelInfo || 'Nenhuma';
      
      return `
        <tr class="hover:bg-white/[0.02] border-b border-white/[0.04] transition-colors">
          <td class="px-6 py-4 font-bold text-white text-base">${dj.name || 'Sem nome'}</td>
          <td class="px-6 py-4 text-xs">
            <span class="px-2 py-0.5 rounded font-black uppercase text-[10px] ${dj.presskitStatus === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}">
              ${dj.presskitStatus === 'completed' ? '✓ Completo' : '⏳ Pendente'}
            </span>
            ${dj.presskitUrl ? `<div class="mt-1.5"><a href="${dj.presskitUrl}" target="_blank" class="text-xs text-purple-400 hover:underline flex items-center gap-1">Material Presskit ↗</a></div>` : ''}
          </td>
          <td class="px-6 py-4 text-xs">
            <span class="text-slate-300 font-semibold block">${dj.musicName || 'Sem Música Demo'}</span>
            ${dj.musicUrl ? `<a href="${dj.musicUrl}" target="_blank" class="text-purple-400 hover:underline text-[10px] mt-1 inline-block">Ouvir Música Demo ↗</a>` : ''}
          </td>
          <td class="px-6 py-4 text-xs space-y-1">
            <div class="text-slate-400"><span class="text-slate-500 font-medium">Agência(s):</span> ${agenciesList}</div>
            <div class="text-slate-400"><span class="text-slate-500 font-medium">Gravadora(s):</span> ${labelsList}</div>
          </td>
          <td class="px-6 py-4 text-xs text-center space-y-1 md:text-left">
            ${dj.flyerPhoto ? `<a href="${dj.flyerPhoto}" target="_blank" class="text-pink-400 hover:underline inline-flex items-center gap-1 font-bold bg-pink-500/5 px-2 py-0.5 rounded-lg border border-pink-500/10">📸 Foto do Flyer ↗</a><br/>` : '<span class="text-rose-400/70 text-[10px] block font-semibold">⚠️ Sem Foto</span>'}
            ${dj.animationVideo ? `<a href="${dj.animationVideo}" target="_blank" class="text-indigo-400 hover:underline inline-flex items-center gap-1 font-bold bg-indigo-500/5 px-2 py-0.5 rounded-lg border border-indigo-500/10">🎥 Motion Video ↗</a>` : '<span class="text-rose-400/70 text-[10px] block font-semibold">⚠️ Sem Motion</span>'}
          </td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="5" class="px-6 py-12 text-center text-slate-500 italic text-sm">Nenhum DJ cadastrado</td></tr>`;

    const paymentsHtmlRows = payments.map(p => `
      <tr class="hover:bg-white/[0.02] border-b border-white/[0.04] transition-colors">
        <td class="px-6 py-4 font-bold text-white text-sm">${p.description || 'Parcela'}</td>
        <td class="px-6 py-4 text-base font-black text-white">R$ ${(p.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        <td class="px-6 py-4 text-xs text-slate-300 font-semibold">${p.dueDate ? formatSafeDate(p.dueDate, "dd/MM/yyyy") : 'Sem vencimento'}</td>
        <td class="px-6 py-4 text-xs text-slate-400">${p.paidAt ? formatSafeDate(p.paidAt, "dd/MM/yyyy") : 'Pendente'}</td>
        <td class="px-6 py-4 text-[10px]">
          <span class="px-2.5 py-1 rounded-full font-black uppercase tracking-wider ${
            p.status === 'paid' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' :
            p.status === 'pending' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' :
            'bg-rose-500/15 text-rose-400 border border-rose-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
          }">${p.status === 'paid' ? 'Pago' : p.status === 'pending' ? 'Pendente' : 'Atrasado'}</span>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="5" class="px-6 py-12 text-center text-slate-500 italic text-sm">Nenhum pagamento cadastrado</td></tr>`;

    const docsHtmlRows = documents.map(doc => `
      <div class="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between hover:bg-white/[0.08] transition-all">
        <div class="flex items-center gap-3">
          <span class="text-2xl">${doc.type === 'contract' ? '📄' : doc.type === 'receipt' ? '🧾' : '📑'}</span>
          <div>
            <h4 class="font-bold text-white text-sm">${doc.name || 'Documento'}</h4>
            <p class="text-[10px] uppercase font-black tracking-widest text-slate-500">${doc.type === 'contract' ? 'Contrato' : doc.type === 'receipt' ? 'Recibo' : 'Proposta'} • ${doc.status === 'signed' ? 'Assinado' : 'Pendente'}</p>
          </div>
        </div>
        <a href="${doc.url}" target="_blank" class="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-slate-300 font-bold border border-white/10 flex items-center gap-1 transition-all">
          Visualizar Documento ↗
        </a>
      </div>
    `).join('') || `<p class="col-span-full text-center text-slate-500 italic text-sm py-8 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">Nenhum documento arquivado</p>`;

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Beys Arts - Relatório de Evento: ${event.name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              purple: '#9333ea',
              pink: '#ec4899',
              dark: '#0a0518',
            }
          }
        }
      }
    }
  </script>
  <style>
    body {
      background-color: #060211;
      color: #e2e8f0;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }
    .font-display {
      font-family: 'Space Grotesk', sans-serif;
    }
    .glass-card {
      background: rgba(255, 255, 255, 0.02);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    @media print {
      .no-print { display: none !important; }
      body { background-color: #ffffff !important; color: #1e293b !important; }
      .glass-card { border: 1px solid #e2e8f0 !important; background: transparent !important; color: #1e293b !important; }
      h1, h2, h3, h4, th, td { color: #000000 !important; }
      .tab-content { display: block !important; margin-bottom: 3rem !important; }
      .print-page-break { page-break-before: always; }
    }
  </style>
</head>
<body class="min-h-screen pb-16 bg-[#04010a]">
  <div class="max-w-6xl mx-auto px-4 py-8">
    
    <!-- HEADER -->
    <header class="flex flex-col md:flex-row items-center md:justify-between gap-6 p-8 mb-8 rounded-[2.5rem] bg-gradient-to-r from-purple-950/20 to-pink-950/10 border border-purple-500/10 shadow-[0_0_40px_rgba(147,51,234,0.1)]">
      <div class="flex flex-col md:flex-row items-center gap-6">
        <div class="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center p-0 shadow-2xl">
          ${event.logoUrl ? `<img src="${event.logoUrl}" alt="${event.name}" class="w-full h-full object-cover">` : `<div class="text-4xl font-black text-purple-500">🎨</div>`}
        </div>
        <div class="text-center md:text-left">
          <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight text-white font-display">${event.name}</h1>
          <p class="text-pink-400 font-bold uppercase text-[10px] tracking-widest mt-1">Status da Produção — Beys Arts HQ</p>
          
          <div class="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-xs text-slate-400 justify-center md:justify-start">
            <span class="flex items-center gap-1">📍 ${event.city || 'Sem Cidade'} - ${event.location || 'Sem Local'}</span>
            <span>•</span>
            <span class="flex items-center gap-1">📅 ${event.eventDate || 'Sem Data'}</span>
            <span>•</span>
            <span class="flex items-center gap-1">👤 Contratante: ${event.contractorName || 'Não especificado'}</span>
          </div>
        </div>
      </div>
      
      <div class="flex flex-col items-center md:items-end gap-2 shrink-0">
        <span class="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
          ${translateEventStatus(event.status)}
        </span>
        <button onclick="window.print()" class="no-print mt-2 flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:scale-102 hover:opacity-95 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all cursor-pointer shadow-[0_0_20px_rgba(236,72,153,0.3)] border border-pink-400/20">
          🖨️ Imprimir / Salvar em PDF
        </button>
      </div>
    </header>

    <!-- STATISTICS -->
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8 no-print">
      <!-- PROGRESS -->
      <div class="glass-card rounded-3xl p-6 relative overflow-hidden">
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Checklist de Artes</p>
        <h3 class="text-3xl font-black text-white font-display">${finishedArtsCount} / ${arts.length}</h3>
        <p class="text-[11px] text-emerald-400 font-bold mt-1">${progressPercent}% concluído</p>
        <div class="w-full bg-white/10 h-2 rounded-full overflow-hidden mt-3">
          <div class="h-full bg-gradient-to-r from-purple-500 to-pink-500" style="width: ${progressPercent}%"></div>
        </div>
      </div>

      <!-- INVESTMENT -->
      <div class="glass-card rounded-3xl p-6 relative overflow-hidden">
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Financeiro Total</p>
        <h3 class="text-3xl font-black text-white font-display">R$ ${totalSum.toLocaleString('pt-BR')}</h3>
        <p class="text-[11px] text-purple-400 font-bold mt-1">R$ ${paidSum.toLocaleString('pt-BR')} já pagos</p>
        <div class="w-full bg-white/10 h-2 rounded-full overflow-hidden mt-3">
          <div class="h-full bg-emerald-500" style="width: ${totalSum > 0 ? (paidSum / totalSum) * 100 : 0}%"></div>
        </div>
      </div>

      <!-- PENDING BILLS -->
      <div class="glass-card rounded-3xl p-6">
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">A Receber / Pendente</p>
        <h3 class="text-3xl font-black text-white font-display">R$ ${pendingSum.toLocaleString('pt-BR')}</h3>
        <p class="text-[11px] text-amber-500 font-bold mt-1">
          ${payments.filter(p => p.status === 'pending').length} parcelas abertas
        </p>
      </div>

      <!-- DJS TOTAL -->
      <div class="glass-card rounded-3xl p-6">
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">DJs Confirmados</p>
        <h3 class="text-3xl font-black text-white font-display">${djAssets.length}</h3>
        <p class="text-[11px] text-indigo-400 font-bold mt-1">
          ${djAssets.filter(d => d.presskitStatus === 'completed').length} de ${djAssets.length} coletados
        </p>
      </div>
    </div>

    <!-- DOCUMENT CLIPS -->
    <div class="mb-8">
      <h3 class="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-3 block">Documentos & Links de Contrato</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        ${docsHtmlRows}
      </div>
    </div>

    <!-- TABS CONTROLLER (NO-PRINT) -->
    <div class="flex border-b border-white/5 gap-2 mb-6 no-print">
      <button onclick="switchTab('arts-tab', this)" class="tab-btn px-6 py-3 border-b-2 border-pink-500 font-black text-xs uppercase tracking-widest text-white transition-all">
        Checklist de Artes (${arts.length})
      </button>
      <button onclick="switchTab('djs-tab', this)" class="tab-btn px-6 py-3 border-b-2 border-transparent font-black text-xs uppercase tracking-widest text-slate-400 hover:text-white transition-all">
        DJs de Presskits (${djAssets.length})
      </button>
      <button onclick="switchTab('payments-tab', this)" class="tab-btn px-6 py-3 border-b-2 border-transparent font-black text-xs uppercase tracking-widest text-slate-400 hover:text-white transition-all">
        Parcelas e Pagamentos (${payments.length})
      </button>
    </div>

    <!-- TAB 1: ARTS -->
    <div id="arts-tab" class="tab-content border border-white/5 bg-white/[0.01] rounded-[2rem] overflow-hidden">
      <div class="p-6 border-b border-white/5">
        <h2 class="text-lg font-bold text-white font-display">Checklist Geral de Cronograma de Artes</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-white/[0.02] border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <th class="px-6 py-3 font-semibold">Nome da Entrega / Tópico</th>
              <th class="px-6 py-3 font-semibold">Descrição / Observações</th>
              <th class="px-6 py-3 font-semibold">Categoria</th>
              <th class="px-6 py-3 font-semibold">Prioridade</th>
              <th class="px-6 py-3 font-semibold">Prazo</th>
              <th class="px-6 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            ${artsHtmlRows}
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 2: DJS -->
    <div id="djs-tab" class="tab-content hidden border border-white/5 bg-white/[0.01] rounded-[2rem] overflow-hidden print-page-break">
      <div class="p-6 border-b border-white/5">
        <h2 class="text-lg font-bold text-white font-display">Diretório de Artistas e Materiais Coletados</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-white/[0.02] border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <th class="px-6 py-3 font-semibold">Artista / DJ</th>
              <th class="px-6 py-3 font-semibold">Presskit</th>
              <th class="px-6 py-3 font-semibold">Música Demo</th>
              <th class="px-6 py-3 font-semibold">Agenciamento / Gravadora</th>
              <th class="px-6 py-3 font-semibold text-center md:text-left">Links de Imagem/Vídeo</th>
            </tr>
          </thead>
          <tbody>
            ${djsHtmlRows}
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 3: PAYMENTS -->
    <div id="payments-tab" class="tab-content hidden border border-white/5 bg-white/[0.01] rounded-[2rem] overflow-hidden print-page-break">
      <div class="p-6 border-b border-white/5">
        <h2 class="text-lg font-bold text-white font-display">Tabela de Parcelamentos e Faturamentos</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-white/[0.02] border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <th class="px-6 py-3 font-semibold">Descrição da Parcela</th>
              <th class="px-6 py-3 font-semibold">Valor</th>
              <th class="px-6 py-3 font-semibold">Vencimento</th>
              <th class="px-6 py-3 font-semibold">Data Liquidação</th>
              <th class="px-6 py-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${paymentsHtmlRows}
          </tbody>
        </table>
      </div>
    </div>

  </div>

  <!-- INTERACTION SCRIPTS -->
  <script class="no-print">
    function switchTab(tabId, button) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      document.getElementById(tabId).classList.remove('hidden');
      
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('border-pink-500', 'text-white');
        btn.classList.add('border-transparent', 'text-slate-400');
      });
      button.classList.add('border-pink-500', 'text-white');
      button.classList.remove('border-transparent', 'text-slate-400');
    }
  </script>
  <script id="beys-arts-backup-data" type="application/json">
    ${safeBackupPayload}
  </script>
</body>
</html>`;

    triggerDownload(
      htmlContent, 
      `relatorio_festa_${event.name.toLowerCase().replace(/\s+/g, '_')}.html`, 
      'text/html;charset=utf-8'
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 auto-rows-[minmax(180px,auto)] gap-6 p-6">
      {/* 1. Hero Card - Large (4x2) */}
      <div className="md:col-span-4 md:row-span-2 relative overflow-hidden glass-card rounded-[2.5rem] p-6 md:p-8 text-white flex flex-col justify-between shadow-2xl border-white/5">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600 rounded-full blur-[100px] opacity-10 -mr-48 -mt-48 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-pink-600 rounded-full blur-[100px] opacity-10 -ml-48 -mb-48 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-36 h-36 md:w-44 md:h-44 rounded-3xl bg-white/5 backdrop-blur-md p-0 border-0 shadow-2xl shrink-0 overflow-hidden group">
            <img src={event.logoUrl} alt={event.name} className="w-full h-full object-cover filter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-transform group-hover:scale-110" />
          </div>
          <div className="text-center md:text-left space-y-4 flex-1">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-pink-100 to-slate-400">
                {event.name}
              </h2>
              <EventSelector profile={profile} editEvent={event} onEventUpdated={() => {}} isMinimal />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-2">
              <div className="flex items-center gap-2 text-slate-400">
                <User className="w-3 h-3 text-pink-400" />
                <span className="text-[10px] uppercase font-black tracking-widest">{event.contractorName || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <CalendarIcon className="w-3 h-3 text-pink-400" />
                <span className="text-[10px] uppercase font-black tracking-widest">{event.eventDate || 'Sem Data'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="w-3 h-3 text-pink-400" />
                <span className="text-[10px] uppercase font-black tracking-widest">{event.city || 'Sem Cidade'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Music className="w-3 h-3 text-pink-400" />
                <span className="text-[10px] uppercase font-black tracking-widest">{event.location || 'Sem Local'}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2 justify-center md:justify-start items-center">
              <span className="bg-white/5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 text-slate-300">
                {translateEventStatus(event.status || '')}
              </span>
              <span className="bg-emerald-500/10 text-emerald-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 shadow-[0_0_15px_rgba(52,211,153,0.1)]">
                {Math.round(progress)}% Concluído
              </span>
              
              <button
                type="button"
                onClick={() => setIsExportOpen(true)}
                className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_15px_rgba(147,51,234,0.35)] hover:shadow-[0_0_22px_rgba(147,51,234,0.5)] border border-purple-500/30"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Dados</span>
              </button>

              <div className="flex gap-2">
                <div className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
                  <Palette className="w-3 h-3 text-pink-400" />
                  <span className="text-[10px] font-bold text-white">{event.artCount || 0} Artes</span>
                </div>
                <div className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
                  <Music className="w-3 h-3 text-purple-400" />
                  <span className="text-[10px] font-bold text-white">{event.djCount || 0} DJs</span>
                </div>
                <div className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
                  <Clock className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] font-bold text-white">{event.motionCount || 0} Motions</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-6 space-y-3">
          <div className="flex justify-between items-end mb-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fluxo de Produção Geral</span>
            <span className="text-2xl font-black text-white">{Math.round(progress)}%</span>
          </div>
          <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.5)]"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500 italic">
              {finishedArts} de {totalArts} artes finalizadas
            </p>
            <div className="flex -space-x-2">
              {[...Array(Math.min(finishedArts, 5))].map((_, i) => (
                <div key={i} className="w-6 h-6 rounded-full border-2 border-[#0a0518] bg-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Total Investment - Small (2x1) */}
      <div className="md:col-span-2 md:row-span-1 glass-card rounded-[2.5rem] p-6 border-white/5 flex flex-col justify-center relative overflow-hidden group">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
        <div className="flex items-center space-x-4 mb-4">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Investimento Total</p>
            <h3 className="text-3xl font-black text-white">R$ {(paidAmount + pendingAmount).toLocaleString()}</h3>
          </div>
        </div>
        <p className="text-[11px] text-emerald-400/60 font-bold">R$ {paidAmount.toLocaleString()} já liquidados</p>
      </div>

      {/* 3. Next Payment - Small (2x1) */}
      <div className="md:col-span-2 md:row-span-1 glass-card rounded-[2.5rem] p-6 border-white/5 flex flex-col justify-center relative overflow-hidden group">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
        <div className="flex items-center space-x-4 mb-4">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Próxima Parcela</p>
            <h3 className="text-3xl font-black text-white">
              {nextPayment ? `R$ ${nextPayment.amount.toLocaleString()}` : "Nenhuma"}
            </h3>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 italic font-bold">
          {nextPayment ? `Vence em ${formatSafeDate(nextPayment.dueDate, "dd/MM/yy")}` : "Tudo em dia"}
        </p>
      </div>

      {/* 4. Recent Arts - Medium (3x2) */}
      <div className="md:col-span-3 md:row-span-2 glass-card rounded-[2.5rem] border-white/5 overflow-hidden flex flex-col text-slate-100">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center text-pink-400">
            <Clock className="mr-3 w-5 h-5" />
            Ultimas Movimentações
          </h3>
          <span className="text-[10px] bg-white/5 px-3 py-1 rounded-full text-slate-400 font-bold">{arts.length} totais</span>
        </div>
        <div className="flex-1 overflow-y-auto max-h-[360px] custom-scrollbar">
          <div className="divide-y divide-white/5">
            {arts.slice(0, 8).map(art => (
              <div key={art.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-all group">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Palette className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-bold text-white tracking-tight leading-none mb-1">{art.title}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider">{translateCategory(art.category)} • {translatePriority(art.priority)}</p>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${
                  art.status === 'finished' ? 'text-emerald-500 bg-emerald-500' :
                  art.status === 'post' ? 'text-pink-500 bg-pink-500' :
                  art.status === 'delivered' ? 'text-purple-500 bg-purple-500' :
                  art.status === 'review' ? 'text-blue-500 bg-blue-500' :
                  art.status === 'production' ? 'text-amber-500 bg-amber-500' :
                  'text-slate-700 bg-slate-700'
                }`} title={translateStatus(art.status)} />
              </div>
            ))}
            {arts.length === 0 && (
              <div className="p-12 text-center text-slate-500 italic font-medium">Nenhuma arte cadastrada.</div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Health Details - Medium (3x2) */}
      <div className="md:col-span-3 md:row-span-2 glass-card rounded-[2.5rem] border-white/5 overflow-hidden p-6 flex flex-col justify-between">
        <div className="space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center text-emerald-400">
            <AlertCircle className="mr-3 w-5 h-5" />
            Agenda de Pagamentos
          </h3>
          <div className="space-y-4">
            {payments.filter(p => p.status === 'pending').slice(0, 4).map(p => (
              <div key={p.id} className="flex justify-between items-center p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-400 text-xs font-black">
                    {formatSafeDate(p.dueDate, "dd")}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-200 block leading-none mb-1">Parcela de {formatSafeDate(p.dueDate, "MMMM")}</span>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Vence em {formatSafeDate(p.dueDate, "dd/MM")}</p>
                  </div>
                </div>
                <p className="text-lg font-black text-white">R$ {p.amount.toLocaleString()}</p>
              </div>
            ))}
            {payments.filter(p => p.status === 'pending').length === 0 && (
              <div className="py-12 text-center text-emerald-400 font-black tracking-widest border border-emerald-500/20 rounded-[2rem] bg-emerald-500/5">
                TODAS AS CONTAS EM DIA ✅
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Status Geral</p>
            <p className="text-white font-bold">Saúde Financeira: <span className="text-emerald-400 uppercase">Ótima</span></p>
          </div>
          <Music className="w-8 h-8 text-white/10" />
        </div>
      </div>

      {/* EXPORT OPTIONS DIALOG */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="w-[95vw] sm:max-w-4xl lg:max-w-5xl bg-[#0d0722] border border-white/10 text-white rounded-[2.2rem] p-6 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black font-display text-white flex items-center gap-2">
              <Download className="w-6 h-6 text-purple-400" />
              <span>Exportar Relatório do Evento</span>
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Selecione o formato desejado para baixar as informações consolidadas de <strong>{event.name}</strong>. Todas as artes, djs, links e faturamentos serão reunidos instantaneamente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
            
            {/* INTERACTIVE REPORT HTML */}
            <button 
              type="button"
              onClick={() => {
                handleExportInteractiveHTML();
                setIsExportOpen(false);
              }}
              className="bg-gradient-to-br from-purple-900/40 to-pink-900/20 hover:from-purple-950/50 hover:to-pink-950/30 border border-purple-500/20 p-5 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] flex items-start gap-4 shadow-[0_0_15px_rgba(139,92,246,0.1)] group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center shrink-0 text-pink-400 font-extrabold text-lg group-hover:scale-110 transition-transform">
                🖨️
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-white text-sm">Relatório Completo (HTML)</h4>
                <p className="text-[11px] text-slate-400 leading-snug">Visual, completo e interativo. Recomendado para guardar, imprimir em PDF ou enviar para contratantes.</p>
              </div>
            </button>

            {/* ART WORKBOOK CSV */}
            <button 
              type="button"
              onClick={() => {
                handleExportArtsCSV();
                setIsExportOpen(false);
              }}
              className="bg-white/5 hover:bg-white/10 border border-white/5 p-5 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] flex items-start gap-4 group text-left"
            >
              <FileSpreadsheet className="w-10 h-10 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
              <div className="space-y-0.5">
                <h4 className="font-bold text-white text-sm">Tabela de Artes (CSV)</h4>
                <p className="text-[11px] text-slate-400 leading-snug font-normal">Checklist integral das entregas, contendo títulos, descrições detalhadas, prioridades e prazos.</p>
              </div>
            </button>

            {/* DIRECT DJ LINKS CSV */}
            <button 
              type="button"
              onClick={() => {
                handleExportDjsCSV();
                setIsExportOpen(false);
              }}
              className="bg-white/5 hover:bg-white/10 border border-white/5 p-5 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] flex items-start gap-4 group text-left"
            >
              <FileSpreadsheet className="w-10 h-10 text-purple-400 shrink-0 group-hover:scale-110 transition-transform" />
              <div className="space-y-0.5">
                <h4 className="font-bold text-white text-sm">Tabela de DJs (CSV)</h4>
                <p className="text-[11px] text-slate-400 leading-snug font-normal">Catálogo geral de DJs, contendo links de presskits, demos, agências, fotos e motion videos.</p>
              </div>
            </button>

            {/* FINANCIAL STATEMENTS CSV */}
            <button 
              type="button"
              onClick={() => {
                handleExportPaymentsCSV();
                setIsExportOpen(false);
              }}
              className="bg-white/5 hover:bg-white/10 border border-white/5 p-5 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] flex items-start gap-4 group text-left"
            >
              <FileSpreadsheet className="w-10 h-10 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
              <div className="space-y-0.5">
                <h4 className="font-bold text-white text-sm">Financeiro & Parcelas (CSV)</h4>
                <p className="text-[11px] text-slate-400 leading-snug font-normal">Planilha detalhada de faturamento, cronograma de vencimentos e listagem de parcelas pagas.</p>
              </div>
            </button>

            {/* TECHNICAL DUMP JSON */}
            <button 
              type="button"
              onClick={() => {
                handleExportJSON();
                setIsExportOpen(false);
              }}
              className="md:col-span-2 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 p-4 rounded-xl cursor-pointer transition-all flex items-center justify-between group text-left"
            >
              <div className="flex items-center gap-3">
                <FileJson className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                <div>
                  <h4 className="font-bold text-white text-xs">Banco de Dados Completo (JSON)</h4>
                  <p className="text-[10px] text-slate-500 font-normal">Backup unificado completo de todas as coleções do Firebase relacionadas a este evento.</p>
                </div>
              </div>
              <span className="text-slate-400 text-xs font-semibold">Baixar Backup ↗</span>
            </button>

          </div>

          <div className="flex items-start gap-2.5 bg-purple-950/15 border border-purple-900/40 p-4 rounded-2xl text-[11px] text-purple-300">
            <AlertTriangle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <p className="leading-normal font-medium font-sans">
              <strong>Dica de Download:</strong> Se o download não iniciar automaticamente, certifique-se de que o aplicativo Beys Arts está aberto em uma nova aba do navegador principal.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
