/* ================================================
   GENESIS Pool and Spa — Main JS
   ================================================ */

// Google Apps Script Web App URL that logs form submissions to the
// Booking Requests sheet. Update this one line once the script is deployed.
window.APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyc4T3oXQhQ283xWYTx9Li9FKjl7qNxvMVkdR_GI7Uh6EvFTEuIPdl39B4jOZP5bNOr/exec';

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

  // ── Pre-select a service on the contact form ──
  function applyServicePreselect(value) {
    const serviceSelect = document.getElementById('service');
    if (serviceSelect && value) {
      serviceSelect.value = value;
    }
  }

  // Same-page click (button/link with data-preselect-service, e.g. the
  // "Sign Up for the Bundle" banner button or the Tile Cleaning card link).
  document.querySelectorAll('[data-preselect-service]').forEach(function (link) {
    link.addEventListener('click', function () {
      applyServicePreselect(link.getAttribute('data-preselect-service'));
    });
  });

  // Cross-page link (e.g. schedule.html's "signup" link ->
  // index.html?service=bundle#contact) — read it from the URL on load.
  applyServicePreselect(new URLSearchParams(window.location.search).get('service'));

  // ── Contact form (show success message) ──────
  const form = document.getElementById('contactForm');
  const successMsg = document.getElementById('formSuccess');

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (window.APPS_SCRIPT_URL && window.APPS_SCRIPT_URL.indexOf('REPLACE_WITH') === -1) {
        const serviceSelect = document.getElementById('service');
        const serviceLabel = serviceSelect.selectedIndex >= 0
          ? serviceSelect.options[serviceSelect.selectedIndex].text
          : '';
        const payload = new URLSearchParams();
        payload.append('Form Source', 'Contact Form');
        payload.append('First Name', document.getElementById('firstName').value);
        payload.append('Last Name', document.getElementById('lastName').value);
        payload.append('Email', document.getElementById('email').value);
        payload.append('Phone', document.getElementById('phone').value);
        payload.append('Service Interested In', serviceLabel);
        payload.append('Notes', document.getElementById('message').value);
        fetch(window.APPS_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: payload });
      }

      successMsg.style.display = 'block';
      form.reset();
      setTimeout(function () {
        successMsg.style.display = 'none';
      }, 6000);
    });
  }

})();
