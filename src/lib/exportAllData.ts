import { collection, getDocs, query, orderBy, where, or } from 'firebase/firestore';
import { db } from '../firebase';
import { EventProject, UserProfile, ArtTask, DjAsset, PaymentItem, ProjectDocument, DjCatalogItem } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface DetailedEventData {
  event: EventProject;
  arts: ArtTask[];
  djs: DjAsset[];
  payments: PaymentItem[];
  documents: ProjectDocument[];
}

export interface AllSystemData {
  metadata: {
    exportDate: string;
    exportTimestamp: number;
    system: string;
    version: string;
    exportedBy: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
    totalEvents: number;
    totalArts: number;
    totalDjs: number;
    totalPayments: number;
    totalDocuments: number;
    totalCatalogDjs: number;
    totalFinancialAmount: number;
    totalPaidAmount: number;
    totalPendingAmount: number;
  };
  events: DetailedEventData[];
  catalogDjs: DjCatalogItem[];
  allEventsFlat: EventProject[];
  allDjsFlat: Array<DjAsset & { eventName: string; eventId: string }>;
  allArtsFlat: Array<ArtTask & { eventName: string; eventId: string }>;
  allPaymentsFlat: Array<PaymentItem & { eventName: string; eventId: string }>;
  allDocumentsFlat: Array<ProjectDocument & { eventName: string; eventId: string }>;
}

export function formatSafeDate(val: any, formatStr: string = 'dd/MM/yyyy HH:mm'): string {
  if (!val) return '';
  try {
    let d: Date | null = null;
    if (typeof val === 'object' && 'toDate' in val && typeof val.toDate === 'function') {
      d = val.toDate();
    } else if (typeof val === 'object' && 'seconds' in val && typeof val.seconds === 'number') {
      d = new Date(val.seconds * 1000);
    } else if (typeof val === 'string' || typeof val === 'number') {
      d = new Date(val);
    }
    if (d && !isNaN(d.getTime())) {
      return format(d, formatStr, { locale: ptBR });
    }
  } catch {
    // fallback
  }
  return String(val);
}

export function serializeFirestoreData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'object') {
    if ('toDate' in obj && typeof obj.toDate === 'function') {
      try {
        return obj.toDate().toISOString();
      } catch {
        return obj.toDate().toString();
      }
    }
    if ('seconds' in obj && typeof obj.seconds === 'number' && Object.keys(obj).length <= 2) {
      return new Date(obj.seconds * 1000).toISOString();
    }
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    if (Array.isArray(obj)) {
      return obj.map(item => serializeFirestoreData(item));
    }
    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[key] = serializeFirestoreData(obj[key]);
    }
    return result;
  }
  return obj;
}

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/[\r\n]+/g, ' ').replace(/"/g, '""');
  return `"${str}"`;
}

