(function(){
  'use strict';
  const $=selector=>document.querySelector(selector);
  const main=$('main'), panel=$('dialog'), currency=$('#currency');
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function read(key,initial){try{return JSON.parse(localStorage.getItem('study-'+key))??initial;}catch{return initial;}}
  function store(key,value){try{localStorage.setItem('study-'+key,JSON.stringify(value));}catch{/* Storage may be disabled. */}}
  let theme=read('theme',matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'), view=read('view','gallery');
  let bag=read('bag',[]), saved=new Set(read('saved',[])), selected=[], deckIndex=0, cleanup=()=>{}, lastRoute;
  const all=new Map();
  collections.forEach(c=>c.paintings.forEach(p=>{if(!all.has(p.id))all.set(p.id,{c,p});}));
  const collectionUrl=c=>'#/collection/'+encodeURIComponent(c.slug);
  const printUrl=(p,c)=>'#/print/'+encodeURIComponent(c.slug)+'/'+p.id;
  const picture=(p,lazy=true)=>`<img src="${escape(p.src)}" ${lazy?'loading="lazy"':''} alt="${escape(p.title)}">`;
  const paths={
    search:'<circle cx="10" cy="10" r="7"/><path d="m16 16 5 5"/>',saved:'<path d="M4 3h16v18l-8-4-8 4z"/>',
    theme:'<path d="M20.8 16A9.2 9.2 0 0 1 8 3a9.2 9.2 0 1 0 12.8 13z"/>',user:'<circle cx="12" cy="7" r="4"/><path d="M3 21v-2c0-6 18-6 18 0v2z"/>',
    bag:'<path d="M2 3h3l2 13h12l2-9H8"/><circle cx="9" cy="20" r=".8"/><circle cx="18" cy="20" r=".8"/>'
  };
  document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=`<svg aria-hidden="true" viewBox="0 0 24 24">${paths[el.dataset.icon]}</svg>`);
  function applyTheme(){document.documentElement.dataset.theme=theme;$('[data-act=theme]').setAttribute('aria-label','Switch to '+(theme==='dark'?'light':'dark')+' mode');}
  applyTheme();currency.value=read('currency','USD');
  const rates={USD:1,GBP:.77,NGN:1450,EUR:.89,ZAR:17.7,KES:129,SAR:3.75,CAD:1.37};
  const money=cents=>new Intl.NumberFormat('en',{style:'currency',currency:currency.value,minimumFractionDigits:0,maximumFractionDigits:2}).format(cents/100*rates[currency.value]);
  function modal(title,html){$('#panel-body').innerHTML=`<h2 class="panel-heading" id="panel-title">${escape(title)}</h2>${html}`;if(!panel.open)panel.showModal();}
  function inspect(p,c){modal(p.title,`<img class="light-art" src="${escape(p.src)}" alt="${escape(p.title)}"><p class="micro muted">Mayowa Alabi · ${escape(c.title)}</p><a class="buy" href="${printUrl(p,c)}">View print</a>`);}
  const switcher=()=>`<div class="switcher" role="group" aria-label="View"><button data-view="gallery" aria-pressed="${view==='gallery'}">Gallery</button><button data-view="list" aria-pressed="${view==='list'}">List</button></div>`;
  const row=(p,url,name,caption)=>`<a class="art-row" href="${url}">${picture(p)}<span class="row-name">${escape(name)}<small class="micro">${escape(caption)}</small></span><span class="go" aria-hidden="true">→</span></a>`;
  function home(){
    if(view==='list'){
      main.innerHTML=`<div class="scene-wrap">${switcher()}<div class="content">${collections.map(c=>`<section class="list-group"><div class="section-head"><h2>${escape(c.title)}</h2><span class="micro muted">${c.paintings.length} prints</span><a class="micro" href="${collectionUrl(c)}">All ${c.paintings.length} →</a></div>${c.paintings.slice(0,8).map(p=>row(p,printUrl(p,c),p.title,c.title)).join('')}</section>`).join('')}</div></div>`;
      return;
    }
    main.innerHTML=`<section class="gallery" aria-label="Walk through the gallery"><canvas aria-hidden="true"></canvas><div class="targets" role="group" aria-label="Paintings on the gallery wall"></div>${switcher()}<div class="guide"><span class="micro">You are walking past</span><h1></h1><a class="line-link">Enter the collection →</a></div><div class="walk"><button data-prev class="round" aria-label="Previous collection">←</button><button data-next class="round" aria-label="Next collection">→</button><span class="micro">Scroll or drag to walk round<br>Click a painting to look closer</span></div></section>`;
    cleanup=mountGallery($('.gallery'),inspect,collectionUrl);
  }
  function shop(c){
    const items=c?c.paintings.map(p=>[p,printUrl(p,c),p.title,money(p.price)]):collections.map(c=>[c.paintings[0],collectionUrl(c),c.title,c.paintings.length+' prints']);
    const n=items.length;
    deckIndex=(deckIndex%n+n)%n;
    const [item,url,label,caption]=items[deckIndex];
    const side=(step,name)=>n>1?`<button class="${name}" data-turn="${step}" aria-label="${step<0?'Previous':'Next'} sheet">${picture(items[(deckIndex+step+n)%n][0],false)}</button>`:'';
    const deck=`<div class="deck">${side(-1,'before')}${side(1,'after')}<a href="${url}" aria-label="${escape(label)}">${picture(item,false)}</a></div><div class="deck-foot"><button class="plain-round" data-turn="-1" aria-label="Previous" ${n===1?'disabled':''}>←</button><div><a href="${url}">${escape(label)}</a><small class="micro muted">${escape(caption)} · ${deckIndex+1} / ${n}</small></div><button class="plain-round" data-turn="1" aria-label="Next" ${n===1?'disabled':''}>→</button></div>`;
    main.innerHTML=`<div class="scene-wrap">${switcher()}<section class="content">${c?'<a class="back" href="#/shop">← All collections</a>':''}<h1>${escape(c?.title||'Prints')}</h1>${view==='gallery'?deck:items.map(item=>row(...item)).join('')}</section></div>`;
  }
  function syncBag(){store('bag',bag);$('#bag-count').textContent='('+bag.reduce((n,l)=>n+l.qty,0)+')';}
  function openBag(){
    const rows=bag.map((line,i)=>{
      const entry=all.get(line.id);if(!entry)return '';
      const spec=line.ids.map((id,j)=>edition.types[j].options.find(o=>o[0]===id)?.[1]).filter(Boolean).join(' · ');
      return `<div class="bag-row">${picture(entry.p)}<div>${escape(entry.p.title)}<small>${escape(spec)}</small><small>${money(line.price*line.qty)}</small></div><span class="qty"><button data-line="${i}" data-qty="-1" aria-label="Decrease quantity">−</button>${line.qty}<button data-line="${i}" data-qty="1" aria-label="Increase quantity">+</button></span></div>`;
    }).join('');
    modal('Your bag',bag.length?`${rows}<div class="bag-total"><span>Subtotal</span>${money(bag.reduce((n,l)=>n+l.price*l.qty,0))}</div><p class="note">This preview bag stays on your device. To purchase a print, visit the artist’s store.</p><a class="line-link" href="https://shutabug.com/shop" target="_blank" rel="noopener">Visit original store</a>`:'<p>Your bag is empty.</p><a class="line-link" href="#/shop">Browse prints</a>');
  }
  function product(p,c){
    const ids=selected[3]===20?selected.slice(0,4):selected;
    const variant=edition.variants.find(([list])=>list.length===ids.length&&list.every((id,i)=>ids[i]===id));
    const controls=edition.types.map((type,i)=>i===4&&selected[3]===20?'':`<label>${escape(type.label)}<select data-option="${i}">${type.options.map(([id,label])=>`<option value="${id}" ${selected[i]===id?'selected':''}>${escape(label)}</option>`).join('')}</select></label>`).join('');
    main.innerHTML=`<article class="product"><div><button class="product-img" aria-label="Enlarge artwork">${picture(p,false)}</button></div><section><a class="back" href="${collectionUrl(c)}">← Back to prints</a><p class="micro">${escape(c.title)}</p><h1>${escape(p.title)}</h1><p>Mayowa Alabi</p><p class="price">${variant?money(variant[1]):'Combination unavailable'}</p>${controls}<div class="product-buttons"><button class="buy" data-add ${variant?'':'disabled'}>Add to bag</button><button class="outline" data-save>${saved.has(p.id)?'Remove from saved':'Save print'}</button></div><p class="note">Preview pricing · <a class="line-link" href="https://shutabug.com${escape(p.path)}" target="_blank" rel="noopener">Original edition</a></p></section></article>`;
    $('.product-img').onclick=()=>inspect(p,c);
    main.querySelectorAll('[data-option]').forEach(select=>select.onchange=()=>{
      const i=Number(select.dataset.option);selected[i]=Number(select.value);
      if(i===0&&selected[0]===24){selected[2]=94;selected[3]=20;}
      if((selected[2]===95||selected[3]!==20)&&selected[0]===24)selected[0]=25;
      product(p,c);$(`[data-option="${i}"]`)?.focus();
    });
    $('[data-save]').onclick=()=>{if(!saved.delete(p.id))saved.add(p.id);store('saved',[...saved]);$('[data-save]').textContent=saved.has(p.id)?'Remove from saved':'Save print';};
    $('[data-add]').onclick=()=>{
      if(!variant)return;
      const key=[p.id,...ids].join('.'), existing=bag.find(l=>l.key===key);
      if(existing)existing.qty++;else bag.push({key,id:p.id,ids:[...ids],price:variant[1],qty:1});
      syncBag();openBag();
    };
  }
  function search(){
    modal('Search','<input type="search" aria-label="Search collections and paintings" placeholder="Search collections and paintings…" id="query"><div class="results" id="matches"></div>');
    const input=$('#query');
    function update(){
      const normalize=s=>s.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'');
      const q=normalize(input.value.trim());
      const result=(p,url,name,type)=>`<a class="result" href="${url}">${picture(p)}<span>${escape(name)}<small>${escape(type)}</small></span></a>`;
      const hits=collections.filter(c=>normalize(c.title).includes(q)).map(c=>result(c.paintings[0],collectionUrl(c),c.title,'Collection'));
      if(q)for(const {c,p} of all.values())if(normalize(p.title).includes(q))hits.push(result(p,printUrl(p,c),p.title,c.title));
      $('#matches').innerHTML=hits.join('')||'<p>No matching prints or collections.</p>';
    }
    input.oninput=update;update();input.focus();
  }
  function savedPage(){
    const list=[...saved].map(id=>all.get(id)).filter(Boolean);
    main.innerHTML=`<section class="content"><h1>Saved prints</h1>${list.length?list.map(({p,c})=>row(p,printUrl(p,c),p.title,c.title)).join(''):'<p>Save a print from its artwork page to find it here.</p><br><a class="line-link" href="#/shop">Browse prints</a>'}</section>`;
  }
  function info(){
    main.innerHTML=`<section class="content info"><img src="assets/artist.webp" alt="Shutabug’s spiky-haired studio mark"><div><span class="micro">“Shutabug”</span><h1>Mayowa Alabi</h1><p>Based in Lagos, Nigeria, Mayowa Alabi works across digital painting, photography, animation and graphic design. His prints follow everyday life, football, film and music.</p><br><a class="line-link" href="mailto:bba@shutabug.com">Press & collaborations</a></div></section>`;
    const extra=document.createElement('section');
    extra.className='profile-extra';
    extra.innerHTML=`<h2>Selected interviews</h2><div class="press-list">${profile.press.map(item=>`<a href="${escape(item.url)}" rel="noopener" target="_blank">${escape(item.title)} <span aria-hidden="true">↗</span></a>`).join('')}</div><h2>Selected projects</h2><div class="cards">${profile.projects.map(p=>`<a class="card" href="${escape(p.href)}" target="_blank" rel="noopener"><figure>${picture(p)}</figure><strong>${escape(p.title)}</strong></a>`).join('')}</div>`;
    main.append(extra);
  }
  function auctions(){
    main.innerHTML=`<section class="auction"><h1>Auctions</h1><div class="empty"><div class="pegs" aria-hidden="true"><i></i><i></i><i></i></div><span class="micro muted">Empty pegs</span><h2>No lots on display</h2><p>Explore the studio’s print collections while the auction wall is empty.</p><a class="line-link" href="#/shop">Browse the shop →</a></div></section>`;
  }
  function render(){
    cleanup();cleanup=()=>{};
    const hash=location.hash||'#/', changed=hash!==lastRoute;
    if(changed){panel.close();deckIndex=0;selected=[24,31,94,20,98];lastRoute=hash;}
    const [page,slug,id]=hash.replace(/^#\/?/,'').split('/');
    const c=collections.find(c=>encodeURIComponent(c.slug)===slug), p=c?.paintings.find(p=>p.id===id);
    if(page==='shop')shop();else if(page==='collection'&&c)shop(c);else if(page==='print'&&p)product(p,c);else if(page==='saved')savedPage();else if(page==='info')info();else if(page==='auctions')auctions();else home();
    document.title=(p?.title||c?.title||({shop:'Prints',saved:'Saved prints',info:'Mayowa Alabi',auctions:'Auctions'})[page]||'Gallery')+' | Shutabug Study';
    $('nav').classList.remove('open');$('.mobile-menu').setAttribute('aria-expanded','false');
    if(changed)window.scrollTo(0,0);
  }
  currency.onchange=()=>{store('currency',currency.value);render();};
  document.addEventListener('click',e=>{
    const el=e.target.closest('button,a');
    if(!el){if(e.target===panel)panel.close();return;}
    if(el.matches('.skip')){e.preventDefault();main.focus();return;}
    if(el.matches('.mobile-menu')){el.setAttribute('aria-expanded',$('nav').classList.toggle('open'));return;}
    if(el.closest('dialog')&&el.tagName==='A')panel.close();
    if(el.dataset.view){view=el.dataset.view;store('view',view);render();window.scrollTo(0,0);}
    if(el.dataset.turn){deckIndex+=Number(el.dataset.turn);render();}
    if(el.dataset.qty){bag[Number(el.dataset.line)].qty+=Number(el.dataset.qty);bag=bag.filter(l=>l.qty>0);syncBag();openBag();}
    switch(el.dataset.act){
      case 'dismiss-news':$('#postcards').hidden=true;store('dismiss-news',true);break;
      case 'theme':theme=theme==='dark'?'light':'dark';store('theme',theme);applyTheme();break;
      case 'bag':openBag();break;
      case 'search':search();break;
      case 'close':panel.close();break;
      case 'help':modal('Need help?',`<p>Contact the artist’s studio for help with an order or an edition.</p><div class="help-list"><a href="mailto:support@shutabug.com?subject=Order%20support">Orders & delivery</a><a href="mailto:support@shutabug.com?subject=Returns">Returns & damage</a><a href="mailto:support@shutabug.com?subject=Prints">Prints & products</a><a href="mailto:bba@shutabug.com?subject=Artist%20inquiry">Artist inquiries</a></div>`);break;
    }
  });
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search();}});
  window.addEventListener('hashchange',render);syncBag();render();
  if(!read('dismiss-news',false))setTimeout(()=>{$('#postcards').hidden=false;},18000);
})();
