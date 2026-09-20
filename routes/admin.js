const express = require('express');
const router = express.Router();
const requireAdmin = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const Doctor = require('../models/Doctor');
const CeoInfo = require('../models/CeoInfo');
const TeamMember = require('../models/TeamMember');
const Appointment = require('../models/Appointment');
const Gallery = require('../models/Gallery');
const Service = require('../models/Service');
const Review = require('../models/Review');
const upload = require('../utils/upload');
const { uploadBuffer, destroy: destroyCloudinary } = require('../utils/cloudinary');

// True when the request came from our AJAX admin forms (fetch + FormData),
// so we can respond with JSON instead of a redirect/re-render.
function wantsJson(req) {
  return (
    req.xhr ||
    req.get('X-Requested-With') === 'XMLHttpRequest' ||
    (req.get('Accept') || '').includes('application/json')
  );
}

/* ---------------- ADMIN HOME ---------------- */

// Vercel and browsers commonly open /admin directly.
// Redirect it to the login page (or dashboard when already authenticated).
router.get('/', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect(303, '/admin/dashboard');
  }
  return res.redirect(303, '/admin/login');
});

/* ---------------- LOGIN / LOGOUT ---------------- */

router.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect(303, '/admin/dashboard');
  }
  res.render('admin/login', { title: 'Admin Login', error: null });
});

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect(303, '/admin/dashboard');
  }
  res.status(401).render('admin/login', { title: 'Admin Login', error: 'Incorrect password.' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect(303, '/admin/login');
  });
});

/* Everything below this line requires an active admin session */
router.use(requireAdmin);

/* ---------------- DASHBOARD ---------------- */

router.get('/dashboard', asyncHandler(async (req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const [todayCount, pendingCount, totalDoctors, totalAppointments] = await Promise.all([
    Appointment.countDocuments({ preferredDate: { $gte: startOfToday, $lte: endOfToday } }),
    Appointment.countDocuments({ status: 'pending' }),
    Doctor.countDocuments({}),
    Appointment.countDocuments({})
  ]);

  res.render('admin/dashboard', {
    title: 'Dashboard',
    todayCount,
    pendingCount,
    totalDoctors,
    totalAppointments
  });
}));

// Safety net: if a POST ever lands on /dashboard (e.g. a 307 redirect
// preserving method), send it back to the dashboard as a GET instead of 404ing.
router.post('/dashboard', (req, res) => res.redirect(303, '/admin/dashboard'));

/* ---------------- DOCTORS ---------------- */

router.get('/doctors', asyncHandler(async (req, res) => {
  const doctors = await Doctor.find({}).sort({ createdAt: -1 });
  res.render('admin/doctors', { title: 'Manage Doctors', doctors });
}));

router.get('/doctors/new', (req, res) => {
  res.render('admin/doctor-form', { title: 'Add Doctor', doctor: null, error: null });
});

router.post('/doctors', upload.single('photo'), asyncHandler(async (req, res) => {
  try {
    const { name, specialty, bio, active } = req.body;

    if (!name || !specialty) {
      throw new Error('Name and specialty are required.');
    }

    // Guard against duplicate creates if this request gets resent/retried
    // (slow connection, a proxy retry, an accidental double submit, etc.):
    // if the exact same doctor was already added moments ago, treat this
    // as the same request instead of adding it again.
    const recentDuplicate = await Doctor.findOne({
      name: name.trim(),
      specialty: specialty.trim(),
      createdAt: { $gte: new Date(Date.now() - 15000) }
    }).sort({ createdAt: -1 });

    if (recentDuplicate) {
      if (wantsJson(req)) return res.json({ success: true });
      return res.redirect('/admin/doctors');
    }

    let photoUrl = '';

    if (req.file) {
      const uploaded = await uploadBuffer(
        req.file.buffer,
        'hiks-dental/doctors'
      );
      photoUrl = uploaded.secure_url;
    }

    await Doctor.create({
      name,
      specialty,
      photoUrl,
      bio: bio || '',
      active: active === 'on'
    });

    if (wantsJson(req)) return res.json({ success: true });
    res.redirect('/admin/doctors');
  } catch (err) {
    const message = err.message || 'Could not save doctor.';
    if (wantsJson(req)) return res.status(400).json({ success: false, error: message });
    res.status(400).render('admin/doctor-form', {
      title: 'Add Doctor',
      doctor: req.body,
      error: message
    });
  }
}));

