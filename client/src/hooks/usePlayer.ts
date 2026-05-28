import { useRef, useState, useCallback } from 'react';

export interface SongInfo {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number;
  fee: number;
  pop?: number;
  url: string | null;
  isTrial?: boolean;
}

export function usePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<SongInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.6);

  const play = useCallback((song: SongInfo) => {
    setCurrent(song);
    setCurrentTime(0);
    setDuration(song.duration || 0);

    if (audioRef.current && song.url) {
      audioRef.current.src = song.url;
      audioRef.current.load();
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((e) => {
          console.warn('播放失败:', e.message);
          setIsPlaying(false);
        });
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const [isMuted, setIsMuted] = useState(false);
  const [volumeBeforeMute, setVolumeBeforeMute] = useState(0.6);

  const setVolume = useCallback((v: number) => {
    const val = Math.max(0, Math.min(1, v));
    setVolumeState(val);
    if (audioRef.current) audioRef.current.volume = val;
    setIsMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volumeBeforeMute;
      setVolumeState(volumeBeforeMute);
      setIsMuted(false);
    } else {
      setVolumeBeforeMute(volume);
      audioRef.current.volume = 0;
      setVolumeState(0);
      setIsMuted(true);
    }
  }, [isMuted, volume, volumeBeforeMute]);

  const seek = useCallback((pct: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = (audioRef.current.duration || 0) * pct;
    }
  }, []);

  return { audioRef, current, setCurrent, isPlaying, setIsPlaying, currentTime, setCurrentTime,
    duration, setDuration, volume, isMuted, play, togglePlay, setVolume, toggleMute, seek };
}
