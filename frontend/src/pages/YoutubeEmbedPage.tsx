import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "../components/Header";

function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise(resolve => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    resolve();
  });
}

export default function YoutubeEmbedPage() {
  const [params] = useSearchParams();
  const id = params.get("v") || params.get("id") || "";

  useEffect(() => {
    document.title = id ? "Video" : "No video";
  }, [id]);

  const handleCopy = () => {
    copyToClipboard(window.location.href);
  };

  if (!id) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-900">
        <p className="text-gray-300">No video specified.</p>
      </div>
    );
  }

  const audioUrl = `https://yewtu.be/latest_version?id=${id}&itag=140`;
  const videoUrl = `https://yewtu.be/latest_version?id=${id}&itag=22`;

  return (
    <div className="min-h-screen bg-neutral-900 text-gray-200">
      <Header />
      <main className="p-4 flex flex-col items-center space-y-4">
        <iframe
          className="w-full max-w-2xl aspect-video"
          src={`https://www.youtube.com/embed/${id}`}
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
        <div className="flex space-x-4">
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-neutral-700 rounded hover:bg-neutral-600"
          >
            Copy URL
          </button>
          <a
            href={videoUrl}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            Download Video
          </a>
          <a
            href={audioUrl}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            Download Audio
          </a>
        </div>
      </main>
    </div>
  );
}
