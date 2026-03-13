console.log('EXCEPTION CARD SCRIPT LOADED - v6');

window.Kustomer.initialize((context) => {
  console.log('DynamicCard context:', context);

  const customer =
    context.customer ||
    context.user?.customer ||
    context.conversation?.customer ||
    context.object ||
    {};

  const customerId =
    customer.id ||
    customer.attributes?.id ||
    '';

  const exceptionIDsTxt =
    customer.attributes?.custom?.exceptionLogIDsTxt ||
    customer.custom?.exceptionLogIDsTxt ||
    '';

  const exceptionIDs = exceptionIDsTxt
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);

  const container = document.getElementById('exceptions-list');

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

      const items =
        response?.data ||
        response?.body?.data ||
        response?.response?.data ||
        (Array.isArray(response) ? response : null) ||
        error?.data ||
        error?.body?.data ||
        error?.response?.data ||
        (Array.isArray(error) ? error : []);

      if (!items.length) {
        container.innerHTML = 'No exceptions logged for this customer.';
        return;
      }

      // sort newest first
      items.sort((a, b) => {
        const aDate = new Date(a.attributes?.createdAt || 0).getTime();
        const bDate = new Date(b.attributes?.createdAt || 0).getTime();
        return bDate - aDate;
      });

      container.innerHTML = '';

      const kustomerBaseUrl = 'https://nathanjames.kustomerapp.com';

      items.forEach((item) => {

        const exceptionId = item.id;

        const targetUrl =
          `${kustomerBaseUrl}/app/customers/${customerId}/event/${exceptionId}`;

        const title = item.attributes?.title || 'Exception';

        const created = item.attributes?.createdAt || '';

        const createdDisplay = created
          ? new Date(created).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })
          : '—';

        const reason =
          item.attributes?.custom?.exceptionReasonStr || '—';

        const order =
          item.attributes?.custom?.orderNumberStr || '—';

        const retailer =
          item.attributes?.custom?.retailerStr || '—';

        const notes =
          item.attributes?.custom?.exceptionNotesTxt || '';

        const notesPreview =
          notes.length > 120 ? `${notes.slice(0, 120)}…` : notes;

        const card = document.createElement('div');

        card.className = 'exception-card clickable';

        card.onclick = () => {
          window.top.location.href = targetUrl;
        };

        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');

        card.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.top.location.href = targetUrl;
          }
        };

        card.innerHTML = `
          <div class="exception-title">${title}</div>
          <div class="exception-date">${createdDisplay}</div>

          <div class="exception-meta">
            <div><strong>Reason:</strong> ${reason}</div>
            <div><strong>Order:</strong> ${order}</div>
            <div><strong>Retailer:</strong> ${retailer}</div>
          </div>

          <div class="exception-notes">
            <strong>Notes:</strong> ${notesPreview || '—'}
          </div>
        `;

        container.appendChild(card);

      });

      if (window.Kustomer.resize) {
        window.Kustomer.resize();
      }

    }
  );

});
