/* =========================================================
   FENCE HOLE LLC — fencehole.org
   script.js: Nav scroll, hub canvas, scroll animations
   ========================================================= */

(function () {
  'use strict';

  /* ── Nav scroll state ── */
  const nav = document.getElementById('nav');
  function updateNav() {
    if (window.scrollY > 40) {
      nav.classList.add('is-scrolled');
    } else {
      nav.classList.remove('is-scrolled');
    }
  }
  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();

  /* ── Hub-and-spoke canvas animation ── */
  const canvas = document.getElementById('hubCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');

    const GOLD = 'rgba(240,180,41,';
    const BLUE = 'rgba(59,158,255,';

    // Spoke labels
    const SPOKES = [
      { label: 'Frances & Family',    color: GOLD },
      { label: 'Cool Cat Stuff',      color: BLUE },
      { label: 'The Good Meow',       color: 'rgba(52,211,153,' },
      { label: 'Vet Van Fleet',       color: 'rgba(34,211,238,' },
      { label: 'Vibecode Cat',        color: 'rgba(167,139,250,' },
      { label: 'User Generated Cats', color: 'rgba(251,113,133,' },
    ];

    let W, H, cx, cy, orbitR, spokeR;
    let nodes = [];
    let particles = [];
    let animFrameId;
    let t = 0;

    function resize() {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width  = W * window.devicePixelRatio;
      canvas.height = H * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      cx = W * 0.62;
      cy = H * 0.5;
      orbitR = Math.min(W, H) * 0.32;
      spokeR  = 8;
      buildNodes();
    }

    function buildNodes() {
      nodes = SPOKES.map((s, i) => {
        const angle = (i / SPOKES.length) * Math.PI * 2 - Math.PI / 2;
        return {
          angle,
          baseAngle: angle,
          color:  s.color,
          label:  s.label,
          pulseT: Math.random() * Math.PI * 2,
          orbitOffset: (Math.random() - 0.5) * 0.04,
        };
      });
    }

    function spawnParticle(fromX, fromY, toX, toY, color) {
      particles.push({
        x: fromX,
        y: fromY,
        tx: toX,
        ty: toY,
        color,
        prog: 0,
        speed: 0.004 + Math.random() * 0.004,
        size: 2 + Math.random() * 1.5,
      });
    }

    function drawHub() {
      // Outer glow ring
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
      grd.addColorStop(0, 'rgba(240,180,41,0.18)');
      grd.addColorStop(0.6, 'rgba(240,180,41,0.05)');
      grd.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(cx, cy, 60, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Center circle
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(240,180,41,0.15)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(240,180,41,0.4)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(240,180,41,0.9)';
      ctx.fill();

      // FH text
      ctx.font = 'bold 8px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#08080f';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FH', cx, cy);
    }

    function drawNodes() {
      nodes.forEach((n, i) => {
        // Slow drift
        n.angle = n.baseAngle + Math.sin(t * 0.3 + i) * 0.04;
        const nx = cx + Math.cos(n.angle) * orbitR;
        const ny = cy + Math.sin(n.angle) * orbitR;
        n.x = nx;
        n.y = ny;

        // Spoke line
        const lineGrd = ctx.createLinearGradient(cx, cy, nx, ny);
        lineGrd.addColorStop(0, n.color + '0.4)');
        lineGrd.addColorStop(1, n.color + '0.1)');
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = lineGrd;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Pulse ring
        n.pulseT += 0.02;
        const pulseScale = 1 + Math.sin(n.pulseT) * 0.35;
        ctx.beginPath();
        ctx.arc(nx, ny, spokeR * pulseScale, 0, Math.PI * 2);
        ctx.fillStyle = n.color + '0.08)';
        ctx.fill();

        // Node circle
        ctx.beginPath();
        ctx.arc(nx, ny, spokeR, 0, Math.PI * 2);
        ctx.fillStyle = n.color + '0.25)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(nx, ny, spokeR - 2, 0, Math.PI * 2);
        ctx.fillStyle = n.color + '0.7)';
        ctx.fill();

        // Label
        const labelDist = 22;
        const lx = cx + Math.cos(n.angle) * (orbitR + labelDist);
        const ly = cy + Math.sin(n.angle) * (orbitR + labelDist);
        ctx.font = '500 11px "Inter", sans-serif';
        ctx.fillStyle = n.color + '0.6)';
        ctx.textAlign = lx > cx ? 'left' : 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(n.label, lx, ly);
      });
    }

    function drawParticles() {
      particles = particles.filter(p => p.prog < 1);
      particles.forEach(p => {
        p.prog = Math.min(1, p.prog + p.speed);
        const ease = 1 - Math.pow(1 - p.prog, 3);
        const px = p.x + (p.tx - p.x) * ease;
        const py = p.y + (p.ty - p.y) * ease;
        ctx.beginPath();
        ctx.arc(px, py, p.size * (1 - p.prog * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = p.color + (0.8 * (1 - p.prog)) + ')';
        ctx.fill();
      });
    }

    // Orbit ring
    function drawOrbitRing() {
      ctx.beginPath();
      ctx.arc(cx, cy, orbitR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    let lastSpawn = 0;
    function tick(timestamp) {
      ctx.clearRect(0, 0, W, H);
      t += 0.01;

      drawOrbitRing();
      drawHub();
      drawNodes();
      drawParticles();

      // Spawn a particle every ~600ms
      if (timestamp - lastSpawn > 600 && nodes.length) {
        lastSpawn = timestamp;
        const n = nodes[Math.floor(Math.random() * nodes.length)];
        if (n.x !== undefined) {
          // 50/50: hub→spoke or spoke→hub
          if (Math.random() > 0.5) {
            spawnParticle(cx, cy, n.x, n.y, n.color);
          } else {
            spawnParticle(n.x, n.y, cx, cy, n.color);
          }
        }
      }

      animFrameId = requestAnimationFrame(tick);
    }

    // Only run canvas when section is visible
    const heroSection = document.querySelector('.hero');
    const canvasObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          if (!animFrameId) animFrameId = requestAnimationFrame(tick);
        } else {
          cancelAnimationFrame(animFrameId);
          animFrameId = null;
        }
      });
    });

    canvasObserver.observe(heroSection);

    window.addEventListener('resize', () => {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
      resize();
      animFrameId = requestAnimationFrame(tick);
    });

    resize();
  }

  /* ── Scroll-triggered reveal animations ── */
  function setupScrollReveal() {
    const targets = document.querySelectorAll(
      '.origin__item, .ecosystem__card, .factory__step, .factory__arrow'
    );

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Staggered delay for ecosystem cards
          const card = entry.target;
          const siblings = card.parentElement
            ? Array.from(card.parentElement.children).filter(c => c.classList.contains('ecosystem__card'))
            : [];
          const idx = siblings.indexOf(card);
          if (idx >= 0) {
            card.style.transitionDelay = (idx * 0.08) + 's';
          }
          card.classList.add('is-visible');
          revealObserver.unobserve(card);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px',
    });

    targets.forEach(el => revealObserver.observe(el));
  }

  setupScrollReveal();

  /* ── Smooth active section highlighting in nav ── */
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav__links a');

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
        });
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(s => sectionObserver.observe(s));

  /* ── Active nav link style injection ── */
  const style = document.createElement('style');
  style.textContent = `
    .nav__links a.is-active {
      color: var(--gold) !important;
    }
  `;
  document.head.appendChild(style);

})();
