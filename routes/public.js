const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const Doctor = require('../models/Doctor');
const CeoInfo = require('../models/CeoInfo');
const TeamMember = require('../models/TeamMember');
const Appointment = require('../models/Appointment');
const generateToken = require('../utils/generateToken');
const getServices = require('../utils/getServices');
const { sendNewAppointmentEmail } = require('../utils/mailer');
const Gallery = require('../models/Gallery');
const Review = require('../models/Review');

const getCanonical = (req) => `${req.protocol}://${req.get('host')}${req.path === '/' ? '/' : req.path}`;

router.get('/', asyncHandler(async (req, res) => {
  const doctors = await Doctor.find({ active: true }).sort({ createdAt: 1 });
  const ceo = await CeoInfo.findOne({ active: true });
  const teamMembers = await TeamMember.find({ active: true }).sort({ createdAt: 1 });
  const [treatmentResults, clinicGallery] = await Promise.all([
    Gallery.find({ category: 'Treatment Results', active: true }).sort({ createdAt: -1 }),
    Gallery.find({ category: 'Clinic', active: true }).sort({ createdAt: -1 })
  ]);
  const services = await getServices();
  const reviews = await Review.find({ approved: true }).sort({ createdAt: -1 });
  res.render('index', { title: 'Home', doctors, ceo, teamMembers, services, treatmentResults, clinicGallery, reviews, reviewSubmitted: req.query.reviewSubmitted === '1', reviewError: req.query.reviewError === '1', canonicalUrl: getCanonical(req) });
}));

router.get('/doctors', asyncHandler(async (req, res) => {
  const doctors = await Doctor.find({ active: true }).sort({ createdAt: 1 });
  res.render('doctors', { title: 'Our Doctors', doctors, canonicalUrl: getCanonical(req) });
}));

router.get('/services/:id', asyncHandler(async (req, res) => {
  const services = await getServices();
  const service = services.find((s) => String(s._id) === req.params.id);

  if (!service) {
    return res.status(404).render('404', { title: 'Service Not Found' });
  }

  res.render('service-detail', { title: service.name, service, canonicalUrl: getCanonical(req) });
}));

router.post('/reviews', asyncHandler(async (req, res) => {
  const customerName = (req.body.customerName || '').trim();
  const rating = Number(req.body.rating);
  const reviewText = (req.body.reviewText || '').trim();
  // Honeypot field: real visitors never fill this hidden input, bots often do.
  const honeypot = (req.body.website || '').trim();

  const wantsJson =
    req.xhr ||
    req.get('X-Requested-With') === 'XMLHttpRequest' ||
    (req.get('Accept') || '').includes('application/json');

  if (honeypot) {
    // Silently pretend success to the bot without actually saving anything.
    if (wantsJson) return res.json({ success: true });
    return res.redirect('/#testimonials');
  }

  if (!customerName || !reviewText || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    const message = 'Please fill in your name, a rating, and your review.';
    if (wantsJson) return res.status(400).json({ success: false, error: message });
    return res.redirect('/?reviewError=1#testimonials');
  }

  await Review.create({ customerName, rating, reviewText, approved: false });

  if (wantsJson) return res.json({ success: true });
  res.redirect('/?reviewSubmitted=1#testimonials');
}));

router.get('/team', asyncHandler(async (req, res) => {
  const teamMembers = await TeamMember.find({ active: true }).sort({ createdAt: 1 });
  res.render('team', { title: 'Our Team', teamMembers, canonicalUrl: getCanonical(req) });
}));

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${req.protocol}://${req.get('host')}/sitemap.xml\n`);
});

router.get('/sitemap.xml', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc></url><url><loc>${base}/book</loc></url><url><loc>${base}/status</loc></url></urlset>`);
});

router.get('/health', (req, res) => res.json({ ok: true, service: 'hiks-dental-studio' }));

router.get('/book', asyncHandler(async (req, res) => {
  const doctors = await Doctor.find({ active: true }).sort({ name: 1 });
  const services = await getServices();
  res.render('book', { title: 'Book Appointment', doctors, services, error: null, canonicalUrl: getCanonical(req) });
}));

router.post('/book', asyncHandler(async (req, res) => {
  try {
    const { patientName, phone, service, preferredDate, doctor } = req.body;
    const services = await getServices();
    const selectedService = services.find(item => item.name === service);
    const validService = !!selectedService;
    const appointmentDate = new Date(preferredDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const phoneDigits = (phone || '').trim();
    const validPhone = /^03\d{9}$/.test(phoneDigits); // must start with 03, exactly 11 digits total

    if (!patientName || !phone || !service || !preferredDate || !validService || Number.isNaN(appointmentDate.getTime()) || appointmentDate < today) {
      const doctors = await Doctor.find({ active: true }).sort({ name: 1 });
      return res.status(400).render('book', { title: 'Book Appointment', doctors, services, error: 'Please fill in all required fields and select a valid service.', canonicalUrl: getCanonical(req) });
    }

    if (!validPhone) {
      const doctors = await Doctor.find({ active: true }).sort({ name: 1 });
      return res.status(400).render('book', { title: 'Book Appointment', doctors, services, error: 'Wrong number. Phone number must start with 03 and be exactly 11 digits (e.g. 03001234567).', canonicalUrl: getCanonical(req) });
    }

    const token = await generateToken();
    const appointment = await Appointment.create({ token, patientName: patientName.trim(), phone: phoneDigits, service: selectedService.name, servicePrice: selectedService.price, preferredDate: appointmentDate, doctor: doctor || null, status: 'pending' });
    await appointment.populate('doctor');
    await sendNewAppointmentEmail(appointment);
    res.render('booked', { title: 'Appointment Booked', appointment, canonicalUrl: getCanonical(req) });
  } catch (err) {
    console.error(err);
    const doctors = await Doctor.find({ active: true }).sort({ name: 1 });
    const services = await getServices();
    res.status(500).render('book', { title: 'Book Appointment', doctors, services, error: 'Something went wrong while booking. Please try again.', canonicalUrl: getCanonical(req) });
  }
}));

router.get('/status', (req, res) => res.render('status', { title: 'Check Appointment Status', appointment: null, notFound: false, token: '', canonicalUrl: getCanonical(req) }));
router.post('/status', asyncHandler(async (req, res) => {
  const { token } = req.body;
  const appointment = await Appointment.findOne({ token: (token || '').trim().toUpperCase() }).populate('doctor');
  res.render('status', { title: 'Check Appointment Status', appointment, notFound: !appointment, token, canonicalUrl: getCanonical(req) });
}));

module.exports = router;
