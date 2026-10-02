// Keep tablet URLs separate while reusing the same permissions, CSRF and workflow locks.
function tabletActionPath(method, pathname) {
  if (method !== 'POST') return null;
  if (/^\/tablet\/work-orders\/\d+\/(quality-checks\/setup|road-tests|mark-ready|close-early)$/.test(pathname) ||
      /^\/tablet\/quality-checks\/\d+$/.test(pathname)) return pathname.slice('/tablet'.length);
  return null;
}

function tabletActionRedirect(location, action) {
  const match = String(location).match(/^\/work-orders\/(\d+)(?:\?tab=([a-z-]+))?$/);
  if (!match) return location;
  const tab = match[2] || (action.endsWith('/road-tests') ? 'road-test' : 'quality');
  return `/tablet/work-orders/${match[1]}?mode=view&tab=${tab}`;
}

module.exports = { tabletActionPath, tabletActionRedirect };
