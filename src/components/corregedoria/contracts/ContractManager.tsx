import React, { useState, useEffect, useRef } from 'react';
import { EventProject, UserProfile, OperationType } from '../../../types';
import { ContractFormState, getDefaultContractForm } from './contractData';
import { ContractTemplateView } from './ContractTemplateView';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  FileText, 
  UploadCloud, 
  Sparkles, 
  Printer, 
  Download, 
  Copy, 
  CheckCircle2, 
  Clock, 
  Edit3, 
  Eye, 
  RefreshCw, 
  Save, 
  ShieldCheck, 
  FileCheck,
  Share2,
  Sliders,
  Send,
  Loader2,
  HelpCircle,
  Undo2
} from "lucide-react";
import { toast } from "sonner";
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError } from '../../../firebase';
import { cn } from "@/lib/utils";

interface ContractManagerProps {
  event: EventProject;
  profile: UserProfile;
  onSavedToVault?: () => void;
}

export function ContractManager({ event, profile, onSavedToVault }: ContractManagerProps) {
  const [formData, setFormData] = useState<ContractFormState>(() => getDefaultContractForm(event, profile));
  const [activeTab, setActiveTab] = useState<'standard' | 'custom' | 'builder'>('standard');
  const [viewMode, setViewMode] = useState<'preview' | 'form' | 'split'>('split');
  const [highlightFields, setHighlightFields] = useState<boolean>(true);
  
  // Custom uploaded contract state
  const [customContractText, setCustomContractText] = useState<string>('');
  const [customFilledText, setCustomFilledText] = useState<string>('');
  const [isProcessingAI, setIsProcessingAI] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [replacedFieldsList, setReplacedFieldsList] = useState<string[]>([]);
  
  // Saving to Firestore state
  const [isSavingDoc, setIsSavingDoc] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync default form whenever active event changes
  useEffect(() => {
    setFormData(getDefaultContractForm(event, profile));
  }, [event.id, event.contractorName, event.city, event.eventDate, event.paymentValue, event.artCount, event.motionCount]);

  const handleInputChange = (field: keyof ContractFormState, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleResetToEventData = () => {
    setFormData(getDefaultContractForm(event, profile));
    toast.success("Dados recarregados a partir do cadastro da festa!");
  };

  // AI Auto-Fill Functionality
  const handleAIAutoFill = async (rawTextToFill?: string) => {
    const textToProcess = rawTextToFill || customContractText;
    if (!textToProcess.trim()) {
      toast.error("Por favor, envie ou cole o texto do contrato antes de preencher.");
      return;
    }

    setIsProcessingAI(true);
    const toastId = toast.loading("A IA está analisando seu contrato e preenchendo todos os dados do cliente...");

    try {
      const clientData = {
        eventName: event.name,
        contractorName: formData.contractorName || event.contractorName,
        contractorEmail: formData.contractorEmail || event.contractorEmail,
        contractorCpf: formData.contractorCpf,
        contractorCnpj: formData.contractorCnpj,
        contractorPhone: formData.contractorPhone,
        city: formData.contractorCity || event.city,
        state: formData.contractorState,
        eventDate: event.eventDate || formData.startDate,
        startDate: formData.startDate,
        artCount: formData.artCount || event.artCount,
        motionCount: formData.motionCount || event.motionCount,
        djCount: formData.djCount || event.djCount,
        paymentValue: formData.totalValue || event.paymentValue,
        agencyName: formData.agencyName,
        agencyCpfCnpj: formData.agencyCpfCnpj,
        agencyEmail: formData.agencyEmail,
        agencyPix: formData.agencyPix,
        durationMonths: formData.durationMonths,
        forumCity: formData.forumCity,
        signatureDate: formData.signatureDate,
        witness2Name: formData.witness2Name,
        witness2Cpf: formData.witness2Cpf,
      };

      const res = await fetch("/api/contracts/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateText: textToProcess,
          clientData,
          customInstructions,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Falha ao preencher automaticamente.");
      }

      setCustomFilledText(data.filledText);
      if (data.fieldsReplaced && Array.isArray(data.fieldsReplaced)) {
        setReplacedFieldsList(data.fieldsReplaced);
      }
      setActiveTab('custom');
      setIsUploadModalOpen(false);
      toast.success("Contrato preenchido com sucesso!", { id: toastId });
    } catch (err: any) {
      console.error("AutoFill error:", err);
      toast.error(err.message || "Erro ao processar preenchimento com IA", { id: toastId });
    } finally {
      setIsProcessingAI(false);
    }
  };

  // File Upload Reader (Supports .txt, .md, .pdf text extract, .doc/.docx text fallback)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();

    if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setCustomContractText(content);
        toast.success(`Arquivo ${file.name} carregado com sucesso!`);
      };
      reader.readAsText(file);
    } else {
      // For PDF or other formats, we read text or inform user
      reader.onload = (event) => {
        const content = (event.target?.result as string) || "";
        setCustomContractText(content);
        toast.info(`Arquivo ${file.name} selecionado. Clique em 'Preencher com IA' para mapear os campos.`);
      };
      reader.readAsText(file);
    }
  };

  // Print / Save as PDF
  const handlePrint = () => {
    window.print();
  };

  // Copy Contract Text
  const handleCopyText = () => {
    const element = document.getElementById('contract-printable-document') || document.getElementById('custom-contract-content');
    if (element) {
      const text = element.innerText;
      navigator.clipboard.writeText(text);
      toast.success("Texto do contrato copiado para a área de transferência!");
    } else if (customFilledText) {
      navigator.clipboard.writeText(customFilledText);
      toast.success("Texto do contrato copiado!");
    }
  };

  // Save Contract to Corregedoria Vault
  const handleSaveToCorregedoriaVault = async () => {
    setIsSavingDoc(true);
    const toastId = toast.loading("Salvando contrato no Cofre de Documentos...");

    try {
      const path = `events/${event.id}/documents`;
      const docName = `Contrato Prestação de Serviços - ${formData.contractorName || event.name}`;
      
      // We create a data URI or link representation
      const contractContent = activeTab === 'custom' && customFilledText ? customFilledText : JSON.stringify(formData);
      const blob = new Blob([contractContent], { type: 'text/plain;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);

      await addDoc(collection(db, path), {
        name: `${docName}.pdf`,
        url: blobUrl,
        type: 'contract',
        status: formData.isSigned ? 'signed' : 'pending',
        thumbnailUrl: '',
        eventId: event.id,
        contractData: formData,
        isCustom: activeTab === 'custom',
        createdAt: serverTimestamp(),
      });

      toast.success("Contrato armazenado no Cofre da Corregedoria!", { id: toastId });
      onSavedToVault?.();
    } catch (err: any) {
      console.error("Erro ao salvar no cofre:", err);
      handleFirestoreError(err, OperationType.CREATE, `events/${event.id}/documents`);
      toast.error("Erro ao salvar documento no cofre", { id: toastId });
    } finally {
      setIsSavingDoc(false);
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-emerald-400">
              CENTRAL DE CONTRATOS AUTOMATIZADOS
            </h2>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Gerador & Gestor de Contratos
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm max-w-xl">
            Preencha contratos automaticamente com os dados do cliente <strong className="text-slate-200">{event.contractorName || event.name}</strong> ou envie seu próprio modelo.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <Button
            onClick={() => setIsUploadModalOpen(true)}
            className="rounded-2xl h-11 px-4 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold shadow-lg shadow-purple-500/20 text-xs sm:text-sm flex items-center gap-2 transition-all hover:scale-105"
          >
            <UploadCloud className="w-4 h-4 text-purple-200" />
            Enviar Meu Contrato
          </Button>

          <Button
            variant="outline"
            onClick={handlePrint}
            className="rounded-2xl h-11 px-4 bg-white/5 hover:bg-white/10 border-white/10 text-slate-100 font-bold text-xs sm:text-sm flex items-center gap-2"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            Imprimir / PDF
          </Button>

          <Button
            onClick={handleSaveToCorregedoriaVault}
            disabled={isSavingDoc}
            className="rounded-2xl h-11 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black shadow-lg shadow-emerald-500/20 text-xs sm:text-sm flex items-center gap-2 transition-all hover:scale-105"
          >
            {isSavingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar no Cofre
          </Button>
        </div>
      </div>

      {/* Tab Selectors & Navigation Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900/60 p-2 rounded-2xl border border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('standard')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeTab === 'standard'
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-md"
                : "text-slate-400 hover:text-white"
            )}
          >
            <FileCheck className="w-4 h-4" />
            Modelo Oficial FdS (Marketing & Design)
          </button>

          {customFilledText && (
            <button
              onClick={() => setActiveTab('custom')}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                activeTab === 'custom'
                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-md"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              Contrato Personalizado (IA)
            </button>
          )}
        </div>

        {/* View Controls */}
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHighlightFields(!highlightFields)}
            className={cn(
              "rounded-xl text-xs font-bold border h-9",
              highlightFields ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-white/5 text-slate-400 border-white/5"
            )}
            title="Destacar campos preenchidos"
          >
            {highlightFields ? "Destaques Ativos" : "Sem Destaques"}
          </Button>

          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setViewMode('split')}
              className={cn(
                "hidden xl:flex items-center px-3 py-1 rounded-lg text-xs font-bold transition-all",
                viewMode === 'split' ? "bg-white/10 text-white shadow" : "text-slate-400 hover:text-white"
              )}
            >
              <Sliders className="w-3.5 h-3.5 mr-1" /> Dividido
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={cn(
                "flex items-center px-3 py-1 rounded-lg text-xs font-bold transition-all",
                viewMode === 'preview' ? "bg-white/10 text-white shadow" : "text-slate-400 hover:text-white"
              )}
            >
              <Eye className="w-3.5 h-3.5 mr-1" /> Visualizar
            </button>
            <button
              onClick={() => setViewMode('form')}
              className={cn(
                "flex items-center px-3 py-1 rounded-lg text-xs font-bold transition-all",
                viewMode === 'form' ? "bg-white/10 text-white shadow" : "text-slate-400 hover:text-white"
              )}
            >
              <Edit3 className="w-3.5 h-3.5 mr-1" /> Editar Dados
            </button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopyText}
            className="rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 h-9 w-9"
            title="Copiar texto do contrato"
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Workspace (Split or Full Views) */}
      <div className={cn(
        "grid gap-8",
        viewMode === 'split' ? "grid-cols-1 xl:grid-cols-12" : "grid-cols-1"
      )}>
        {/* Left Side: Form Editor (Visible when in form or split mode) */}
        {(viewMode === 'form' || viewMode === 'split') && (
          <div className={cn(
            "space-y-6",
            viewMode === 'split' ? "xl:col-span-5" : "w-full max-w-4xl mx-auto"
          )}>
            <Card className="rounded-[2.5rem] bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500/10 via-purple-500/10 to-transparent p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white tracking-tight">Campos Preenchidos do Cliente</h3>
                    <p className="text-[11px] text-slate-400 font-medium">Os campos abaixo atualizam o contrato em tempo real.</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetToEventData}
                  className="text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-xl"
                  title="Recarregar dados do evento"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Sincronizar
                </Button>
              </div>

              <CardContent className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                {/* 1. Contratante (Cliente) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                      <span>1.</span> Qualificação do Contratante
                    </h4>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleInputChange('contractorType', 'pf')}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase",
                          formData.contractorType === 'pf' ? "bg-emerald-500 text-white" : "bg-white/5 text-slate-400"
                        )}
                      >
                        Pessoa Física
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInputChange('contractorType', 'pj')}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase",
                          formData.contractorType === 'pj' ? "bg-emerald-500 text-white" : "bg-white/5 text-slate-400"
                        )}
                      >
                        Pessoa Jurídica
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                        {formData.contractorType === 'pf' ? 'Nome Completo do Contratante' : 'Razão Social da Empresa'}
                      </Label>
                      <Input
                        value={formData.contractorName}
                        onChange={e => handleInputChange('contractorName', e.target.value)}
                        placeholder="Ex: Iago Pavarote da Silva Moura"
                        className="rounded-xl bg-white/5 border-white/10 text-white h-11"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                          {formData.contractorType === 'pf' ? 'CPF' : 'CNPJ'}
                        </Label>
                        <Input
                          value={formData.contractorType === 'pf' ? formData.contractorCpf : formData.contractorCnpj}
                          onChange={e => handleInputChange(formData.contractorType === 'pf' ? 'contractorCpf' : 'contractorCnpj', e.target.value)}
                          placeholder={formData.contractorType === 'pf' ? "000.000.000-00" : "00.000.000/0000-00"}
                          className="rounded-xl bg-white/5 border-white/10 text-white h-11"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">E-mail do Cliente</Label>
                        <Input
                          value={formData.contractorEmail}
                          onChange={e => handleInputChange('contractorEmail', e.target.value)}
                          placeholder="cliente@email.com"
                          className="rounded-xl bg-white/5 border-white/10 text-white h-11"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Cidade / Foro</Label>
                        <Input
                          value={formData.contractorCity}
                          onChange={e => {
                            handleInputChange('contractorCity', e.target.value);
                            handleInputChange('forumCity', e.target.value);
                          }}
                          placeholder="Belo Horizonte"
                          className="rounded-xl bg-white/5 border-white/10 text-white h-11"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Estado (UF)</Label>
                        <Input
                          value={formData.contractorState}
                          onChange={e => handleInputChange('contractorState', e.target.value)}
                          placeholder="MG / Minas Gerais"
                          className="rounded-xl bg-white/5 border-white/10 text-white h-11"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                    <span>2.</span> Escopo, Artes & Entregas
                  </h4>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Nome do Evento / Projeto</Label>
                      <Input
                        value={formData.eventName}
                        onChange={e => handleInputChange('eventName', e.target.value)}
                        className="rounded-xl bg-white/5 border-white/10 text-white h-11"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Qtd. Artes Estáticas</Label>
                        <Input
                          type="number"
                          value={formData.artCount}
                          onChange={e => handleInputChange('artCount', parseInt(e.target.value) || 0)}
                          className="rounded-xl bg-white/5 border-white/10 text-white h-11"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Qtd. Vídeos / Motions</Label>
                        <Input
                          type="number"
                          value={formData.motionCount}
                          onChange={e => handleInputChange('motionCount', parseInt(e.target.value) || 0)}
                          className="rounded-xl bg-white/5 border-white/10 text-white h-11"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                    <span>3.</span> Remuneração e Condições de Pagamento
                  </h4>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Valor Total do Contrato</Label>
                        <Input
                          value={formData.totalValue}
                          onChange={e => handleInputChange('totalValue', e.target.value)}
                          placeholder="R$ 700,00"
                          className="rounded-xl bg-white/5 border-white/10 text-emerald-300 font-bold h-11"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Chave PIX / Conta</Label>
                        <Input
                          value={formData.agencyPix}
                          onChange={e => handleInputChange('agencyPix', e.target.value)}
                          placeholder="marksbeys@proton.me"
                          className="rounded-xl bg-white/5 border-white/10 text-white h-11"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-white/5 p-3 rounded-xl border border-white/5 text-center">
                      <div>
                        <span className="text-[9px] uppercase font-black text-slate-400 block">Sinal (Entrada)</span>
                        <span className="text-xs font-black text-emerald-400">{formData.installment1Percent}%</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-black text-slate-400 block">Prévia/Parcial</span>
                        <span className="text-xs font-black text-amber-400">{formData.installment2Percent}%</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-black text-slate-400 block">Entrega Final</span>
                        <span className="text-xs font-black text-indigo-400">{formData.installment3Percent}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-rose-400 flex items-center gap-2">
                    <span>4.</span> Vigência e Foro
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Vigência (Meses)</Label>
                      <Input
                        type="number"
                        value={formData.durationMonths}
                        onChange={e => handleInputChange('durationMonths', parseInt(e.target.value) || 1)}
                        className="rounded-xl bg-white/5 border-white/10 text-white h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Data de Início</Label>
                      <Input
                        value={formData.startDate}
                        onChange={e => handleInputChange('startDate', e.target.value)}
                        placeholder="01/05/2026"
                        className="rounded-xl bg-white/5 border-white/10 text-white h-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Cidade e Data da Assinatura</Label>
                    <Input
                      value={formData.signatureDate}
                      onChange={e => handleInputChange('signatureDate', e.target.value)}
                      placeholder="Belo Horizonte - MG, 29/04/2026"
                      className="rounded-xl bg-white/5 border-white/10 text-white h-11"
                    />
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                      <span>5.</span> Status de Assinatura Digital
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleInputChange('isSigned', !formData.isSigned)}
                      className={cn(
                        "px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1.5",
                        formData.isSigned ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/50" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      )}
                    >
                      {formData.isSigned ? <><CheckCircle2 className="w-3.5 h-3.5" /> Assinado</> : <><Clock className="w-3.5 h-3.5" /> Pendente</>}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Right Side: Document Preview (Visible when in preview or split mode) */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={cn(
            "space-y-6",
            viewMode === 'split' ? "xl:col-span-7" : "w-full max-w-4xl mx-auto"
          )}>
            {activeTab === 'custom' && customFilledText ? (
              /* Custom Filled Contract View */
              <div id="custom-contract-content" className="bg-white text-slate-900 font-sans shadow-2xl rounded-2xl md:rounded-3xl border border-slate-200 p-6 sm:p-12 md:p-16 space-y-8 print:p-0 print:shadow-none print:border-none print:rounded-none">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-purple-600" />
                    <div>
                      <h3 className="font-black text-slate-900 text-lg">Contrato Personalizado Auto-Preenchido</h3>
                      <p className="text-xs text-slate-500">Documento processado com dados de {event.contractorName || event.name}</p>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    IA Inteligente Ativa
                  </div>
                </div>

                {replacedFieldsList.length > 0 && (
                  <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 space-y-1.5 print:hidden">
                    <div className="text-xs font-black uppercase tracking-wider text-purple-700">Variáveis Mapeadas e Substituídas:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {replacedFieldsList.map((f, i) => (
                        <span key={i} className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-purple-200 text-purple-900 font-medium">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="whitespace-pre-wrap leading-relaxed text-sm sm:text-base text-slate-800 text-justify font-serif">
                  {customFilledText}
                </div>
              </div>
            ) : (
              /* Standard 9-Page FdS Advogados Contract Template */
              <ContractTemplateView
                data={formData}
                highlightFields={highlightFields}
                onFieldClick={() => {
                  setViewMode('split');
                  toast.info("Você pode ajustar qualquer valor no painel de edição.");
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Upload Custom Contract Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="rounded-3xl sm:max-w-[550px] glass border-white/10 text-slate-100 p-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-2">
              <UploadCloud className="w-6 h-6" />
            </div>
            <DialogTitle className="text-2xl font-black text-white tracking-tight">
              Enviar Meu Documento de Contrato
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs sm:text-sm">
              Envie um arquivo (.txt, .md, .pdf) ou cole o texto do contrato que você já utiliza. O sistema identificará os campos e preencherá automaticamente com os dados do cliente cadastrado.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            {/* File Dropzone */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/15 hover:border-purple-400/50 transition-colors rounded-2xl p-6 text-center cursor-pointer bg-white/5 hover:bg-white/10 space-y-2 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.pdf,.doc,.docx"
                className="hidden"
                onChange={handleFileUpload}
              />
              <UploadCloud className="w-8 h-8 text-purple-400 mx-auto group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold text-white">
                {uploadedFileName ? `Arquivo: ${uploadedFileName}` : "Clique para selecionar ou arraste o arquivo do contrato"}
              </div>
              <div className="text-[10px] text-slate-400">
                Suporta modelos de texto (.txt, .md), cópias de PDF e contratos em geral
              </div>
            </div>

            {/* Paste Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                  Ou Cole o Texto do Contrato Abaixo:
                </Label>
                {customContractText && (
                  <span className="text-[10px] text-emerald-400 font-bold">
                    {customContractText.length} caracteres
                  </span>
                )}
              </div>
              <textarea
                value={customContractText}
                onChange={e => setCustomContractText(e.target.value)}
                placeholder="Cole aqui as cláusulas do seu contrato com placeholders como [QUALIFICAÇÃO CONTRATANTE], [Nome], [CPF], [Valor], etc..."
                className="w-full h-36 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 p-4 text-xs font-mono resize-y focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            {/* Custom Instructions */}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                Instruções Especiais (Opcional)
              </Label>
              <Input
                value={customInstructions}
                onChange={e => setCustomInstructions(e.target.value)}
                placeholder="Ex: Formatar valores por extenso, incluir cláusula de entrega expressa..."
                className="rounded-xl bg-white/5 border-white/10 text-white h-11 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setIsUploadModalOpen(false)}
              className="rounded-xl text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => handleAIAutoFill()}
              disabled={isProcessingAI || !customContractText.trim()}
              className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-xl h-12 px-6 font-black shadow-lg shadow-purple-500/20 flex items-center gap-2"
            >
              {isProcessingAI ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Preenchendo Dados...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Preencher com Dados do Cliente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
