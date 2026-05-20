import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Shield, Cpu, Code2, Heart, Github, Globe, Sparkles } from "lucide-react";
import { motion } from "motion/react";

export function About() {
  const features = [
    {
      icon: <Zap className="w-5 h-5 text-yellow-400" />,
      title: "Alta Performance",
      description: "Construído sobre Vite e React 18 para uma experiência instantânea."
    },
    {
      icon: <Shield className="w-5 h-5 text-blue-400" />,
      title: "Segurança Total",
      description: "Infraestrutura Firebase com regras granulares de acesso a dados."
    },
    {
      icon: <Sparkles className="w-5 h-5 text-pink-400" />,
      title: "Design Moderno",
      description: "Interface focada em produtividade e estética cibernética."
    },
    {
      icon: <Cpu className="w-5 h-5 text-purple-400" />,
      title: "Real-time",
      description: "Sincronização instantânea entre todos os membros da equipe."
    }
  ];

  const techStack = [
    "React 18", "TypeScript", "Tailwind CSS", "Firebase", "Framer Motion", "Lucide Icons", "Radix UI"
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12">
      <header className="text-center space-y-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 bg-gradient-to-tr from-purple-600 to-pink-600 rounded-[2rem] flex items-center justify-center shadow-[0_0_40px_rgba(236,72,153,0.3)] mx-auto mb-6"
        >
          <Code2 className="w-12 h-12 text-white" />
        </motion.div>
        <h1 className="text-5xl font-black text-white tracking-tighter italic">
          BACK <span className="text-pink-500 text-shadow-glow">STAGE</span>
        </h1>
        <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-xs">
          Sistema de Gerenciamento de Produção Audiovisual • v2.4.0
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="rounded-[2rem] glass border-white/5 hover:border-white/10 transition-all group h-full">
              <CardContent className="p-8 flex items-start space-x-6">
                <div className="bg-white/5 p-4 rounded-2xl group-hover:bg-white/10 transition-colors">
                  {feature.icon}
                </div>
                <div className="space-y-2">
                  <h3 className="font-black text-white uppercase tracking-tight">{feature.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed font-medium">{feature.description}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="rounded-[3rem] glass border-white/5 overflow-hidden">
        <CardHeader className="p-10 pb-0">
          <CardTitle className="text-2xl font-black text-white uppercase tracking-tight flex items-center">
            <Cpu className="w-6 h-6 mr-3 text-pink-500" />
            Core Technology Stack
          </CardTitle>
        </CardHeader>
        <CardContent className="p-10 space-y-8">
          <div className="flex flex-wrap gap-3">
            {techStack.map((tech) => (
              <Badge key={tech} variant="secondary" className="bg-white/5 text-slate-300 border-white/5 px-4 py-2 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-colors">
                {tech}
              </Badge>
            ))}
          </div>
          
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center space-x-2 text-slate-500 text-sm font-bold italic">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500 animate-pulse" />
              <span>Desenvolvido com foco em excelência e produtividade.</span>
            </div>
            <div className="flex items-center space-x-4">
              <Github className="w-5 h-5 text-slate-500 cursor-help hover:text-white transition-colors" />
              <Globe className="w-5 h-5 text-slate-500 cursor-help hover:text-white transition-colors" />
            </div>
          </div>
        </CardContent>
      </Card>

      <footer className="text-center text-[10px] text-slate-600 font-black uppercase tracking-[0.2em] pt-12">
        © 2024 BACKSTAGE • TODOS OS DIREITOS RESERVADOS
      </footer>
    </div>
  );
}
