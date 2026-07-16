/*
 * theme/assets/theme.js
 * Core Javascript: Vendor IIFEs, Helpers, Custom Elements, and Theme Editor Integration
 */

// Initialize Namespace
window.theme = window.theme || {};

// ==========================================================================
// 1. PubSub / Event Bus (JS-006)
// ==========================================================================
theme.pubsub = {
  events: {},
  subscribe(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  },
  unsubscribe(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  },
  publish(event, data) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => callback(data));
  }
};

// ==========================================================================
// 2. Helpers (JS-001)
// ==========================================================================
theme.Helpers = {
  debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  },

  formatMoney(cents, format) {
    if (typeof cents === 'string') cents = cents.replace('.', '');
    let value = '';
    const placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
    const formatString = format || '${{amount}}';

    function defaultOption(opt, def) {
      return (typeof opt == 'undefined' ? def : opt);
    }

    function formatWithDelimiters(number, precision, thousands, decimal) {
      precision = defaultOption(precision, 2);
      thousands = defaultOption(thousands, ',');
      decimal   = defaultOption(decimal, '.');

      if (isNaN(number) || number == null) return 0;

      number = (number / 100.0).toFixed(precision);

      const parts = number.split('.');
      const dollarsAmount = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
      const centsAmount = parts[1] ? (decimal + parts[1]) : '';

      return dollarsAmount + centsAmount;
    }

    switch (formatString.match(placeholderRegex)[1]) {
      case 'amount':
        value = formatWithDelimiters(cents, 2);
        break;
      case 'amount_no_decimals':
        value = formatWithDelimiters(cents, 0);
        break;
      case 'amount_with_comma_separator':
        value = formatWithDelimiters(cents, 2, '.', ',');
        break;
      case 'amount_no_decimals_with_comma_separator':
        value = formatWithDelimiters(cents, 0, '.', ',');
        break;
    }

    return formatString.replace(placeholderRegex, value);
  },

  // Focus Trapping Utility (A11Y-004)
  trapFocus(element) {
    const focusableElements = element.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]');
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    element.addEventListener('keydown', function(e) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus();
          e.preventDefault();
        }
      }
    });
  }
};

// ==========================================================================
// 3. Custom Elements (JS-002)
// ==========================================================================

/* --- Popover-based Drawer component --- */
if (!customElements.get('decor-drawer')) {
  customElements.define('decor-drawer', class extends HTMLElement {
    constructor() {
      super();
      this.popoverId = this.getAttribute('popover-id');
      this.drawer = this.querySelector('.drawer__container');
    }

    connectedCallback() {
      this.popoverEl = document.getElementById(this.popoverId);
      if (!this.popoverEl) return;
      
      this.popoverEl.addEventListener('toggle', (e) => {
        const state = e.newState || (e.detail && e.detail.newState);
        if (state === 'open') {
          this.onOpen();
        } else {
          this.onClose();
        }
      });

      const closeBtn = this.querySelector('.js-drawer-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          try {
            this.popoverEl.hidePopover();
          } catch(err) {
            this.popoverEl.classList.remove('is-open');
            document.body.style.overflow = '';
            this.popoverEl.dispatchEvent(new CustomEvent('toggle', { detail: { newState: 'closed' } }));
          }
        });
      }

      // Close on escape key
      this.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          try {
            this.popoverEl.hidePopover();
          } catch(err) {
            this.popoverEl.classList.remove('is-open');
            document.body.style.overflow = '';
            this.popoverEl.dispatchEvent(new CustomEvent('toggle', { detail: { newState: 'closed' } }));
          }
        }
      });
    }

    onOpen() {
      document.body.style.overflow = 'hidden';
      theme.Helpers.trapFocus(this);
      const closeBtn = this.querySelector('.js-drawer-close');
      if (closeBtn) closeBtn.focus();
    }

    onClose() {
      document.body.style.overflow = '';
      const trigger = document.querySelector(`[popovertarget="${this.popoverId}"]`);
      if (trigger) trigger.focus();
    }
  });
}

/* --- Popover-based Modal (Quick View etc.) --- */
if (!customElements.get('decor-modal')) {
  customElements.define('decor-modal', class extends HTMLElement {
    constructor() {
      super();
      this.popoverId = this.getAttribute('popover-id');
    }

    connectedCallback() {
      this.popoverEl = document.getElementById(this.popoverId);
      if (!this.popoverEl) return;

      this.popoverEl.addEventListener('toggle', (e) => {
        const state = e.newState || (e.detail && e.detail.newState);
        if (state === 'open') {
          document.body.style.overflow = 'hidden';
          theme.Helpers.trapFocus(this);
        } else {
          document.body.style.overflow = '';
        }
      });

      const closeBtn = this.querySelector('.js-modal-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          try {
            this.popoverEl.hidePopover();
          } catch(err) {
            this.popoverEl.classList.remove('is-open');
            document.body.style.overflow = '';
            this.popoverEl.dispatchEvent(new CustomEvent('toggle', { detail: { newState: 'closed' } }));
          }
        });
      }

      // Close on escape key (A11Y-004) — native popover="auto" already
      // light-dismisses on Esc, this covers the classList fallback path.
      this.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        try {
          this.popoverEl.hidePopover();
        } catch(err) {
          this.popoverEl.classList.remove('is-open');
          document.body.style.overflow = '';
          this.popoverEl.dispatchEvent(new CustomEvent('toggle', { detail: { newState: 'closed' } }));
        }
      });
    }
  });
}

