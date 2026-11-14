/* PHOTOGRAF — MOTION DESIGN ENGINE PRO
   Progressive enhancement only; existing navigation/gallery logic remains untouched. */
(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const hero = document.querySelector('.hero');
  const progress = document.createElement('div');
  progress.className = 'motion-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.appendChild(progress);

  let scrollQueued = false;
  const updateProgress = () => {
    const root = document.documentElement;
    const max = root.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    progress.style.width = (ratio * 100).toFixed(2) + '%';
    scrollQueued = false;
  };
  window.addEventListener('scroll', () => {
    if (!scrollQueued) {
      scrollQueued = true;
      window.requestAnimationFrame(updateProgress);
    }
  }, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateProgress();

  if (reduce.matches) return;

  if (hero && finePointer.matches) {
    let heroFrame = 0;
    hero.addEventListener('pointermove', event => {
      if (heroFrame) return;
      heroFrame = window.requestAnimationFrame(() => {
        const rect = hero.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        hero.style.setProperty('--motion-x', x.toFixed(1) + '%');
        hero.style.setProperty('--motion-y', y.toFixed(1) + '%');
        heroFrame = 0;
      });
    }, { passive: true });
    hero.addEventListener('pointerleave', () => {
      hero.style.setProperty('--motion-x', '50%');
      hero.style.setProperty('--motion-y', '42%');
    }, { passive: true });
  }

  if (finePointer.matches) {
    document.querySelectorAll('.btn, .hdr-cta').forEach(button => {
      let frame = 0;
      button.addEventListener('pointermove', event => {
        if (frame) return;
        frame = window.requestAnimationFrame(() => {
          const rect = button.getBoundingClientRect();
          const dx = (event.clientX - rect.left - rect.width / 2) / rect.width;
          const dy = (event.clientY - rect.top - rect.height / 2) / rect.height;
          button.style.translate = (dx * 5).toFixed(1) + 'px ' + (dy * 4).toFixed(1) + 'px';
          frame = 0;
        });
      }, { passive: true });
      const reset = () => { button.style.translate = ''; };
      button.addEventListener('pointerleave', reset, { passive: true });
      button.addEventListener('blur', reset);
    });

    document.querySelectorAll('.g-btn').forEach(card => {
      const image = card.querySelector('img');
      if (!image) return;
      card.addEventListener('pointermove', event => {
        const rect = card.getBoundingClientRect();
        const dx = (event.clientX - rect.left - rect.width / 2) / rect.width;
        const dy = (event.clientY - rect.top - rect.height / 2) / rect.height;
        image.style.setProperty('--motion-tilt', (dx * 1.15 - dy * .35).toFixed(2) + 'deg');
      }, { passive: true });
      card.addEventListener('pointerleave', () => image.style.removeProperty('--motion-tilt'), { passive: true });
    });
  }
})();
