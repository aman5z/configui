document.addEventListener('site-rendered', () => {
  // ── Theme Toggle ──
  const html = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');
  const toggleIcon = document.getElementById('toggle-icon');
  const toggleLabel = document.getElementById('toggle-label');

  function setTheme(t) {
    html.setAttribute('data-theme', t);
    localStorage.setItem('portfolio-theme', t);
    if (t === 'dark') {
      toggleIcon.textContent = '☀️';
      toggleLabel.textContent = 'Light Mode';
    } else {
      toggleIcon.textContent = '🌙';
      toggleLabel.textContent = 'Dark Mode';
    }
  }
  function toggleTheme() {
    const current = html.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  }
  setTheme(html.getAttribute('data-theme') || 'dark');
  themeToggle.addEventListener('click', toggleTheme);

  const footerYear = document.getElementById('footer-year');
  if (footerYear) footerYear.textContent = new Date().getFullYear();

  // ── Lightbox ──
  const lb = document.getElementById('lb');
  const lbClose = document.getElementById('lb-close');
  const lbImg = document.getElementById('lb-img');
  let lastLightboxTrigger = null;

  function openLightbox(img) {
    lastLightboxTrigger = img;
    lbImg.src = img.src;
    lbImg.alt = img.alt;
    lb.classList.add('open');
    lbClose.focus();
  }
  function closeLightbox() {
    lb.classList.remove('open');
    if (lastLightboxTrigger) lastLightboxTrigger.focus();
  }

  document.querySelectorAll('.gallery img').forEach(img => {
    img.setAttribute('tabindex', '0');
    img.setAttribute('role', 'button');
    img.addEventListener('click', () => openLightbox(img));
    img.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(img);
      }
    });
  });
  lbClose.addEventListener('click', closeLightbox);
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
  });

  // ── Smooth scroll for cat-nav / anchor links ──
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

  // ── Hide/show social buttons on scroll ──
  const socialBtns = document.querySelectorAll('#social-icons .social-btn');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 80) {
      socialBtns.forEach(btn => btn.classList.add('social-hidden'));
    } else {
      socialBtns.forEach(btn => btn.classList.remove('social-hidden'));
    }
  });

  // ── Collapse / Expand Project Cards ──
  document.querySelectorAll('.project-card').forEach(card => {
    const firstEl = card.querySelector('.card-body > p, .card-body > ul');
    if (firstEl) {
      const preview = document.createElement('div');
      preview.className = 'card-preview';
      preview.textContent = firstEl.tagName === 'P'
        ? firstEl.textContent
        : Array.from(firstEl.querySelectorAll('li')).map(li => '• ' + li.textContent).join('  ');
      card.querySelector('.card-header').insertAdjacentElement('afterend', preview);
    }

    const chevron = document.createElement('div');
    chevron.className = 'card-chevron';
    chevron.innerHTML =
      '<span class="chev-lbl"></span>' +
      '<svg width="14" height="14" viewBox="0 0 14 14" fill="none">' +
      '<path d="M2 4.5L7 9.5L12 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';

    const body = card.querySelector('.card-body');
    if (body) body.insertAdjacentElement('beforebegin', chevron);
    else card.appendChild(chevron);

    function sync() {
      const collapsed = card.classList.contains('collapsed');
      chevron.querySelector('.chev-lbl').textContent = collapsed ? 'expand' : 'collapse';
      card.setAttribute('aria-expanded', String(!collapsed));
    }
    card.classList.add('collapsed');
    sync();

    card.addEventListener('click', e => {
      if (e.target.closest('a') || e.target.closest('iframe')) return;
      card.classList.toggle('collapsed');
      sync();
    });
  });
});
