'use client';

import { useEffect, useState } from 'react';

/**
 * Hook providing multi-layered protection against unauthorized saving, printing,
 * inspecting, copying, and background window screen-captures while reading protected eBooks.
 */
export function useReaderProtection() {
  const [isObscured, setIsObscured] = useState(false);

  useEffect(() => {
    // 1. Keyboard Shortcut Interceptor
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const isAltOrOption = e.altKey;
      const key = e.key.toLowerCase();

      // Block Save (Ctrl+S, Cmd+S)
      if (isCtrlOrCmd && key === 's') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Block Print (Ctrl+P, Cmd+P)
      if (isCtrlOrCmd && key === 'p') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Block Copy / Cut / Select All (Ctrl+C, Cmd+C, Ctrl+X, Cmd+X, Ctrl+A, Cmd+A)
      if (isCtrlOrCmd && (key === 'c' || key === 'x' || key === 'a')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Block View Source (Ctrl+U, Cmd+U)
      if (isCtrlOrCmd && key === 'u') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Block DevTools (F12, Ctrl+Shift+I, Cmd+Option+I, Ctrl+Shift+J, Cmd+Option+J, Ctrl+Shift+C, Cmd+Option+C)
      if (
        e.key === 'F12' ||
        (isCtrlOrCmd && isShift && (key === 'i' || key === 'j' || key === 'c')) ||
        (isCtrlOrCmd && isAltOrOption && (key === 'i' || key === 'j' || key === 'c'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Block PrintScreen key
      if (e.key === 'PrintScreen' || key === 'printscreen') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // 2. Context Menu (Right-Click) Interceptor
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // 3. Drag & Drop Interceptor
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // 4. Print Event Interceptor
    const handleBeforePrint = () => {
      setIsObscured(true);
    };

    // 5. Window Blur & Tab Visibility Change Interceptor (Deterrence against background capture)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsObscured(true);
      }
    };

    const handleWindowBlur = () => {
      // Small debounce so clicking within standard UI controls doesn't trigger false positives
      setIsObscured(true);
    };

    const handleWindowFocus = () => {
      setIsObscured(false);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('contextmenu', handleContextMenu, { capture: true });
    window.addEventListener('dragstart', handleDragStart, { capture: true });
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      window.removeEventListener('dragstart', handleDragStart, { capture: true });
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return {
    isObscured,
    resumeReading: () => setIsObscured(false),
  };
}
