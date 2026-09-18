const FORMSPREE_ENDPOINT = process.env.FORMSPREE_ENDPOINT; // e.g. https://formspree.io/f/xxxxxxxx

/**
 * Notifies the clinic admin (via Formspree) when a new appointment is booked.
 * Never throws — a broken/misconfigured endpoint must never block a booking.
 * Requires Node 18+ for the built-in global fetch (no extra dependency needed).
 */
async function sendNewAppointmentEmail(appointment) {
  if (!FORMSPREE_ENDPOINT) {
    console.warn('Email notifications are not configured (missing FORMSPREE_ENDPOINT env var) — skipping.');
    return;
  }

  const priceStr = `Rs. ${Number(appointment.servicePrice || 0).toLocaleString('en-PK')}`;
  const doctorName = (appointment.doctor && appointment.doctor.name) ? appointment.doctor.name : 'Not assigned';

  try {
    const response = await fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        subject: `New Appointment — ${appointment.token}`,
        Token: appointment.token,
        Patient: appointment.patientName,
        Phone: appointment.phone,
        Service: appointment.service,
        'Total Price': priceStr,
        Doctor: doctorName,
        'Preferred Date': appointment.preferredDate.toDateString(),
        Status: appointment.status
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('Formspree notification failed:', response.status, body);
    }
  } catch (err) {
    console.error('Failed to send appointment notification via Formspree:', err.message);
  }
}

module.exports = { sendNewAppointmentEmail };