router.get('/doctors/:id/edit', asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) return res.redirect('/admin/doctors');

  res.render('admin/doctor-form', {
    title: 'Edit Doctor',
    doctor,
    error: null
  });
}));

router.post('/doctors/:id', upload.single('photo'), asyncHandler(async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      if (wantsJson(req)) return res.status(404).json({ success: false, error: 'Doctor not found.' });
      return res.redirect('/admin/doctors');
    }

    const { name, specialty, bio, active } = req.body;

    if (!name || !specialty) {
      throw new Error('Name and specialty are required.');
    }

    const updateData = {
      name,
      specialty,
      bio: bio || '',
      active: active === 'on'
    };

    if (req.file) {
      const uploaded = await uploadBuffer(
        req.file.buffer,
        'hiks-dental/doctors'
      );

      updateData.photoUrl = uploaded.secure_url;
    }

    await Doctor.findByIdAndUpdate(
      req.params.id,
      updateData,
      { runValidators: true }
    );

    if (wantsJson(req)) return res.json({ success: true });
    res.redirect('/admin/doctors');
  } catch (err) {
    const message = err.message || 'Could not update doctor.';
    if (wantsJson(req)) return res.status(400).json({ success: false, error: message });
    res.status(400).render('admin/doctor-form', {
      title: 'Edit Doctor',
      doctor: {
        ...req.body,
        _id: req.params.id,
        photoUrl: ''
      },
      error: message
    });
  }
}));

router.post('/doctors/:id/delete', asyncHandler(async (req, res) => {
  try {
    await Doctor.findByIdAndDelete(req.params.id);
    if (wantsJson(req)) return res.json({ success: true });
    res.redirect('/admin/doctors');
  } catch (err) {
    if (wantsJson(req)) return res.status(500).json({ success: false, error: 'Could not delete doctor.' });
    res.redirect('/admin/doctors');
  }
}));

/* ---------------- CEO MESSAGE ---------------- */

router.get('/ceo', asyncHandler(async (req, res) => {
  const ceo = await CeoInfo.findOne({});
  res.render('admin/ceo', { title: 'CEO Message', ceo, error: null });
}));

router.post('/ceo', upload.single('photo'), asyncHandler(async (req, res) => {
  try {
    const { name, title, message } = req.body;
    const updateData = {
      name: name || '',
      title: title || 'Chief Executive Officer',
      message: message || '',
      active: true
    };

    if (req.file) {
      const uploaded = await uploadBuffer(req.file.buffer, 'hiks-dental/ceo');
      updateData.photoUrl = uploaded.secure_url;
    }

    const existing = await CeoInfo.findOne({});
    if (existing) {
      await CeoInfo.findByIdAndUpdate(existing._id, updateData, { runValidators: true });
    } else {
      await CeoInfo.create(updateData);
    }

    if (wantsJson(req)) return res.json({ success: true });
    res.redirect('/admin/ceo');
  } catch (err) {
    const message = err.message || 'Could not save CEO message.';
    if (wantsJson(req)) return res.status(400).json({ success: false, error: message });
    const ceo = await CeoInfo.findOne({});
    res.status(400).render('admin/ceo', { title: 'CEO Message', ceo, error: message });
  }
}));

/* ---------------- OUR TEAM ---------------- */

router.get('/team', asyncHandler(async (req, res) => {
  const teamMembers = await TeamMember.find({}).sort({ createdAt: -1 });
  res.render('admin/team', { title: 'Our Team', teamMembers });
}));

router.get('/team/new', (req, res) => {
  res.render('admin/team-form', { title: 'Add Team Member', member: null, error: null });
});

router.post('/team', upload.single('photo'), asyncHandler(async (req, res) => {
  try {
    const { name, title, description, active } = req.body;

    if (!name || !title) {
      throw new Error('Name and title are required.');
    }

    // Same duplicate-submission guard as Doctors — see the comment there.
    const recentDuplicate = await TeamMember.findOne({
      name: name.trim(),
      title: title.trim(),
      createdAt: { $gte: new Date(Date.now() - 15000) }
    }).sort({ createdAt: -1 });

    if (recentDuplicate) {
      if (wantsJson(req)) return res.json({ success: true });
      return res.redirect('/admin/team');
    }

    let photoUrl = '';

    if (req.file) {
      const uploaded = await uploadBuffer(req.file.buffer, 'hiks-dental/team');
      photoUrl = uploaded.secure_url;
    }

    await TeamMember.create({
      name,
      title,
      photoUrl,
      description: description || '',
      active: active === 'on'
    });

    if (wantsJson(req)) return res.json({ success: true });
    res.redirect('/admin/team');
  } catch (err) {
    const message = err.message || 'Could not save team member.';
    if (wantsJson(req)) return res.status(400).json({ success: false, error: message });
    res.status(400).render('admin/team-form', {
      title: 'Add Team Member',
      member: req.body,
      error: message
    });
  }
}));

