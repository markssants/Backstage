import { useState, useEffect } from 'react';
import { UserProfile, EventProject, OperationType, ViewType } from '../../types';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError } from '../../firebase';
import { Sidebar } from './Sidebar';
import { MobileNavigation } from './MobileNavigation';
import { Overview } from './Overview';
import { KanbanBoard } from '../kanban/Board';
import { DjAssets } from '../dj/DjAssets';
import { Corregedoria } from '../corregedoria/Corregedoria';
import { Files } from '../files/Files';
import { Payments } from '../payments/Payments';
import { EventSelector } from '../events/EventSelector';
import { Header } from './Header';
import { ProfileManagement } from './ProfileManagement';
import { About } from './About';
import { AdminPanel } from '../admin/AdminPanel';
import { signOut } from 'firebase/auth';
import { Palette } from 'lucide-react';

interface DashboardProps {
  profile: UserProfile;
}

export function Dashboard({ profile }: DashboardProps) {
  const [activeView, setActiveView] = useState<ViewType>('overview');
  const [events, setEvents] = useState<EventProject[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isAdmin = profile.email === 'beysarts@gmail.com';
    const q = isAdmin 
      ? query(collection(db, 'events'), orderBy('createdAt', 'desc'))
      : query(
          collection(db, 'events'),
          where(profile.role === 'designer' ? 'designerId' : 'contractorId', '==', profile.id),
          orderBy('createdAt', 'desc')
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventProject));
      setEvents(eventList);
      if (eventList.length > 0 && !selectedEventId) {
        setSelectedEventId(eventList[0].id);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'events');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile.id, profile.role, selectedEventId]);

  const activeEvent = events.find(e => e.id === selectedEventId);

  const handleLogout = () => signOut(auth);

  return (
    <div className="flex h-screen bg-transparent overflow-hidden">
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        profile={profile} 
        onLogout={handleLogout}
      />
      
      <MobileNavigation 
        activeView={activeView} 
        setActiveView={setActiveView} 
        profile={profile}
        onLogout={handleLogout}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          profile={profile} 
          events={events}
          selectedEventId={selectedEventId}
          setSelectedEventId={setSelectedEventId}
          activeView={activeView}
          setActiveView={setActiveView}
        />
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 pb-24 md:pb-8">
          {activeView === 'profile' && <ProfileManagement profile={profile} />}
          {activeView === 'about' && <About />}
          {activeView === 'admin' && profile.email === 'beysarts@gmail.com' && <AdminPanel profile={profile} />}

          {!selectedEventId && !loading && activeView !== 'profile' && activeView !== 'about' && activeView !== 'admin' && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                  <Palette className="w-10 h-10 text-slate-500" />
                </div>
                <h3 className="text-xl font-semibold text-white">Nenhum evento encontrado</h3>
                <p className="text-slate-400">
                  {profile.email === 'beysarts@gmail.com' 
                    ? "Comece criando um novo evento para gerenciar suas artes." 
                    : "Você ainda não foi vinculado a nenhum evento. Aguarde o convite do designer."}
                </p>
                <EventSelector 
                  profile={profile} 
                  onEventCreated={(id) => setSelectedEventId(id)}
                />
              </div>
            </div>
          )}

          {activeEvent && activeView !== 'profile' && activeView !== 'about' && activeView !== 'admin' && (
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
              {activeView === 'overview' && <Overview event={activeEvent} profile={profile} />}
              {activeView === 'arts' && <KanbanBoard event={activeEvent} profile={profile} />}
               {activeView === 'dj' && <DjAssets event={activeEvent} profile={profile} />}
              {activeView === 'docs' && <Corregedoria event={activeEvent} profile={profile} />}
              {activeView === 'files' && <Files event={activeEvent} profile={profile} />}
              {activeView === 'payments' && <Payments event={activeEvent} profile={profile} />}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
