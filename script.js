Kustomer.initialize((context) => {

  const customer = context.customer || {};
  const exceptionIDs = (customer.custom?.exceptionLogIDsTxt || "")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);

  const container = document.getElementById("exceptions-list");

  if (!exceptionIDs.length) {
    container.innerHTML = "No exceptions logged for this customer.";
    return;
  }

  const joinedIDs = exceptionIDs.join(",");

  fetch(`/v1/klasses/exception_log/${joinedIDs}?page=1&pageSize=100`, {
    credentials: "include"
  })
  .then(r => r.json())
  .then(data => {

    const items = data.data || [];

    if (!items.length) {
      container.innerHTML = "No exceptions found.";
      return;
    }

    container.innerHTML = "";

    items.forEach(item => {

      const title = item.attributes?.title || "Exception";
      const created = item.attributes?.createdAt || "";
      const reason = item.attributes?.custom?.exceptionReasonStr || "";
      const order = item.attributes?.custom?.orderNumberStr || "";

      const card = document.createElement("div");
      card.className = "exception-card";

      card.innerHTML = `
        <div class="exception-title">${title}</div>
        <div class="exception-date">${new Date(created).toLocaleDateString()}</div>
        <div class="exception-meta">
          Reason: ${reason}<br/>
          Order: ${order}
        </div>
      `;

      container.appendChild(card);

    });

  })
  .catch(() => {
    container.innerHTML = "Failed to load exceptions.";
  });

});
