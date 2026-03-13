<script>
console.log('EXCEPTION CARD SCRIPT LOADED - v13');

window.Kustomer.initialize((context) => {
  console.log('DynamicCard context:', context);

  const get = (obj, path, fallback = undefined) => {
    try {
      const value = path.split('.').reduce((acc, key) => {
        if (acc == null) return undefined;
        return acc[key];
      }, obj);
      return value === undefined ? fallback : value;
    } catch (e) {
      return fallback;
    }
  };

  const escapeHtml = (str) => {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const contextCustomer =
    get(context, 'customer') ||
    get(context, 'user.customer') ||
    get(context, 'conversation.customer') ||
    get(context, 'object') ||
    {};

  const customerId =
    get(contextCustomer, 'id') ||
    get(contextCustomer, 'attributes.id') ||
    '';

  const container = document.getElementById('exceptions-list');

  const setStatus = (msg) => {
    if (container) {
      container.innerHTML = `<div class="empty-state">${escapeHtml(msg)}</div>`;
    }
  };

  const parseIds = (txt) =>
    String(txt || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

  const normalizeApiResult = (payload) => {
    // Handles:
    // { data: [...] }
    // { data: {...} }
    // [...]
    // {...}
    if (!payload) return [];

    const source = payload.data !== undefined ? payload.data : payload;

    if (Array.isArray(source)) return source;
    if (source && typeof source === 'object' && source.id) return [source];

    return [];
  };

  const resizeCard = () => {
    setTimeout(() => {
      if (window.Kustomer && typeof window.Kustomer.resize === 'function') {
        window.Kustomer.resize();
      }
    }, 100);
  };

  if (!container) {
    console.error('Missing #exceptions-list container');
    return;
  }

  if (!customerId) {
    setStatus('Customer not found.');
    resizeCard();
    return;
  }

  let lastRenderedIds = '';

  const renderCards = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
      setStatus('No exceptions logged for this customer.');
      resizeCard();
      return;
    }

    const normalizedItems = [...items].sort((a, b) => {
      const aDate = new Date(get(a, 'attributes.createdAt', 0)).getTime();
      const bDate = new Date(get(b, 'attributes.createdAt', 0)).getTime();
      return bDate - aDate;
    });

    container.innerHTML = '';

    normalizedItems.forEach((item) => {
      const exceptionId = get(item, 'id', '');
      const title = get(item, 'attributes.title', 'Exception');
      const created = get(item, 'attributes.createdAt', '');
      const reason = get(item, 'attributes.custom.exceptionReasonStr', '—');
      const order = get(item, 'attributes.custom.orderNumberStr', '—');
      const notes = get(item, 'attributes.custom.exceptionNotesTxt', '');

      const createdDisplay = created
        ? new Date(created).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
        : '—';

      const notesPreview =
        String(notes || '').length > 120
          ? `${String(notes).slice(0, 120)}…`
          : (notes || '—');

      const card = document.createElement('div');
      card.className = 'exception-card clickable';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      const openEvent = () => {
        if (
          window.Kustomer &&
          typeof window.Kustomer.openCustomerEvent === 'function' &&
          customerId &&
          exceptionId
        ) {
          window.Kustomer.openCustomerEvent(customerId, exceptionId);
        }
      };

      card.addEventListener('click', openEvent);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openEvent();
        }
      });

      card.innerHTML = `
        <div class="exception-title">${escapeHtml(title)}</div>
        <div class="exception-date">${escapeHtml(createdDisplay)}</div>

        <div class="exception-meta">
          <div><strong>Reason:</strong> ${escapeHtml(reason)}</div>
          <div><strong>Order:</strong> ${escapeHtml(order)}</div>
        </div>

        <div class="exception-notes">
          <strong>Notes:</strong> ${escapeHtml(notesPreview)}
        </div>
      `;

      container.appendChild(card);
    });

    resizeCard();
  };

  const requestAsync = (options) =>
    new Promise((resolve, reject) => {
      window.Kustomer.request(options, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data);
      });
    });

  const fetchExceptionsByIds = async (idsTxt) => {
    const ids = parseIds(idsTxt);
    console.log('Exception IDs to fetch:', ids);

    if (!ids.length) {
      renderCards([]);
      return;
    }

    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          requestAsync({
            url: `/v1/klasses/exception_log/${encodeURIComponent(id)}`,
            method: 'GET'
          })
        )
      );

      const items = results
        .filter((r) => r.status === 'fulfilled')
        .flatMap((r) => normalizeApiResult(r.value));

      console.log('Fetched exception items:', items);

      // 0 results = no exceptions
      // 1 result = array of 1
      // 2+ results = array of many
      renderCards(items);
    } catch (error) {
      console.error('Failed to fetch exceptions:', error);
      setStatus('Could not load exceptions.');
      resizeCard();
    }
  };

  const fetchFreshCustomer = async (attempt = 0) => {
    try {
      const customerData = await requestAsync({
        url: `/v1/customers/${encodeURIComponent(customerId)}`,
        method: 'GET'
      });

      console.log('Fresh customer data:', customerData);

      const freshIdsTxt =
        get(customerData, 'data.attributes.custom.exceptionLogIDsTxt') ||
        get(customerData, 'attributes.custom.exceptionLogIDsTxt') ||
        get(customerData, 'custom.exceptionLogIDsTxt') ||
        '';

      const freshIds = parseIds(freshIdsTxt);

      console.log('Fresh exceptionLogIDsTxt:', freshIdsTxt);

      if (!freshIds.length) {
        renderCards([]);

        if (attempt < 2) {
          setTimeout(() => fetchFreshCustomer(attempt + 1), 1200);
        }
        return;
      }

      if (freshIdsTxt === lastRenderedIds) {
        return;
      }

      lastRenderedIds = freshIdsTxt;
      await fetchExceptionsByIds(freshIdsTxt);
    } catch (error) {
      console.error('Failed to refresh customer:', error);

      if (attempt === 0) {
        setStatus('Could not load exceptions.');
        resizeCard();
      }
    }
  };

  const initialIdsTxt =
    get(contextCustomer, 'attributes.custom.exceptionLogIDsTxt') ||
    get(contextCustomer, 'custom.exceptionLogIDsTxt') ||
    '';

  const initialIds = parseIds(initialIdsTxt);

  if (initialIds.length) {
    lastRenderedIds = initialIdsTxt;
    fetchExceptionsByIds(initialIdsTxt);
    fetchFreshCustomer(0);
  } else {
    renderCards([]);
    fetchFreshCustomer(0);
  }
});
</script>
