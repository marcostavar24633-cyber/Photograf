/* PHOTOGRAF — NAVIGATION MODE CONTROLLER */
(() => {
  'use strict';
  const body = document.body;
  const toggle = document.getElementById('menuModeToggle');
  const modes = [
    {id:'editorial',label:'EDITORIAL'},
    {id:'vertical',label:'VERTICAL'},
    {id:'orbit',label:'ORBIT'}
  ];
  let index = 0;
  if (!toggle) return;
  const apply = () => {
    modes.forEach(mode => body.classList.toggle('menu-mode-' + mode.id, modes[index].id === mode.id));
    toggle.innerHTML = 'РЕЖИМ: ' + modes[index].label + ' <span aria-hidden="true">↗</span>';
    toggle.title = 'Переключить режим навигации';
    toggle.dataset.mode = modes[index].id;
  };
  toggle.addEventListener('click', () => {
    index = (index + 1) % modes.length;
    apply();
  });
  apply();
})();
