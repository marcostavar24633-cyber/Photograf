/* PHOTOGRAF — PREMIUM INTERACTION CONTROLLER */
(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const navLinks = [...document.querySelectorAll('.hdr-nav a, .nav a')];
  const sections = [...new Set(navLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean))];
  if (sections.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio-a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach(link => {
        if (link.getAttribute('href') === '#' + visible.target.id) link.setAttribute('aria-current','location');
        else link.removeAttribute('aria-current');
      });
    }, {rootMargin:'-24% 0px -58% 0px',threshold:[0,.1,.25,.5]});
    sections.forEach(section => observer.observe(section));
  }
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      const id = link.getAttribute('href').slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      if (document.body.classList.contains('menu-open')) return;
      event.preventDefault();
      target.scrollIntoView({behavior:reduce.matches?'auto':'smooth',block:'start'});
      if (!target.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) target.setAttribute('tabindex','-1');
      if (link.hasAttribute('data-focus-target')) target.focus({preventScroll:true});
      history.replaceState(null,'','#'+id);
    });
  });
})();
