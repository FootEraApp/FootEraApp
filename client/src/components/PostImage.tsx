import * as React from "react";

export default function PostImage({ src }: { src?: string }) {
  const [url, setUrl] = React.useState(src);
  if (!url) return null;

  const isCard = /\/uploads\/cards\/|[-_]card\.(png|jpe?g|webp)$/i.test(url);

  return (
    <img
      src={url}
      alt="Post"
      className={`mt-2 rounded-lg mx-auto ${isCard ? "w-full h-auto max-w-[420px]" : "w-auto max-h-72"}`}
      onError={(e) => {
        const cur = e.currentTarget.src;
        if (cur.includes("/uploads/") && !cur.includes("/uploads/cards/")) {
          setUrl(cur.replace("/uploads/", "/uploads/cards/"));
        } else {
          setUrl("");
        }
      }}
    />
  );
}