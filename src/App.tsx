import { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  User,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, UserRole } from './types';
import { Dashboard } from './components/dashboard/Dashboard';
import { RoleSelection } from './components/auth/RoleSelection';
import { DjPublicForm } from './components/dj/DjPublicForm';
import { Button } from '@/components/ui/button';
import { LogIn, Loader2, Music, Palette, Calendar, Lock, ArrowLeft } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Input } from '@/components/ui/input';

function ThemeProvider({ children }: { children: React.ReactNode; [key: string]: any }) {
  return <>{children}</>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [loginLoading, setLoginLoading] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);

  useEffect(() => {
    if (!auth || typeof auth.onIdTokenChanged !== 'function') {
      console.warn("Firebase Auth is not fully configured or missing connection parameters.");
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            setProfile(null);
          }
        } catch (err: any) {
          console.error("Erro ao carregar perfil do Firestore:", err);
          toast.error("Conectado à conta, mas falha ao sincronizar com o banco de dados Firestore. Verifique suas regras de segurança ou id do banco.");
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    if (loginLoading) return;
    setLoginLoading(true);
    try {
      if (!auth || !auth.app) {
        throw new Error("Configuração do Firebase ausente ou inválida. Verifique se as variáveis de ambiente VITE_FIREBASE_ estão configuradas.");
      }
      const provider = new GoogleAuthProvider();
      // Apenas login simples, sem solicitar permissões de Drive
      await signInWithPopup(auth, provider);
      console.log("Login efetuado com sucesso!");
    } catch (err: any) {
      if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        console.log('Login cancelado pelo usuário');
      } else {
        console.error('Erro no login:', err);
        toast.error(err.message || 'Erro durante o login');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const selectRole = async (role: UserRole) => {
    if (!user) return;
    setRoleSaving(true);
    try {
      const newProfile: UserProfile = {
        id: user.uid,
        name: user.displayName || 'User',
        email: user.email || '',
        role,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'users', user.uid), newProfile);
      setProfile(newProfile);
      toast.success("Perfil registrado com sucesso!");
    } catch (err: any) {
      console.error("Erro ao salvar perfil no Firestore:", err);
      toast.error(
        `Erro de conexão / permissão no banco de dados Firestore: ${err.message || 'Desconhecido'}. ` +
        "Verifique se as variáveis de ambiente e as Regras de Segurança do Firestore no console do Firebase estão corretas e publicadas."
      );
    } finally {
      setRoleSaving(false);
    }
  };

  if (loading || roleSaving) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a0518] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
        {roleSaving && (
          <p className="text-slate-400 text-sm font-semibold animate-pulse">Sincronizando perfil com o Firebase...</p>
        )}
      </div>
    );
  }

  // Intercept for unauthenticated DJ Public Form
  const queryParams = new URLSearchParams(window.location.search);
  const djShare = queryParams.get('djShare');
  let publicEventId = '';
  let publicAssetId = '';
  if (djShare) {
    const parts = djShare.split('_');
    if (parts.length >= 2) {
      publicEventId = parts[0];
      publicAssetId = parts.slice(1).join('_');
    }
  }

  if (djShare && publicEventId && publicAssetId) {
    return (
      <div className="dark min-h-screen bg-[#0a0518] text-slate-100 overflow-hidden relative font-sans">
        <Toaster />
        <div className="relative z-10 min-h-screen flex flex-col">
          <ThemeProvider attribute="class" defaultTheme="dark">
            <DjPublicForm eventId={publicEventId} assetId={publicAssetId} />
          </ThemeProvider>
        </div>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-[#0a0518] text-slate-100 overflow-hidden relative font-sans">
      <div className="glow-purple top-[-10%] left-[-10%] w-[40%] h-[40%]" />
      <div className="glow-pink bottom-[10%] right-[-5%] w-[35%] h-[35%]" />
      <Toaster />
      <div className="relative z-10 min-h-screen flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark">
          {!user ? (
            <Landing handleLogin={handleLogin} loginLoading={loginLoading} />
          ) : !profile ? (
            <RoleSelection onSelect={selectRole} onLogout={handleLogout} />
          ) : (
            <Dashboard profile={profile} />
          )}
        </ThemeProvider>
      </div>
    </div>
  );
}

function Landing({ handleLogin, loginLoading }: { handleLogin: () => void, loginLoading: boolean }) {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'Lince7') {
      handleLogin();
    } else {
      toast.error('Senha incorreta!');
      setPassword('');
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {!showPassword ? (
          <motion.div 
            key="landing-hero"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full text-center space-y-8 glass-card p-6 sm:p-12 rounded-3xl"
          >
            <div className="flex justify-center space-x-[-12px]">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center transform -rotate-12 shadow-xl">
                <Palette className="text-white w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shadow-lg z-10 border border-white/20">
                <Calendar className="text-pink-400 w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center transform rotate-12 shadow-xl">
                <Music className="text-white w-7 h-7 sm:w-8 sm:h-8" />
              </div>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-pink-200 to-slate-400 font-outfit">
                BACKSTAGE
              </h1>
              <p className="text-slate-400 text-sm sm:text-lg leading-relaxed">
                Gestão de eventos e artes em um só lugar. Organize presskits, cronogramas e pagamentos.
              </p>
            </div>

            <Button 
              size="lg" 
              onClick={() => setShowPassword(true)}
              className="w-full h-12 sm:h-14 text-base sm:text-lg font-bold bg-pink-500 hover:bg-pink-600 text-white transition-all rounded-2xl shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30_rgba(236,72,153,0.5)] border-none group"
            >
              <LogIn className="mr-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              Entrar agora
            </Button>
          </motion.div>
        ) : (
          <motion.div 
            key="landing-password"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-md w-full glass-card p-6 sm:p-10 rounded-2xl sm:rounded-[2.5rem] border-white/10"
          >
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-pink-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(236,72,153,0.1)]">
                <Lock className="text-pink-500 w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white tracking-tight">Acesso Restrito</h2>
                <p className="text-slate-400 text-sm">Insira a senha para prosseguir</p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-6">
                <Input
                  type="password"
                  placeholder="••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-2xl bg-white/5 border-white/10 text-white h-14 text-center text-xl tracking-widest focus:ring-pink-500"
                  autoFocus
                />
                
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowPassword(false)}
                    className="flex-1 rounded-2xl h-12 text-slate-400 font-bold"
                  >
                    <ArrowLeft className="mr-2 w-4 h-4" />
                    Voltar
                  </Button>
                  <Button
                    type="submit"
                    disabled={loginLoading}
                    className="flex-[2] rounded-2xl h-12 bg-pink-500 hover:bg-pink-600 text-white font-black shadow-[0_0_20px_rgba(236,72,153,0.3)]"
                  >
                    {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar'}
                  </Button>
                </div>
              </form>

              <div className="pt-4 border-t border-white/5">
                <Button
                  variant="link"
                  className="text-slate-500 hover:text-pink-400 text-xs font-bold uppercase tracking-widest"
                  onClick={() => window.open('https://wa.me/5519971087116?text=Oi%2C%20preciso%20da%20senha%20pra%20entrar%20no%20gerenciador%20do%20Backstage', '_blank')}
                >
                  Não tem a senha? Solicitar acesso
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute bottom-8 text-[10px] font-black text-white tracking-[0.3em] uppercase opacity-40">
        v2.9
      </div>
    </div>
  );
}
