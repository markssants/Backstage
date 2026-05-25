import { useState, useEffect } from 'react';
import { UserProfile } from "../../types";
import { doc, updateDoc, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, Users, Mail, User, ShieldCheck, Loader2, Cloud, CheckCircle, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";

interface ProfileManagementProps {
  profile: UserProfile;
}

export function ProfileManagement({ profile }: ProfileManagementProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: profile.name,
    email: profile.email,
  });

  const [driveEmail, setDriveEmail] = useState<string | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [checkingDrive, setCheckingDrive] = useState(false);

  useEffect(() => {
    if (profile.email === 'beysarts@gmail.com') {
      const fetchDriveStatus = async () => {
        setCheckingDrive(true);
        try {
          const docSnap = await getDoc(doc(db, 'settings', 'google_drive'));
          if (docSnap.exists()) {
            setDriveEmail(docSnap.data().ownerEmail || 'Conectado');
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
        }, { merge: true });
        
        setDriveEmail(result.user.email || 'beysarts@gmail.com');
        toast.success("Google Drive conectado com sucesso para " + (result.user.email || 'beysarts@gmail.com') + "!");
      } else {
        throw new Error("Não foi possível obter o token de acesso do Google.");
      }
    } catch (err: any) {
      console.error("Erro ao conectar Google Drive:", err);
      toast.error("Erro ao conectar Google Drive: " + (err.message || 'Tente novamente'));
    } finally {
      setDriveLoading(false);
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
              <p className="text-xs text-slate-500 font-black uppercase tracking-widest">{profile.role === 'designer' ? 'Visual Designer' : 'Contratante / Organizador'}</p>
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
                <CardTitle className="text-lg font-black text-white uppercase tracking-tight">Vincular Armazenamento (Google Drive)</CardTitle>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Configure o Google Drive padrão para o recebimento de arquivos</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-2 space-y-6">
            <p className="text-sm text-slate-300 font-medium leading-relaxed">
              Como dono e designer do Backstage, todos os arquivos enviados por DJs e contratantes (Demos, Músicas, Presskits, Logotipos, Imagens) serão guardados diretamente na pasta <strong className="text-pink-400 font-black">’Backstage’</strong> do seu Google Drive. Outros usuários não precisam conceder acesso, pois o sistema usará o seu token de nuvem.
            </p>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Status de Integração
                </p>
                {checkingDrive ? (
                  <div className="flex items-center gap-2 text-slate-400 font-black text-xs uppercase tracking-wider">
                    <Loader2 className="w-4 h-4 animate-spin text-pink-500" /> Verificando...
                  </div>
                ) : driveEmail ? (
                  <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                    <CheckCircle className="w-5 h-5 text-green-500" /> Conectado com <span className="underline">{driveEmail}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                    <AlertCircle className="w-5 h-5 text-rose-500" /> Google Drive Não Vinculado
                  </div>
                )}
              </div>

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
                {driveEmail ? "RECONECTAR CONTA" : "VINCULAR MINHA CONTA"}
              </Button>
            </div>
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