export function triggerDownload(content: string, filename: string, mimeType: string = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function fetchAllSystemData(
  profile: UserProfile,
  preloadedEvents?: EventProject[],
  onProgress?: (message: string, percent: number) => void
): Promise<AllSystemData> {
  onProgress?.('Identificando festas e permissões...', 10);

  let eventsToProcess: EventProject[] = [];

  if (preloadedEvents && preloadedEvents.length > 0) {
    eventsToProcess = [...preloadedEvents];
  } else {
    const isAdmin = profile.email === 'beysarts@gmail.com';
    let q;
    if (isAdmin) {
      q = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
    } else if (profile.role === 'designer') {
      q = query(collection(db, 'events'), where('designerId', '==', profile.id), orderBy('createdAt', 'desc'));
    } else {
      q = query(
        collection(db, 'events'),
        or(
          where('contractorId', '==', profile.id),
          where('contractorIds', 'array-contains', profile.id)
        ),
        orderBy('createdAt', 'desc')
      );
    }

    try {
      const snap = await getDocs(q);
      eventsToProcess = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as EventProject));
    } catch (err) {
      console.error('Erro ao buscar lista de eventos:', err);
      // Fallback: try direct collection query
      try {
        const snap = await getDocs(collection(db, 'events'));
        eventsToProcess = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as EventProject));
      } catch (e2) {
        console.error('Falha no fallback de eventos:', e2);
      }
    }
  }

  onProgress?.(`Carregando catálogo geral e subcoleções de ${eventsToProcess.length} festa(s)...`, 25);

  // Fetch DJ Catalog
  let catalogDjs: DjCatalogItem[] = [];
  try {
    const catalogSnap = await getDocs(collection(db, 'djs_catalog'));
    catalogDjs = catalogSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as DjCatalogItem));
  } catch (err) {
    console.warn('Não foi possível ler o catálogo geral de DJs:', err);
  }

  const detailedEvents: DetailedEventData[] = [];
  const allDjsFlat: Array<DjAsset & { eventName: string; eventId: string }> = [];
  const allArtsFlat: Array<ArtTask & { eventName: string; eventId: string }> = [];
  const allPaymentsFlat: Array<PaymentItem & { eventName: string; eventId: string }> = [];
  const allDocumentsFlat: Array<ProjectDocument & { eventName: string; eventId: string }> = [];

  let totalFinancialAmount = 0;
  let totalPaidAmount = 0;
  let totalPendingAmount = 0;

  const totalEventsCount = eventsToProcess.length;

  for (let i = 0; i < totalEventsCount; i++) {
    const event = eventsToProcess[i];
    const progressPercent = 30 + Math.round(((i + 1) / (totalEventsCount || 1)) * 60);
    onProgress?.(`Coletando dados da festa "${event.name}" (${i + 1}/${totalEventsCount})...`, progressPercent);

    let arts: ArtTask[] = [];
    let djs: DjAsset[] = [];
    let payments: PaymentItem[] = [];
    let documents: ProjectDocument[] = [];

    // Load subcollections concurrently with safety
    const [artsRes, djsRes, paymentsRes, docsRes] = await Promise.allSettled([
      getDocs(collection(db, 'events', event.id, 'arts')),
      getDocs(collection(db, 'events', event.id, 'dj_assets')),
      getDocs(collection(db, 'events', event.id, 'payments')),
      getDocs(collection(db, 'events', event.id, 'documents')),
    ]);

    if (artsRes.status === 'fulfilled') {
      arts = artsRes.value.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ArtTask));
    }
    if (djsRes.status === 'fulfilled') {
      djs = djsRes.value.docs.map(d => ({ id: d.id, ...(d.data() as any) } as DjAsset));
    }
    if (paymentsRes.status === 'fulfilled') {
      payments = paymentsRes.value.docs.map(d => ({ id: d.id, ...(d.data() as any) } as PaymentItem));
    }
    if (docsRes.status === 'fulfilled') {
      documents = docsRes.value.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ProjectDocument));
    }

    // Accumulate flats
    arts.forEach(art => allArtsFlat.push({ ...art, eventName: event.name, eventId: event.id }));
    djs.forEach(dj => allDjsFlat.push({ ...dj, eventName: event.name, eventId: event.id }));
    payments.forEach(payment => {
      allPaymentsFlat.push({ ...payment, eventName: event.name, eventId: event.id });
      const val = Number(payment.amount) || 0;
      totalFinancialAmount += val;
      if (payment.status === 'paid') {
        totalPaidAmount += val;
      } else {
        totalPendingAmount += val;
      }
    });
    documents.forEach(doc => allDocumentsFlat.push({ ...doc, eventName: event.name, eventId: event.id }));

    detailedEvents.push({
      event,
      arts,
      djs,
      payments,
      documents
    });
  }

  onProgress?.('Finalizando estruturação do backup geral...', 95);

  const systemData: AllSystemData = {
    metadata: {
      exportDate: new Date().toISOString(),
      exportTimestamp: Date.now(),
      system: 'Backstage Produção & Gestão',
      version: '2.0',
      exportedBy: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role
      },
      totalEvents: detailedEvents.length,
      totalArts: allArtsFlat.length,
      totalDjs: allDjsFlat.length,
      totalPayments: allPaymentsFlat.length,
      totalDocuments: allDocumentsFlat.length,
      totalCatalogDjs: catalogDjs.length,
      totalFinancialAmount,
      totalPaidAmount,
      totalPendingAmount,
    },
    events: detailedEvents,
    catalogDjs,
    allEventsFlat: eventsToProcess,
    allDjsFlat,
    allArtsFlat,
    allPaymentsFlat,
    allDocumentsFlat,
  };

  onProgress?.('Pronto para download!', 100);
  return systemData;
}

