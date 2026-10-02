function renderTabletWorkspace(panels, selected = 'repair') {
  if (!panels.some(panel => panel.key === selected)) selected = panels[0].key;
  return `<section class="tablet-workspace" data-tablet-workspace>
    <nav class="tablet-work-tabs" role="tablist" aria-label="Schede del veicolo">${panels.map(panel => `<button type="button" class="button" role="tab" id="work-tab-${panel.key}" aria-controls="work-panel-${panel.key}" aria-selected="${panel.key === selected}" tabindex="${panel.key === selected ? 0 : -1}" data-work-tab="${panel.key}">${panel.label}</button>`).join('')}</nav>
    <div class="tablet-work-stage">${panels.map(panel => `<section class="tablet-work-panel" role="tabpanel" id="work-panel-${panel.key}" aria-labelledby="work-tab-${panel.key}" ${panel.key === selected ? '' : 'hidden'}>${panel.html}</section>`).join('')}</div>
  </section>`;
}
module.exports = { renderTabletWorkspace };
