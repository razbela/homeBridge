// Mobile navigation toggle
const menuToggle = document.querySelector('.menu-toggle');
const nav = document.getElementById('main-nav');

menuToggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
});

nav.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') {
    nav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }
});

// Lead form: no backend yet, so open the visitor's email client with the details filled in
const CONTACT_EMAIL = 'dafna.malikzvi@gmail.com';
const form = document.getElementById('lead-form');
const status = document.getElementById('form-status');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const name = data.get('name').trim();
  const body = [
    `Name: ${name}`,
    `Email: ${data.get('email').trim()}`,
    `Phone: ${data.get('phone').trim() || '-'}`,
    '',
    data.get('message').trim(),
  ].join('\n');

  const subject = `HomeBridge inquiry from ${name}`;
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  status.textContent = "Thank you! Your email app should open with your message ready to send.";
});

document.getElementById('year').textContent = new Date().getFullYear();

// Entrance animations. Content stays visible if GSAP fails to load or the visitor prefers reduced motion.
if (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  gsap.registerPlugin(ScrollTrigger);

  gsap.from('.chapter-intro > *', { y: 24, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: 0.1, delay: 0.15 });
  gsap.from('.hud', { x: 24, opacity: 0, duration: 1.1, ease: 'power3.out', delay: 0.6 });

  document.querySelectorAll('.split-heading, .why-grid > *, .contact-grid > *').forEach((el) => {
    gsap.from(el, {
      y: 32,
      opacity: 0,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
  });

  gsap.from('.service-card', {
    y: 24,
    opacity: 0,
    duration: 0.8,
    ease: 'power3.out',
    stagger: 0.07,
    scrollTrigger: { trigger: '.service-grid', start: 'top 85%', once: true },
  });

  gsap.from('.stats li', {
    x: 24,
    opacity: 0,
    duration: 0.8,
    ease: 'power3.out',
    stagger: 0.1,
    scrollTrigger: { trigger: '.stats', start: 'top 85%', once: true },
  });
}
