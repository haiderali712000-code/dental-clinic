// Protects every /admin/* route except the login page itself.
// Anyone whose session has isAdmin === true (set after entering the
// correct shared ADMIN_PASSWORD) is allowed through.
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.redirect('/admin/login');
}

module.exports = requireAdmin;
