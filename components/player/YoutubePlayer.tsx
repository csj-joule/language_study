"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type YoutubePlayerHandle = {
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
  setPlaybackRate: (rate: number) => void;
};

type Props = {
  youtubeId: string;
  onTimeUpdate?: (seconds: number) => void;
  onReady?: () => void;
};

let apiLoadPromise: Promise<void> | null = null;

function loadYoutubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiLoadPromise;
}

export const YoutubePlayer = forwardRef<YoutubePlayerHandle, Props>(
  function YoutubePlayer({ youtubeId, onTimeUpdate, onReady }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YT.Player | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const onTimeUpdateRef = useRef(onTimeUpdate);
    const onReadyRef = useRef(onReady);

    onTimeUpdateRef.current = onTimeUpdate;
    onReadyRef.current = onReady;

    useImperativeHandle(
      ref,
      () => ({
        seekTo: (seconds, allowSeekAhead = true) =>
          playerRef.current?.seekTo(seconds, allowSeekAhead),
        playVideo: () => playerRef.current?.playVideo(),
        pauseVideo: () => playerRef.current?.pauseVideo(),
        getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
        setPlaybackRate: (rate) => playerRef.current?.setPlaybackRate(rate),
      }),
      []
    );

    useEffect(() => {
      let cancelled = false;

      loadYoutubeApi().then(() => {
        if (cancelled || !containerRef.current) return;
        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId: youtubeId,
          playerVars: { rel: 0 },
          events: {
            onReady: () => {
              onReadyRef.current?.();
              intervalRef.current = setInterval(() => {
                const time = playerRef.current?.getCurrentTime();
                if (typeof time === "number") onTimeUpdateRef.current?.(time);
              }, 100);
            },
          },
        });
      });

      return () => {
        cancelled = true;
        if (intervalRef.current) clearInterval(intervalRef.current);
        playerRef.current?.destroy();
        playerRef.current = null;
      };
      // youtubeId가 바뀔 때만 플레이어를 재생성한다
    }, [youtubeId]);

    return (
      <div
        ref={containerRef}
        className="mx-auto aspect-video max-h-[20vh] w-auto max-w-full overflow-hidden rounded-lg bg-black sm:mx-0 sm:h-auto sm:max-h-none sm:w-full"
      />
    );
  }
);
