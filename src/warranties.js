const transitions = {
  received: ['assessment', 'closed'],
  assessment: ['approved', 'denied', 'closed'],
  approved: ['repair', 'resolved', 'closed'],
  denied: ['closed'],
  repair: ['resolved', 'closed'],
  resolved: ['repair', 'closed'],
  closed: []
};

function canTransition(from, to) {
  return Boolean(transitions[from]?.includes(to));
}

module.exports = { canTransition, warrantyTransitions: transitions };
