<script>
console.log('EXCEPTION CARD SCRIPT LOADED - normalized pre-request version');

window.Kustomer.initialize(function (context) {
  console.log('DynamicCard context:', context);

  function get(obj, path, fallback) {
    try {
      var parts = path.split('.');
      var current = obj;
      for (var i = 0; i < parts.length; i++) {
        if (current == null) return fallback;
        current = current[parts[i]];
      }
      return current === undefined ? fallback : current;
    } catch (e) {
      return fallback;
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function resizeCard() {
    setTimeout(function () {
      if (window.Kustomer && typeof window.Kustomer.resize === 'function') {
        window.Kustomer.resize();
      }
    }, 100);
  }

  function normalizeExceptionIds(rawValue) {
    if (rawValue == null) return [];

    var cleaned = String(rawValue)
      .split(',')
      .map(function (id) {
        return String(id).trim();
      })
      .filter(function (id) {
        return id.length > 0;
      });

    return cleaned;
  }

  function normalizeResponseToArray(response) {
    if (!response) return [];

    var data =
      response.data ||
      response.body && response.body.data ||
      response.response && response.response.data ||
      response;

    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'object') return [data];

    return [];
  }

  function formatDate(value) {
    if (!value) return '—';

    var date = new Date(value);
    if (isNaN(date.getTime())) return '—';

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function setEmptyState(container, message) {
    container.innerHTML = '<div class="empty-state">' + escapeHtml(message) + '</div>';
    resizeCard();
  }

  function renderExceptions(container, customerId, items) {
    if (!Array.isArray(items) || items.length === 0) {
      setEmptyState(container, 'No exceptions logged for this customer.');
      return;
    }

    var sortedItems = items.slice().sort(function (a, b) {
      var aTime = new Date(get(a, 'attributes.createdAt', 0)).getTime() || 0;
      var bTime = new Date(get(b, 'attributes.createdAt', 0)).getTime() || 0;
      return bTime - aTime;
    });

    container.innerHTML = '';

    sortedItems.forEach(function (item) {
      var exceptionId = get(item, 'id', '');
      var title = get(item, 'attributes.title', 'Exception');
      var createdAt = get(item, 'attributes.createdAt', '');
      var reason = get(item, 'attributes.custom.exceptionReasonStr', '—');
      var orderNumber = get(item, 'attributes.custom.orderNumberStr', '—');
      var notes = get(item, 'attributes.custom.exceptionNotesTxt', '');
      var createdDisplay = formatDate(createdAt);

      var notesPreview = String(notes || '—');
      if (notesPreview.length > 140) {
        notesPreview = notesPreview.slice(0, 140) + '...';
      }

      var card = document.createElement('div');
      card.className = 'exception-card clickable';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      function openEvent() {
        if (
          window.Kustomer &&
          typeof window.Kustomer.openCustomerEvent === 'function' &&
          customerId &&
          exceptionId
        ) {
          window.Kustomer.openCustomerEvent(customerId, exceptionId);
        }
      }

      card.addEventListener('click', openEvent);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openEvent();
        }
      });

      card.innerHTML =
        '<div class="exception-title">' + escapeHtml(title) + '</div>' +
        '<div class="exception-date">' + escapeHtml(createdDisplay) + '</div>' +
        '<div class="exception-meta">' +
          '<div><strong>Reason:</strong> ' + escapeHtml(reason) + '</div>' +
          '<div><strong>Order:</strong> ' + escapeHtml(orderNumber) + '</div>' +
        '</div>' +
        '<div class="exception-notes"><strong>Notes:</strong> ' + escapeHtml(notesPreview) + '</div>';

      container.appendChild(card);
    });

    resizeCard();
  }

  function requestAsync(options) {
    return new Promise(function (resolve, reject) {
      window.Kustomer.request(options, function (error, response) {
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  }

  var container = document.getElementById('exceptions-list');
  if (!container) {
    console.error('Missing #exceptions-list container');
    return;
  }

  var contextCustomer =
    get(context, 'customer', null) ||
    get(context, 'user.customer', null) ||
    get(context, 'conversation.customer', null) ||
    get(context, 'object', null) ||
    {};

  var customerId =
    get(contextCustomer, 'id', '') ||
    get(contextCustomer, 'attributes.id', '');

  if (!customerId) {
    setEmptyState(container, 'Customer not found.');
    return;
  }

  var rawExceptionIds =
    get(contextCustomer, 'attributes.custom.exceptionLogIDsTxt', '') ||
    get(contextCustomer, 'custom.exceptionLogIDsTxt', '') ||
    '';

  console.log('Raw exceptionLogIDsTxt:', rawExceptionIds);

  // NORMALIZE BEFORE API TOUCHES ANYTHING
  var normalizedIds = normalizeExceptionIds(rawExceptionIds);

  console.log('Normalized exception IDs:', normalizedIds);

  if (normalizedIds.length === 0) {
    setEmptyState(container, 'No exceptions logged for this customer.');
    return;
  }

  var joinedIds = normalizedIds.join(',');

  console.log('Joined normalized IDs for request:', joinedIds);

  requestAsync({
    url: '/v1/klasses/exception_log/' + encodeURIComponent(joinedIds) + '?page=1&pageSize=100',
    method: 'GET'
  })
    .then(function (response) {
      console.log('Exception API response:', response);

      var items = normalizeResponseToArray(response);

      console.log('Normalized response items:', items);

      renderExceptions(container, customerId, items);
    })
    .catch(function (error) {
      console.error('Failed to fetch exceptions:', error);
      setEmptyState(container, 'Could not load exceptions.');
    });
});
</script>
