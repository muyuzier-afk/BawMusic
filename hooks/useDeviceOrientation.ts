'use client';

import { useEffect, useRef, useState } from 'react';

interface OrientationData {
  /** 左右倾斜（-90~90），向右为正 */
  gamma: number;
  /** 前后倾斜（-180~180），向前为正 */
  beta: number;
}

interface UseDeviceOrientationOptions {
  enabled: boolean;
}

interface UseDeviceOrientationResult {
  /** 当前归一化偏移 x（-1~1），由 gamma 派生，用于水平位移 */
  offsetX: number;
  /** 当前归一化偏移 y（-1~1），由 beta 派生，用于垂直位移 */
  offsetY: number;
  /** iOS 13+ 需要请求权限，调用此函数发起授权请求 */
  requestPermission: () => Promise<boolean>;
  /** 当前是否已获得权限（非 iOS 永远为 true） */
  granted: boolean;
  /** 设备是否支持陀螺仪 */
  supported: boolean;
}

/**
 * 设备方向监听 hook。
 *
 * iOS 13+ 要求在用户手势内调用 DeviceOrientationEvent.requestPermission()，
 * 因此暴露 requestPermission 供开关点击时调用。
 *
 * offset 采用低通滤波平滑，避免抖动；并对小角度做死区处理，避免静止时漂移。
 */
export function useDeviceOrientation({ enabled }: UseDeviceOrientationOptions): UseDeviceOrientationResult {
  const [supported] = useState(() => {
    if (typeof window === 'undefined') return false;
    return typeof window.DeviceOrientationEvent !== 'undefined';
  });
  const [granted, setGranted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    // 非 iOS（无 requestPermission 静态方法）默认视为已授权
    return typeof (window.DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission !== 'function';
  });

  // 平滑后的值（用 ref 持有，避免触发多余渲染；定时器轮询同步到 state）
  const smoothRef = useRef<OrientationData>({ gamma: 0, beta: 0 });
  const [offset, setOffset] = useState<OrientationData>({ gamma: 0, beta: 0 });

  const requestPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    const ctor = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof ctor.requestPermission === 'function') {
      try {
        const res = await ctor.requestPermission();
        const ok = res === 'granted';
        setGranted(ok);
        return ok;
      } catch {
        setGranted(false);
        return false;
      }
    }
    setGranted(true);
    return true;
  };

  useEffect(() => {
    if (!enabled || !supported || !granted) return;

    const handler = (e: DeviceOrientationEvent) => {
      // gamma: 左右倾斜 -90~90；beta: 前后 -180~180
      const rawGamma = e.gamma ?? 0;
      const rawBeta = e.beta ?? 0;
      // 死区：±2 度内视为 0
      const dz = (v: number) => (Math.abs(v) < 2 ? 0 : v);
      // 归一化到 -1~1：gamma 上限 45 度即可满偏，beta 上限 45 度
      const norm = (v: number, max: number) => Math.max(-1, Math.min(1, v / max));
      const targetGamma = norm(dz(rawGamma), 45);
      const targetBeta = norm(dz(rawBeta), 45);
      // 低通滤波，平滑系数 0.15，约 ~7 帧收敛
      smoothRef.current.gamma += (targetGamma - smoothRef.current.gamma) * 0.15;
      smoothRef.current.beta += (targetBeta - smoothRef.current.beta) * 0.15;
    };

    window.addEventListener('deviceorientation', handler, true);
    // 用 rAF 轮询同步平滑值到 state（约 60fps，但 setOffset 仅在变化超阈值时触发渲染）
    let raf = 0;
    let lastGamma = 0;
    let lastBeta = 0;
    const tick = () => {
      const { gamma, beta } = smoothRef.current;
      if (Math.abs(gamma - lastGamma) > 0.002 || Math.abs(beta - lastBeta) > 0.002) {
        lastGamma = gamma;
        lastBeta = beta;
        setOffset({ gamma, beta });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('deviceorientation', handler, true);
      cancelAnimationFrame(raf);
    };
  }, [enabled, supported, granted]);

  return {
    offsetX: offset.gamma,
    offsetY: offset.beta,
    requestPermission,
    granted,
    supported,
  };
}
