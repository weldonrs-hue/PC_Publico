'use client';

import { useEffect } from 'react';

const SELECTOR =
  '.no-scrollbar, .scrollbar-hide, .scrollbar-none, .custom-scrollbar-hide';

function updateFadeState(el: HTMLElement) {
  const maxScrollLeft = el.scrollWidth - el.clientWidth;
  if (maxScrollLeft <= 4) {
    if (el.getAttribute('data-scroll-fade')) {
      el.removeAttribute('data-scroll-fade');
    }
    return;
  }

  const hasLeft = el.scrollLeft > 6;
  const hasRight = el.scrollLeft < maxScrollLeft - 6;
  const nextState =
    hasLeft && hasRight ? 'both' : hasLeft ? 'left' : hasRight ? 'right' : 'none';

  if (el.getAttribute('data-scroll-fade') !== nextState) {
    el.setAttribute('data-scroll-fade', nextState);
  }
}

export default function HorizontalScrollEnhancer() {
  useEffect(() => {
    const attached = new WeakSet<HTMLElement>();

    const enhanceElement = (el: HTMLElement) => {
      if (attached.has(el)) {
        updateFadeState(el);
        return;
      }
      attached.add(el);
      updateFadeState(el);

      let isPointerDown = false;
      let isDragging = false;
      let startX = 0;
      let startScrollLeft = 0;

      const onScroll = () => {
        updateFadeState(el);
      };

      // Rolar com a rodinha do mouse na horizontal quando o container tiver overflow-x
      const onWheel = (e: WheelEvent) => {
        if (el.scrollWidth <= el.clientWidth + 4) return;
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          el.scrollBy({ left: e.deltaY, behavior: 'auto' });
          updateFadeState(el);
        }
      };

      // Arrastar com o mouse (drag-to-scroll) no desktop
      const onMouseDown = (e: MouseEvent) => {
        if (e.button !== 0 || el.scrollWidth <= el.clientWidth + 4) return;
        const target = e.target as HTMLElement | null;
        if (target?.closest('input, textarea, select')) return;

        isPointerDown = true;
        isDragging = false;
        startX = e.pageX;
        startScrollLeft = el.scrollLeft;
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isPointerDown) return;
        const dx = e.pageX - startX;
        if (Math.abs(dx) > 5) {
          isDragging = true;
          el.setAttribute('data-dragging', 'true');
          el.scrollLeft = startScrollLeft - dx;
          updateFadeState(el);
        }
      };

      const stopDrag = () => {
        if (!isPointerDown) return;
        isPointerDown = false;
        setTimeout(() => {
          isDragging = false;
          el.removeAttribute('data-dragging');
        }, 40);
      };

      // Ao clicar em qualquer botão/aba dentro da barra, centraliza suavemente o item clicado
      const onClickCapture = (e: MouseEvent) => {
        if (isDragging) {
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        if (el.scrollWidth <= el.clientWidth + 4) return;
        const target = e.target as HTMLElement | null;
        const clickable = target?.closest('button, a, [role="tab"]') as HTMLElement | null;
        if (clickable && el.contains(clickable)) {
          const elRect = el.getBoundingClientRect();
          const itemRect = clickable.getBoundingClientRect();
          const targetScrollLeft =
            el.scrollLeft +
            (itemRect.left - elRect.left) -
            elRect.width / 2 +
            itemRect.width / 2;
          el.scrollTo({
            left: Math.max(0, targetScrollLeft),
            behavior: 'smooth',
          });
        }
      };

      el.addEventListener('scroll', onScroll, { passive: true });
      el.addEventListener('wheel', onWheel, { passive: false });
      el.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove, { passive: true });
      window.addEventListener('mouseup', stopDrag, { passive: true });
      el.addEventListener('click', onClickCapture, true);
    };

    const scanAll = () => {
      document.querySelectorAll<HTMLElement>(SELECTOR).forEach(enhanceElement);
    };

    scanAll();

    const observer = new MutationObserver(() => {
      scanAll();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener('resize', scanAll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scanAll);
    };
  }, []);

  return null;
}