/* --- Lightweight Scroll Snap Carousel (SEC-007, A11Y-006) --- */
if (!customElements.get('decor-carousel')) {
  customElements.define('decor-carousel', class extends HTMLElement {
    constructor() {
      super();
      this.track = this.querySelector('.js-carousel-track');
      this.prevBtn = this.querySelector('.js-carousel-prev');
      this.nextBtn = this.querySelector('.js-carousel-next');
      this.dots = this.querySelectorAll('.js-carousel-dot');
    }

    connectedCallback() {
      if (!this.track) return;

      // Check if item count is less than or equal to visible columns
      const wrapperWidth = this.track.offsetWidth;
      const totalWidth = this.track.scrollWidth;
      
      if (totalWidth <= wrapperWidth + 10) {
        if (this.prevBtn) this.prevBtn.style.display = 'none';
        if (this.nextBtn) this.nextBtn.style.display = 'none';
        return; // Disable slider actions (SEC-007)
      }

      if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.scroll('left'));
      if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.scroll('right'));

      this.track.addEventListener('scroll', theme.Helpers.debounce(() => this.updateActiveState(), 100));

      this.dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
          const items = this.track.children;
          if (items[index]) {
            this.track.scrollTo({
              left: items[index].offsetLeft,
              behavior: 'smooth'
            });
          }
        });
      });
    }

    scroll(direction) {
      const scrollAmount = this.track.offsetWidth * 0.75;
      const targetLeft = direction === 'left' 
        ? this.track.scrollLeft - scrollAmount 
        : this.track.scrollLeft + scrollAmount;
      
      this.track.scrollTo({
        left: targetLeft,
        behavior: 'smooth'
      });
    }

    updateActiveState() {
      const scrollLeft = this.track.scrollLeft;
      const items = Array.from(this.track.children);
      
      let activeIndex = 0;
      let minDiff = Infinity;

      items.forEach((item, index) => {
        const diff = Math.abs(item.offsetLeft - scrollLeft);
        if (diff < minDiff) {
          minDiff = diff;
          activeIndex = index;
        }
      });

      this.dots.forEach((dot, index) => {
        const isActive = index === activeIndex;
        dot.setAttribute('aria-current', isActive ? 'true' : 'false');
        dot.classList.toggle('active', isActive);
      });
    }
  });
}

