/* The wall is projected into screen space. Each frame shares the same projection
   for paint, lighting, labels and pointer targets, including while dragging. */
function mountGallery(root, onInspect, linkToCollection) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const targets = root.querySelector('.targets');
  const title = root.querySelector('h1');
  const link = root.querySelector('.guide a');
  const stops = collections.flatMap((collection, index) => {
    const pieces = collection.paintings.slice(0, 5).map(art => ({art, index}));
    return [...pieces, {index}];
  });
  const starts = stops.map((_, i) => i).filter(i => i === 0 || stops[i].index !== stops[i-1].index);
  const cache = new Map();
  let position = 0, destination = 0, frame = 0, active = true, current = 0;
  let drag = null, ignoreClick = false, w = 0, h = 0;
  const wrap = n => (n % stops.length + stops.length) % stops.length;
  function schedule() {
    if (active && !frame) frame = requestAnimationFrame(draw);
  }
  function texture(art) {
    if (!cache.has(art.src)) {
      const image = new Image();
      image.onload = schedule;
      image.src = art.src;
      cache.set(art.src, image);
    }
    return cache.get(art.src);
  }
  function paintShape(points, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.closePath();
    ctx.fill();
  }
  function draw() {
    frame = 0;
    if (!active || !w || !h) return;
    const delta = destination - position;
    position += Math.abs(delta) < .002 || matchMedia('(prefers-reduced-motion:reduce)').matches ? delta : delta*.16;
    const world = Math.max(w,h*1.55);
    const offset = (world-w) * .78;
    const screen = s => s*world-offset;
    const top = s => h*(.287-.49*(s-.25)**2);
    const bottom = s => h*(.544+.36*(s-.25)**2);
    const eye = s => top(s)+(bottom(s)-top(s))*.56;
    ctx.fillStyle = '#11151f';
    ctx.fillRect(0,0,w,h);
    const wall = ctx.createLinearGradient(0,0,w,0);
    wall.addColorStop(0,'#bdbab6');wall.addColorStop(.45,'#d3d0ca');wall.addColorStop(.9,'#eae7e0');
    const curve = Array.from({length:81},(_,i)=>i/80*w);
    const sAt = x => (x+offset)/world;
    const upper = curve.map(x=>[x,top(sAt(x))]);
    const lower = curve.map(x=>[x,bottom(sAt(x))]);
    paintShape([...upper,...lower.slice().reverse()],wall);
    const floor = ctx.createLinearGradient(0,h*.53,0,h*.92);
    floor.addColorStop(0,'#29282c');floor.addColorStop(.2,'#3b393b');floor.addColorStop(.45,'#2b2a2e');floor.addColorStop(1,'#28272d');
    paintShape([...lower,[w,h],[0,h]],floor);
    ctx.fillStyle='#11151f';ctx.beginPath();
    ctx.ellipse(screen(.03),h*1.07,world*.53,h*.47,0,0,Math.PI*2);ctx.fill();

    const base = Math.floor(position);
    const keys = new Set();
    for (let step=-3;step<=13;step++) {
      const real = base+step;
      const theta = (6.15 - (real-position))*.16;
      if (Math.abs(theta)>1.28) continue;
      const s = .25+.52*Math.tan(theta);
      const x = screen(s);
      const wallH = bottom(s)-top(s);
      const stop = stops[wrap(real)];
      const art = stop.art;
      const artH = wallH*.415;
      const artW = Math.min(artH*(art?.ratio ?? .68),world*.075/(Math.cos(theta)**2));
      if (x+artW<0 || x-artW>w) continue;
      const left = x-artW/2, right=x+artW/2;
      const y = eye(s);
      ctx.save();ctx.translate(x,y-wallH*.04);ctx.scale(artW*.98,wallH*.50);
      const glow=ctx.createRadialGradient(0,-.12,.07,0,0,1);
      glow.addColorStop(0,'rgba(255,255,249,.92)');glow.addColorStop(.51,'rgba(255,254,244,.52)');glow.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=glow;ctx.fillRect(-1,-1,2,2);ctx.restore();
      const edge = edgeX => {
        const side=sAt(edgeX), height=(bottom(side)-top(side))*.415;
        return [eye(side)-height/2, height];
      };
      const [y1,h1]=edge(left),[y2,h2]=edge(right);
      const image = art && texture(art);
      paintShape([[left,y1],[right,y2],[right,y2+h2],[left,y1+h1]], art ? '#d0ccc4' : '#b8b6b0');
      if (image?.complete && image.naturalWidth) {
        // Narrow vertical strips preserve the perspective of the four corners.
        const strips = Math.ceil(artW/5);
        for (let i=0;i<strips;i++) {
          const f=i/strips;
          ctx.drawImage(image,image.width*f,0,image.width/strips,image.height,
            left+artW*f,y1+(y2-y1)*f,artW/strips+.55,h1+(h2-h1)*f);
        }
      }
      ctx.save();ctx.translate(left+artW*.035,art ? y1+h1+artH*.07 : y1+artH*.15);
      ctx.transform(1,((y2+h2)-(y1+h1))/artW,0,1,0,0);
      if (art) {
        const labelW=Math.min(artW*.63,artH*.46);
        ctx.fillStyle='#efede7';ctx.fillRect(-2,-2,labelW,artH*.14);
        ctx.fillStyle='#45443f';ctx.font='bold '+Math.max(2,artH*.036)+'px Georgia';ctx.fillText('Mayowa Alabi',0,artH*.032,labelW-3);
        ctx.font='italic '+Math.max(2,artH*.035)+'px Georgia';ctx.fillText(art.title,0,artH*.083,labelW-3);
      } else {
        ctx.fillStyle='#4f4d49';ctx.font='bold '+Math.max(6,artH*.075)+'px Display';ctx.fillText(collections[stop.index].title.toUpperCase(),0,0,artW*.9);
      }
      ctx.restore();
      const id=String(wrap(real));keys.add(id);
      let button=targets.querySelector('[data-stop="'+id+'"]');
      if (!button) {
        button=document.createElement('button');button.dataset.stop=id;
        button.setAttribute('aria-label',art ? 'Look closer: '+art.title : 'Explore '+collections[stop.index].title);
        targets.append(button);
      }
      Object.assign(button.style,{left:left+'px',top:Math.min(y1,y2)+'px',width:artW+'px',height:Math.max(h1,h2)+'px'});
    }
    for (const el of Array.from(targets.children)) if (!keys.has(el.dataset.stop)) el.remove();
    current=stops[wrap(Math.round(position))].index;
    title.textContent=collections[current].title;
    link.href=linkToCollection(collections[current]);
    if (Math.abs(destination-position)>.001) schedule();
  }
  const resize = new ResizeObserver(() => {
    w=root.clientWidth;h=root.clientHeight;
    const dpr=Math.min(devicePixelRatio || 1,2);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);schedule();
  });
  resize.observe(root);
  function move(dir) {
    const index=stops[wrap(Math.round(destination))].index;
    const next=(index+dir+starts.length)%starts.length;
    const diff=dir>0 ? wrap(starts[next]-wrap(destination)) : -wrap(wrap(destination)-starts[next]);
    destination+=diff || dir*stops.length;schedule();
  }
  root.querySelector('[data-prev]').onclick=()=>move(-1);
  root.querySelector('[data-next]').onclick=()=>move(1);
  function key(e) {
    if (document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (['ArrowLeft','ArrowRight'].includes(e.key)) {e.preventDefault();move(e.key==='ArrowRight'?1:-1);}
  }
  document.addEventListener('keydown',key);
  targets.addEventListener('wheel', e=>{
    if(e.ctrlKey) return;
    e.preventDefault();destination+=Math.max(-350,Math.min(350,(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*(e.deltaMode===1?16:1)))/260;schedule();
  },{passive:false});
  targets.onpointerdown=e=>{if(e.button!==0)return;drag={x:e.clientX,start:position};ignoreClick=false;};
  targets.onpointermove=e=>{
    if(!drag)return;
    const dx=e.clientX-drag.x;
    if(Math.abs(dx)>5){ignoreClick=true;targets.setPointerCapture(e.pointerId);}
    if(ignoreClick){destination=drag.start+dx/Math.max(65,w*.12);position=destination;schedule();}
  };
  targets.onpointerup=targets.onpointercancel=()=>{drag=null;};
  targets.onpointerleave=()=>{if(!ignoreClick)drag=null;};
  targets.onclick=e=>{
    if(ignoreClick && e.detail){ignoreClick=false;return;}
    const button=e.target.closest('button');
    if(!button)return;
    const stop=stops[Number(button.dataset.stop)];
    if(stop.art)onInspect(stop.art,collections[stop.index]);
    else location.hash=linkToCollection(collections[stop.index]);
  };
  return ()=>{active=false;cancelAnimationFrame(frame);resize.disconnect();document.removeEventListener('keydown',key);};
}