function getTimestampSuffix(): string {
  const now = new Date();
  return format(now, 'yyyy-MM-dd_HH-mm');
}

export function exportAllDataAsJSON(data: AllSystemData) {
  const suffix = getTimestampSuffix();
  const serialized = serializeFirestoreData(data);
  const jsonString = JSON.stringify(serialized, null, 2);
  triggerDownload(
    jsonString,
    `backup_geral_todas_festas_${suffix}.json`,
    'application/json;charset=utf-8'
  );
}

export function exportEventsCSV(data: AllSystemData) {
  const suffix = getTimestampSuffix();
  let csv = '\uFEFF'; // Excel UTF-8 BOM
  const headers = [
    'ID da Festa',
    'Nome da Festa',
    'Data do Evento',
    'Cidade',
    'Local',
    'Status',
    'Contratante Principal',
    'Email Contratante',
    'Email Designer',
    'Total de DJs Cadastrados',
    'Total de Artes Cadastradas',
    'Total de Pagamentos',
    'Total de Documentos',
    'Valor Acordado',
    'Link do Google Drive',
    'Link do Logotipo',
    'Data de Cadastro'
  ];
  csv += headers.map(escapeCsv).join(';') + '\n';

  data.events.forEach(item => {
    const ev = item.event;
    const statusLabel = ev.status === 'planning' ? 'Planejamento' : ev.status === 'ongoing' ? 'Em Andamento' : 'Finalizado';
    const row = [
      ev.id,
      ev.name || '',
      ev.eventDate || '',
      ev.city || '',
      ev.location || '',
      statusLabel,
      ev.contractorName || '',
      ev.contractorEmail || '',
      ev.designerEmail || '',
      item.djs.length,
      item.arts.length,
      item.payments.length,
      item.documents.length,
      ev.paymentValue || '',
      ev.driveUrl || '',
      ev.logoUrl || '',
      formatSafeDate(ev.createdAt, 'dd/MM/yyyy HH:mm')
    ];
    csv += row.map(escapeCsv).join(';') + '\n';
  });

  triggerDownload(csv, `relatorio_geral_todas_festas_${suffix}.csv`, 'text/csv;charset=utf-8');
}

export function exportAllDjsCSV(data: AllSystemData) {
  const suffix = getTimestampSuffix();
  let csv = '\uFEFF';
  const headers = [
    'ID do DJ',
    'Festa / Evento',
    'ID da Festa',
    'Nome do DJ',
    'Formato',
    'DJ 2 (Versus / B2B)',
    'Status do Presskit',
    'Link do Presskit',
    'Música / Set de Trabalho',
    'Link da Música',
    'Duração',
    'Prazo de Entrega da Arte',
    'Agências / Escritórios',
    'Gravadoras / Labels',
    'Material Visual',
    'Prioridade',
    'Logo Obrigatória',
    'Link da Foto do Flyer',
    'Link do Vídeo Animação',
    'Data de Cadastro'
  ];
  csv += headers.map(escapeCsv).join(';') + '\n';

  data.allDjsFlat.forEach(dj => {
    const agenciesStr = dj.agencies?.map(a => `${a.name}${a.link ? ` (${a.link})` : ''}`).join(', ') || dj.agencyInfo || '';
    const labelsStr = dj.labels?.map(l => `${l.name}${l.link ? ` (${l.link})` : ''}`).join(', ') || dj.labelInfo || '';
    const visualTypeStr = dj.visualMaterialType === 'both' ? 'Foto e Vídeo' : dj.visualMaterialType === 'photo' ? 'Apenas Foto' : dj.visualMaterialType === 'video' ? 'Apenas Vídeo' : 'Não informado';
    const priorityStr = dj.priority === 'urgent' ? 'Urgente' : dj.priority === 'medium' ? 'Média' : 'Baixa';

    const row = [
      dj.id,
      dj.eventName,
      dj.eventId,
      dj.name || '',
      dj.isVersus ? 'Versus (B2B)' : 'Individual',
      dj.dj2Name || '',
      dj.presskitStatus === 'completed' ? 'Completo' : 'Pendente',
      dj.presskitUrl || '',
      dj.musicName || '',
      dj.musicUrl || '',
      dj.musicDuration || '',
      dj.artDeadline || '',
      agenciesStr,
      labelsStr,
      visualTypeStr,
      priorityStr,
      dj.hasMandatoryLogo ? 'Sim' : 'Não',
      dj.flyerPhoto || '',
      dj.animationVideo || '',
      formatSafeDate(dj.createdAt, 'dd/MM/yyyy HH:mm')
    ];
    csv += row.map(escapeCsv).join(';') + '\n';
  });

  triggerDownload(csv, `relatorio_geral_todos_djs_${suffix}.csv`, 'text/csv;charset=utf-8');
}