/* --- Variant Selector (JS-002) --- */
if (!customElements.get('decor-variant-selector')) {
  customElements.define('decor-variant-selector', class extends HTMLElement {
    constructor() {
      super();
      const jsonEl = this.querySelector('.js-variants-json');
      this.variantData = jsonEl ? JSON.parse(jsonEl.textContent) : [];
      this.addEventListener('change', this.onVariantChange.bind(this));
      
      // Listen to selling plan selection changes to update pricing dynamically
      document.addEventListener('change', (e) => {
        if (e.target.closest(`.product-form__selling-plans[data-section="${this.dataset.section}"]`)) {
          this.updatePrice();
          this.updateStickyCart();
        }
      });
    }

    onVariantChange() {
      this.updateOptions();
      this.updateMasterId();
      this.updatePrice();
      this.updateImages();
      this.updateStickyCart();
      this.updatePickupAvailability();
      this.updateQuantityRules();
      this.updateVolumePricing();
    }

    updateOptions() {
      this.querySelectorAll('.product-form__option').forEach((optionEl) => {
        const checkedInput = optionEl.querySelector('input:checked, select');
        if (checkedInput) {
          const selectedSpan = optionEl.querySelector('.product-form__selected-value');
          if (selectedSpan) {
            selectedSpan.textContent = checkedInput.value;
          }
        }
      });
      this.options = Array.from(this.querySelectorAll('input:checked, select'), el => el.value);
    }

    updateMasterId() {
      this.currentVariant = this.variantData.find(variant => {
        return !variant.options.map((option, index) => {
          return this.options[index] === option;
        }).includes(false);
      });

      const input = this.querySelector('input[name="id"]');
      if (input && this.currentVariant) {
        input.value = this.currentVariant.id;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    updatePrice() {
      if (!this.currentVariant) return;
      const priceContainer = document.querySelector(`.js-product-price-${this.dataset.section}`);
      if (!priceContainer) return;

      const moneyFormat = document.getElementById('cart-config') 
        ? JSON.parse(document.getElementById('cart-config').textContent).money_format 
        : '${{amount}}';
      
      // Subscription allocations pricing overrides B2B/standard variant price (B1)
      let priceToFormat = this.currentVariant.price;
      let compareToFormat = this.currentVariant.compare_at_price;
      
      const sellingPlansEl = document.querySelector(`.product-form__selling-plans[data-section="${this.dataset.section}"]`);
      if (sellingPlansEl) {
        const activePlanInput = sellingPlansEl.querySelector('.js-selling-plan-input');
        if (activePlanInput && activePlanInput.value) {
          const planId = parseInt(activePlanInput.value);
          const allocations = this.currentVariant.selling_plan_allocations || [];
          const allocation = allocations.find(alloc => alloc.selling_plan_id === planId);
          if (allocation) {
            priceToFormat = allocation.price;
            if (allocation.compare_at_price) {
              compareToFormat = allocation.compare_at_price;
            }
          }
        }
      }
      
      const priceFormatted = theme.Helpers.formatMoney(priceToFormat, moneyFormat);
      const compareFormatted = compareToFormat 
        ? theme.Helpers.formatMoney(compareToFormat, moneyFormat) 
        : '';

      priceContainer.querySelector('.js-price').textContent = priceFormatted;
      
      const compareEl = priceContainer.querySelector('.js-compare-price');
      if (compareEl) {
        if (compareFormatted) {
          compareEl.textContent = compareFormatted;
          compareEl.style.display = '';
        } else {
          compareEl.style.display = 'none';
        }
      }

      // Dynamic unit price update
      const unitEl = priceContainer.querySelector('.js-unit-price');
      if (unitEl) {
        if (this.currentVariant.unit_price_measurement) {
          let unitPriceText = theme.Helpers.formatMoney(this.currentVariant.unit_price, moneyFormat) + '/';
          if (this.currentVariant.unit_price_measurement.reference_value !== 1) {
            unitPriceText += this.currentVariant.unit_price_measurement.reference_value;
          }
          unitPriceText += this.currentVariant.unit_price_measurement.reference_unit;
          unitEl.textContent = unitPriceText;
          unitEl.style.display = '';
        } else {
          unitEl.style.display = 'none';
        }
      }

      // Update button availability
      const buyBtns = document.querySelectorAll(`.js-buy-button-${this.dataset.section}`);
      buyBtns.forEach(buyBtn => {
        if (this.currentVariant.available) {
          buyBtn.removeAttribute('disabled');
          buyBtn.textContent = buyBtn.dataset.addText;
        } else {
          buyBtn.setAttribute('disabled', 'disabled');
          buyBtn.textContent = buyBtn.dataset.soldOutText;
        }
      });
    }

    updateImages() {
      if (!this.currentVariant || !this.currentVariant.featured_media) return;
      
      // Dispatch event to allow gallery components to slide to variant image
      theme.pubsub.publish('variant:image-change', {
        sectionId: this.dataset.section,
        mediaId: this.currentVariant.featured_media.id
      });
    }

    updateStickyCart() {
      const stickyVariantInput = document.querySelector('.js-sticky-variant-id');
      if (stickyVariantInput && this.currentVariant) {
        stickyVariantInput.value = this.currentVariant.id;
      }
      
      const stickyPrice = document.querySelector('.product-sticky-cart__price');
      if (stickyPrice && this.currentVariant) {
        const moneyFormat = document.getElementById('cart-config') 
          ? JSON.parse(document.getElementById('cart-config').textContent).money_format 
          : '${{amount}}';
        
        let priceToFormat = this.currentVariant.price;
        const sellingPlansEl = document.querySelector(`.product-form__selling-plans[data-section="${this.dataset.section}"]`);
        if (sellingPlansEl) {
          const activePlanInput = sellingPlansEl.querySelector('.js-selling-plan-input');
          if (activePlanInput && activePlanInput.value) {
            const planId = parseInt(activePlanInput.value);
            const allocations = this.currentVariant.selling_plan_allocations || [];
            const allocation = allocations.find(alloc => alloc.selling_plan_id === planId);
            if (allocation) priceToFormat = allocation.price;
          }
        }
        
        stickyPrice.textContent = theme.Helpers.formatMoney(priceToFormat, moneyFormat);
      }
    }

    updatePickupAvailability() {
      if (!this.currentVariant) return;
      const pickupContainer = document.querySelector('.js-pickup-container');
      if (!pickupContainer) return;

      const rootUrl = window.Shopify && window.Shopify.routes && window.Shopify.routes.root || '/';
      fetch(`${rootUrl}variants/${this.currentVariant.id}/pickup_availabilities`)
        .then(response => response.text())
        .then(html => {
          const div = document.createElement('div');
          div.innerHTML = html;
          const containerContent = div.querySelector('.pickup-availability-container');
          if (containerContent) {
            pickupContainer.innerHTML = containerContent.outerHTML;
            pickupContainer.style.display = '';
          } else {
            pickupContainer.innerHTML = '';
            pickupContainer.style.display = 'none';
          }
        })
        .catch(err => console.error('Error fetching pickup availabilities:', err));
    }

    updateQuantityRules() {
      if (!this.currentVariant) return;
      const qtyInput = document.querySelector(`.js-qty-input-${this.dataset.section}`);
      const rulesContainer = document.querySelector(`.js-quantity-rules-container-${this.dataset.section}`);
      if (!qtyInput) return;

      const rule = this.currentVariant.quantity_rule;
      if (rule) {
        qtyInput.min = rule.min || 1;
        qtyInput.step = rule.increment || 1;
        if (rule.max) {
          qtyInput.max = rule.max;
        } else {
          qtyInput.removeAttribute('max');
        }
        
        // Ensure input value respects new minimum
        const currentVal = parseInt(qtyInput.value) || 1;
        if (currentVal < rule.min) {
          qtyInput.value = rule.min;
        }
        
        // Update B2B Rules display using templates from attributes
        if (rulesContainer) {
          let html = '';
          const minTextTemplate = rulesContainer.getAttribute('data-min-text') || 'Minimum of [count]';
          const maxTextTemplate = rulesContainer.getAttribute('data-max-text') || 'Maximum of [count]';
          const incrementTextTemplate = rulesContainer.getAttribute('data-increment-text') || 'Increments of [count]';

          if (rule.min > 1) {
            html += `<div class="quantity-rule-item">${minTextTemplate.replace('[count]', rule.min)}</div>`;
          }
          if (rule.max) {
            html += `<div class="quantity-rule-item">${maxTextTemplate.replace('[count]', rule.max)}</div>`;
          }
          if (rule.increment > 1) {
            html += `<div class="quantity-rule-item">${incrementTextTemplate.replace('[count]', rule.increment)}</div>`;
          }
          rulesContainer.innerHTML = html;
        }
      }
    }

    updateVolumePricing() {
      if (!this.currentVariant) return;
      const pricingContainer = document.querySelector(`.js-volume-pricing-container-${this.dataset.section}`);
      const listEl = document.querySelector(`.js-volume-pricing-container-${this.dataset.section} .js-volume-pricing-list`);
      
      const breaks = this.currentVariant.quantity_price_breaks || [];
      if (pricingContainer) {
        if (breaks.length > 0) {
          if (listEl) {
            listEl.innerHTML = breaks.map(brk => `
              <li>
                <span>${brk.minimum_quantity}+</span>
                <span>${brk.price_formatted}</span>
              </li>
            `).join('');
          }
          pricingContainer.style.display = '';
        } else {
          pricingContainer.style.display = 'none';
        }
      }
    }
  });
}

/* --- Selling Plans Selector (B1) --- */
if (!customElements.get('decor-selling-plans')) {
  customElements.define('decor-selling-plans', class extends HTMLElement {
    constructor() {
      super();
      this.hiddenInput = this.querySelector('.js-selling-plan-input');
      this.addEventListener('change', this.handleChange.bind(this));
      this.updatePlan();
    }

    handleChange(event) {
      if (event.target.name === 'selling_plan_group') {
        this.updateGroupDisplay();
      }
      this.updatePlan();
    }

    updateGroupDisplay() {
      const activeGroupRadio = this.querySelector('input[name="selling_plan_group"]:checked');
      const activeGroupId = activeGroupRadio ? activeGroupRadio.value : '';

      this.querySelectorAll('.selling-plan__options-container').forEach(container => {
        const select = container.querySelector('select');
        if (select && select.dataset.groupId === activeGroupId) {
          container.style.display = '';
        } else {
          container.style.display = 'none';
        }
      });
    }

    updatePlan() {
      const activeGroupRadio = this.querySelector('input[name="selling_plan_group"]:checked');
      if (!activeGroupRadio || !activeGroupRadio.value) {
        this.hiddenInput.value = '';
        this.hiddenInput.removeAttribute('name');
      } else {
        const activeGroupId = activeGroupRadio.value;
        const activeSelect = this.querySelector(`select[data-group-id="${activeGroupId}"]`);
        if (activeSelect) {
          this.hiddenInput.value = activeSelect.value;
          this.hiddenInput.setAttribute('name', 'selling_plan');
        }
      }
      this.hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

/* --- AJAX Add to Cart (JS-005) --- */
if (!customElements.get('decor-cart-form')) {
  customElements.define('decor-cart-form', class extends HTMLElement {
    constructor() {
      super();
      this.form = this.querySelector('form');
      if (this.form) this.form.addEventListener('submit', this.onSubmit.bind(this));
    }

    onSubmit(e) {
      e.preventDefault();
      
      const submitBtn = this.querySelector('[type="submit"]');
      submitBtn.setAttribute('disabled', 'disabled');
      submitBtn.classList.add('loading');

      const formData = new FormData(this.form);
      const config = document.getElementById('cart-config') 
        ? JSON.parse(document.getElementById('cart-config').textContent) 
        : {};
      const addUrl = config.cart_add_url || '/cart/add.js';

      fetch(addUrl, {
        method: 'POST',
        body: formData
      })
      .then(res => {
        if (!res.ok) {
          throw new Error('add_error');
        }
        return res.json();
      })
      .then(item => {
        theme.pubsub.publish('cart:updated', item);
        submitBtn.removeAttribute('disabled');
        submitBtn.classList.remove('loading');
      })
      .catch(err => {
        console.error('Add to cart error:', err);
        alert(config.add_to_cart_error || (window.themeStrings && window.themeStrings.addToCartError) || 'Error');
        submitBtn.removeAttribute('disabled');
        submitBtn.classList.remove('loading');
      });
    }
  });
}

/* --- AJAX Cart Drawer (JS-005) --- */
if (!customElements.get('decor-cart-drawer')) {
  customElements.define('decor-cart-drawer', class extends HTMLElement {
    connectedCallback() {
      theme.pubsub.subscribe('cart:updated', () => this.refreshCart());

      this.popoverId = this.getAttribute('popover-id');
      const popover = document.getElementById(this.popoverId);
      if (popover) {
        popover.addEventListener('toggle', (e) => {
          const state = e.newState || (e.detail && e.detail.newState);
          if (state === 'open') {
            this.refreshCart();
            document.body.style.overflow = 'hidden';
            theme.Helpers.trapFocus(this);
          } else {
            document.body.style.overflow = '';
          }
        });
      }

      // Close button (A11Y-004) — lives in the static header, outside the
      // AJAX-swapped .js-cart-drawer-content, so binding once here is safe.
      const closeBtn = this.querySelector('.js-drawer-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.close());
      }

      // Esc key dismissal (A11Y-004) — covers the classList fallback path
      // for browsers without native popover light-dismiss.
      this.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.close();
      });
    }

    close() {
      const popover = document.getElementById(this.popoverId);
      if (!popover) return;
      try {
        popover.hidePopover();
      } catch(err) {
        popover.classList.remove('is-open');
        document.body.style.overflow = '';
        popover.dispatchEvent(new CustomEvent('toggle', { detail: { newState: 'closed' } }));
      }
    }

    refreshCart() {
      const config = document.getElementById('cart-config') 
        ? JSON.parse(document.getElementById('cart-config').textContent) 
        : {};
      const cartUrl = config.cart_url || '/cart';

      fetch(`${cartUrl}?view=ajax`)
      .then(res => res.text())
      .then(html => {
        this.querySelector('.js-cart-drawer-content').innerHTML = html;
        
        // Open drawer using Popover API (JS-007)
        const popover = document.getElementById('cart-drawer-popover');
        if (popover) {
          try {
            if (!popover.matches(':popover-open') && !popover.classList.contains('is-open')) {
              popover.showPopover();
            }
          } catch(err) {
            popover.classList.add('is-open');
          }
        }
        
        // Refresh header count
        this.updateCartCount();
      });
    }

    updateCartCount() {
      const config = document.getElementById('cart-config') 
        ? JSON.parse(document.getElementById('cart-config').textContent) 
        : {};
      const cartUrl = config.cart_url || '/cart';

      fetch(`${cartUrl}.js`)
      .then(res => res.json())
      .then(cart => {
        const countEls = document.querySelectorAll('.js-cart-count');
        countEls.forEach(el => {
          el.textContent = cart.item_count;
          el.style.display = cart.item_count > 0 ? '' : 'none';
        });
      });
    }
  });
}

/* --- AJAX Collection Filtering (JS-008) --- */
if (!customElements.get('decor-filters')) {
  customElements.define('decor-filters', class extends HTMLElement {
    constructor() {
      super();
      this.form = this.querySelector('form');
    }

    connectedCallback() {
      if (!this.form) return;
      this.form.addEventListener('change', this.onChange.bind(this));
    }

    onChange() {
      const queryParams = new URLSearchParams(new FormData(this.form)).toString();
      const targetUrl = `${window.location.pathname}?${queryParams}`;
      
      const gridContainer = document.getElementById('ProductGridContainer');
      if (gridContainer) gridContainer.classList.add('loading');

      fetch(targetUrl)
      .then(res => res.text())
      .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Replace product grid
        const newGrid = doc.getElementById('ProductGridContainer');
        if (newGrid && gridContainer) {
          gridContainer.innerHTML = newGrid.innerHTML;
          gridContainer.classList.remove('loading');
        }

        // Replace active filter list
        const activeFilters = document.getElementById('ActiveFilters');
        const newFilters = doc.getElementById('ActiveFilters');
        if (activeFilters && newFilters) {
          activeFilters.innerHTML = newFilters.innerHTML;
        }

        // Update URL state without page reload
        window.history.pushState({ path: targetUrl }, '', targetUrl);
      });
    }
  });
}

/* --- Shop the Look / Lookbook Hotspots --- */
if (!customElements.get('decor-lookbook')) {
  customElements.define('decor-lookbook', class extends HTMLElement {
    connectedCallback() {
      const hotspots = this.querySelectorAll('.js-hotspot-marker');
      hotspots.forEach(hotspot => {
        hotspot.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetCardId = hotspot.dataset.cardId;
          this.closeAllCards();
          const card = this.querySelector(`#${targetCardId}`);
          if (card) {
            card.classList.add('active');
            card.showPopover(); // If native Popover
          }
        });
      });

      document.addEventListener('click', () => this.closeAllCards());
    }

    closeAllCards() {
      const cards = this.querySelectorAll('.js-hotspot-card');
      cards.forEach(card => {
        card.classList.remove('active');
        if (card.hidePopover) card.hidePopover();
      });
    }
  });
}

