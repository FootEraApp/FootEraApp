import { useState } from "react";

interface UploadVideoProps {
  onVideoSelect: (file: File | null) => void;
}

export default function UploadVideo({ onVideoSelect }: UploadVideoProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      onVideoSelect(file);
    } else {
      setVideoUrl(null);
      onVideoSelect(null);
    }
  };

  return (
    <div>
      <label className="text-green-800">Vídeo (opcional)</label><br />
      <input type="file" accept="video/*" onChange={handleVideoChange} />

      {videoUrl && (
        <div style={{ marginTop: '10px' }}>
          <video width="320" height="240" controls>
            <source src={videoUrl} type="video/mp4" />
            Seu navegador não suporta o vídeo.
          </video>
        </div>
      )}
    </div>
  );
}
