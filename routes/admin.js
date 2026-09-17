const express = require('express');
const router = express.Router();
const requireAdmin = require('../middleware/auth');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Gallery = require('../models/Gallery');
const Service = require('../models/Service');
const Review = require('../models/Review');
const upload = require('../utils/upload');
const { uploadBuffer, destroy: destroyCloudinary } = require('../utils/cloudinary');

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

router.get('/dashboard', async (req, res) => {
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
});

// Safety net: if a POST ever lands on /dashboard (e.g. a 307 redirect
// preserving method), send it back to the dashboard as a GET instead of 404ing.
router.post('/dashboard', (req, res) => res.redirect(303, '/admin/dashboard'));

/* ---------------- DOCTORS ---------------- */

router.get('/doctors', async (req, res) => {
  const doctors = await Doctor.find({}).sort({ createdAt: -1 });
  res.render('admin/doctors', { title: 'Manage Doctors', doctors });
});

router.get('/doctors/new', (req, res) => {
  res.render('admin/doctor-form', { title: 'Add Doctor', doctor: null, error: null });
});

router.post('/doctors', upload.single('photo'), async (req, res) => {
  try {
    const { name, specialty, bio, active } = req.body;

    if (!name || !specialty) {
      throw new Error('Name and specialty are required.');
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

    res.redirect('/admin/doctors');
  } catch (err) {
    res.status(400).render('admin/doctor-form', {
      title: 'Add Doctor',
      doctor: req.body,
      error: err.message || 'Could not save doctor.'
    });
  }
});

router.get('/doctors/:id/edit', async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) return res.redirect('/admin/doctors');

  res.render('admin/doctor-form', {
    title: 'Edit Doctor',
    doctor,
    error: null
  });
});

router.post('/doctors/:id', upload.single('photo'), async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
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

    res.redirect('/admin/doctors');
  } catch (err) {
    res.status(400).render('admin/doctor-form', {
      title: 'Edit Doctor',
      doctor: {
        ...req.body,
        _id: req.params.id,
        photoUrl: ''
      },
      error: err.message || 'Could not update doctor.'
    });
  }
});

router.post('/doctors/:id/delete', async (req, res) => {
  await Doctor.findByIdAndDelete(req.params.id);
  res.redirect('/admin/doctors');
});

/* ---------------- TREATMENT RESULTS GALLERY ---------------- */

router.get('/gallery', async (req, res) => {
  const photos = await Gallery.find({ category: 'Treatment Results' }).sort({ createdAt: -1 });
  res.render('admin/gallery', { title: 'Treatment Results Gallery', photos, error: null });
});

/* ---------------- CLINIC GALLERY ---------------- */

router.get('/clinic-gallery', async (req, res) => {
  const photos = await Gallery.find({ category: 'Clinic' }).sort({ createdAt: -1 });
  res.render('admin/clinic-gallery', { title: 'Clinic Gallery', photos, error: null });
});

router.post('/clinic-gallery', upload.single('photo'), async (req, res) => {
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
    res.redirect('/admin/clinic-gallery');
  } catch (err) {
    const photos = await Gallery.find({ category: 'Clinic' }).sort({ createdAt: -1 });
    res.status(400).render('admin/clinic-gallery', { title: 'Clinic Gallery', photos, error: err.message || 'Could not upload photo.' });
  }
});

router.post('/clinic-gallery/:id/delete', async (req, res) => {
  const photo = await Gallery.findOneAndDelete({ _id: req.params.id, category: 'Clinic' });
  if (photo && photo.cloudinaryPublicId) await destroyCloudinary(photo.cloudinaryPublicId);
  res.redirect('/admin/clinic-gallery');
});

router.post('/gallery', upload.single('photo'), async (req, res) => {
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
    res.redirect('/admin/gallery');
  } catch (err) {
    const photos = await Gallery.find({ category: 'Treatment Results' }).sort({ createdAt: -1 });
    res.status(400).render('admin/gallery', { title: 'Treatment Results Gallery', photos, error: err.message || 'Could not upload photo.' });
  }
});

router.post('/gallery/:id/delete', async (req, res) => {
  const photo = await Gallery.findByIdAndDelete(req.params.id);
  if (photo && photo.cloudinaryPublicId) await destroyCloudinary(photo.cloudinaryPublicId);
  res.redirect('/admin/gallery');
});

/* ---------------- SERVICES ---------------- */

router.get('/services', async (req, res) => {
  const services = await Service.find({ isAdminAdded: true }).sort({ createdAt: 1 });
  res.render('admin/services', { title: 'Manage Services', services, error: null });
});