/* --- Design Style Quiz --- */
if (!customElements.get('decor-style-quiz')) {
  customElements.define('decor-style-quiz', class extends HTMLElement {
    constructor() {
      super();
      this.questions = Array.from(this.querySelectorAll('.js-quiz-track .style-quiz__question'));
      this.progress = this.querySelector('.js-quiz-progress');
      this.backBtn = this.querySelector('.js-quiz-back');
      this.restartBtn = this.querySelector('.js-quiz-restart');
      this.resultsWrapper = this.querySelector('.js-quiz-results');
      this.track = this.querySelector('.js-quiz-track');
      this.scores = {};
      this.history = [];
      this.currentIndex = 0;
    }

    connectedCallback() {
      if (!this.questions.length) return;

      this.addEventListener('click', (e) => {
        const optionBtn = e.target.closest('.js-quiz-option');
        if (optionBtn) {
          this.answer(optionBtn.dataset.style);
          return;
        }
        if (e.target.closest('.js-quiz-back')) this.goBack();
        if (e.target.closest('.js-quiz-restart')) this.restart();
      });

      this.updateProgress();
    }

    answer(styleKey) {
      if (styleKey) this.scores[styleKey] = (this.scores[styleKey] || 0) + 1;
      this.history.push(this.currentIndex);

      if (this.currentIndex < this.questions.length - 1) {
        this.showQuestion(this.currentIndex + 1);
      } else {
        this.showResult();
      }
    }

    goBack() {
      if (!this.history.length) return;
      const prevIndex = this.history.pop();
      this.showQuestion(prevIndex);
      this.resultsWrapper.querySelectorAll('.style-quiz__result').forEach((el) => {
        el.setAttribute('data-visible', 'false');
      });
      this.track.hidden = false;
    }

    restart() {
      this.scores = {};
      this.history = [];
      this.track.hidden = false;
      this.resultsWrapper.querySelectorAll('.style-quiz__result').forEach((el) => {
        el.setAttribute('data-visible', 'false');
      });
      this.showQuestion(0);
      this.restartBtn.hidden = true;
    }

    showQuestion(index) {
      this.currentIndex = index;
      this.questions.forEach((q, i) => {
        q.setAttribute('data-active', i === index ? 'true' : 'false');
      });
      this.backBtn.hidden = this.history.length === 0;
      this.updateProgress();
    }

    updateProgress() {
      if (!this.progress || !this.progress.dataset.template) return;
      this.progress.textContent = this.progress.dataset.template
        .replace('{current}', this.currentIndex + 1)
        .replace('{total}', this.questions.length);
    }

    showResult() {
      this.track.hidden = true;
      this.backBtn.hidden = true;
      this.restartBtn.hidden = false;

      let topStyle = null;
      let topScore = -1;
      Object.keys(this.scores).forEach((key) => {
        if (this.scores[key] > topScore) {
          topScore = this.scores[key];
          topStyle = key;
        }
      });

      this.resultsWrapper.querySelectorAll('.style-quiz__result').forEach((el) => {
        el.setAttribute('data-visible', el.dataset.resultStyle === topStyle ? 'true' : 'false');
      });
    }
  });
}

