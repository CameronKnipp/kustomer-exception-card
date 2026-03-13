window.Kustomer.initialize((context) => {
  console.log('DynamicCard context:', context);

  const customer =
    context.customer ||
    context.user?.customer ||
    context.conversation?.customer ||
    context.object ||
    {};

  const exceptionIDs = (customer.custom?.exceptionLogIDsTxt || '')
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

      if (error) {
        container.innerHTML = 'Failed to load exceptions.';
        return;
      }

      const items =
        response?.data ||
        response?.body?.data ||
        response?.response?.data ||
        [];

      if (!items.length) {
        container.innerHTML = 'No exceptions logged for this customer.';
        return;
      }

      container.innerHTML = '';

      items.forEach((item) => {
        const title = item.attributes?.title || 'Exception';
        const created = item.attributes?.createdAt || '';
        const reason = item.attributes?.custom?.exceptionReasonStr || '';
        const order = item.attributes?.custom?.orderNumberStr || '';

        const card = document.createElement('div');
        card.className = 'exception-card';

        card.innerHTML = `
          <div class="exception-title">${title}</div>
          <div class="exception-date">${created ? new Date(created).toLocaleDateString() : '—'}</div>
          <div class="exception-meta">
            Reason: ${reason || '—'}<br/>
            Order: ${order || '—'}
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
