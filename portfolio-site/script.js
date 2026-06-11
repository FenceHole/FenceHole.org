(function(){
  'use strict';

  // Nav scroll
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, {passive:true});

  // Active nav link
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav__links a');
  new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const id = e.target.id;
        navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#'+id));
      }
    });
  }, {threshold: 0.4}).observe && sections.forEach(s =>
    new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#'+e.target.id));
        }
      });
    }, {threshold: 0.4}).observe(s)
  );

  // Scroll reveal
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      // stagger portfolio cards
      if (el.classList.contains('pcard') || el.classList.contains('social-card')) {
        const siblings = Array.from(el.parentElement.children).filter(c => c.classList.contains(el.classList[0]));
        const idx = siblings.indexOf(el);
        el.style.transitionDelay = (idx * 0.07) + 's';
      }
      el.classList.add('is-visible');
      revealObs.unobserve(el);
    });
  }, {threshold: 0.1, rootMargin: '0px 0px -30px 0px'});

  document.querySelectorAll('.pcard, .social-card, .reveal-item').forEach(el => revealObs.observe(el));

  // Hub-and-spoke canvas
  const canvas = document.getElementById('hubCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const SPOKES = [
    {label:'Frances & Family',   color:'rgba(240,180,41,'},
    {label:'Cool Cat Stuff',      color:'rgba(59,158,255,'},
    {label:'The Good Meow',       color:'rgba(52,211,153,'},
    {label:'Vet Van Fleet',       color:'rgba(34,211,238,'},
    {label:'Vibecode Cat',        color:'rgba(167,139,250,'},
    {label:'User Generated Cats', color:'rgba(251,113,133,'},
  ];

  let W, H, cx, cy, orbitR, nodes = [], particles = [], t = 0, rafId, lastSpawn = 0;

  function resize() {
    W = canvas.offsetWidth; H = canvas.offsetHeight;
    canvas.width = W * devicePixelRatio; canvas.height = H * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    cx = W * 0.64; cy = H * 0.5; orbitR = Math.min(W, H) * 0.3;
    nodes = SPOKES.map((s, i) => {
      const a = (i / SPOKES.length) * Math.PI * 2 - Math.PI / 2;
      return {baseAngle: a, angle: a, color: s.color, label: s.label, pulseT: Math.random()*Math.PI*2};
    });
  }

  function spawn(fx, fy, tx, ty, color) {
    particles.push({x:fx,y:fy,tx,ty,color,prog:0,speed:.003+Math.random()*.004,size:2+Math.random()*1.5});
  }

  function frame(ts) {
    ctx.clearRect(0, 0, W, H);
    t += 0.008;

    // orbit ring
    ctx.beginPath(); ctx.arc(cx, cy, orbitR, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    ctx.setLineDash([4,10]); ctx.stroke(); ctx.setLineDash([]);

    // hub glow
    const g = ctx.createRadialGradient(cx,cy,0,cx,cy,55);
    g.addColorStop(0,'rgba(240,180,41,.18)'); g.addColorStop(1,'transparent');
    ctx.beginPath(); ctx.arc(cx,cy,55,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy,14,0,Math.PI*2); ctx.fillStyle='rgba(240,180,41,.4)'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy,7,0,Math.PI*2); ctx.fillStyle='rgba(240,180,41,.9)'; ctx.fill();
    ctx.font='bold 7px "Space Grotesk",sans-serif'; ctx.fillStyle='#08080f';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('FH',cx,cy);

    nodes.forEach((n, i) => {
      n.angle = n.baseAngle + Math.sin(t*.3+i)*.035;
      n.x = cx + Math.cos(n.angle)*orbitR;
      n.y = cy + Math.sin(n.angle)*orbitR;

      // spoke
      const lg = ctx.createLinearGradient(cx,cy,n.x,n.y);
      lg.addColorStop(0, n.color+'0.35)'); lg.addColorStop(1, n.color+'0.08)');
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(n.x,n.y);
      ctx.strokeStyle=lg; ctx.lineWidth=1; ctx.stroke();

      // node
      n.pulseT += 0.018;
      const ps = 1 + Math.sin(n.pulseT)*.3;
      ctx.beginPath(); ctx.arc(n.x,n.y,10*ps,0,Math.PI*2);
      ctx.fillStyle=n.color+'0.07)'; ctx.fill();
      ctx.beginPath(); ctx.arc(n.x,n.y,8,0,Math.PI*2);
      ctx.fillStyle=n.color+'0.2)'; ctx.fill();
      ctx.beginPath(); ctx.arc(n.x,n.y,5,0,Math.PI*2);
      ctx.fillStyle=n.color+'0.75)'; ctx.fill();

      // label
      const ld = 20, lx = cx+Math.cos(n.angle)*(orbitR+ld), ly = cy+Math.sin(n.angle)*(orbitR+ld);
      ctx.font='500 10px "Inter",sans-serif'; ctx.fillStyle=n.color+'0.55)';
      ctx.textAlign = lx > cx ? 'left' : 'right'; ctx.textBaseline='middle';
      ctx.fillText(n.label, lx, ly);
    });

    // particles
    particles = particles.filter(p => p.prog < 1);
    particles.forEach(p => {
      p.prog = Math.min(1, p.prog + p.speed);
      const e = 1 - Math.pow(1-p.prog, 3);
      const px = p.x + (p.tx-p.x)*e, py = p.y + (p.ty-p.y)*e;
      ctx.beginPath(); ctx.arc(px,py,p.size*(1-p.prog*.5),0,Math.PI*2);
      ctx.fillStyle = p.color + (0.8*(1-p.prog)) + ')'; ctx.fill();
    });

    if (ts - lastSpawn > 700 && nodes.length && nodes[0].x) {
      lastSpawn = ts;
      const n = nodes[Math.floor(Math.random()*nodes.length)];
      Math.random() > .5 ? spawn(cx,cy,n.x,n.y,n.color) : spawn(n.x,n.y,cx,cy,n.color);
    }

    rafId = requestAnimationFrame(frame);
  }

  new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) { if (!rafId) rafId = requestAnimationFrame(frame); }
    else { cancelAnimationFrame(rafId); rafId = null; }
  }).observe(document.querySelector('.hero'));

  window.addEventListener('resize', () => {
    cancelAnimationFrame(rafId); rafId = null; resize(); rafId = requestAnimationFrame(frame);
  });

  resize();
})();
