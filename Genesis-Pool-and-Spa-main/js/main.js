/* ================================================
   GENESIS Pool and Spa — Main JS
   ================================================ */

(function () {
  'use strict';

  const header    = document.getElementById('header');
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('navLinks');

  // ── Sticky header on scroll ──────────────────
  function onScroll() {
    if (window.scrollY > 24) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── Mobile hamburger menu ────────────────────
  hamburger.addEventListener('click', function () {
    const isOpen = navLinks.classList.toggle('open');
    hamburger.classList.toggle('active', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  navLinks.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      navLinks.classList.remove('open');
      hamburger.classList.remove('active');
      document.body.style.overflow = '';
    });
  });

  // ── Active nav link on scroll ────────────────
  const sections   = document.querySelectorAll('section[id]');
  const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');

  const sectionObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        navAnchors.forEach(function (a) { a.classList.remove('active'); });
        const active = document.querySelector('.nav-links a[href="#' + entry.target.id + '"]');
        if (active) active.classList.add('active');
      }
    });
  }, { threshold: 0.35 });

  sections.forEach(function (s) { sectionObserver.observe(s); });

  // ── Scroll-in animations ─────────────────────
  const animEls = document.querySelectorAll(
    '.feature-card, .service-card, .testimonial-card, .about-content, .contact-info, .contact-form-wrap'
  );

  const animObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        animObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  animEls.forEach(function (el) {
    el.classList.add('fade-up');
    animObserver.observe(el);
  });

  // ── Contact form (show success message) ──────
  const form = document.getElementById('contactForm');
  const successMsg = document.getElementById('formSuccess');

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      successMsg.style.display = 'block';
      form.reset();
      setTimeout(function () {
        successMsg.style.display = 'none';
      }, 6000);
    });
  }

})();
