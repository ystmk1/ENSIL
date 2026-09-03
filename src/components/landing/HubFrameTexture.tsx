import { useEffect, useRef } from 'react';

/**
 * 허브 텍스처 — 비디오를 직접 표시한다. "밝은 곳=흰색, 어두운 곳=투명" 룩은
 * CSS(grayscale + screen 블렌드)가 동일하게 만들어 준다.
 * 이전 구현의 30fps getImageData 픽셀 루프(CPU)를 제거 — 정방향 재생은 비용 0,
 * 역방향은 기존 그대로 30fps 시킹 스텝.
 */

const HUB_TEXTURE_VIDEO = '/media/index/ensil-tentacle-exact.m4v';
const FRAME_INTERVAL = 1000 / 30;
const REVERSE_STEP = 1 / 30;

export function HubFrameTexture() {
  const rootRef = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    if (!root || !video) return undefined;

    let ready = false;
    let direction: 1 | -1 = 1;
    let reverseTimer = 0;

    const playForward = () => {
      direction = 1;
      root.dataset.direction = 'forward';
      root.dataset.playback = 'forward';
      void video.play().catch(() => undefined);
    };

    const stepBackward = () => {
      if (!ready || direction !== -1) return;
      if (video.currentTime <= REVERSE_STEP) {
        video.currentTime = 0;
        playForward();
        return;
      }
      video.currentTime = Math.max(0, video.currentTime - REVERSE_STEP);
    };

    const onSeeked = () => {
      if (direction !== -1) return;
      window.clearTimeout(reverseTimer);
      reverseTimer = window.setTimeout(stepBackward, FRAME_INTERVAL);
    };

    const playBackward = () => {
      direction = -1;
      root.dataset.direction = 'reverse';
      root.dataset.playback = 'reverse';
      video.pause();
      stepBackward();
    };

    const onLoaded = () => {
      ready = true;
      playForward();
    };

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('ended', playBackward);
    video.addEventListener('seeked', onSeeked);
    if (video.readyState >= 1) onLoaded();

    return () => {
      window.clearTimeout(reverseTimer);
      video.pause();
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('ended', playBackward);
      video.removeEventListener('seeked', onSeeked);
    };
  }, []);

  return (
    <span ref={rootRef} className="index-dial__hub-texture" data-playback="loading">
      <video
        ref={videoRef}
        className="hub-texture__video"
        src={HUB_TEXTURE_VIDEO}
        muted
        playsInline
        preload="auto"
        tabIndex={-1}
      />
    </span>
  );
}