export function exportAllArtsCSV(data: AllSystemData) {
  const suffix = getTimestampSuffix();
  let csv = '\uFEFF';
  const headers = [
    'ID da Tarefa/Arte',
    'Festa / Evento',
    'ID da Festa',
    'Título da Arte',
    'Categoria',
    'Status Kanban',
    'Prioridade',
    'Prazo de Entrega',
    'Descrição / Briefing',
    'Cor do Card',
    'Posição',
    'Data de Criação'
  ];
  csv += headers.map(escapeCsv).join(';') + '\n';

  const categoryMap: Record<string, string> = {
    dj: 'DJ / Atração',
    party: 'Festa / Geral',
    branding: 'Identidade / Branding'
  };

  const statusMap: Record<string, string> = {
    todo: 'A Fazer',
    production: 'Em Produção',
    review: 'Em Revisão',
    delivered: 'Entregue',
    post: 'Postado',
    finished: 'Finalizado'
  };

  const priorityMap: Record<string, string> = {
    urgent: 'Urgente',
    high: 'Alta',
    medium: 'Média',
    low: 'Baixa'
  };

  data.allArtsFlat.forEach(art => {
    const row = [
      art.id,
      art.eventName,
      art.eventId,
      art.title || '',
      categoryMap[art.category] || art.category || 'Geral',
      statusMap[art.status] || art.status || '',
      priorityMap[art.priority] || art.priority || 'Normal',
      formatSafeDate(art.deadline, 'dd/MM/yyyy HH:mm'),
      (art.description || '').replace(/[\r\n]+/g, ' '),
      art.color || '',
      art.position ?? '',
      formatSafeDate(art.createdAt, 'dd/MM/yyyy HH:mm')
    ];
    csv += row.map(escapeCsv).join(';') + '\n';
  });

  triggerDownload(csv, `relatorio_geral_todas_artes_${suffix}.csv`, 'text/csv;charset=utf-8');
}

export function exportAllPaymentsCSV(data: AllSystemData) {
  const suffix = getTimestampSuffix();
  let csv = '\uFEFF';
  const headers = [
    'ID do Pagamento',
    'Festa / Evento',
    'ID da Festa',
    'Descrição / Parcela',
    'Valor (R$)',
    'Status Financeiro',
    'Data de Vencimento',
    'Data de Liquidação',
    'Observações',
    'Qtd de Comprovantes Anexados',
    'Links dos Comprovantes',
    'Data de Criação'
  ];
  csv += headers.map(escapeCsv).join(';') + '\n';

  data.allPaymentsFlat.forEach(p => {
    const statusLabel = p.status === 'paid' ? 'Pago' : p.status === 'pending' ? 'Pendente' : 'Atrasado';
    const receiptsStr = p.receipts?.map(r => `${r.name || 'Comprovante'}: ${r.url}`).join(' | ') || (p.receiptUrl ? `Comprovante: ${p.receiptUrl}` : '');

    const row = [
      p.id,
      p.eventName,
      p.eventId,
      p.description || '',
      p.amount || 0,
      statusLabel,
      formatSafeDate(p.dueDate, 'dd/MM/yyyy'),
      formatSafeDate(p.paidAt, 'dd/MM/yyyy HH:mm'),
      (p.notes || '').replace(/[\r\n]+/g, ' '),
      p.receipts?.length || (p.receiptUrl ? 1 : 0),
      receiptsStr,
      formatSafeDate(p.createdAt, 'dd/MM/yyyy HH:mm')
    ];
    csv += row.map(escapeCsv).join(';') + '\n';
  });

  triggerDownload(csv, `relatorio_geral_todos_pagamentos_${suffix}.csv`, 'text/csv;charset=utf-8');
}

