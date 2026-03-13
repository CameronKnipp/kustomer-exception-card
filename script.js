console.log('EXCEPTION CARD SCRIPT LOADED - v11');

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
    if (container) {
      container.innerHTML = msg;
    }
  };

  const normalizeToArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  const renderCards = (items) => {
    if (!items.length) {
      setStatus('No exceptions logged for this customer.');
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

    setTimeout(() => {
      if (window.Kustomer?.resize) {
        window.Kustomer.resize();
      }
    }, 100);
  };

  const fetchExceptions = (exceptionIDsTxt) => {
    const exceptionIDs = (exceptionIDsTxt || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

    console.log('Exception IDs from customer field:', exceptionIDs);

    if (!exceptionIDs.length) {
      setStatus('No exceptions logged for this customer.');
      return;
    }

    const joinedIDs = exceptionIDs.join(',');

    window.Kustomer.request(
      {
        url: `/v1/klasses/exception_log/${joinedIDs}?page=1&pageSize=100`,
        method: 'GET'
      },
      (err, data) => {
        console.log('Exception fetch err:', err);
        console.log('Exception fetch data:', data);

        if (err && !data) {
          setStatus('Could not load exceptions.');
          return;
        }

        const items = normalizeToArray(data);
        renderCards(items);
      }
    );
  };

  const fetchFreshCustomer = () => {
    if (!customerId) {
      setStatus('Customer not found.');
      return;
    }

    setStatus('Loading exceptions...');

    window.Kustomer.request(
      {
        url: `/v1/customers/${customerId}`,
        method: 'GET'
      },
      (err, data) => {
        console.log('Fresh customer err:', err);
        console.log('Fresh customer data:', data);

        if (err && !data) {
          setStatus('Could not load exceptions.');
          return;
        }

        const freshExceptionIDsTxt =
          _.get(data, 'attributes.custom.exceptionLogIDsTxt') ||
          _.get(data, 'custom.exceptionLogIDsTxt') ||
          '';

        console.log('Fresh exceptionLogIDsTxt:', freshExceptionIDsTxt);

        fetchExceptions(freshExceptionIDsTxt);
      }
    );
  };

  fetchFreshCustomer();
});
