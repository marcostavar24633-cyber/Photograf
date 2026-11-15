/* PHOTOGRAF — Gallery Experience PRO */
(() => {
 'use strict';
 const root=document.querySelector('#portfolio');
 const gallery=root?.querySelector('#gallery');
 const filters=root?.querySelector('#filters');
 if(!root||!gallery||!filters)return;
 const items=[...gallery.querySelectorAll('.g-item')];
 const status=document.createElement('div');
 status.className='gallery-status';
 status.setAttribute('role','status');
 status.setAttribute('aria-live','polite');
 status.innerHTML='<span></span>';
 gallery.after(status);
 const label=status.querySelector('span');
 const update=()=>{
  const active=filters.querySelector('button[aria-pressed="true"]');
  const visible=items.filter(item=>!item.classList.contains('is-hidden')).length;
  const name=active?.textContent?.replace(/\d+/g,'').trim()||'Все истории';
  label.textContent=name+' · '+String(visible).padStart(2,'0')+' кадра';
 };
 filters.addEventListener('click',event=>{
  if(!event.target.closest('button[data-filter]'))return;
  requestAnimationFrame(update);
 });
 update();
 // Give the existing reveal observer a graceful initial state if a card is already in view.
 if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
   entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('is-in');observer.unobserve(entry.target)}
   });
  },{rootMargin:'0px 0px -6% 0px',threshold:.04});
  items.forEach(item=>observer.observe(item));
 }else items.forEach(item=>item.classList.add('is-in'));
})();
