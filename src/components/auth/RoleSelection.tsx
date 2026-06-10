import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, Users, Brush, Layout, Lock, ArrowLeft, LogOut } from "lucide-react";
import { UserRole } from "../../types";
import { motion, AnimatePresence } from "motion/react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface RoleSelectionProps {
  onSelect: (role: UserRole) => void;
  onLogout: () => void;
}

export function RoleSelection({ onSelect, onLogout }: RoleSelectionProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");

  const handleDesignerClick = () => {
    setShowPassword(true);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "Cinza7") {
      onSelect('designer');
    } else {
      toast.error("Senha incorreta");
      setPassword("");
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <AnimatePresence mode="wait">
          {!showPassword ? (
            <motion.div 
              key="roles"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-12 space-y-4">
                <h2 className="text-4xl font-black text-white tracking-tight">Escolha seu perfil</h2>
                <p className="text-slate-400">Como você pretende usar a plataforma?</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-8 items-stretch">
                <motion.div 
                  whileHover={{ y: -8, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="h-full"
                >
                  <Card 
                    className="cursor-pointer glass-card group transition-all h-full rounded-[2.5rem] border-white/5 relative overflow-hidden flex flex-col justify-between"
                    onClick={handleDesignerClick}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-purple-500/20 transition-all duration-500" />
                    <CardHeader className="text-center pt-12">
                      <div className="w-24 h-24 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl group-hover:rotate-12 transition-transform duration-500 relative">
                        <div className="absolute inset-0 bg-white/20 rounded-[inherit] animate-pulse" />
                        <Brush className="text-white w-12 h-12 relative z-10" />
                      </div>
                      <CardTitle className="text-3xl font-black text-white tracking-tighter">Designer</CardTitle>
                      <CardDescription className="text-slate-400 text-base mt-3 max-w-[200px] mx-auto leading-tight">Gestão criativa e controle total do cronograma.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center pb-12 pt-8">
                      <div className="bg-white/5 py-3 px-6 rounded-2xl border border-white/5 inline-block group-hover:bg-pink-500/10 transition-colors">
                        <p className="text-[10px] text-pink-400 font-black tracking-[0.2em] uppercase">Acesso Mestre</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div 
                  whileHover={{ y: -8, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="h-full"
                >
                  <Card 
                    className="cursor-pointer glass-card group transition-all h-full rounded-[2.5rem] border-white/5 relative overflow-hidden flex flex-col justify-between"
                    onClick={() => onSelect('contractor')}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-pink-500/20 transition-all duration-500" />
                    <CardHeader className="text-center pt-12">
                      <div className="w-24 h-24 bg-slate-900 border-2 border-pink-500/30 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl group-hover:bg-pink-500 group-hover:border-pink-400 transition-all duration-500 relative">
                        <Users className="text-white w-12 h-12 group-hover:scale-110 transition-transform" />
                      </div>
                      <CardTitle className="text-3xl font-black text-white tracking-tighter">Contratante</CardTitle>
                      <CardDescription className="text-slate-400 text-base mt-3 max-w-[200px] mx-auto leading-tight">Solicitações rápidas e acompanhamento real.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center pb-12 pt-8">
                      <div className="bg-white/5 py-3 px-6 rounded-2xl border border-white/5 inline-block group-hover:bg-purple-500/10 transition-colors">
                        <p className="text-[10px] text-purple-400 font-black tracking-[0.2em] uppercase">Vista de Cliente</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              <div className="mt-12 text-center">
                <Button 
                  variant="ghost" 
                  onClick={onLogout}
                  className="text-slate-500 hover:text-white hover:bg-white/5 rounded-2xl h-12 px-8 font-bold"
                >
                  <LogOut className="mr-2 w-4 h-4" />
                  Sair da Conta
                </Button>
              </div>
            </motion.div>

          ) : (
            <motion.div 
              key="password"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto"
            >
              <Card className="glass-card rounded-[2.5rem] p-8 border-white/10">
                <CardHeader className="text-center">
                  <div className="w-16 h-16 bg-pink-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Lock className="text-pink-500 w-8 h-8" />
                  </div>
                  <CardTitle className="text-2xl font-black text-white">Acesso Designer</CardTitle>
                  <CardDescription className="text-slate-400">Insira a senha de acesso mestre</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handlePasswordSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Input
                        type="password"
                        placeholder="Senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="rounded-2xl bg-white/5 border-white/10 text-white h-14 text-center text-xl tracking-widest focus:ring-pink-500"
                        autoFocus
                      />
                    </div>
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
                        className="flex-[2] rounded-2xl h-12 bg-pink-500 hover:bg-pink-600 text-white font-black shadow-[0_0_20px_rgba(236,72,153,0.3)]"
                      >
                        Entrar
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
