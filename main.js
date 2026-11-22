const SHOTS={prehlad:['Prehľad – čo je dôležité dnes: inzeráty, nevybavené dopyty, obhliadky a upozornenia.','Prehľad: počet inzerátov, nevybavené dopyty, úlohy na dnes a posledné upozornenia'],
 inzeraty:['Inzeráty – zmena ceny zadarmo, TOP, vloženie znova po 60 dňoch a presun starých inzerátov z Bazoša.','Inzeráty na Bazoši s cenou, zobrazeniami, platnosťou a tlačidlami na zmenu ceny a TOP'],
 dopyty:['Dopyty – správy záujemcov zoradené podľa inzerátu, odpoveď priamo z aplikácie.','Dopyty od záujemcov zoradené podľa inzerátov s možnosťou odpovedať']};
document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>{const i=b.dataset.i;
 document.querySelectorAll('.tabs button').forEach(x=>x.setAttribute('aria-selected',x===b));
 document.getElementById('shotWebp').srcset='img/app_'+i+'.webp';const im=document.getElementById('shotImg');im.src='img/app_'+i+'.jpg';im.alt=SHOTS[i][1];
 document.getElementById('shotCap').textContent=SHOTS[i][0]}));

document.querySelectorAll('.obd button').forEach(b=>b.addEventListener('click',()=>{const o=b.dataset.o;
 document.querySelectorAll('.obd button').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',x===b)});
 document.querySelectorAll('#cennik [data-m]').forEach(e=>e.innerHTML=e.dataset[o]);
 document.querySelectorAll('#cennik .plan a[href*="asistent"]').forEach(a=>{a.href=a.href.replace(/%20%E2%80%93%20ro%C4%8Dne/,'')+(o=='r'?'%20%E2%80%93%20ro%C4%8Dne':'')})}));
const h=document.getElementById('hlavicka');addEventListener('scroll',()=>h.classList.toggle('scrolled',scrollY>8),{passive:true});
if(matchMedia('(prefers-reduced-motion: reduce)').matches){const v=document.querySelector('.hero-vid video');if(v){v.removeAttribute('autoplay');v.pause()}}


function wStav(){const f=document.getElementById('konf');const t=f.querySelector('input[name=typ]:checked');const c=+t.dataset.c;const a=document.getElementById('wAsist').checked;
 const e=document.getElementById('wCena'),p=document.getElementById('wPozn');document.getElementById('wAsR').hidden=!a;document.getElementById('wZlR').hidden=!(a&&c);
 if(!c){e.textContent='dohodou';p.textContent=a?'zľavu 20 % na web uplatníme aj pri webe na mieru':'pripravíme podľa zadania';return}
 const k=a?Math.round(c*0.8):c;e.innerHTML=k+' €'+(a?'<span class="old">'+c+' €</span>':'');p.textContent='jednorazovo za web';document.getElementById('wZl').textContent='−'+(c-k)+' €'}
function wOdoslat(ev){ev.preventDefault();const f=ev.target;const d=new FormData(f);const t=f.querySelector('input[name=typ]:checked').value;const a=document.getElementById('wAsist').checked;
 const ex=d.getAll('extra');const L=['Typ webu: '+t,'Orientačná cena: '+document.getElementById('wCena').textContent.replace(/(\d) €(\d)/,'$1 € (pôvodne $2')+(a?')':''),'Správa webu: 120 € ročne','S Realitným asistentom – Všetky portály na rok (−20 % na web): '+(a?'áno':'nie'),'Čo by som chcel: '+(ex.length?ex.join(', '):'—'),'','Meno: '+d.get('meno'),'Kancelária: '+(d.get('rk')||'—'),'E-mail: '+d.get('email'),'Telefón: '+(d.get('tel')||'—'),'Vzorový web: '+(d.get('vzor')||'—'),'','Poznámka: '+(d.get('pozn')||'—')];
 location.href='mailto:rarex731@gmail.com?subject='+encodeURIComponent('Návrh webu – '+t)+'&body='+encodeURIComponent(L.join('\n'));return false}
if(document.getElementById('konf')){document.getElementById('konf').addEventListener('change',wStav);wStav();}


(function(){const b=document.querySelector('.mnav'),n=document.getElementById('navlinks');b.addEventListener('click',()=>{const o=n.classList.toggle('open');b.setAttribute('aria-expanded',o)});n.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{n.classList.remove('open');b.setAttribute('aria-expanded',false)}));})();

/* ===== Moderné interakcie (doplnok) ===== */
(function(){
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const bar=document.createElement('div');bar.className='sprog';document.body.prepend(bar);
const top=document.createElement('button');top.className='totop';top.type='button';top.setAttribute('aria-label','Hore');top.textContent='↑';document.body.append(top);
top.addEventListener('click',()=>scrollTo({top:0,behavior:RM?'auto':'smooth'}));
const hdr=document.getElementById('hlavicka');
function onS(){const h=document.documentElement,p=h.scrollTop/((h.scrollHeight-h.clientHeight)||1);bar.style.width=(p*100)+'%';
 if(hdr)hdr.classList.toggle('scrolled',h.scrollTop>10);top.classList.toggle('on',h.scrollTop>700)}
addEventListener('scroll',onS,{passive:true});onS();
document.querySelectorAll('.svc,.bcard,.wcard,.feat>div,.ukz,.wben>div,.rq').forEach(e=>{e.classList.add('spot');
 e.addEventListener('pointermove',ev=>{const r=e.getBoundingClientRect();e.style.setProperty('--mx',(ev.clientX-r.left)+'px');e.style.setProperty('--my',(ev.clientY-r.top)+'px')})});
const v=document.querySelector('.hero-vid');
if(v&&!RM&&matchMedia('(pointer:fine)').matches){const hero=v.closest('.hero');
 hero.addEventListener('pointermove',ev=>{const r=v.getBoundingClientRect(),x=(ev.clientX-r.left)/r.width-.5,y=(ev.clientY-r.top)/r.height-.5;v.style.transform='perspective(1000px) rotateY('+(x*6)+'deg) rotateX('+(-y*6)+'deg)'});
 hero.addEventListener('pointerleave',()=>v.style.transform='')}
if(!RM&&'IntersectionObserver' in window){document.documentElement.classList.add('js-rv');
 const els=document.querySelectorAll('main .sec-h,main .lead,main .card,main .bcard,main .feat>div,main .wben>div,main .ukz,main .faq details,main .cta,main .packs>*,main .steps>*,main .grid2>*,main .grid3>*');
 const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{rootMargin:'0px 0px -8% 0px'});
 els.forEach((e,i)=>{if(e.closest('.hero'))return;e.classList.add('rv');e.style.transitionDelay=((i%3)*80)+'ms';io.observe(e)})}
})();
