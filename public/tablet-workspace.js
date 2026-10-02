document.addEventListener('DOMContentLoaded', () => {
  const workspace = document.querySelector('[data-tablet-workspace]');
  if (!workspace) return;
  const tabs = [...workspace.querySelectorAll('[data-work-tab]')];
  const panels = [...workspace.querySelectorAll('.tablet-work-panel')];
  const showPanel = (key, updateUrl = true) => {
    if (!tabs.some(tab => tab.dataset.workTab === key)) return;
    tabs.forEach(tab => {
      const selected = tab.dataset.workTab === key;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach(panel => { panel.hidden = panel.id !== `work-panel-${key}`; });
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('mode', 'view');
      url.searchParams.set('tab', key);
      history.replaceState(null, '', url);
    }
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => showPanel(tab.dataset.workTab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
        (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      tabs[next].focus();
      tabs[next].click();
    });
  });
  // These links remain usable without JS and select the corresponding panel with JS.
  workspace.querySelectorAll('a[href="#tablet-quality-checks"]').forEach(link => {
    link.addEventListener('click', event => { event.preventDefault(); showPanel('quality'); });
  });

  workspace.querySelectorAll('[data-tablet-items]').forEach(list => {
    const kind = list.dataset.tabletItems;
    const selector = kind === 'checks' ? 'tbody > tr[data-quality-row]' : kind === 'operations' ? '.tablet-operation' : '.tablet-update';
    const pager = document.createElement('nav');
    pager.className = 'tablet-item-pager';
    pager.setAttribute('aria-label', kind === 'checks' ? 'Controlli del collaudo' : kind === 'operations' ? 'Lavorazioni del veicolo' : 'Note e richieste');
    const previous = document.createElement('button');
    const next = document.createElement('button');
    const counter = document.createElement('span');
    previous.type = next.type = 'button';
    previous.className = next.className = 'button';
    previous.textContent = '← Precedente';
    next.textContent = 'Successivo →';
    counter.setAttribute('role', 'status');
    pager.append(previous, counter, next);
    list.after(pager);
    const storageKey = `go-tablet-page:${location.pathname}:${kind}`;
    let index = 0;
    try { index = Math.max(0, Number.parseInt(sessionStorage.getItem(storageKey) || '0', 10) || 0); } catch {}

    const render = () => {
      const items = [...list.querySelectorAll(selector)];
      index = Math.min(index, Math.max(0, items.length - 1));
      try { sessionStorage.setItem(storageKey, String(index)); } catch {}

      items.forEach((item, i) => { item.hidden = i !== index; });
      pager.hidden = items.length < 2;
      previous.disabled = index === 0;
      next.disabled = index >= items.length - 1;
      counter.textContent = `${index + 1} di ${items.length}`;
    };
    previous.addEventListener('click', () => { index--; render(); });
    next.addEventListener('click', () => { index++; render(); });
    // Setup may replace the checklist asynchronously. Rebind pagination to the new rows.
    new MutationObserver(records => {
      if (records.some(record => record.type === 'childList')) render();
    }).observe(list, { childList: true, subtree: true });
    render();
  });

  // Lengthy descriptions open in a dialog without pushing timer buttons below the screen.
  workspace.querySelectorAll('.mechanic-operation-info p,.tablet-complaint p,.tablet-update p').forEach(paragraph => {
    if (paragraph.textContent.length < 170) return;
    paragraph.classList.add('tablet-long-copy');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button small tablet-read-more';
    button.textContent = 'Leggi tutto';
    const dialog = document.createElement('dialog');
    dialog.className = 'tablet-copy-dialog';
    const copy = document.createElement('p');
    copy.textContent = paragraph.textContent;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'button primary';
    close.textContent = 'Chiudi';
    close.addEventListener('click', () => dialog.close());
    dialog.append(copy, close);
    document.body.append(dialog);
    button.addEventListener('click', () => dialog.showModal());
    paragraph.after(button);
  });
});