/* --- Material & Finish Explorer Filter --- */
if (!customElements.get('decor-material-filter')) {
  customElements.define('decor-material-filter', class extends HTMLElement {
    connectedCallback() {
      this.filterBtns = Array.from(this.querySelectorAll('.js-material-filter-btn'));
      this.swatches = Array.from(this.querySelectorAll('.js-material-swatch'));
      this.emptyMsg = this.querySelector('.js-material-empty');

      this.filterBtns.forEach((btn) => {
        btn.addEventListener('click', () => this.filter(btn.dataset.type, btn));
      });
    }

    filter(type, activeBtn) {
      this.filterBtns.forEach((btn) => {
        btn.setAttribute('aria-pressed', btn === activeBtn ? 'true' : 'false');
      });

      let visibleCount = 0;
      this.swatches.forEach((swatch) => {
        const matches = type === 'all' || swatch.dataset.type === type;
        swatch.hidden = !matches;
        if (matches) visibleCount++;
      });

      if (this.emptyMsg) this.emptyMsg.hidden = visibleCount !== 0;
    }
  });
}

/* --- Room Fit Calculator --- */
if (!customElements.get('decor-room-fit')) {
  customElements.define('decor-room-fit', class extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('.js-room-fit-form');
      this.status = this.querySelector('.js-room-fit-status');
      this.items = Array.from(this.querySelectorAll('.js-room-fit-item'));
      this.clearance = parseFloat(this.getAttribute('data-clearance')) || 0;

      if (this.form) {
        this.form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.calculate();
        });
      }
    }

    calculate() {
      const unit = this.querySelector('.js-room-fit-unit').value;
      const toInches = (val) => (unit === 'cm' ? val / 2.54 : val);

      const roomWidth = toInches(parseFloat(this.querySelector('.js-room-fit-width').value) || 0) - this.clearance;
      const roomDepth = toInches(parseFloat(this.querySelector('.js-room-fit-depth').value) || 0) - this.clearance;

      let matchCount = 0;
      this.items.forEach((item) => {
        const itemWidth = parseFloat(item.dataset.width) || 0;
        const itemDepth = parseFloat(item.dataset.depth) || 0;
        const fits = itemWidth > 0 && itemDepth > 0 && itemWidth <= roomWidth && itemDepth <= roomDepth;
        item.hidden = !fits;
        if (fits) matchCount++;
      });

      if (this.status) {
        this.status.textContent = matchCount > 0
          ? this.status.dataset.matchTemplate.replace('{count}', matchCount)
          : this.status.dataset.emptyText;
      }
    }
  });
}

