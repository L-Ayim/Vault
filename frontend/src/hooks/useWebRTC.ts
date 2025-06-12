import { useCallback, useEffect, useRef, useState } from "react";

export interface SignalMessage {
  type: "offer" | "answer" | "candidate" | "end";
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  video?: boolean;
}

export default function useWebRTC(sendSignal: (msg: SignalMessage) => void) {
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef(false);

  async function getMedia(video: boolean): Promise<MediaStream | null> {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.error("Media devices API unavailable");
      setError("Media devices API unavailable");
      return null;
    }
    try {
      setError(null);
      return await navigator.mediaDevices.getUserMedia({ audio: true, video });
    } catch (err) {
      console.error("Error accessing user media", err);
      setError("Permission denied for camera/microphone");
      return null;
    }
  }

  const cleanup = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    remoteStream?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setActive(false);
    setError(null);
  }, [remoteStream]);

  const startCall = useCallback(async (video: boolean) => {
    videoRef.current = video;
    const stream = await getMedia(video);
    if (!stream) return;
    localStreamRef.current = stream;
    setLocalStream(stream);

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    stream.getTracks().forEach(t => peer.addTrack(t, stream));
    peer.onicecandidate = e => {
      if (e.candidate) sendSignal({ type: "candidate", candidate: e.candidate.toJSON() });
    };
    peer.ontrack = e => {
      setRemoteStream(e.streams[0]);
    };
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    sendSignal({ type: "offer", sdp: offer.sdp, video });
    peerRef.current = peer;
    setActive(true);
  }, [sendSignal]);

  const handleSignal = useCallback(async (msg: SignalMessage) => {
    if (msg.type === "offer") {
      videoRef.current = !!msg.video;
      const stream = await getMedia(!!msg.video);
      if (!stream) return;
      localStreamRef.current = stream;
      setLocalStream(stream);
      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      stream.getTracks().forEach(t => peer.addTrack(t, stream));
      peer.onicecandidate = e => {
        if (e.candidate) sendSignal({ type: "candidate", candidate: e.candidate.toJSON() });
      };
      peer.ontrack = e => {
        setRemoteStream(e.streams[0]);
      };
      await peer.setRemoteDescription({ type: "offer", sdp: msg.sdp! });
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      sendSignal({ type: "answer", sdp: answer.sdp });
      peerRef.current = peer;
      setActive(true);
    } else if (msg.type === "answer" && peerRef.current) {
      await peerRef.current.setRemoteDescription({ type: "answer", sdp: msg.sdp! });
    } else if (msg.type === "candidate" && peerRef.current) {
      try {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate!));
      } catch (err) {
        console.error("Error adding candidate", err);
      }
    } else if (msg.type === "end") {
      cleanup();
    }
  }, [cleanup, sendSignal]);

  const endCall = useCallback(() => {
    sendSignal({ type: "end" });
    cleanup();
  }, [cleanup, sendSignal]);

  useEffect(() => () => cleanup(), [cleanup]);

  return { localStream, remoteStream, startCall, handleSignal, endCall, active, isVideo: videoRef.current, error };
}
