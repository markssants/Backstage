import { useState, useEffect } from 'react';
import { UserProfile } from "../../types";
import { doc, updateDoc, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Palette, 
  Users, 
  Mail, 
  User, 
  ShieldCheck, 
  Loader2, 
  Cloud, 
  CheckCircle, 
  RefreshCw, 
  AlertCircle, 
  Copy, 
  ExternalLink,
  Lock,
  Terminal,
  Settings,
  Sparkles,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";

interface ProfileManagementProps {
  profile: UserProfile;
}

const APPS_SCRIPT_CODE = `function doGet(e) {
  var url = ScriptApp.getService().getUrl();
  var isDev = url.indexOf("/dev") !== -1;
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    message: "Conector Backstage para Google Drive está ativo!",
    isDevMode: isDev,
    tip: isDev 
      ? "ATENÇÃO: Você abriu um link de teste terminando em /dev. Para o formulário do Backstage funcionar, você precisa usar o link de produção terminando em /exec que o Google fornece ao clicar em Implantação (Deploy) -> Gerenciar Implantações (Manage Deployments)."
      : "Pronto! Copie este link da barra de endereços (terminante em /exec) e insira nas configurações do perfil do Backstage.",
    targetFolderId: "1qoycH41-DFLKIssqMitdWqkdHP--7LFI"
  }, null, 2)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var folderId = "1qoycH41-DFLKIssqMitdWqkdHP--7LFI";
    var folder = DriveApp.getFolderById(folderId);
    
    // Decodifica o arquivo transmitido em Base64 para gravação binária nativa
    var decoded = Utilities.base64Decode(data.base64);
    var blob = Utilities.newBlob(decoded, data.mimeType, data.filename);
    var file = folder.createFile(blob);
    
    // Configura visibilidade pública imediata para links de áudio/mídia funcionarem
    file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      url: "https://drive.google.com/uc?id=" + file.getId() + "&export=download"
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

export function ProfileManagement({ profile }: ProfileManagementProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: profile.name,
    email: profile.email,
  });

  // Google Drive config states
  const [driveEmail, setDriveEmail] = useState<string | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [checkingDrive, setCheckingDrive] = useState(false);
  const [connectionType, setConnectionType] = useState<'standard' | 'apps_script' | 'oauth_credentials'>('apps_script');
  const [appsScriptUrl, setAppsScriptUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [savingDriveSettings, setSavingDriveSettings] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (profile.email === 'beysarts@gmail.com') {
      const fetchDriveStatus = async () => {
        setCheckingDrive(true);
        try {
          const docSnap = await getDoc(doc(db, 'settings', 'google_drive'));
          if (docSnap.exists()) {
            const data = docSnap.data();
            setDriveEmail(data.ownerEmail || 'Conectado');
            setConnectionType(data.connectionType || 'apps_script');
            setAppsScriptUrl(data.appsScriptUrl || '');
            setClientId(data.clientId || '');
            setClientSecret(data.clientSecret || '');
            setRefreshToken(data.refreshToken || '');
          } else {
            setDriveEmail(null);
          }
        } catch (err) {
          console.error("Erro ao carregar status do Google Drive:", err);
        } finally {
          setCheckingDrive(false);
        }
      };
      fetchDriveStatus();
    }
  }, [profile.email]);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopied(true);
    toast.success("Código do Apps Script copiado com sucesso!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnectDrive = async () => {
    setDriveLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        await setDoc(doc(db, 'settings', 'google_drive'), {
          accessToken: credential.accessToken,
          ownerEmail: result.user.email || 'beysarts@gmail.com',
          updatedAt: serverTimestamp(),
          connectionType: 'standard' // Switch to standard on successful standard auth
        }, { merge: true });
        
        setDriveEmail(result.user.email || 'beysarts@gmail.com');
        setConnectionType('standard');
        toast.success("Google Drive conectado para " + (result.user.email || 'beysarts@gmail.com') + "!");
      } else {
        throw new Error("Não foi possível carregar o token de acesso.");
      }
    } catch (err: any) {
      console.error("Erro ao conectar Google Drive via Pop-up:", err);
      toast.error("Erro ao conectar Google Drive: " + (err.message || 'Tente novamente'));
    } finally {
      setDriveLoading(false);
    }
  };

  const handleSaveDriveSettings = async () => {
    setSavingDriveSettings(true);
    try {
      if (connectionType === 'apps_script') {
        if (!appsScriptUrl || !appsScriptUrl.startsWith('https://script.google.com')) {
          toast.error("Por favor, cole uma URL de Web App válida do Google Apps Script.");
          setSavingDriveSettings(false);
          return;
        }
      }
      
      if (connectionType === 'oauth_credentials') {
        if (!clientId || !clientSecret || !refreshToken) {
          toast.error("Por favor, insira todos os parâmetros do OAuth (ID, Cliente Secreto e Refresh Token).");
          setSavingDriveSettings(false);
          return;
        }
      }

      await setDoc(doc(db, 'settings', 'google_drive'), {
        connectionType,
        appsScriptUrl: appsScriptUrl.trim(),
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        refreshToken: refreshToken.trim(),
        ownerEmail: connectionType === 'apps_script' ? 'Apps Script Integrado' : driveEmail || 'beysarts@gmail.com',
        updatedAt: serverTimestamp()
      }, { merge: true });

      setDriveEmail(connectionType === 'apps_script' ? 'Apps Script Integrado' : driveEmail || 'beysarts@gmail.com');
      toast.success("Configurações do Google Drive atualizadas e ativadas!");
    } catch (err: any) {
      console.error("Erro ao salvar opções avançadas do Drive:", err);
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSavingDriveSettings(false);
    }
  };

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

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <header className="space-y-2">
        <h1 className="text-4xl font-black text-white tracking-tighter italic">
          GERENCIAR <span className="text-pink-500">PERFIL</span>
        </h1>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
          Mantenha suas informações de acesso sempre em dia
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="rounded-[2.5rem] glass border-white/5 overflow-hidden col-span-1">
          <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
            <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 p-1">
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center border-4 border-slate-900 overflow-hidden text-white">
                {profile.role === 'designer' ? <Palette className="w-12 h-12" /> : <Users className="w-12 h-12" />}
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

        <Card className="rounded-[2.5rem] glass border-white/5 col-span-1 md:col-span-2">
          <CardHeader className="p-8 pb-0">
            <CardTitle className="text-lg font-black text-white uppercase tracking-tight">Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500 flex items-center">
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
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500 flex items-center">
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

              <div className="pt-4">
                <Button 
                  onClick={handleUpdate}
                  disabled={loading}
                  className="w-full h-14 rounded-2xl bg-pink-500 hover:bg-pink-600 font-black text-white shadow-[0_10px_20px_rgba(236,72,153,0.2)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "SALVAR ALTERAÇÕES"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {profile.email === 'beysarts@gmail.com' && (
        <Card className="rounded-[2.5rem] glass border-pink-500/20 shadow-[0_0_30px_rgba(236,72,153,0.05)] overflow-hidden">
          <CardHeader className="p-8 pb-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-500">
                <Cloud className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-lg font-black text-white uppercase tracking-tight">Conexão Estável (Google Drive)</CardTitle>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Mapeamento para recebimento de arquivos de DJs nas páginas públicas</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-2 space-y-6">
            <p className="text-sm text-slate-300 font-medium leading-relaxed">
              Como todos os arquivos de músicas e presskits enviados por qualquer usuário do site devem entrar diretamente no seu Google Drive (ID da pasta: <code className="text-pink-400 font-bold px-1 bg-white/5 rounded">1qoycH41-DFLKIssqMitdWqkdHP--7LFI</code>), o conector padrão do Google com Popup expira em exatamente 1 hora, impedindo que os DJs enviem arquivos mais tarde se você não estiver logado.
            </p>

            {/* Selector de tipo de conexão */}
            <div className="space-y-3">
              <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                Escolha o Método de Integração:
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setConnectionType('apps_script')}
                  className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    connectionType === 'apps_script'
                      ? 'bg-pink-500/15 border-pink-500/60 text-white shadow-lg'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-pink-400" />
                    <span className="text-xs font-black uppercase tracking-wider">Apps Script (RECOMENDADO)</span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 leading-snug">
                    Criado no seu próprio Google Drive. 100% gratuito, não expira, suporta múltiplos usuários e não necessita de permissões do visitante.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setConnectionType('oauth_credentials')}
                  className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    connectionType === 'oauth_credentials'
                      ? 'bg-pink-500/15 border-pink-500/60 text-white shadow-lg'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-4 h-4 text-pink-400" />
                    <span className="text-xs font-black uppercase tracking-wider">OAuth Auto-Renovação</span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 leading-snug">
                    ID do Cliente + Segredo + Refresh Token. O Backstage renova o Token de forma invisível em background a cada hora.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setConnectionType('standard')}
                  className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    connectionType === 'standard'
                      ? 'bg-pink-500/15 border-pink-500/60 text-white shadow-lg'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-pink-400" />
                    <span className="text-xs font-black uppercase tracking-wider">Conexão por Pop-Up</span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 leading-snug">
                    Simples autenticação por Pop-up tradicional. Prático para testes curtos, mas expira a cada 1 hora.
                  </p>
                </button>
              </div>
            </div>

            {/* Status do conector */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Status Geral do Drive</span>
              <div className="flex items-center gap-2">
                {checkingDrive ? (
                  <div className="flex items-center gap-2 text-slate-400 font-black text-xs uppercase tracking-wider">
                    <Loader2 className="w-4 h-4 animate-spin text-pink-500" /> Verificando...
                  </div>
                ) : driveEmail ? (
                  <div className="flex items-center gap-2 text-green-400 font-bold text-xs uppercase tracking-wider">
                    <CheckCircle className="w-4 h-4 text-green-500" /> Ativo / Vinculado ({driveEmail})
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                    <AlertCircle className="w-4 h-4 text-rose-500" /> Desativado ou Token Expirado
                  </div>
                )}
              </div>
            </div>

            {/* Formulários dinâmicos baseados no tipo de conector */}
            {connectionType === 'apps_script' && (
              <div className="space-y-4 border-l-2 border-pink-500/30 pl-4 py-1 animate-fade-in">
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-pink-500" />
                    Passo-a-passo do Google Apps Script (Recomendado)
                  </h4>
                  <ol className="text-xs text-slate-400 space-y-2 leading-relaxed ml-4 list-decimal font-medium">
                    <li>Acesse <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-pink-400 underline inline-flex items-center gap-0.5">script.google.com <ExternalLink className="w-3 h-3" /></a> e clique em <strong>"Novo Projeto"</strong>.</li>
                    <li>Substitua todo o código existente lá pelo código mostrado no quadro abaixo.</li>
                    <li>Clique no ícone de salvar (disquete) e depois em <strong>"Implantar" (Deploy) &rarr; "Nova Implantação" (New Deployment)</strong>.</li>
                    <li>Clique no ícone de engrenagem no canto de "Selecione o tipo" e escolha <strong>"Surgimento da Web" (Web App)</strong>.</li>
                    <li>Escreva uma descrição (ex: "My Backstage Upload"), mude <strong>"Executar como"</strong> para <span className="text-pink-400 font-bold">"Eu ({profile.email})"</span> e o campo <strong>"Quem tem acesso"</strong> obrigatoriamente para <span className="text-pink-400 font-bold">"Qualquer pessoa" (Anyone)</span>.</li>
                    <li>Clique em <strong>"Implantar"</strong>, forneça as autorizações necessárias para a sua conta e copie a <strong>"URL da Web"</strong> gerada. Cole-o no campo abaixo!</li>
                  </ol>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Script para Cópia</span>
                    <button
                      type="button"
                      onClick={handleCopyScript}
                      className="px-3 py-1.5 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? "Copiado!" : "Copiar Código"}
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-slate-950 border border-white/5 font-mono text-[10px] text-slate-400 overflow-x-auto max-h-48 leading-relaxed">
                    {APPS_SCRIPT_CODE}
                  </pre>
                </div>

                <div className="space-y-2 pt-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                    Cole o Link Gerado (URL do Web App do Google Apps Script)
                  </Label>
                  <Input 
                    value={appsScriptUrl}
                    onChange={(e) => setAppsScriptUrl(e.target.value)}
                    className="rounded-2xl bg-white/5 border-white/10 text-white h-12 placeholder:text-slate-600 focus:ring-pink-500/20 text-xs font-mono"
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  />
                </div>
              </div>
            )}

            {connectionType === 'oauth_credentials' && (
              <div className="space-y-4 border-l-2 border-pink-500/30 pl-4 py-1 animate-fade-in">
                <p className="text-xs text-slate-400 leading-relaxed font-bold italic">
                  Utilize este conector preenchendo as chaves do Google Cloud Platform (GCP). O sistema utiliza o <b>Refresh Token</b> para gerar automaticamente novos <b>Access Tokens</b> sem que você precise autorizar por popups manualmente de tempos em tempos.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Client ID (ID do Cliente)</Label>
                    <Input 
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="rounded-2xl bg-white/5 border-white/10 text-white h-12 text-xs font-mono"
                      placeholder="Identificador do app no console GCP"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Client Secret (Segredo)</Label>
                    <Input 
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      className="rounded-2xl bg-white/5 border-white/10 text-white h-12 text-xs font-mono"
                      placeholder="Segredo da Chave de Segurança"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Refresh Token (Token de Renovação)</Label>
                    <Input 
                      value={refreshToken}
                      onChange={(e) => setRefreshToken(e.target.value)}
                      className="rounded-2xl bg-white/5 border-white/10 text-white h-12 text-xs font-mono"
                      placeholder="Token OAuth para renovações automáticas"
                    />
                  </div>
                </div>
              </div>
            )}

            {connectionType === 'standard' && (
              <div className="space-y-4 border-l-2 border-pink-500/30 pl-4 py-1 animate-fade-in">
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  Clique no botão abaixo para autorizar temporariamente a gravação direta no Google Drive. Esta conexão expira após uma hora devido às diretivas de segurança do Google para sessões interativas padrão.
                </p>

                <Button 
                  onClick={handleConnectDrive}
                  disabled={driveLoading || checkingDrive}
                  className="rounded-xl h-12 px-6 font-black uppercase tracking-wider text-[11px] bg-pink-500 hover:bg-pink-600 text-white flex items-center gap-2 shadow-lg transition-all active:scale-95"
                >
                  {driveLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {driveEmail ? "RECONECTAR INTEGRADO" : "VINCULAR MINHA CONTA"}
                </Button>
              </div>
            )}

            {/* Ação de salvamento para os métodos estruturados */}
            {connectionType !== 'standard' && (
              <div className="pt-2">
                <Button
                  onClick={handleSaveDriveSettings}
                  disabled={savingDriveSettings}
                  className="w-full h-12 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-md cursor-pointer"
                >
                  {savingDriveSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                  ATUALIZAR CONFIGURAÇÃO DE INTEGRAÇÃO
                </Button>
              </div>
            )}

          </CardContent>
        </Card>
      )}

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-8 rounded-[2.5rem] bg-indigo-500/10 border border-indigo-500/20 space-y-4"
      >
        <h4 className="text-sm font-black text-indigo-400 uppercase tracking-widest">Segurança & Privacidade</h4>
        <p className="text-xs text-slate-400 leading-relaxed font-bold italic">
          Suas informações são armazenadas de forma segura em nossos servidores. 
          As alterações feitas aqui refletem em como outros membros do Backstage veem seu perfil nos projetos e tarefas.
        </p>
      </motion.div>
    </div>
  );
}