export function exportCatalogDjsCSV(data: AllSystemData) {
  const suffix = getTimestampSuffix();
  let csv = '\uFEFF';
  const headers = [
    'ID do Registro',
    'Nome do DJ / Atração',
    'Status do Presskit',
    'Link do Presskit',
    'Música / Set Principal',
    'Link da Música',
    'Duração da Música',
    'Agências Cadastradas',
    'Gravadoras Cadastradas',
    'Foto Flyer (URL)',
    'Vídeo Flyer / Animação (URL)',
    'Última Atualização'
  ];
  csv += headers.map(escapeCsv).join(';') + '\n';

  data.catalogDjs.forEach(dj => {
    const agenciesStr = dj.agencies?.map(a => `${a.name}${a.link ? ` (${a.link})` : ''}`).join(', ') || dj.agencyInfo || '';
    const labelsStr = dj.labels?.map(l => `${l.name}${l.link ? ` (${l.link})` : ''}`).join(', ') || dj.labelInfo || '';

    const row = [
      dj.id || '',
      dj.name || '',
      dj.presskitStatus === 'completed' ? 'Completo' : 'Pendente',
      dj.presskitUrl || '',
      dj.musicName || '',
      dj.musicUrl || '',
      dj.musicDuration || '',
      agenciesStr,
      labelsStr,
      dj.flyerPhoto || '',
      dj.animationVideo || '',
      formatSafeDate(dj.updatedAt || dj.lastUsedAt, 'dd/MM/yyyy HH:mm')
    ];
    csv += row.map(escapeCsv).join(';') + '\n';
  });

  triggerDownload(csv, `catalogo_geral_djs_${suffix}.csv`, 'text/csv;charset=utf-8');
}

export async function exportCompletePackage(data: AllSystemData) {
  // 1. Download JSON
  exportAllDataAsJSON(data);

  // 2. Download spreadsheets sequentially with delay to avoid browser blocking
  await new Promise(r => setTimeout(r, 400));
  exportEventsCSV(data);

  await new Promise(r => setTimeout(r, 400));
  exportAllDjsCSV(data);

  await new Promise(r => setTimeout(r, 400));
  exportAllArtsCSV(data);

  await new Promise(r => setTimeout(r, 400));
  exportAllPaymentsCSV(data);

  if (data.catalogDjs.length > 0) {
    await new Promise(r => setTimeout(r, 400));
    exportCatalogDjsCSV(data);
  }
}

export function generateSummaryText(data: AllSystemData): string {
  const m = data.metadata;
  return `📊 BACKSTAGE - RESUMO GERAL DO SISTEMA
Exportado em: ${formatSafeDate(m.exportTimestamp, 'dd/MM/yyyy às HH:mm')}
Usuário: ${m.exportedBy.name} (${m.exportedBy.email})

🎉 FESTAS CADASTRADAS: ${m.totalEvents}
🎧 TOTAL DE DJS NO LINEUP: ${m.totalDjs}
🎨 TOTAL DE ARTES / TAREFAS: ${m.totalArts}
💰 TOTAL FINANCEIRO: R$ ${m.totalFinancialAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Pago: R$ ${m.totalPaidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Pendente: R$ ${m.totalPendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
📁 DOCUMENTOS REGISTRADOS: ${m.totalDocuments}
📚 DJS NO CATÁLOGO GERAL: ${m.totalCatalogDjs}`;
}
