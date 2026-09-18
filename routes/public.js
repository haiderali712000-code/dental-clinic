const express = require('express');
const router = express.Router();
const Doctor = require('../models/Doctor');
const CeoInfo = require('../models/CeoInfo');
const Appointment = require('../models/Appointment');
const generateToken = require('../utils/generateToken');
const getServices = require('../utils/getServices');
const { sendNewAppointmentEmail } = require('../utils/mailer');
const Gallery = require('../models/Gallery');
const Review = require('../models/Review');

const getCanonical = (req) => `${req.protocol}://${req.get('host')}${req.path === '/' ? '/' : req.path}`;

router.get('/', async (req, res) => {
  const doctors = await Doctor.find({ active: true }).sort({ createdAt: 1 });
  const ceo = await CeoInfo.findOne({ active: true });
  const [treatmentResults, clinicGallery] = await Promise.all([
    Gallery.find({ category: 'Treatment Results', active: true }).sort({ createdAt: -1 }),
    Gallery.find({ category: 'Clinic', active: true }).sort({ createdAt: -1 })
  ]);
  const services = await getServices();
  const reviews = await Review.find({}).sort({ createdAt: -1 });
  res.render('index', { title: 'Home', doctors, ceo, services, treatmentResults, clinicGallery, reviews, canonicalUrl: getCanonical(req) });
});

router.get('/doctors', async (req, res) => {
  const doctors = await Doctor.find({ active: true }).sort({ createdAt: 1 });
  res.render('doctors', { title: 'Our Doctors', doctors, canonicalUrl: getCanonical(req) });
});

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${req.protocol}://${req.get('host')}/sitemap.xml\n`);
});

router.get('/sitemap.xml', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc></url><url><loc>${base}/book</loc></url><url><loc>${base}/status</loc></url></urlset>`);
});

router.get('/health', (req, res) => res.json({ ok: true, service: 'hiks-dental-studio' }));

router.get('/book', async (req, res) => {
  const doctors = await Doctor.find({ active: true }).sort({ name: 1 });
  const services = await getServices();
  res.render('book', { title: 'Book Appointment', doctors, services, error: null, canonicalUrl: getCanonical(req) });
});

router.post('/book', async (req, res) => {
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
});

router.get('/status', (req, res) => res.render('status', { title: 'Check Appointment Status', appointment: null, notFound: false, token: '', canonicalUrl: getCanonical(req) }));
router.post('/status', async (req, res) => {
  const { token } = req.body;
  const appointment = await Appointment.findOne({ token: (token || '').trim().toUpperCase() }).populate('doctor');
  res.render('status', { title: 'Check Appointment Status', appointment, notFound: !appointment, token, canonicalUrl: getCanonical(req) });
});

module.exports = router;