/* --- Shop the Room Hotspots --- */
if (!customElements.get('decor-room-hotspot')) {
  customElements.define('decor-room-hotspot', class extends HTMLElement {
    connectedCallback() {
      this.pins = Array.from(this.querySelectorAll('.js-hotspot-pin'));
      this.cards = Array.from(this.querySelectorAll('.room-hotspots__card'));

      this.pins.forEach((pin) => {
        const cardId = pin.getAttribute('popovertarget');
        const card = document.getElementById(cardId);
        if (!card) return;

        // Native popover="auto" already Esc-dismisses and light-dismisses
        // sibling popovers. This covers browsers without Popover API support.
        if (typeof card.showPopover !== 'function') {
          pin.addEventListener('click', () => this.openFallback(card));
        }

        card.addEventListener('toggle', (e) => {
          const state = e.newState || (e.detail && e.detail.newState);
          if (state === 'open') {
            const closeLink = card.querySelector('a, button');
            if (closeLink) closeLink.focus();
          } else {
            pin.focus();
          }
        });

        card.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') this.closeFallback(card, pin);
        });
      });
    }

    openFallback(card) {
      this.cards.forEach((c) => c.classList.remove('is-open'));
      card.classList.add('is-open');
      card.dispatchEvent(new CustomEvent('toggle', { detail: { newState: 'open' } }));
    }

    closeFallback(card, pin) {
      card.classList.remove('is-open');
      card.dispatchEvent(new CustomEvent('toggle', { detail: { newState: 'closed' } }));
      if (pin) pin.focus();
    }
  });
}

/* --- Product Comparison Builder --- */
if (!customElements.get('decor-compare-builder')) {
  customElements.define('decor-compare-builder', class extends HTMLElement {
    connectedCallback() {
      this.max = parseInt(this.getAttribute('data-max'), 10) || 3;
      this.checkboxes = Array.from(this.querySelectorAll('.js-compare-checkbox'));

      const root = this.closest('section') || document;
      this.bar = root.querySelector('.js-compare-bar');
      this.countEl = root.querySelector('.js-compare-count');
      this.openBtn = root.querySelector('.js-compare-open');
      this.clearBtn = root.querySelector('.js-compare-clear');
      this.modalBody = root.querySelector('.js-compare-modal-body');

      this.checkboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', () => this.onChange());
      });

      if (this.clearBtn) {
        this.clearBtn.addEventListener('click', () => {
          this.checkboxes.forEach((c) => { c.checked = false; });
          this.onChange();
        });
      }

      if (this.openBtn) {
        this.openBtn.addEventListener('click', () => this.buildTable());
      }
    }

    onChange() {
      const checked = this.checkboxes.filter((c) => c.checked);

      this.checkboxes.forEach((c) => {
        if (!c.checked) c.disabled = checked.length >= this.max;
      });

      if (this.bar) this.bar.setAttribute('data-visible', checked.length > 0 ? 'true' : 'false');
      if (this.countEl) {
        this.countEl.textContent = this.countEl.dataset.template
          ? this.countEl.dataset.template.replace('{count}', checked.length).replace('{max}', this.max)
          : String(checked.length);
      }
      if (this.openBtn) this.openBtn.disabled = checked.length < 2;
    }

    buildTable() {
      if (!this.modalBody) return;
      this.modalBody.innerHTML = '';

      this.checkboxes
        .filter((c) => c.checked)
        .forEach((checkbox) => {
          const card = checkbox.closest('.compare-builder__card');
          const template = card ? card.querySelector('.js-compare-template') : null;
          if (template) {
            this.modalBody.appendChild(template.content.cloneNode(true));
          }
        });
    }
  });
}

/* --- Bundle & Save Builder --- */
if (!customElements.get('decor-bundle-builder')) {
  customElements.define('decor-bundle-builder', class extends HTMLElement {
    connectedCallback() {
      this.discountPercent = parseFloat(this.getAttribute('data-discount-percent')) || 0;
      this.checkboxes = Array.from(this.querySelectorAll('.js-bundle-item'));
      this.totalEl = this.querySelector('.js-bundle-total');
      this.savingsEl = this.querySelector('.js-bundle-savings');
      this.addBtn = this.querySelector('.js-bundle-add');

      this.checkboxes.forEach((c) => c.addEventListener('change', () => this.recalculate()));
      if (this.addBtn) this.addBtn.addEventListener('click', () => this.addBundle());

      this.recalculate();
    }

    getMoneyFormat() {
      const config = document.getElementById('cart-config');
      return config ? JSON.parse(config.textContent).money_format : '${{amount}}';
    }

    recalculate() {
      const format = this.getMoneyFormat();
      const checked = this.checkboxes.filter((c) => c.checked);
      const subtotalCents = checked.reduce((sum, c) => sum + parseInt(c.dataset.price, 10), 0);
      const savingsCents = Math.round(subtotalCents * (this.discountPercent / 100));

      if (this.totalEl) this.totalEl.textContent = theme.Helpers.formatMoney(subtotalCents - savingsCents, format);
      if (this.savingsEl) {
        this.savingsEl.textContent = savingsCents > 0 && this.savingsEl.dataset.template
          ? this.savingsEl.dataset.template.replace('{amount}', theme.Helpers.formatMoney(savingsCents, format))
          : '';
      }
      if (this.addBtn) this.addBtn.disabled = checked.length === 0;
    }

    addBundle() {
      const checked = this.checkboxes.filter((c) => c.checked);
      if (!checked.length) return;

      const config = document.getElementById('cart-config')
        ? JSON.parse(document.getElementById('cart-config').textContent)
        : {};
      const addUrl = config.cart_add_url || '/cart/add.js';

      this.addBtn.disabled = true;
      this.addBtn.classList.add('loading');

      fetch(addUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: checked.map((c) => ({ id: parseInt(c.dataset.variantId, 10), quantity: 1 }))
        })
      })
        .then((res) => {
          if (!res.ok) throw new Error('add_error');
          return res.json();
        })
        .then(() => {
          theme.pubsub.publish('cart:updated');
          this.addBtn.disabled = false;
          this.addBtn.classList.remove('loading');
        })
        .catch((err) => {
          console.error('Bundle add-to-cart error:', err);
          this.addBtn.disabled = false;
          this.addBtn.classList.remove('loading');
        });
    }
  });
}

