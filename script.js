console.log('EXCEPTION CARD SCRIPT LOADED - v12');

window.Kustomer.initialize((context) => {
  console.log('DynamicCard context:', context);

  const contextCustomer =
    _.get(context, 'customer') ||
    _.get(context, 'user.customer') ||
    _.get(context, 'conversation.customer') ||
    _.get(context, 'object') ||
    {};

  const customerId =
    _.get(contextCustomer, 'id') ||
    _.get(contextCustomer, 'attributes.id') ||
    '';

  const container = document.getElementById('exceptions-list');

  const setStatus = (msg) => {
    if (container) container.innerHTML = msg;
  };

  const parseIds = (txt) =>
    (txt || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

  const normalizeToArray = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (_.get(value, 'id')) return [value];
    return [];
  };

  const resizeCard = () => {
    setTimeout(() => {
      if (window.Kustomer?.resize) {
        window.Kustomer.resize();
      }
    }, 100);
  };

  if (!customerId) {
    setStatus('Customer not found.');
    return;
  }

  let lastRenderedIds = '';

  const renderCards = (items) => {
    if (!items.length) {
      setStatus('No exceptions logged for this customer.');
      resizeCard();
      return;
    }

    items.sort((a, b) => {
      const aDate = new Date(_.get(a, 'attributes.createdAt', 0)).getTime();
      const bDate = new Date(_.get(b, 'attributes.createdAt', 0)).getTime();
      return bDate - aDate;
    });

    container.innerHTML = '';

    items.forEach((item) => {
      const exceptionId = _.get(item, 'id', '');
      const title = _.get(item, 'attributes.title', 'Exception');
      const created = _.get(item, 'attributes.createdAt', '');
      const reason = _.get(item, 'attributes.custom.exceptionReasonStr', '—');
      const order = _.get(item, 'attributes.custom.orderNumberStr', '—');
      const notes = _.get(item, 'attributes.custom.exceptionNotesTxt', '');

      const createdDisplay = created
        ? new Date(created).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
        : '—';

      const notesPreview =
        notes.length > 120 ? `${notes.slice(0, 120)}…` : (notes || '—');

      const card = document.createElement('div');
      card.className = 'exception-card clickable';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      const openEvent = () => {
        if (window.Kustomer?.openCustomerEvent) {
          window.Kustomer.openCustomerEvent(customerId, exceptionId);
        }
      };

      card.onclick = openEvent;
      card.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openEvent();
        }
      };

      card.innerHTML = `
        <div class="exception-title">${title}</div>
        <div class="exception-date">${createdDisplay}</div>

        <div class="exception-meta">
          <div><strong>Reason:</strong> ${reason}</div>
          <div><strong>Order:</strong> ${order}</div>
        </div>

        <div class="exception-notes">
          <strong>Notes:</strong> ${notesPreview}
        </div>
      `;

      container.appendChild(card);
    });

    resizeCard();
  };

  const fetchExceptionsByIds = (idsTxt) => {
    const ids = parseIds(idsTxt);
    console.log('Exception IDs to fetch:', ids);

    if (!ids.length) {
      renderCards([]);
      return;
    }

    const joinedIDs = ids.join(',');

    window.Kustomer.request(
      {
        url: `/v1/klasses/exception_log/${joinedIDs}?page=1&pageSize=100`,
        method: 'GET'
      },
      (err, data) => {
        console.log('Exception fetch err:', err);
        console.log('Exception fetch data:', data);

        const raw = data || err || [];
        const items = normalizeToArray(raw);

        console.log('Normalized exception items:', items);
        renderCards(items);
      }
    );
  };

  const fetchFreshCustomer = (attempt = 0) => {
    window.Kustomer.request(
      {
        url: `/v1/customers/${customerId}`,
        method: 'GET'
      },
      (err, data) => {
        console.log('Fresh customer err:', err);
        console.log('Fresh customer data:', data);

        const customerData = data || err || {};

        const freshIdsTxt =
          _.get(customerData, 'attributes.custom.exceptionLogIDsTxt') ||
          _.get(customerData, 'custom.exceptionLogIDsTxt') ||
          '';

        const freshIds = parseIds(freshIdsTxt);

        console.log('Fresh exceptionLogIDsTxt:', freshIdsTxt);

        // If there are no IDs, show the empty state immediately.
        // Retry twice in the background so a just-created first exception can appear
        // after the workflow updates the customer.
        if (!freshIds.length) {
          renderCards([]);

          if (attempt < 2) {
            setTimeout(() => fetchFreshCustomer(attempt + 1), 1200);
          }
          return;
        }

        // Avoid refetching the same IDs repeatedly
        if (freshIdsTxt === lastRenderedIds) {
          return;
        }

        lastRenderedIds = freshIdsTxt;
        fetchExceptionsByIds(freshIdsTxt);
      }
    );
  };

  // Use the initial context immediately if it already has IDs
  const initialIdsTxt =
    _.get(contextCustomer, 'attributes.custom.exceptionLogIDsTxt') ||
    _.get(contextCustomer, 'custom.exceptionLogIDsTxt') ||
    '';

  const initialIds = parseIds(initialIdsTxt);

  if (initialIds.length) {
    lastRenderedIds = initialIdsTxt;
    fetchExceptionsByIds(initialIdsTxt);
    // Still refresh in background in case the workflow appended a newer ID
    fetchFreshCustomer(0);
  } else {
    // Show a stable empty state immediately instead of hanging on "Loading..."
    renderCards([]);
    // Then check in the background for a newly-added first exception
    fetchFreshCustomer(0);
  }
});
