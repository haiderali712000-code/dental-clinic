require('dotenv').config();

const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const path = require('path');

const connectDB = require('./config/db');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const app = express();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8 // 8 hours
    }
  })
);

// Make clinic info available in every view
app.use((req, res, next) => {
  res.locals.clinic = {
    name: 'H.I.K.S Dental Studio',
    phone: '0337-0401215',
    secondPhone: '0343-5976148',
    address: 'Canal Road, Mandi Bahauddin — Near Muzamil Masjid — Near Old Ghegha Mill',
    timing: '12:00 PM – 8:00 PM'
  };
  res.locals.isAdmin = !!(req.session && req.session.isAdmin);
  res.locals.social = {
    facebook: process.env.FACEBOOK_URL || '',
    instagram: process.env.INSTAGRAM_URL || '',
    tiktok: process.env.TIKTOK_URL || '',
    youtube: process.env.YOUTUBE_URL || ''
  };
  next();
});

// Routes
app.use('/', publicRoutes);
app.use('/admin', adminRoutes);

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});


module.exports = app;

// Local development only. Vercel uses api/index.js and does not call app.listen().
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  connectDB()
    .then(() => app.listen(PORT, () => console.log(`HIKS Dental Studio server running on http://localhost:${PORT}`)))
    .catch(err => {
      console.error('Server startup error:', err.message);
      process.exit(1);
    });
}
