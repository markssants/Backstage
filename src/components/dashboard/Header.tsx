import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserProfile, EventProject, ViewType } from "../../types";
import { EventSelector } from "../events/EventSelector";
import { Layout, Users } from "lucide-react";
import { PendingChangesManager } from "./PendingChangesManager";

interface HeaderProps {
  profile: UserProfile;
  events: EventProject[];
  selectedEventId: string | null;
  setSelectedEventId: (id: string) => void;
  activeView: ViewType;
}

export function Header({ profile, events, selectedEventId, setSelectedEventId, activeView }: HeaderProps) {
  const activeEvent = events.find(e => e.id === selectedEventId);

  return (
    <header className="h-24 glass-header px-6 md:px-8 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-4">
          {events.length > 0 && selectedEventId ? (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-4 bg-white/5 p-1 rounded-2xl border border-white/10 shadow-lg">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 to-purple-500 flex items-center justify-center shadow-[0_0_15px_rgba(236,72,153,0.3)]">
                  <Layout className="text-white w-5 h-5" />
                </div>
                <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                  <SelectTrigger className="w-[180px] md:w-[260px] border-none bg-transparent font-black text-white rounded-xl focus:ring-0 transition-all h-10 text-sm tracking-tight">
                    <SelectValue placeholder="Selecione um evento">
                      {activeEvent?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-[1.5rem] bg-slate-900/95 border-white/10 backdrop-blur-xl text-slate-100 shadow-2xl">
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id} className="cursor-pointer focus:bg-pink-500 font-bold py-3 rounded-xl mx-1 my-1">
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {activeEvent && (
                <PendingChangesManager profile={profile} selectedEventId={selectedEventId} />
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-4">
               <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                 <Users className="text-pink-500 w-5 h-5" />
               </div>
               <h1 className="text-xl font-black text-white tracking-tighter uppercase italic opacity-80">Bem-vindo, {profile.name}</h1>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {activeEvent && activeView === 'overview' && (
          <EventSelector 
            profile={profile} 
            editEvent={activeEvent} 
            onEventUpdated={() => {}} // Could trigger a refresh if needed, but onSnapshot usually handles it
            isMinimal 
          />
        )}
        {activeView === 'overview' && (
          <EventSelector profile={profile} onEventCreated={(id) => setSelectedEventId(id)} isMinimal />
        )}
      </div>
    </header>
  );
}
