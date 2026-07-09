import { useState, useEffect } from 'react';

// 预定义的断点
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Hook to detect if a media query matches
 * @param query - Media query string (e.g., '(min-width: 768px)')
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // 新版浏览器使用 addEventListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // 旧版浏览器使用 addListener
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [query]);

  return matches;
}

/**
 * Hook to check if viewport is at or above a breakpoint
 * @param breakpoint - Breakpoint name (sm, md, lg, xl, 2xl)
 * @returns boolean indicating if viewport is at or above the breakpoint
 */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  const query = `(min-width: ${BREAKPOINTS[breakpoint]}px)`;
  return useMediaQuery(query);
}

/**
 * Hook to get current device type
 * @returns 'mobile' | 'tablet' | 'desktop'
 */
export function useDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const isDesktop = useBreakpoint('lg');
  const isTablet = useBreakpoint('md');

  if (isDesktop) return 'desktop';
  if (isTablet) return 'tablet';
  return 'mobile';
}

/**
 * Hook to check if device is mobile
 * @returns boolean
 */
export function useIsMobile(): boolean {
  return !useBreakpoint('md');
}

/**
 * Hook to check if device is tablet
 * @returns boolean
 */
export function useIsTablet(): boolean {
  const isTablet = useBreakpoint('md');
  const isDesktop = useBreakpoint('lg');
  return isTablet && !isDesktop;
}

/**
 * Hook to check if device is desktop
 * @returns boolean
 */
export function useIsDesktop(): boolean {
  return useBreakpoint('lg');
}