/* --- White-Glove Delivery Tier Tabs --- */
if (!customElements.get('decor-delivery-tabs')) {
  customElements.define('decor-delivery-tabs', class extends HTMLElement {
    connectedCallback() {
      this.inputs = Array.from(this.querySelectorAll('.js-delivery-tab-input'));
      this.panels = Array.from(this.querySelectorAll('.js-delivery-panel'));

      this.inputs.forEach((input) => {
        input.addEventListener('change', () => this.showTier(input.dataset.tier));
      });
    }

    showTier(tier) {
      this.panels.forEach((panel) => {
        panel.style.display = panel.dataset.tier === tier ? 'block' : 'none';
      });
    }
  });
}

/* --- Background Video with Mobile Static-Image Fallback --- */
if (!customElements.get('decor-background-video')) {
  customElements.define('decor-background-video', class extends HTMLElement {
    constructor() {
      super();
      this.videoInserted = false;
    }

    connectedCallback() {
      const breakpoint = parseInt(this.getAttribute('data-breakpoint'), 10) || 740;
      this.template = this.querySelector('template.bg-video__template');
      if (!this.template) return; // No video configured — static image only.

      this.mediaQuery = window.matchMedia(`(min-width: ${breakpoint}px)`);
      this.onMediaChange = this.onMediaChange.bind(this);

      if (this.mediaQuery.matches) this.insertVideo();

      if (this.mediaQuery.addEventListener) {
        this.mediaQuery.addEventListener('change', this.onMediaChange);
      } else if (this.mediaQuery.addListener) {
        // Safari < 14 fallback
        this.mediaQuery.addListener(this.onMediaChange);
      }
    }

    onMediaChange(e) {
      if (e.matches) this.insertVideo();
    }

    insertVideo() {
      if (this.videoInserted || !this.template) return;
      this.videoInserted = true;

      const fragment = this.template.content.cloneNode(true);
      const video = fragment.querySelector('video');
      this.appendChild(fragment);

      if (video) {
        video.play().catch(() => {
          // Autoplay blocked (e.g. data-saver mode) — the poster image still shows.
        });
      }
    }

    disconnectedCallback() {
      if (!this.mediaQuery) return;
      if (this.mediaQuery.removeEventListener) {
        this.mediaQuery.removeEventListener('change', this.onMediaChange);
      } else if (this.mediaQuery.removeListener) {
        this.mediaQuery.removeListener(this.onMediaChange);
      }
    }
  });
}

/* --- Predictive Search Suggestion Component --- */
if (!customElements.get('predictive-search')) {
  customElements.define('predictive-search', class extends HTMLElement {
    constructor() {
      super();
      this.input = this.querySelector('input[type="search"]');
      this.results = this.querySelector('.js-predictive-results');
      this.cachedQueries = {};
    }

    connectedCallback() {
      if (!this.input || !this.results) return;

      // ARIA combobox pattern (A11Y-003)
      this.input.setAttribute('role', 'combobox');
      this.input.setAttribute('aria-expanded', 'false');
      this.input.setAttribute('aria-autocomplete', 'list');
      this.input.setAttribute('aria-haspopup', 'listbox');
      if (!this.input.hasAttribute('aria-controls') && this.results.id) {
        this.input.setAttribute('aria-controls', this.results.id);
      }

      this.input.addEventListener('input', this.debounce(() => {
        this.onChange();
      }, 300));

      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.results.innerHTML = '';
          this.input.setAttribute('aria-expanded', 'false');
        }
      });
    }

    onChange() {
      const query = this.input.value.trim();
      if (!query) {
        this.results.innerHTML = '';
        this.input.setAttribute('aria-expanded', 'false');
        return;
      }

      if (this.cachedQueries[query]) {
        this.renderSearchResults(this.cachedQueries[query]);
        return;
      }

      const rootUrl = window.Shopify && window.Shopify.routes && window.Shopify.routes.root || '/';
      fetch(`${rootUrl}search/suggest?q=${encodeURIComponent(query)}&resources[type]=product,collection,page&section_id=predictive-search`)
        .then(response => {
          if (!response.ok) throw new Error('Network response was not ok');
          return response.text();
        })
        .then(text => {
          this.cachedQueries[query] = text;
          this.renderSearchResults(text);
        })
        .catch(err => {
          console.error(err);
        });
    }

    renderSearchResults(html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const resultsNode = doc.getElementById('predictive-search-results');
      if (resultsNode && this.results) {
        this.results.innerHTML = resultsNode.outerHTML;
        this.input.setAttribute('aria-expanded', 'true');
      } else {
        this.results.innerHTML = '';
        this.input.setAttribute('aria-expanded', 'false');
      }
    }

    debounce(fn, wait) {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), wait);
      };
    }
  });
}


// Fetch Complementary Products (Shopify Recommendations API)
theme.initComplementaryProducts = function(container) {
  if (!container) return;
  const productId = container.dataset.productId;
  const limit = container.dataset.limit || 4;
  const rootUrl = window.Shopify && window.Shopify.routes && window.Shopify.routes.root || '/';
  
  fetch(`${rootUrl}recommendations/products?product_id=${productId}&limit=${limit}&intent=complementary&section_id=complementary-products`)
    .then(response => response.text())
    .then(html => {
      const div = document.createElement('div');
      div.innerHTML = html;
      const recommendationsContent = div.querySelector('.complementary-products__wrapper');
      if (recommendationsContent) {
        container.innerHTML = recommendationsContent.outerHTML;
      }
    })
    .catch(err => console.error('Error loading complementary products:', err));
};

document.addEventListener('DOMContentLoaded', () => {
  const compContainer = document.querySelector('.js-complementary-products');
  if (compContainer) theme.initComplementaryProducts(compContainer);
});

document.addEventListener('shopify:section:load', (e) => {
  const section = e.target;
  
  // Re-initialize Carousels when sections are added
  const carousels = section.querySelectorAll('decor-carousel');
  carousels.forEach(c => {
    if (typeof c.connectedCallback === 'function') c.connectedCallback();
  });

  // Re-initialize lookbook
  const lookbooks = section.querySelectorAll('decor-lookbook');
  lookbooks.forEach(l => {
    if (typeof l.connectedCallback === 'function') l.connectedCallback();
  });

  // Re-initialize recommendations
  const recommendations = section.querySelectorAll('decor-recommendations');
  recommendations.forEach(r => {
    if (typeof r.connectedCallback === 'function') r.connectedCallback();
  });

  // Re-initialize recently-viewed
  const recentlyViewed = section.querySelectorAll('decor-recently-viewed');
  recentlyViewed.forEach(rv => {
    if (typeof rv.connectedCallback === 'function') rv.connectedCallback();
  });

  // Re-initialize complementary products in editor
  const compContainer = section.querySelector('.js-complementary-products');
  if (compContainer) theme.initComplementaryProducts(compContainer);
});

