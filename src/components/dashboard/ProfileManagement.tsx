import { useState, useEffect } from 'react';
import { UserProfile, EventProject } from "../../types";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Palette, 
  Users, 
  Mail, 
  User, 
  ShieldCheck, 
  Loader2, 
  Download, 
  FileJson, 
  FileSpreadsheet, 
  HardDriveDownload, 
  Copy, 
  Check, 
  Sparkles, 
  Database,
  Calendar,
  Music,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { 
  fetchAllSystemData, 
  exportAllDataAsJSON, 
  exportEventsCSV, 
  exportAllDjsCSV, 
  exportAllArtsCSV, 
  exportAllPaymentsCSV, 
  exportCatalogDjsCSV, 
  exportCompletePackage, 
  generateSummaryText,
  AllSystemData 
} from "../../lib/exportAllData";

interface ProfileManagementProps {
  profile: UserProfile;
  events?: EventProject[];
}

export function ProfileManagement({ profile, events: initialEvents = [] }: ProfileManagementProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: profile.name,
    email: profile.email,
  });

  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ message: '', percent: 0 });
  const [cachedData, setCachedData] = useState<AllSystemData | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Quick stats derived from preloaded events if available
  const [stats, setStats] = useState({
    eventsCount: initialEvents.length,
    estimatedDjs: initialEvents.reduce((acc, ev) => acc + (ev.djCount || 0), 0),
    estimatedArts: initialEvents.reduce((acc, ev) => acc + (ev.artCount || 0), 0),
  });

  useEffect(() => {
    setStats({
      eventsCount: initialEvents.length,
      estimatedDjs: initialEvents.reduce((acc, ev) => acc + (ev.djCount || 0), 0),
      estimatedArts: initialEvents.reduce((acc, ev) => acc + (ev.artCount || 0), 0),
    });
  }, [initialEvents]);

  const handleUpdate = async () => {
    if (!formData.name.trim()) {
      toast.error("O nome não pode estar vazio");
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', profile.id);
      await updateDoc(userRef, {
        name: formData.name,
        updatedAt: serverTimestamp(),
      });
      toast.success("Perfil atualizado com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar perfil");
    } finally {
      setLoading(false);
    }
  };

  const getData = async (forceRefresh: boolean = false): Promise<AllSystemData> => {
    if (cachedData && !forceRefresh) {
      return cachedData;
    }
    const data = await fetchAllSystemData(profile, initialEvents, (message, percent) => {
      setExportProgress({ message, percent });
    });
    setCachedData(data);
    return data;
  };

  const handleExportFullJSON = async () => {
    setIsExporting(true);
    try {
      const data = await getData();
      exportAllDataAsJSON(data);
      toast.success("Backup completo (JSON) exportado com sucesso!", {
        description: `${data.metadata.totalEvents} festa(s), ${data.metadata.totalDjs} DJ(s) e ${data.metadata.totalArts} arte(s) incluídas.`
      });
    } catch (error: any) {
      console.error("Erro ao exportar JSON:", error);
      toast.error("Falha ao exportar os dados do sistema", {
        description: error?.message || "Tente novamente em instantes."
      });
    } finally {
      setIsExporting(false);
      setExportProgress({ message: '', percent: 0 });
    }
  };

  const handleExportCSV = async (type: 'events' | 'djs' | 'arts' | 'payments' | 'catalog') => {
    setIsExporting(true);
    try {
      const data = await getData();
      switch (type) {
        case 'events':
          exportEventsCSV(data);
          toast.success("Planilha geral de festas exportada com sucesso!");
          break;
        case 'djs':
          exportAllDjsCSV(data);
          toast.success(`Planilha com ${data.allDjsFlat.length} DJs de todas as festas exportada!`);
          break;
        case 'arts':
          exportAllArtsCSV(data);
          toast.success(`Planilha com ${data.allArtsFlat.length} artes de todas as festas exportada!`);
          break;
        case 'payments':
          exportAllPaymentsCSV(data);
          toast.success(`Planilha financeira de todas as festas exportada!`);
          break;
        case 'catalog':
          exportCatalogDjsCSV(data);
          toast.success(`Catálogo geral com ${data.catalogDjs.length} DJs exportado!`);
          break;
      }
    } catch (error: any) {
      console.error(`Erro ao exportar CSV (${type}):`, error);
      toast.error("Falha ao gerar planilha CSV", {
        description: error?.message || "Tente novamente."
      });
    } finally {
      setIsExporting(false);
      setExportProgress({ message: '', percent: 0 });
    }
  };

  const handleExportAllPackage = async () => {
    setIsExporting(true);
    try {
      const data = await getData();
      toast.info("Iniciando download de todos os arquivos...", {
        description: "Seu navegador baixará o JSON e as planilhas CSV em sequência."
      });
      await exportCompletePackage(data);
      toast.success("Pacote completo exportado com êxito!");
    } catch (error: any) {
      console.error("Erro no pacote completo:", error);
      toast.error("Erro ao exportar pacote completo");
    } finally {
      setIsExporting(false);
      setExportProgress({ message: '', percent: 0 });
    }
  };

  const handleCopySummary = async () => {
    try {
      const data = await getData();
      const text = generateSummaryText(data);
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      toast.success("Resumo geral copiado para a área de transferência!");
      setTimeout(() => setCopiedSummary(false), 3000);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível copiar o resumo");
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      <header className="space-y-2">
        <div className="flex items-center space-x-3">
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tighter italic">
            GERENCIAR <span className="text-pink-500">PERFIL</span>
          </h1>
          <Badge variant="outline" className="border-pink-500/30 text-pink-400 bg-pink-500/10 font-bold uppercase text-[10px] tracking-wider px-2.5 py-0.5">
            Configurações & Backup
          </Badge>
        </div>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
          Mantenha suas informações sempre em dia e gerencie os dados de toda a sua conta
        </p>
      </header>

      {/* Grid: Profile Card & Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="rounded-[2.5rem] glass border-white/5 overflow-hidden col-span-1 shadow-2xl">
          <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
            <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 p-1 shadow-[0_0_30px_rgba(236,72,153,0.3)]">
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center border-4 border-slate-900 overflow-hidden text-white">
                {profile.role === 'designer' ? <Palette className="w-12 h-12 text-pink-400" /> : <Users className="w-12 h-12 text-purple-400" />}
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-white tracking-tight">{profile.name}</h3>
              <p className="text-xs text-slate-500 font-black uppercase tracking-widest">
                {profile.role === 'designer' ? 'Visual Designer' : 'Contratante / Organizador'}
              </p>
            </div>
            <div className="pt-4 border-t border-white/5 w-full">
              <div className="flex items-center justify-center space-x-2 text-pink-500">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Acesso Verificado</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] glass border-white/5 col-span-1 md:col-span-2 shadow-2xl">
          <CardHeader className="p-8 pb-0">
            <CardTitle className="text-lg font-black text-white uppercase tracking-tight flex items-center">
              <User className="w-4 h-4 mr-2 text-pink-500" />
              Informações Básicas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center">
                  <User className="w-3 h-3 mr-2 text-pink-500" />
                  Nome Completo
                </Label>
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="rounded-2xl bg-white/5 border-white/10 text-white h-12 placeholder:text-slate-600 focus:ring-pink-500/20"
                  placeholder="Seu nome completo"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center">
                  <Mail className="w-3 h-3 mr-2 text-pink-500" />
                  E-mail de Acesso
                </Label>
                <Input 
                  value={formData.email}
                  readOnly
                  disabled
                  className="rounded-2xl bg-white/5 border-white/10 text-slate-500 h-12 cursor-not-allowed opacity-50 font-medium"
                />
                <p className="text-[10px] text-slate-600 font-bold italic tracking-tight">O e-mail não pode ser alterado diretamente.</p>
              </div>

              <div className="pt-2">
                <Button 
                  onClick={handleUpdate}
                  disabled={loading}
                  className="w-full h-12 rounded-2xl bg-pink-500 hover:bg-pink-600 font-black text-white shadow-[0_10px_20px_rgba(236,72,153,0.2)] transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                  {loading ? "SALVANDO..." : "SALVAR ALTERAÇÕES"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION: EXPORT ALL SITE DATA (GERAL DE TODAS AS FESTAS) */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="rounded-[2.5rem] glass border-white/10 overflow-hidden shadow-2xl relative bg-gradient-to-b from-slate-900/90 via-slate-950/90 to-purple-950/20">
          {/* Glowing accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-pink-500 via-purple-500 to-emerald-400" />

          <CardHeader className="p-6 sm:p-8 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400">
                    <Database className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                    EXPORTAÇÃO GERAL DE DADOS
                  </CardTitle>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 font-medium">
                  Baixe todos os dados cadastrados no site de <span className="text-pink-400 font-bold">todas as festas</span> (não apenas de uma festa isolada): histórico de eventos, lineup geral de DJs, quadro de artes, documentos, financeiro e catálogo geral.
                </p>
              </div>

              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 text-xs font-black uppercase tracking-wider self-start sm:self-auto shrink-0">
                <Sparkles className="w-3 h-3 mr-1" /> Geral de Todas as Festas
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-8 pt-2 space-y-6">
            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center">
                  <Calendar className="w-3 h-3 mr-1.5 text-pink-400" /> Festas
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
                  {cachedData ? cachedData.metadata.totalEvents : stats.eventsCount}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5">Eventos cadastrados</span>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center">
                  <Music className="w-3 h-3 mr-1.5 text-purple-400" /> DJs no Lineup
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
                  {cachedData ? cachedData.metadata.totalDjs : (stats.estimatedDjs > 0 ? stats.estimatedDjs : '--')}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5">Em todas as festas</span>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center">
                  <Palette className="w-3 h-3 mr-1.5 text-blue-400" /> Artes / Tarefas
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
                  {cachedData ? cachedData.metadata.totalArts : (stats.estimatedArts > 0 ? stats.estimatedArts : '--')}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5">Demandas cadastradas</span>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center">
                  <Database className="w-3 h-3 mr-1.5 text-emerald-400" /> Catálogo Geral
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
                  {cachedData ? cachedData.metadata.totalCatalogDjs : 'Central'}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5">DJs no acervo</span>
              </div>
            </div>

            {/* Active Export Progress Notification */}
            <AnimatePresence>
              {isExporting && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 rounded-2xl bg-pink-500/10 border border-pink-500/30 space-y-2 overflow-hidden"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-pink-300">
                    <span className="flex items-center">
                      <Loader2 className="w-4 h-4 animate-spin mr-2 text-pink-400" />
                      {exportProgress.message || 'Processando dados de todas as festas...'}
                    </span>
                    <span>{exportProgress.percent}%</span>
                  </div>
                  <div className="w-full h-2 bg-pink-950/40 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all duration-300"
                      style={{ width: `${exportProgress.percent}%` }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Primary Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* PRIMARY JSON BUTTON */}
              <Button
                onClick={handleExportFullJSON}
                disabled={isExporting}
                size="lg"
                className="h-16 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-black shadow-[0_10px_25px_rgba(236,72,153,0.3)] transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center space-x-3 text-sm sm:text-base cursor-pointer"
              >
                {isExporting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <FileJson className="w-6 h-6 text-pink-200" />
                )}
                <div className="flex flex-col text-left">
                  <span className="leading-tight">EXPORTAR BACKUP COMPLETO (JSON)</span>
                  <span className="text-[11px] font-normal text-pink-100 opacity-90">
                    Todas as festas, DJs, artes, financeiro e catálogo em 1 arquivo
                  </span>
                </div>
              </Button>

              {/* COMPLETE PACKAGE BUTTON */}
              <Button
                onClick={handleExportAllPackage}
                disabled={isExporting}
                size="lg"
                className="h-16 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-600 hover:from-purple-700 hover:to-emerald-700 text-white font-black shadow-[0_10px_25px_rgba(99,102,241,0.25)] transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center space-x-3 text-sm sm:text-base cursor-pointer"
              >
                {isExporting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <HardDriveDownload className="w-6 h-6 text-emerald-200" />
                )}
                <div className="flex flex-col text-left">
                  <span className="leading-tight">BAIXAR PACOTE COMPLETO</span>
                  <span className="text-[11px] font-normal text-slate-200 opacity-90">
                    Backup JSON + Todas as 4 Planilhas CSV de uma vez
                  </span>
                </div>
              </Button>
            </div>

            {/* SPREADSHEETS (CSV / EXCEL) SECTION */}
            <div className="pt-4 border-t border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center">
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-400" />
                  Planilhas em CSV (Compatíveis com Excel e Google Sheets)
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopySummary}
                  disabled={isExporting}
                  className="text-xs text-slate-400 hover:text-white hover:bg-white/5 h-8 px-2.5 rounded-xl flex items-center"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                      <span className="text-emerald-400">Resumo Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1 text-pink-400" />
                      Copiar Resumo em Texto
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Button
                  onClick={() => handleExportCSV('events')}
                  disabled={isExporting}
                  variant="outline"
                  className="h-13 rounded-2xl bg-white/[0.02] hover:bg-white/[0.08] border-white/10 hover:border-pink-500/40 text-slate-200 hover:text-white flex items-center justify-start px-4 text-xs font-bold transition-all"
                >
                  <Calendar className="w-4 h-4 mr-2.5 text-pink-400 shrink-0" />
                  <div className="flex flex-col text-left truncate">
                    <span className="truncate">Geral de Festas</span>
                    <span className="text-[10px] text-slate-500 font-normal">Todas as festas cadastradas</span>
                  </div>
                </Button>

                <Button
                  onClick={() => handleExportCSV('djs')}
                  disabled={isExporting}
                  variant="outline"
                  className="h-13 rounded-2xl bg-white/[0.02] hover:bg-white/[0.08] border-white/10 hover:border-purple-500/40 text-slate-200 hover:text-white flex items-center justify-start px-4 text-xs font-bold transition-all"
                >
                  <Music className="w-4 h-4 mr-2.5 text-purple-400 shrink-0" />
                  <div className="flex flex-col text-left truncate">
                    <span className="truncate">Todos os DJs</span>
                    <span className="text-[10px] text-slate-500 font-normal">Lineup de todas as festas</span>
                  </div>
                </Button>

                <Button
                  onClick={() => handleExportCSV('arts')}
                  disabled={isExporting}
                  variant="outline"
                  className="h-13 rounded-2xl bg-white/[0.02] hover:bg-white/[0.08] border-white/10 hover:border-blue-500/40 text-slate-200 hover:text-white flex items-center justify-start px-4 text-xs font-bold transition-all"
                >
                  <Palette className="w-4 h-4 mr-2.5 text-blue-400 shrink-0" />
                  <div className="flex flex-col text-left truncate">
                    <span className="truncate">Todas as Artes</span>
                    <span className="text-[10px] text-slate-500 font-normal">Tarefas & prazos kanban</span>
                  </div>
                </Button>

                <Button
                  onClick={() => handleExportCSV('payments')}
                  disabled={isExporting}
                  variant="outline"
                  className="h-13 rounded-2xl bg-white/[0.02] hover:bg-white/[0.08] border-white/10 hover:border-emerald-500/40 text-slate-200 hover:text-white flex items-center justify-start px-4 text-xs font-bold transition-all"
                >
                  <Download className="w-4 h-4 mr-2.5 text-emerald-400 shrink-0" />
                  <div className="flex flex-col text-left truncate">
                    <span className="truncate">Geral Financeiro</span>
                    <span className="text-[10px] text-slate-500 font-normal">Parcelas & pagamentos</span>
                  </div>
                </Button>
              </div>
            </div>

            {/* Explanatory note */}
            <div className="pt-2 text-[11px] text-slate-500 leading-relaxed font-medium flex items-start space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-pink-400 shrink-0 mt-0.5" />
              <span>
                Os arquivos gerados são formatados com suporte a caracteres e acentos em Português (UTF-8 BOM), prontos para abrir diretamente no Microsoft Excel, LibreOffice ou importar no Google Planilhas.
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Security & Privacy card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-8 rounded-[2.5rem] bg-indigo-500/10 border border-indigo-500/20 space-y-4"
      >
        <h4 className="text-sm font-black text-indigo-400 uppercase tracking-widest flex items-center">
          <ShieldCheck className="w-4 h-4 mr-2" />
          Segurança, Backup & Privacidade
        </h4>
        <p className="text-xs text-slate-400 leading-relaxed font-bold italic">
          Suas informações e o histórico de todas as festas são armazenados de forma segura em nossos servidores. 
          A funcionalidade de exportação acima permite que você faça downloads de segurança independentes a qualquer momento, garantindo que você nunca perca o histórico consolidado de seus eventos, briefings e contratos.
        </p>
      </motion.div>
    </div>
  );
}
