const Service = require('../models/Service');
const DEFAULT_SERVICES = require('../config/services');

async function getServices() {
  // Only services explicitly added through Admin Panel are customer-selectable.
  // The old default service list is kept only for optional icon/description metadata.
  const services = await Service.find({ active: true, isAdminAdded: true }).sort({ createdAt: 1 });

  const meta = new Map(DEFAULT_SERVICES.map(s => [s.name, s]));
  return services.map(s => ({
    _id: s._id,
    name: s.name,
    price: s.price,
    active: s.active,
    icon: meta.get(s.name)?.icon || '🦷',
    description: meta.get(s.name)?.description || ''
  }));
}

module.exports = getServices;
