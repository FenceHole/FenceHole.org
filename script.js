/* =============================================
   FENCE HOLE LLC — fencehole.org
   Main JavaScript
   ============================================= */

(function () {
  'use strict';

  /* ---- Navigation scroll state ---- */
  const nav = document.getElementById('main-nav');
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');

  function handleNavScroll() {
    if (window.scrollY > 20) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', handleNavScroll, { passive: true });
  handleNavScroll();

  /* ---- Mobile nav toggle ---- */
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      const isOpen = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
      navToggle.querySelectorAll('span').forEach(function (s, i) {
        if (isOpen) {
          if (i === 0) s.style.transform = 'translateY(7px) rotate(45deg)';
          if (i === 1) s.style.opacity = '0';
          if (i === 2) s.style.transform = 'translateY(-7px) rotate(-45deg)';
        } else {
          s.style.transform = '';
          s.style.opacity = '';
        }
      });
    });

    navLinks.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.querySelectorAll('span').forEach(function (s) {
          s.style.transform = '';
          s.style.opacity = '';
        });
      });
    });
  }

  /* ---- Intersection Observer for reveal animations ---- */
  var revealObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll(
    '.reveal, .timeline-item, .factory-step'
  ).forEach(function (el) {
    revealObserver.observe(el);
  });

  /* ---- Hub-and-Spoke SVG lines ---- */
  function drawHubLines() {
    var svg = document.getElementById('hub-svg');
    if (!svg) return;

    var center = document.getElementById('hub-center');
    var spokes = document.querySelectorAll('.hub-spoke');
    if (!center || !spokes.length) return;

    var svgRect    = svg.getBoundingClientRect();
    var centerRect = center.getBoundingClientRect();

    var cx = centerRect.left + centerRect.width  / 2 - svgRect.left;
    var cy = centerRect.top  + centerRect.height / 2 - svgRect.top;

    // Clear existing lines
    svg.innerHTML = '';

    // Defs for gradient
    var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    spokes.forEach(function (spoke, idx) {
      var spokeRect = spoke.getBoundingClientRect();
      var sx = spokeRect.left + spokeRect.width  / 2 - svgRect.left;
      var sy = spokeRect.top  + spokeRect.height / 2 - svgRect.top;
      var color = getComputedStyle(spoke).getPropertyValue('--spoke-color').trim() || '#f5c842';

      var gradId = 'grad-' + idx;
      var grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      grad.setAttribute('id', gradId);
      grad.setAttribute('x1', String(cx)); grad.setAttribute('y1', String(cy));
      grad.setAttribute('x2', String(sx)); grad.setAttribute('y2', String(sy));
      grad.setAttribute('gradientUnits', 'userSpaceOnUse');
      var stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute('stop-color', '#f5c842');
      stop1.setAttribute('stop-opacity', '0.7');
      var stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop2.setAttribute('offset', '100%');
      stop2.setAttribute('stop-color', color);
      stop2.setAttribute('stop-opacity', '0.4');
      grad.appendChild(stop1);
      grad.appendChild(stop2);
      defs.appendChild(grad);

      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(cx)); line.setAttribute('y1', String(cy));
      line.setAttribute('x2', String(sx)); line.setAttribute('y2', String(sy));
      line.setAttribute('stroke', 'url(#' + gradId + ')');
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('stroke-dasharray', '5 4');
      svg.appendChild(line);
    });

    svg.insertBefore(defs, svg.firstChild);
  }

  // Wait for layout, then draw
  window.addEventListener('load', function () {
    drawHubLines();
  });
  window.addEventListener('resize', function () {
    drawHubLines();
  });

  /* ---- Animated counter for stat numbers ---- */
  function animateCounter(el) {
    var raw    = el.getAttribute('data-count');
    var suffix = el.getAttribute('data-suffix') || '';
    if (!raw) return;

    var target   = parseFloat(raw);
    var duration = 1800;
    var start    = null;

    function step(timestamp) {
      if (!start) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      var eased    = 1 - Math.pow(1 - progress, 3);
      var current  = target * eased;

      if (Number.isInteger(target)) {
        el.textContent = Math.floor(current).toLocaleString() + suffix;
      } else {
        el.textContent = current.toFixed(1) + suffix;
      }

      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var counterObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  document.querySelectorAll('[data-count]').forEach(function (el) {
    counterObserver.observe(el);
  });

  /* ---- Smooth scroll for anchor links ---- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        var top = target.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  });

}());