// Handle Theme Editor Block Select Events (carousel slide auto-centering)
document.addEventListener('shopify:block:select', (e) => {
  const block = e.target;
  const carousel = block.closest('decor-carousel');
  if (carousel && carousel.track) {
    const slide = block.closest('.js-carousel-slide');
    if (slide) {
      carousel.track.scrollTo({
        left: slide.offsetLeft,
        behavior: 'smooth'
      });
    }
  }
});

// Handle Theme Editor Section Unload Events (unlock body scroll if popovers/drawers are removed)
document.addEventListener('shopify:section:unload', (e) => {
  const section = e.target;
  const openPopover = section.querySelector('[popover].is-open, [popover]:popover-open');
  if (openPopover) {
    document.body.style.overflow = '';
  }
});

// Handle Theme Editor Block Deselect Events
document.addEventListener('shopify:block:deselect', (e) => {
  // Reserved for editor synchronization cleanups
});

// ==========================================================================
// 5. Popover API Fallback / Polyfill (JS-007 Fallback)
// ==========================================================================
(function() {
  function initPopoverPolyfill() {
    // Intercept clicks on elements with popovertarget
    document.addEventListener('click', function(e) {
      const trigger = e.target.closest('[popovertarget]');
      if (!trigger) return;

      const targetId = trigger.getAttribute('popovertarget');
      const target = document.getElementById(targetId);
      if (!target) return;

      e.preventDefault();

      let success = false;
      if (typeof target.showPopover === 'function') {
        try {
          if (!target.matches(':popover-open')) {
            target.showPopover();
          } else {
            target.hidePopover();
          }
          success = true;
        } catch (err) {
          console.warn('Native popover failed, falling back to class toggle', err);
        }
      }

      if (!success) {
        const isOpen = target.classList.contains('is-open');
        document.querySelectorAll('[popover].is-open, .drawer__root.is-open, .modal__root.is-open').forEach(el => {
          if (el !== target) {
            el.classList.remove('is-open');
            document.body.style.overflow = '';
            el.dispatchEvent(new CustomEvent('toggle', { detail: { newState: 'closed' } }));
          }
        });

        if (!isOpen) {
          target.classList.add('is-open');
          document.body.style.overflow = 'hidden';
          target.dispatchEvent(new CustomEvent('toggle', { detail: { newState: 'open' } }));
        } else {
          target.classList.remove('is-open');
          document.body.style.overflow = '';
          target.dispatchEvent(new CustomEvent('toggle', { detail: { newState: 'closed' } }));
        }
      }
    });

    // Close when clicking outside of contents
    document.addEventListener('click', function(e) {
      const openPopover = document.querySelector('[popover].is-open, .drawer__root.is-open, .modal__root.is-open');
      if (!openPopover) return;

      const container = openPopover.querySelector('.drawer__container, .modal__container, [popover] > div');
      if (container && !container.contains(e.target) && !e.target.closest('[popovertarget]')) {
        openPopover.classList.remove('is-open');
        document.body.style.overflow = '';
        openPopover.dispatchEvent(new CustomEvent('toggle', { detail: { newState: 'closed' } }));
      }
    });
  }

  function initNavAccessibility() {
    document.querySelectorAll('.header__nav-item').forEach(item => {
      const link = item.querySelector('.header__nav-link');
      if (!link) return;
      const dropdown = item.querySelector('.header__dropdown');
      if (dropdown) {
        link.setAttribute('aria-haspopup', 'true');
        link.setAttribute('aria-expanded', 'false');

        const showMenu = () => {
          link.setAttribute('aria-expanded', 'true');
        };
        const hideMenu = () => {
          link.setAttribute('aria-expanded', 'false');
        };

        item.addEventListener('mouseenter', showMenu);
        item.addEventListener('mouseleave', hideMenu);
        link.addEventListener('focus', showMenu);

        // Hide on focus out unless focus moves inside the dropdown item itself
        item.addEventListener('focusout', (e) => {
          if (!item.contains(e.relatedTarget)) {
            hideMenu();
          }
        });
      }
    });
  }

  function initQuickView() {
    document.addEventListener('click', function(e) {
      const trigger = e.target.closest('.js-quick-view-trigger');
      if (!trigger) return;

      const url = trigger.getAttribute('data-product-url');
      const contentContainer = document.querySelector('.js-quick-view-content');
      if (!url || !contentContainer) return;

      const config = document.getElementById('cart-config')
        ? JSON.parse(document.getElementById('cart-config').textContent)
        : {};
      const loadingText = config.loading_quickview || 'Loading options...';
      const errorText = config.error_loading_quickview || 'Error loading Quick View. Please try again.';

      contentContainer.innerHTML = `<div style="text-align: center; padding: 5rem 0;"><p>${loadingText}</p></div>`;

      fetch(url)
        .then(response => {
          if (!response.ok) throw new Error(errorText);
          return response.text();
        })
        .then(html => {
          contentContainer.innerHTML = html;
          // Dispatch custom event to initialize custom elements in the quick view content (e.g. variants, forms)
          const section = contentContainer.querySelector('[data-section-type]');
          if (section) {
            document.dispatchEvent(new CustomEvent('shopify:section:load', {
              detail: { sectionId: section.dataset.sectionId },
              bubbles: true,
              cancelable: true
            }));
          }
        })
        .catch(err => {
          contentContainer.innerHTML = `<div style="text-align: center; padding: 3rem;"><p style="color: var(--error-color, red);">${err.message || errorText}</p></div>`;
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initPopoverPolyfill();
      initNavAccessibility();
      initQuickView();
    });
  } else {
    initPopoverPolyfill();
    initNavAccessibility();
    initQuickView();
  }
})();
