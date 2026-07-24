import { useSiderResize } from '@/renderer/hooks/ui/useSiderResize';
import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('useSiderResize', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  it('restores the persisted desktop width', () => {
    localStorage.setItem('layout-sider-width', '340');

    const { result } = renderHook(() =>
      useSiderResize({ isMobile: false, viewportWidth: 1200, collapsed: false, setCollapsed: vi.fn() })
    );

    expect(result.current.siderWidth).toBe(340);
  });

  it('clamps a desktop drag and persists the final width', () => {
    const setCollapsed = vi.fn();
    const { result } = renderHook(() =>
      useSiderResize({ isMobile: false, viewportWidth: 1200, collapsed: false, setCollapsed })
    );

    act(() => {
      result.current.beginSiderResizeDrag({
        clientX: 260,
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent<HTMLDivElement>);
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 600 }));
    });

    expect(result.current.siderWidth).toBe(480);
    expect(setCollapsed).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
    expect(localStorage.getItem('layout-sider-width')).toBe('480');
  });

  it('requests collapse when dragged below the snap threshold', () => {
    const setCollapsed = vi.fn();
    const { result } = renderHook(() =>
      useSiderResize({ isMobile: false, viewportWidth: 1200, collapsed: false, setCollapsed })
    );

    act(() => {
      result.current.beginSiderResizeDrag({
        clientX: 260,
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent<HTMLDivElement>);
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50 }));
    });

    expect(setCollapsed).toHaveBeenCalledWith(true);
  });
});
