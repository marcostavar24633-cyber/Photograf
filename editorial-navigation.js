/* PHOTOGRAF — EDITORIAL CHAPTER NAVIGATION
   Adds a compact, keyboard-accessible section index on wide screens. */
(() => {
  'use strict';
  const sections = [
    ['portfolio', 'Портфолио'],
    ['about', 'Философия'],
    ['services', 'Форматы'],
    ['reviews', 'Отзывы'],
    ['book', 'Контакт']
  ];
  const available = sections
    .map(([id, label]) => ({ id, label, node: document.getElementById(id) }))
    .filter(item => item.node);
  if (!available.length || document.querySelector('.editorial-rail')) return;

  const rail = document.createElement('nav');
  rail.className = 'editorial-rail';
  rail.setAttribute('aria-label', 'Навигация по разделам');
  available.forEach(({ id, label }) => {
    const link = document.createElement('a');
    link.href = '#' + id;
    link.dataset.label = label;
    link.setAttribute('aria-label', label);
    rail.append(link);
  });
  document.body.append(rail);

  const links = [...rail.querySelectorAll('a')];
  const setActive = id => {
    links.forEach(link => {
      if (link.hash === '#' + id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: '-28% 0px -48% 0px', threshold: [0, .15, .35, .6] });
    available.forEach(({ node }) => observer.observe(node));
  } else {
    const update = () => {
      const current = available.filter(({ node }) => node.getBoundingClientRect().top < innerHeight * .55).at(-1);
      if (current) setActive(current.id);
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }
})();