router.get('/team/:id/edit', asyncHandler(async (req, res) => {
  const member = await TeamMember.findById(req.params.id);
  if (!member) return res.redirect('/admin/team');

  res.render('admin/team-form', {
    title: 'Edit Team Member',
    member,
    error: null
  });
}));

router.post('/team/:id', upload.single('photo'), asyncHandler(async (req, res) => {
  try {
    const member = await TeamMember.findById(req.params.id);

    if (!member) {
      if (wantsJson(req)) return res.status(404).json({ success: false, error: 'Team member not found.' });
      return res.redirect('/admin/team');
    }

    const { name, title, description, active } = req.body;

    if (!name || !title) {
      throw new Error('Name and title are required.');
    }

    const updateData = {
      name,
      title,
      description: description || '',
      active: active === 'on'
    };

    if (req.file) {
      const uploaded = await uploadBuffer(req.file.buffer, 'hiks-dental/team');
      updateData.photoUrl = uploaded.secure_url;
    }

    await TeamMember.findByIdAndUpdate(
      req.params.id,
      updateData,
      { runValidators: true }
    );

    if (wantsJson(req)) return res.json({ success: true });
    res.redirect('/admin/team');
  } catch (err) {
    const message = err.message || 'Could not update team member.';
    if (wantsJson(req)) return res.status(400).json({ success: false, error: message });
    res.status(400).render('admin/team-form', {
      title: 'Edit Team Member',
      member: {
        ...req.body,
        _id: req.params.id,
        photoUrl: ''
      },
      error: message
    });
  }
}));

router.post('/team/:id/delete', asyncHandler(async (req, res) => {
  try {
    await TeamMember.findByIdAndDelete(req.params.id);
    if (wantsJson(req)) return res.json({ success: true });
    res.redirect('/admin/team');
  } catch (err) {
    if (wantsJson(req)) return res.status(500).json({ success: false, error: 'Could not delete team member.' });
    res.redirect('/admin/team');
  }
}));

/* ---------------- TREATMENT RESULTS GALLERY ---------------- */

router.get('/gallery', asyncHandler(async (req, res) => {
  const photos = await Gallery.find({ category: 'Treatment Results' }).sort({ createdAt: -1 });
  res.render('admin/gallery', { title: 'Treatment Results Gallery', photos, error: null });
}));

/* ---------------- CLINIC GALLERY ---------------- */

router.get('/clinic-gallery', asyncHandler(async (req, res) => {
  const photos = await Gallery.find({ category: 'Clinic' }).sort({ createdAt: -1 });
  res.render('admin/clinic-gallery', { title: 'Clinic Gallery', photos, error: null });
}));

router.post('/clinic-gallery', upload.single('photo'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) throw new Error('Please choose an image to upload.');
    const { title } = req.body;
    if (!title || !title.trim()) throw new Error('Please enter a photo title.');

    const folder = 'hiks-dental/gallery/clinic';
    const uploaded = await uploadBuffer(req.file.buffer, folder);

    await Gallery.create({
      title: title.trim(),
      category: 'Clinic',
      treatment: 'Other',
      imageUrl: uploaded.secure_url,
      cloudinaryPublicId: uploaded.public_id
    });
    if (wantsJson(req)) return res.json({ success: true });
    res.redirect('/admin/clinic-gallery');
  } catch (err) {
    const message = err.message || 'Could not upload photo.';
    if (wantsJson(req)) return res.status(400).json({ success: false, error: message });
    const photos = await Gallery.find({ category: 'Clinic' }).sort({ createdAt: -1 });
    res.status(400).render('admin/clinic-gallery', { title: 'Clinic Gallery', photos, error: message });
  }
}));

router.post('/clinic-gallery/:id/delete', asyncHandler(async (req, res) => {
  const photo = await Gallery.findOneAndDelete({ _id: req.params.id, category: 'Clinic' });
  if (photo && photo.cloudinaryPublicId) await destroyCloudinary(photo.cloudinaryPublicId);
  res.redirect('/admin/clinic-gallery');
}));