router.post('/services', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const price = Number(req.body.price);
    if (!name) throw new Error('Please enter a service name.');
    if (!Number.isFinite(price) || price < 0) throw new Error('Please enter a valid price.');
    const existingLegacy = await Service.findOne({ name, isAdminAdded: { $ne: true } });
    if (existingLegacy) {
      existingLegacy.price = price;
      existingLegacy.active = true;
      existingLegacy.isAdminAdded = true;
      await existingLegacy.save();
    } else {
      await Service.create({ name, price, active: true, isAdminAdded: true });
    }
    res.redirect('/admin/services');
  } catch (err) {
    const services = await Service.find({ isAdminAdded: true }).sort({ createdAt: 1 });
    const message = err.code === 11000 ? 'A service with this name already exists.' : (err.message || 'Could not add service.');
    res.status(400).render('admin/services', { title: 'Manage Services', services, error: message });
  }
});

router.post('/services/:id', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const price = Number(req.body.price);
    if (!name) throw new Error('Please enter a service name.');
    if (!Number.isFinite(price) || price < 0) throw new Error('Please enter a valid price.');
    await Service.findByIdAndUpdate(req.params.id, { name, price }, { runValidators: true });
    res.redirect('/admin/services');
  } catch (err) {
    const services = await Service.find({ isAdminAdded: true }).sort({ createdAt: 1 });
    const message = err.code === 11000 ? 'A service with this name already exists.' : (err.message || 'Could not update service.');
    res.status(400).render('admin/services', { title: 'Manage Services', services, error: message });
  }
});

router.post('/services/:id/delete', async (req, res) => {
  await Service.findByIdAndDelete(req.params.id);
  res.redirect('/admin/services');
});

/* ---------------- CUSTOMER REVIEWS ---------------- */

router.get('/reviews', async (req, res) => {
  const reviews = await Review.find({}).sort({ createdAt: -1 });
  res.render('admin/reviews', { title: 'Customer Reviews', reviews, error: null });
});

router.post('/reviews', async (req, res) => {
  try {
    const customerName = (req.body.customerName || '').trim();
    const rating = Number(req.body.rating);
    const reviewText = (req.body.reviewText || '').trim();
    if (!customerName) throw new Error('Please enter the customer name.');
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new Error('Please select a valid rating.');
    if (!reviewText) throw new Error('Please enter the review text.');
    await Review.create({ customerName, rating, reviewText });
    res.redirect('/admin/reviews');
  } catch (err) {
    const reviews = await Review.find({}).sort({ createdAt: -1 });
    res.status(400).render('admin/reviews', { title: 'Customer Reviews', reviews, error: err.message || 'Could not add review.' });
  }
});

router.post('/reviews/:id', async (req, res) => {
  try {
    const customerName = (req.body.customerName || '').trim();
    const rating = Number(req.body.rating);
    const reviewText = (req.body.reviewText || '').trim();
    if (!customerName) throw new Error('Please enter the customer name.');
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new Error('Please select a valid rating.');
    if (!reviewText) throw new Error('Please enter the review text.');
    await Review.findByIdAndUpdate(req.params.id, { customerName, rating, reviewText }, { runValidators: true });
    res.redirect('/admin/reviews');
  } catch (err) {
    const reviews = await Review.find({}).sort({ createdAt: -1 });
    res.status(400).render('admin/reviews', { title: 'Customer Reviews', reviews, error: err.message || 'Could not update review.' });
  }
});

router.post('/reviews/:id/delete', async (req, res) => {
  await Review.findByIdAndDelete(req.params.id);
  res.redirect('/admin/reviews');
});

/* ---------------- APPOINTMENTS ---------------- */

router.get('/appointments', async (req, res) => {
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
});

router.post('/appointments/:id/status', async (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'confirmed', 'cancelled', 'completed'];
  const wantsJson =
    req.xhr ||
    req.get('X-Requested-With') === 'XMLHttpRequest' ||
    (req.get('Accept') || '').includes('application/json');

  if (!allowed.includes(status)) {
    if (wantsJson) return res.status(400).json({ success: false, error: 'Invalid status.' });
    return res.redirect('back');
  }

  try {
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status },              // only status is ever written here — token is never touched
      { new: true, runValidators: true }
    );

    if (!appointment) {
      if (wantsJson) return res.status(404).json({ success: false, error: 'Appointment not found.' });
      return res.redirect('back');
    }

    if (wantsJson) {
      return res.json({ success: true, status: appointment.status, token: appointment.token });
    }
    return res.redirect('back');
  } catch (err) {
    if (wantsJson) return res.status(500).json({ success: false, error: 'Could not update status.' });
    return res.redirect('back');
  }
});

router.post('/appointments/:id/delete', async (req, res) => {
  await Appointment.findByIdAndDelete(req.params.id);
  res.redirect('back');
});

module.exports = router;
