import { useState } from "react";
import axios from "axios";
import { API } from "../../config";
import Storage from "../../../../server/utils/storage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Share2 } from "lucide-react";

type Badge = {
  id: string;
  nome: string;
  icon: string;
  iconUrl?: string;
}

const badgeIconMap: { [key: string]: string } = {
  stopwatch: "⏱️",
  bullseye: "🎯",
  medal: "🏅",
};

function BadgeIcon({ src, fallback }: { src: string; fallback: string }) {
  const [err, setErr] = useState(false);
  if (err || !src) {
    return <span className="text-2xl">{fallback || '🏅'}</span>;
  }
  return <img src={src} className="w-12 h-12 mb-2" onError={() => setErr(true)} />;
}

export function BadgesList({ userId, badges = [] as Badge[] }: { userId?: string; badges?: Badge[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Badge | null>(null);
  const [mensagem, setMensagem] = useState("");

  async function handleShare() {
    if (!selected) return;
    try {
      await axios.post(
        `${API.BASE_URL}/api/conquistas/compartilhar`,
        { badgeId: selected.id, mensagem },
        { headers: { Authorization: `Bearer ${Storage.token}` } }
      );
      setOpen(false);
      setMensagem("");
      alert("Conquista compartilhada no feed! 🎉");
    } catch (e) {
      console.error(e);
      alert("Não foi possível compartilhar. Tente novamente.");
    }
  }

  return (
    <>
     <h1 className="text-green-900 text-xl p-4">Conquistas</h1>
        
      <div className="grid grid-cols-3 gap-3"> 
       {badges.map((b) => (
          <div key={b.id} className="rounded-lg border p-3 flex flex-col items-center text-center">
            <BadgeIcon src={b.iconUrl || `/assets/badges/${b.icon}.png`} fallback={badgeIconMap[b.icon]} />
             <span className="text-sm font-medium text-green-800">{b.nome || (b as any).name}</span>
            <Button
              className="mt-2 h-8 text-xs"
              variant="secondary"
              onClick={() => { setSelected(b); setOpen(true); }}
            >
              <Share2 className="w-3.5 h-3.5 mr-1" /> Compartilhar
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartilhar conquista</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3">
            {selected && (
              <>
                <img src={selected.iconUrl || `/assets/badges/${selected.icon}.png`} className="w-12 h-12" />
                <div>
                  <div className="font-semibold">{selected?.nome || (selected as any).name}</div>
                  <div className="text-xs text-muted-foreground">Isso aparecerá no seu feed</div>
                </div>
              </>
            )}
          </div>
          <Textarea
            placeholder={`Escreva algo sobre "${selected?.nome || (selected as any)?.name}" (opcional)`}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
          />
          <DialogFooter>
            <Button onClick={handleShare}>Postar no feed</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}