router.post('/gallery', upload.single('photo'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) throw new Error('Please choose an image to upload.');
    const { title, category, treatment } = req.body;
    if (!title || !title.trim()) throw new Error('Please enter a photo title.');

    const safeCategory = ['Clinic', 'Services', 'Treatment Results'].includes(category) ? category : 'Treatment Results';
    const treatments = ['Scaling', 'Whitening', 'RCT', 'Crowns', 'Implants', 'Cosmetic Dentistry', 'Other'];
    const safeTreatment = treatments.includes(treatment) ? treatment : 'Other';
    const folder = `hiks-dental/gallery/${safeCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const uploaded = await uploadBuffer(req.file.buffer, folder);

    await Gallery.create({
      title: title.trim(),
      category: safeCategory,
      treatment: safeCategory === 'Treatment Results' ? safeTreatment : 'Other',
      imageUrl: uploaded.secure_url,
      cloudinaryPublicId: uploaded.public_id
    });
    if (wantsJson(req)) return res.json({ success: true });
    res.redirect('/admin/gallery');
  } catch (err) {
    const message = err.message || 'Could not upload photo.';
    if (wantsJson(req)) return res.status(400).json({ success: false, error: message });
    const photos = await Gallery.find({ category: 'Treatment Results' }).sort({ createdAt: -1 });
    res.status(400).render('admin/gallery', { title: 'Treatment Results Gallery', photos, error: message });
  }
}));

router.post('/gallery/:id/delete', asyncHandler(async (req, res) => {
  const photo = await Gallery.findByIdAndDelete(req.params.id);
  if (photo && photo.cloudinaryPublicId) await destroyCloudinary(photo.cloudinaryPublicId);
  res.redirect('/admin/gallery');
}));

/* ---------------- SERVICES ---------------- */

router.get('/services', asyncHandler(async (req, res) => {
  const services = await Service.find({ isAdminAdded: true }).sort({ createdAt: 1 });
  res.render('admin/services', { title: 'Manage Services', services });
}));

router.get('/services/new', (req, res) => {
  res.render('admin/service-form', { title: 'Add Service', service: null, error: null });
});

router.post('/services', upload.single('photo'), asyncHandler(async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const price = Number(req.body.price);
    const description = (req.body.description || '').trim();
    const videoUrl = (req.body.videoUrl || '').trim();
    if (!name) throw new Error('Please enter a service name.');
    if (!Number.isFinite(price) || price < 0) throw new Error('Please enter a valid price.');

    let photoUrl = '';
    if (req.file) {
      const uploaded = await uploadBuffer(req.file.buffer, 'hiks-dental/services');
      photoUrl = uploaded.secure_url;
    }

    // A fixed default service (from config/services.js) becoming admin-managed
    // for the first time reuses that existing document rather than creating
    // a duplicate with the same name.
    const existingLegacy = await Service.findOne({ name, isAdminAdded: { $ne: true } });
    if (existingLegacy) {
      existingLegacy.price = price;
      existingLegacy.description = description;
      if (photoUrl) existingLegacy.photoUrl = photoUrl;
      existingLegacy.active = true;
      existingLegacy.isAdminAdded = true;
      existingLegacy.videoUrl = videoUrl;
      await existingLegacy.save();
    } else {
      await Service.create({ name, price, description, photoUrl, active: true, isAdminAdded: true, videoUrl });
    }

    if (wantsJson(req)) return res.json({ success: true });
    res.redirect('/admin/services');
  } catch (err) {
    const message = err.code === 11000 ? 'A service with this name already exists.' : (err.message || 'Could not add service.');
    if (wantsJson(req)) return res.status(400).json({ success: false, error: message });
    res.status(400).render('admin/service-form', { title: 'Add Service', service: req.body, error: message });
  }
}));

router.get('/services/:id/edit', asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) return res.redirect('/admin/services');
  res.render('admin/service-form', { title: 'Edit Service', service, error: null });
}));

router.post('/services/:id', upload.single('photo'), asyncHandler(async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const price = Number(req.body.price);
    const description = (req.body.description || '').trim();
    const videoUrl = (req.body.videoUrl || '').trim();
    if (!name) throw new Error('Please enter a service name.');
    if (!Number.isFinite(price) || price < 0) throw new Error('Please enter a valid price.');

    const updateData = { name, price, description, videoUrl };

    if (req.file) {
      const uploaded = await uploadBuffer(req.file.buffer, 'hiks-dental/services');
      updateData.photoUrl = uploaded.secure_url;
    }

    await Service.findByIdAndUpdate(req.params.id, updateData, { runValidators: true });
    if (wantsJson(req)) return res.json({ success: true });
    res.redirect('/admin/services');
  } catch (err) {
    const message = err.code === 11000 ? 'A service with this name already exists.' : (err.message || 'Could not update service.');
    if (wantsJson(req)) return res.status(400).json({ success: false, error: message });
    res.status(400).render('admin/service-form', {
      title: 'Edit Service',
      service: { ...req.body, _id: req.params.id, photoUrl: '' },
      error: message
    });
  }
}));

router.post('/services/:id/delete', asyncHandler(async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    if (wantsJson(req)) return res.json({ success: true });
    res.redirect('/admin/services');
  } catch (err) {
    if (wantsJson(req)) return res.status(500).json({ success: false, error: 'Could not delete service.' });
    res.redirect('/admin/services');
  }
}));

/* ---------------- CUSTOMER REVIEWS ---------------- */

router.get('/reviews', asyncHandler(async (req, res) => {
  const reviews = await Review.find({}).sort({ createdAt: -1 });
  res.render('admin/reviews', { title: 'Customer Reviews', reviews, error: null });
}));

router.post('/reviews', upload.none(), asyncHandler(async (req, res) => {
  try {
    const customerName = (req.body.customerName || '').trim();
    const rating = Number(req.body.rating);
    const reviewText = (req.body.reviewText || '').trim();
    if (!customerName) throw new Error('Please enter the customer name.');
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new Error('Please select a valid rating.');
    if (!reviewText) throw new Error('Please enter the review text.');
    await Review.create({ customerName, rating, reviewText });
    if (wantsJson(req)) return res.json({ success: true });
    res.redirect('/admin/reviews');
  } catch (err) {
    const message = err.message || 'Could not add review.';
    if (wantsJson(req)) return res.status(400).json({ success: false, error: message });
    const reviews = await Review.find({}).sort({ createdAt: -1 });
    res.status(400).render('admin/reviews', { title: 'Customer Reviews', reviews, error: message });
  }
}));

router.post('/reviews/:id', upload.none(), asyncHandler(async (req, res) => {
  try {
    const customerName = (req.body.customerName || '').trim();
    const rating = Number(req.body.rating);
    const reviewText = (req.body.reviewText || '').trim();
    if (!customerName) throw new Error('Please enter the customer name.');
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new Error('Please select a valid rating.');
    if (!reviewText) throw new Error('Please enter the review text.');
    await Review.findByIdAndUpdate(req.params.id, { customerName, rating, reviewText }, { runValidators: true });
    if (wantsJson(req)) return res.json({ success: true });
    res.redirect('/admin/reviews');
  } catch (err) {
    const message = err.message || 'Could not update review.';
    if (wantsJson(req)) return res.status(400).json({ success: false, error: message });
    const reviews = await Review.find({}).sort({ createdAt: -1 });
    res.status(400).render('admin/reviews', { title: 'Customer Reviews', reviews, error: message });
  }
}));

router.post('/reviews/:id/delete', asyncHandler(async (req, res) => {
  await Review.findByIdAndDelete(req.params.id);
  res.redirect('/admin/reviews');
}));

/* ---------------- APPOINTMENTS ---------------- */

router.get('/appointments', asyncHandler(async (req, res) => {
  const statusFilter = req.query.status;
  const filter = statusFilter ? { status: statusFilter } : {};
  const appointments = await Appointment.find(filter)
    .populate('doctor')
    .sort({ createdAt: -1 });
  res.render('admin/appointments', {
    title: 'Appointments',
    appointments,
    statusFilter: statusFilter || ''
  });
}));

router.post('/appointments/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'confirmed', 'cancelled', 'completed'];

  if (!allowed.includes(status)) {
    if (wantsJson(req)) return res.status(400).json({ success: false, error: 'Invalid status.' });
    return res.redirect('back');
  }

  try {
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status },              // only status is ever written here — token is never touched
      { new: true, runValidators: true }
    );

    if (!appointment) {
      if (wantsJson(req)) return res.status(404).json({ success: false, error: 'Appointment not found.' });
      return res.redirect('back');
    }

    if (wantsJson(req)) {
      return res.json({ success: true, status: appointment.status, token: appointment.token });
    }
    return res.redirect('back');
  } catch (err) {
    if (wantsJson(req)) return res.status(500).json({ success: false, error: 'Could not update status.' });
    return res.redirect('back');
  }
}));

router.post('/appointments/:id/delete', asyncHandler(async (req, res) => {
  await Appointment.findByIdAndDelete(req.params.id);
  res.redirect('back');
}));

module.exports = router;
