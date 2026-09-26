'use strict';

const transitions = {
  reported: ['authorized', 'rejected', 'cancelled'],
  authorized: ['shipped', 'rejected', 'cancelled'],
  shipped: ['received', 'replacement_received', 'refund_received', 'rejected'],
  received: ['replacement_received', 'refund_received', 'rejected'],
  replacement_received: ['closed'],
  refund_received: ['closed'],
  rejected: ['closed'],
  cancelled: [],
  closed: []
};

function canTransition(from, to) {
  return Boolean(transitions[from]?.includes(to));
}

function stockEffect(toStatus, quantity) {
  if (toStatus === 'shipped') return -Number(quantity);
  if (toStatus === 'replacement_received') return Number(quantity);
  return 0;
}

module.exports = { canTransition, stockEffect, supplierReturnTransitions: transitions };
