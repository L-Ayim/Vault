import { useEffect, useRef } from "react";
import { PhoneOff } from "lucide-react";

interface Props {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEnd: () => void;
  video: boolean;
}

export default function CallPanel({ localStream, remoteStream, onEnd, video }: Props) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localRef.current) {
      localRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current) {
      remoteRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center">
      <video ref={remoteRef} autoPlay playsInline className="w-64 h-48 bg-black" />
      {video && (
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          className="w-32 h-24 bg-black absolute bottom-4 right-4"
        />
      )}
      <button onClick={onEnd} className="mt-4 p-2 bg-red-600 rounded-full">
        <PhoneOff className="text-white" />
      </button>
    </div>
  );
}
