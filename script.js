// Projects data
const projects = [
  {
    title: 'حملة إعلانية — منتج تجميل',
    desc: 'إعلان تلفزيوني ٣٠ ثانية مع تصحيح ألوان سينمائي.',
    cat: 'ads',
    tag: 'إعلان',
    badge: '00:30',
    thumb: 'bg-grad-1'
  },
  {
    title: 'فيلم قصير — الطريق',
    desc: 'فيلم قصير ٨ دقائق، مونتاج كامل وتصميم صوتي.',
    cat: 'short',
    tag: 'فيلم قصير',
    badge: '08:00',
    thumb: 'bg-grad-6'
  },
  {
    title: 'Reels — كوفي شوب',
    desc: 'سلسلة ريلز لحملة افتتاح فرع جديد.',
    cat: 'social',
    tag: 'Instagram',
    badge: '00:45',
    thumb: 'bg-grad-3'
  },
  {
    title: 'لوجو أنميشن — استوديو تصوير',
    desc: 'موشن جرافيك احترافي لهوية بصرية جديدة.',
    cat: 'motion',
    tag: 'موشن',
    badge: '00:12',
    thumb: 'bg-grad-5'
  },
  {
    title: 'فيديو يوتيوب — بودكاست',
    desc: 'حلقة بودكاست بمونتاج ديناميكي وعناوين.',
    cat: 'social',
    tag: 'YouTube',
    badge: '42:15',
    thumb: 'bg-grad-4'
  },
  {
    title: 'إعلان مطعم — قائمة جديدة',
    desc: 'إعلان سوشيال ميديا بتصوير طعام وألوان دافئة.',
    cat: 'ads',
    tag: 'إعلان',
    badge: '00:20',
    thumb: 'bg-grad-2'
  },
  {
    title: 'Title Sequence — مسلسل ويب',
    desc: 'تصميم عناوين افتتاحية سينمائية.',
    cat: 'motion',
    tag: 'موشن',
    badge: '01:10',
    thumb: 'bg-grad-5'
  },
  {
    title: 'فيلم وثائقي قصير',
    desc: 'قصة ملهمة عن حرفي مصري، مونتاج وتصحيح ألوان.',
    cat: 'short',
    tag: 'وثائقي',
    badge: '12:30',
    thumb: 'bg-grad-6'
  },
  {
    title: 'تيك توك — ماركة ملابس',
    desc: 'فيديوهات ترويجية بإيقاع سريع للسوشيال ميديا.',
    cat: 'social',
    tag: 'TikTok',
    badge: '00:30',
    thumb: 'bg-grad-1'
  }
];

// Render gallery
function renderGallery(filter = 'all') {
  const gallery = document.getElementById('gallery');
  const filtered = filter === 'all' ? projects : projects.filter(p => p.cat === filter);
  gallery.innerHTML = filtered.map(p => `
    <article class="card reveal" data-cat="${p.cat}">
      <div class="thumb ${p.thumb}">
        <span class="badge">${p.tag} · ${p.badge}</span>
        <span class="play-icon">▶</span>
      </div>
      <div class="card-body">
        <h3>${p.title}</h3>
        <p>${p.desc}</p>
      </div>
    </article>
  `).join('');
  // trigger reveal
  requestAnimationFrame(() => {
    gallery.querySelectorAll('.reveal').forEach((el, i) => {
      setTimeout(() => el.classList.add('show'), i * 60);
    });
  });
}

// Filters
document.getElementById('filters').addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderGallery(btn.dataset.filter);
});

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') navLinks.classList.remove('open');
});

// Contact form
document.getElementById('contactForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const note = document.getElementById('formNote');
  const form = e.currentTarget;
  if (!form.checkValidity()) {
    note.textContent = 'من فضلك املأ كل الحقول المطلوبة.';
    note.className = 'form-note error';
    return;
  }
  note.textContent = 'تم إرسال رسالتك بنجاح — هرجع لك في أقرب وقت ✦';
  note.className = 'form-note success';
  form.reset();
});

// Year
document.getElementById('year').textContent = new Date().getFullYear();

// Reveal on scroll
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('show');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.section, .hero-text, .hero-visual, .mini-card, .service').forEach(el => {
  el.classList.add('reveal');
  io.observe(el);
});

// Initial render
renderGallery('all');
