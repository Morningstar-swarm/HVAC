/* ==========================================================================
   Best Comfort HVAC — Joliet Office
   Hand-written vanilla JavaScript. No libraries.
   Modules: nav · drawer · accordions · slider · tabs · gallery · lightbox
            filters · forms · reveal · sticky header · year stamp
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- 1. HEADER */
  /* Sticky bar: shadow once the page has moved, and a compact state that
     hands vertical space back to the content on short viewports. */
  function initHeader() {
    var header = $('.site-header');
    if (!header) return;
    var ticking = false;
    var apply = function () {
      header.classList.toggle('is-stuck', window.scrollY > 6);
      header.classList.toggle('is-compact', window.scrollY > 260);
      ticking = false;
    };
    apply();
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(apply); }
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ 2. NAV */
  /* Desktop dropdowns: click toggles, pointer hover opens with a short intent
     delay, Escape closes, arrow keys walk in and out of the menu. Submenus are
     hidden in the markup so nothing flashes open before the script runs.      */
  function initNav() {
    var items = $$('.nav__list > li');
    if (!items.length) return;

    var hoverTimer = null;
    // Evaluated per event, not once at load, so a mouse plugged into a tablet or a
    // window widened past the breakpoint starts working without a reload.
    var canHover = function () {
      return window.innerWidth > 1140 &&
        (window.matchMedia('(hover:hover)').matches || window.matchMedia('(any-hover:hover)').matches);
    };

    var setState = function (li, open) {
      var t = $('.nav__toggle', li), p = $('.nav__sub', li);
      if (!t || !p) return;
      t.setAttribute('aria-expanded', open ? 'true' : 'false');
      p.hidden = !open;
    };
    var closeAll = function (except) {
      items.forEach(function (li) { if (li !== except) setState(li, false); });
    };
    var openOnly = function (li) {
      if (li.getAttribute('data-hovered') === 'true') return;
      li.setAttribute('data-hovered', 'true');
      closeAll(li);
      setState(li, true);
    };
    var closeOnly = function (li) {
      li.removeAttribute('data-hovered');
      setState(li, false);
    };

    items.forEach(function (li) {
      var toggle = $('.nav__toggle', li);
      var panel  = $('.nav__sub', li);
      if (!toggle || !panel) return;

      toggle.addEventListener('click', function () {
        var open = toggle.getAttribute('aria-expanded') === 'true';
        closeAll(li);
        li.removeAttribute('data-hovered');
        setState(li, !open);
      });

      li.addEventListener('mouseenter', function () {
        if (!canHover()) return;
        window.clearTimeout(hoverTimer);
        hoverTimer = window.setTimeout(function () { openOnly(li); }, 110);
      });
      li.addEventListener('mouseleave', function () {
        window.clearTimeout(hoverTimer);
        if (!canHover()) return;
        hoverTimer = window.setTimeout(function () { closeOnly(li); }, 160);
      });
      // keyboard users on a touch-reporting device can still reach the menu
      toggle.addEventListener('focus', function () {
        if (!window.matchMedia('(hover:hover)').matches) return;
      });

      li.addEventListener('keydown', function (e) {
        if (e.target !== toggle) return;   // panel keys are handled below
        var open = toggle.getAttribute('aria-expanded') === 'true';
        if (e.key === 'Escape' && open) {
          e.preventDefault(); setState(li, false); toggle.focus();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!open) { closeAll(li); setState(li, true); }
          var first = $('a', panel); if (first) first.focus();
        } else if (e.key === 'ArrowUp' && open) {
          e.preventDefault(); setState(li, false); toggle.focus();
        }
      });

      panel.addEventListener('keydown', function (e) {
        e.stopPropagation();
        var links = $$('a', panel);
        var i = links.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); (links[i + 1] || links[0]).focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); (links[i - 1] || toggle).focus(); }
        else if (e.key === 'Tab' && i === links.length - 1 && !e.shiftKey) { setState(li, false); }
        else if (e.key === 'Escape') { e.preventDefault(); setState(li, false); toggle.focus(); }
      });
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav__list')) closeAll(null);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(null); });
    window.addEventListener('resize', function () { closeAll(null); });
  }

  /* --------------------------------------------------------------- 3. DRAWER */
  function initDrawer() {
    var openBtn  = $('[data-drawer-open]');
    var drawer   = $('[data-drawer]');
    var scrim    = $('[data-drawer-scrim]');
    var closeBtn = $('[data-drawer-close]');
    if (!openBtn || !drawer) return;

    var lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      drawer.hidden = false;
      if (scrim) scrim.hidden = false;
      document.body.classList.add('nav-open');
      openBtn.setAttribute('aria-expanded', 'true');
      var first = $('[data-drawer-close]', drawer);
      if (first) first.focus();
    }
    function close() {
      drawer.hidden = true;
      if (scrim) scrim.hidden = true;
      document.body.classList.remove('nav-open');
      openBtn.setAttribute('aria-expanded', 'false');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (scrim) scrim.addEventListener('click', close);
    // following a link inside the drawer should close it before navigating
    $$('a[href]', drawer).forEach(function (a) {
      a.addEventListener('click', function () {
        if (a.getAttribute('href').charAt(0) !== '#') close();
      });
    });
    // keep the page behind the drawer from scrolling on touch devices too
    window.addEventListener('resize', function () {
      if (!drawer.hidden && window.innerWidth > 1140) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !drawer.hidden) close();
    });

    // Focus trap
    drawer.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = $$('a[href], button:not([disabled]), input, select, textarea', drawer)
        .filter(function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // Mobile submenus
    $$('.mnav__toggle', drawer).forEach(function (t) {
      var sub = document.getElementById(t.getAttribute('aria-controls'));
      if (!sub) return;
      t.addEventListener('click', function () {
        var open = t.getAttribute('aria-expanded') === 'true';
        t.setAttribute('aria-expanded', open ? 'false' : 'true');
        sub.hidden = open;
      });
    });
  }

  /* ----------------------------------------------------------- 4. ACCORDIONS */
  function initAccordions() {
    $$('[data-accordion]').forEach(function (group) {
      var single    = group.hasAttribute('data-single') && group.getAttribute('data-single') !== 'false';
      var collapsible = group.getAttribute('data-collapsible') !== 'false';
      var buttons   = $$('[data-acc-toggle]', group);

      buttons.forEach(function (btn) {
        var panel = document.getElementById(btn.getAttribute('aria-controls'));
        if (!panel) return;

        // Normalise initial state from the markup
        var startOpen = btn.getAttribute('aria-expanded') === 'true' && panel.hasAttribute('data-open');
        btn.setAttribute('aria-expanded', startOpen ? 'true' : 'false');
        panel.hidden = !startOpen;

        btn.addEventListener('click', function () {
          var isOpen = btn.getAttribute('aria-expanded') === 'true';
          if (isOpen && !collapsible) return;

          if (single) {
            buttons.forEach(function (other) {
              if (other === btn) return;
              var op = document.getElementById(other.getAttribute('aria-controls'));
              other.setAttribute('aria-expanded', 'false');
              if (op) { op.hidden = true; op.classList.remove('is-animating'); }
            });
          }

          btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
          var item = btn.closest('.accordion__item');
          if (item) item.classList.toggle('is-open', !isOpen);

          if (isOpen) {
            panel.hidden = true;
            panel.classList.remove('is-animating');
          } else {
            panel.hidden = false;
            panel.classList.add('is-animating');
            if (!reduceMotion) {
              window.setTimeout(function () { panel.classList.remove('is-animating'); }, 320);
            }
          }
        });

        if (startOpen) {
          var it = btn.closest('.accordion__item');
          if (it) it.classList.add('is-open');
        }
      });
    });
  }

  function openFromHash() {
    if (!location.hash) return;
    var id = location.hash.slice(1);
    var btn = document.querySelector('[data-acc-toggle][aria-controls="' + id + '"]');
    if (btn && btn.getAttribute('aria-expanded') !== 'true') {
      btn.click();
      var y = btn.getBoundingClientRect().top + window.scrollY - 130;
      window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }

  /* --------------------------------------------------------------- 5. SLIDER */
  function initSlider() {
    $$('[data-slider]').forEach(function (root) {
      var slides = $$('[data-slide]', root);
      var dots   = $$('[data-slide-to]', root);
      if (slides.length < 2) {
        if (slides.length) slides[0].classList.add('is-active');
        return;
      }
      var index = 0, timer = null, DELAY = 6500;

      function show(i, focus) {
        index = (i + slides.length) % slides.length;
        slides.forEach(function (s, n) {
          s.classList.toggle('is-active', n === index);
          s.setAttribute('aria-hidden', n === index ? 'false' : 'true');
        });
        dots.forEach(function (d, n) {
          d.setAttribute('aria-current', n === index ? 'true' : 'false');
        });
        if (focus) dots[index].focus();
      }
      function start() {
        if (reduceMotion) return;
        stop();
        timer = window.setInterval(function () { show(index + 1); }, DELAY);
      }
      function stop() { if (timer) window.clearInterval(timer); timer = null; }

      dots.forEach(function (d, n) {
        d.addEventListener('click', function () { show(n, true); start(); });
      });
      // Buttons rendered as tabs: arrow keys move between them
      var dotBox = dots.length ? dots[0].parentNode : null;
      if (dotBox) {
        dotBox.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1, true); start(); }
          if (e.key === 'ArrowLeft')  { e.preventDefault(); show(index - 1, true); start(); }
        });
      }
      root.addEventListener('mouseenter', stop);
      root.addEventListener('mouseleave', start);
      root.addEventListener('focusin', stop);
      root.addEventListener('focusout', start);
      document.addEventListener('visibilitychange', function () {
        document.hidden ? stop() : start();
      });
      // Touch swipe
      var x0 = null;
      root.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; stop(); }, { passive: true });
      root.addEventListener('touchend', function (e) {
        if (x0 === null) return;
        var dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 45) show(index + (dx < 0 ? 1 : -1));
        x0 = null; start();
      }, { passive: true });

      show(0);
      start();
    });
  }

  /* ----------------------------------------------------------------- 6. TABS */
  function initTabs() {
    $$('[data-tabs]').forEach(function (root) {
      var tabs   = $$('[role="tab"]', root);
      var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });

      function select(i, focus) {
        tabs.forEach(function (t, n) {
          var on = n === i;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.setAttribute('tabindex', on ? '0' : '-1');
        });
        panels.forEach(function (p, n) { if (p) p.hidden = n !== i; });
        if (focus) tabs[i].focus();
      }
      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { select(i); });
        t.addEventListener('keydown', function (e) {
          var k = e.key, n = tabs.length, next = null;
          if (k === 'ArrowRight') next = (i + 1) % n;
          else if (k === 'ArrowLeft') next = (i - 1 + n) % n;
          else if (k === 'Home') next = 0;
          else if (k === 'End') next = n - 1;
          if (next !== null) { e.preventDefault(); select(next, true); }
        });
      });
      select(0);
    });
  }

  /* ------------------------------------------------------- 7. PRODUCT GALLERY */
  function initGallery() {
    $$('[data-gallery]').forEach(function (root) {
      var mainImg  = $('#galleryMain', root);
      var phSlot   = $('#galleryMainPh', root);
      var caption  = $('#galleryCaption', root);
      var counter  = $('#galleryCounter', root);
      var tag      = $('#galleryTag', root);
      var zoomBtn  = $('#galleryZoom', root);
      var thumbs   = $$('[data-thumb]', root);
      if (!thumbs.length) return;
      var current  = 0, lastFocus = null;

      function render(i) {
        var t = thumbs[i];
        if (!t) return;
        current = i;
        var src = t.getAttribute('data-src');
        var isReal = t.getAttribute('data-placeholder') !== 'true';

        if (isReal && src && mainImg) {
          mainImg.src = src;
          mainImg.alt = t.getAttribute('data-alt') || '';
          mainImg.hidden = false;
          if (phSlot) phSlot.hidden = true;
        } else {
          if (mainImg) { mainImg.hidden = true; mainImg.removeAttribute('src'); }
          if (phSlot) {
            phSlot.hidden = false;
            var pt = phSlot.querySelector('[data-ph-title]');
            var pb = phSlot.querySelector('[data-ph-body]');
            if (pt) pt.textContent = t.getAttribute('data-ph-title') || 'Photo coming soon';
            if (pb) pb.textContent = t.getAttribute('data-ph-body') || 'Drop your product photo in this slot.';
          }
        }
        if (caption) {
          var cap = t.getAttribute('data-caption') || '';
          caption.textContent = cap;
          caption.hidden = !cap;
        }
        if (counter) {
          counter.textContent = (i + 1) + ' / ' + thumbs.length;
          counter.hidden = false;
        }
        if (tag) tag.textContent = t.getAttribute('data-tag') || '';
        if (zoomBtn) zoomBtn.disabled = !isReal;

        thumbs.forEach(function (x, n) {
          x.setAttribute('aria-selected', n === i ? 'true' : 'false');
          x.classList.toggle('is-active', n === i);
        });
      }

      thumbs.forEach(function (t, i) {
        t.addEventListener('click', function () { render(i); });
        t.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); render(i); }
        });
      });

      /* ---- lightbox ---- */
      function openBox() {
        var t = thumbs[current];
        if (!t || t.getAttribute('data-placeholder') === 'true') return;
        lastFocus = document.activeElement;
        var box = document.createElement('div');
        box.className = 'lightbox';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('aria-label', 'Product photo, enlarged');
        box.innerHTML =
          '<button class="lightbox__close" type="button" aria-label="Close enlarged photo">' +
            '<svg class="ico" aria-hidden="true"><use href="#i-x"></use></svg></button>' +
          '<div class="lightbox__inner">' +
            '<img src="' + t.getAttribute('data-src') + '" alt="' + (t.getAttribute('data-alt') || '') + '">' +
            '<div class="lightbox__cap">' + (t.getAttribute('data-caption') || '') +
              '<small>Best Comfort HVAC · Joliet, IL</small></div>' +
            '<div class="lightbox__nav">' +
              '<button type="button" data-box-prev>Previous</button>' +
              '<button type="button" data-box-next>Next</button>' +
            '</div></div>';
        document.body.appendChild(box);
        document.body.style.overflow = 'hidden';

        function close() {
          box.remove();
          document.body.style.overflow = '';
          if (lastFocus && lastFocus.focus) lastFocus.focus();
        }
        function step(d) {
          var n = current, guard = 0;
          do { n = (n + d + thumbs.length) % thumbs.length; guard++; }
          while (thumbs[n].getAttribute('data-placeholder') === 'true' && guard < thumbs.length);
          render(n);
          var img = box.querySelector('img');
          img.src = thumbs[n].getAttribute('data-src');
          img.alt = thumbs[n].getAttribute('data-alt') || '';
          var cap = box.querySelector('.lightbox__cap');
          cap.innerHTML = (thumbs[n].getAttribute('data-caption') || '') +
            '<small>Best Comfort HVAC · Joliet, IL</small>';
        }
        box.querySelector('.lightbox__close').addEventListener('click', close);
        box.querySelector('[data-box-prev]').addEventListener('click', function () { step(-1); });
        box.querySelector('[data-box-next]').addEventListener('click', function () { step(1); });
        box.addEventListener('click', function (e) { if (e.target === box) close(); });
        document.addEventListener('keydown', function esc(e) {
          if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
          if (e.key === 'ArrowRight') step(1);
          if (e.key === 'ArrowLeft') step(-1);
        });
        box.querySelector('.lightbox__close').focus();
      }
      if (zoomBtn) zoomBtn.addEventListener('click', openBox);
      if (mainImg) mainImg.addEventListener('click', openBox);

      render(0);
    });
  }

  /* --------------------------------------------------------- 8. GRID FILTERS */
  function initFilters() {
    var bars = $$('[data-filter-bar]');
    bars.forEach(function (bar) {
      var target = document.querySelector(bar.getAttribute('data-filter-bar'));
      if (!target) return;
      var items = $$('[data-tags]', target);
      var count = document.querySelector(bar.getAttribute('data-filter-count') || '');
      var chips = $$('[data-filter]', bar);

      function apply(tag) {
        var shown = 0;
        items.forEach(function (el) {
          var tags = (el.getAttribute('data-tags') || '').split(/\s+/);
          var on = tag === 'all' || tags.indexOf(tag) > -1;
          el.hidden = !on;
          if (on) shown++;
        });
        if (count) count.textContent = shown + (shown === 1 ? ' item' : ' items');
      }
      chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
          chips.forEach(function (c) {
            c.classList.toggle('is-active', c === chip);
            c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
          });
          apply(chip.getAttribute('data-filter'));
        });
      });
      var active = chips.filter(function (c) { return c.classList.contains('is-active'); })[0];
      apply(active ? active.getAttribute('data-filter') : 'all');
    });
  }

  /* ---------------------------------------------------------- 9. LIGHTBOX GAL */
  function initPhotoGrid() {
    var grid = document.querySelector('[data-photo-grid]');
    if (!grid) return;
    var items = $$('[data-photo]', grid);

    items.forEach(function (item, i) {
      item.addEventListener('click', function () {
        var lastFocus = document.activeElement;
        var box = document.createElement('div');
        box.className = 'lightbox';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('aria-label', item.getAttribute('data-caption') || 'Project photo');
        box.innerHTML =
          '<button class="lightbox__close" type="button" aria-label="Close photo">' +
            '<svg class="ico" aria-hidden="true"><use href="#i-x"></use></svg></button>' +
          '<div class="lightbox__inner">' +
            '<img src="' + item.getAttribute('data-src') + '" alt="' + (item.getAttribute('data-alt') || '') + '">' +
            '<div class="lightbox__cap">' + (item.getAttribute('data-caption') || '') +
              '<small>' + (item.getAttribute('data-sub') || 'Best Comfort HVAC · Joliet, IL') + '</small></div>' +
            '<div class="lightbox__nav">' +
              '<button type="button" data-box-prev>Previous</button>' +
              '<button type="button" data-box-next>Next</button></div></div>';
        document.body.appendChild(box);
        document.body.style.overflow = 'hidden';

        var at = i;
        function fill() {
          var el = items[at];
          var img = box.querySelector('img');
          img.src = el.getAttribute('data-src');
          img.alt = el.getAttribute('data-alt') || '';
          var cap = box.querySelector('.lightbox__cap');
          cap.innerHTML = (el.getAttribute('data-caption') || '') +
            '<small>' + (el.getAttribute('data-sub') || 'Best Comfort HVAC · Joliet, IL') + '</small>';
        }
        function close() {
          box.remove(); document.body.style.overflow = '';
          document.removeEventListener('keydown', key);
          if (lastFocus && lastFocus.focus) lastFocus.focus();
        }
        function key(e) {
          if (e.key === 'Escape') close();
          if (e.key === 'ArrowRight') { at = (at + 1) % items.length; fill(); }
          if (e.key === 'ArrowLeft')  { at = (at - 1 + items.length) % items.length; fill(); }
        }
        box.querySelector('.lightbox__close').addEventListener('click', close);
        box.querySelector('[data-box-prev]').addEventListener('click', function () { at = (at - 1 + items.length) % items.length; fill(); });
        box.querySelector('[data-box-next]').addEventListener('click', function () { at = (at + 1) % items.length; fill(); });
        box.addEventListener('click', function (e) { if (e.target === box) close(); });
        document.addEventListener('keydown', key);
        box.querySelector('.lightbox__close').focus();
      });
    });
  }

  /* ---------------------------------------------------------------- 10. FORMS */
  function initForms() {
    $$('[data-form]').forEach(function (form) {
      var success = document.getElementById(form.getAttribute('data-success'));

      function setError(field, msg) {
        var wrap = field.closest('.field') || field.parentNode;
        wrap.classList.add('field--error');
        var out = wrap.querySelector('.field__err');
        if (out) out.textContent = msg;
        field.setAttribute('aria-invalid', 'true');
      }
      function clearError(field) {
        var wrap = field.closest('.field') || field.parentNode;
        wrap.classList.remove('field--error');
        field.removeAttribute('aria-invalid');
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var ok = true, firstBad = null;

        $$('input, select, textarea', form).forEach(function (f) {
          if (f.type === 'hidden' || f.disabled) return;
          clearError(f);

          if (f.required && !String(f.value).trim()) {
            setError(f, 'This field is required.'); ok = false; firstBad = firstBad || f; return;
          }
          if (f.type === 'email' && f.value && !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(f.value)) {
            setError(f, 'Please enter a valid email address (name@example.com).'); ok = false; firstBad = firstBad || f; return;
          }
          if (f.type === 'tel' && f.value) {
            var digits = f.value.replace(/[^0-9]/g, '');
            if (digits.length < 10) { setError(f, 'Please enter a phone number with at least 10 digits.'); ok = false; firstBad = firstBad || f; return; }
          }
          if (f.type === 'checkbox' && f.required && !f.checked) {
            setError(f, 'Please tick this box so we can contact you.'); ok = false; firstBad = firstBad || f;
          }
        });

        if (!ok) {
          if (firstBad) firstBad.focus();
          return;
        }

        var name = (form.querySelector('[name="name"]') || {}).value || 'there';
        if (success) {
          success.innerHTML = '<strong>Thanks, ' + name.trim().split(' ')[0] +
            ' — your request is on its way.</strong> A Best Comfort dispatcher will call you back within one ' +
            'business hour during office hours. Need help right now? Call ' +
            '<a href="tel:+18155560660">815-556-0660</a> — the line is answered 24/7.';
          success.classList.add('is-shown');
          success.setAttribute('role', 'status');
          success.focus();
        }
        form.reset();
      });

      $$('input, select, textarea', form).forEach(function (f) {
        f.addEventListener('input', function () { if (f.getAttribute('aria-invalid')) clearError(f); });
      });
    });
  }

  /* --------------------------------------------------------------- 11. REVEAL */
  function initReveal() {
    var els = $$('[data-reveal]');
    if (!els.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    els.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i % 4, 3) * 60 + 'ms';
      io.observe(el);
    });
  }

  /* --------------------------------------------------------------- 12. TO TOP */
  function initToTop() {
    var btn = $('[data-to-top]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* --------------------------------------------------- 13. CITY / TOWN SEARCH */
  function initCitySearch() {
    var input = document.querySelector('[data-city-search]');
    if (!input) return;
    var lists = $$('[data-city-list]');
    var counter = document.querySelector('[data-city-count]');
    var all = [];
    lists.forEach(function (ul) {
      $$('li', ul).forEach(function (li) { all.push(li); });
    });
    var total = all.length;

    function run() {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      var perList = lists.map(function () { return 0; });
      all.forEach(function (li) {
        var hit = !q || li.textContent.toLowerCase().indexOf(q) > -1;
        li.hidden = !hit;
        if (hit) {
          shown++;
          var i = lists.indexOf(li.parentNode);
          if (i > -1) perList[i]++;
        }
      });
      // hide an accordion group whose towns are all filtered out
      lists.forEach(function (ul, i) {
        var item = ul.closest('.accordion__item');
        if (item) item.hidden = perList[i] === 0;
        var label = item && item.querySelector('.accordion__btn > span');
        if (label) label.setAttribute('data-count', perList[i] + (perList[i] === 1 ? ' town' : ' towns'));
      });
      if (counter) {
        counter.textContent = q
          ? shown + (shown === 1 ? ' town matches' : ' towns match') + ' "' + input.value.trim() + '"'
          : 'Showing all ' + total + ' listed communities.';
      }
      // open every group so matches are visible while searching
      if (q) {
        lists.forEach(function (ul) {
          var btn = ul.closest('.accordion__item') && ul.closest('.accordion__item').querySelector('[data-acc-toggle]');
          var panel = btn && document.getElementById(btn.getAttribute('aria-controls'));
          if (btn && panel && btn.getAttribute('aria-expanded') !== 'true') {
            btn.setAttribute('aria-expanded', 'true');
            panel.hidden = false;
          }
        });
      }
    }
    input.addEventListener('input', run);
    input.addEventListener('search', run);
  }

  /* ------------------------------------------------------- 14. PRINT COUPON */
  function initPrint() {
    $$('[data-print]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.coupon') || document;
        document.body.classList.add('is-printing');
        window.print();
        window.setTimeout(function () { document.body.classList.remove('is-printing'); }, 400);
      });
    });
  }

  /* ------------------------------------------------------------------ 15. YEAR */
  function initYear() {
    $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  /* ------------------------------------------------ 16. ACCORDION OPEN STATE */
  /* Marks the open item so the stylesheet can lift it out of the stack. */
  function initAccordionState() {
    $$('[data-accordion]').forEach(function (group) {
      var sync = function () {
        $$('[data-acc-toggle]', group).forEach(function (btn) {
          var item = btn.closest('.accordion__item');
          if (item) item.classList.toggle('is-open', btn.getAttribute('aria-expanded') === 'true');
        });
      };
      group.addEventListener('click', function (e) {
        if (e.target.closest('[data-acc-toggle]')) window.setTimeout(sync, 0);
      });
      sync();
    });
  }

  /* ------------------------------------------------------------------ 17. BOOT */
  function boot() {
    initHeader();
    initNav();
    initDrawer();
    initAccordions();
    initSlider();
    initTabs();
    initGallery();
    initFilters();
    initPhotoGrid();
    initForms();
    initReveal();
    initToTop();
    initCitySearch();
    initPrint();
    initAccordionState();
    initYear();
    openFromHash();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
