console.log('EXCEPTION CARD SCRIPT LOADED - v9');

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

  if (!customerId) {
    container.innerHTML = 'Customer not found.';
    return;
  }

  const renderExceptions = (exceptionIDsTxt) => {
    const exceptionIDs = (exceptionIDsTxt || '')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);

    console.log('Exception IDs from customer field:', exceptionIDs);

    if (!exceptionIDs.length) {
      container.innerHTML = 'No exceptions logged for this customer.';
      return;
    }

    const joinedIDs = exceptionIDs.join(',');

    window.Kustomer.request(
      {
        url: `/v1/klasses/exception_log/${joinedIDs}?page=1&pageSize=100`,
        method: 'GET'
      },
      (response, error) => {
        console.log('DynamicCard request response:', response);
        console.log('DynamicCard request error:', error);

        const rawItems =
          _.get(response, 'data') ||
          _.get(response, 'body.data') ||
          _.get(response, 'response.data') ||
          response ||
          _.get(error, 'data') ||
          _.get(error, 'body.data') ||
          _.get(error, 'response.data') ||
          error ||
          [];

        const items = Array.isArray(rawItems)
          ? rawItems
          : _.get(rawItems, 'id')
            ? [rawItems]
            : [];

        console.log('Normalized exception items:', items);

        if (!items.length) {
          container.innerHTML = 'No exceptions logged for this customer.';
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
          if (window.Kustomer && window.Kustomer.resize) {
            window.Kustomer.resize();
          }
        }, 100);
      }
    );
  };

  window.Kustomer.request(
    {
      url: `/v1/customers/${customerId}`,
      method: 'GET'
    },
    (response, error) => {
      console.log('Fresh customer response:', response);
      console.log('Fresh customer error:', error);

      const customerData =
        _.get(response, 'data') ||
        _.get(response, 'body.data') ||
        _.get(response, 'response.data') ||
        response ||
        _.get(error, 'data') ||
        _.get(error, 'body.data') ||
        _.get(error, 'response.data') ||
        error ||
        {};

      const freshExceptionIDsTxt =
        _.get(customerData, 'attributes.custom.exceptionLogIDsTxt') ||
        _.get(customerData, 'custom.exceptionLogIDsTxt') ||
        '';

      console.log('Fresh exceptionLogIDsTxt:', freshExceptionIDsTxt);

      renderExceptions(freshExceptionIDsTxt);
    }
  );
});
