require('dotenv').config();
const nodemailer = require('nodemailer');

const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASS;
const to   = process.env.TO_EMAIL;

console.log('════════════════════════════════════');
console.log('🔍 CONFIGURATION CHECK');
console.log('════════════════════════════════════');
console.log('  USER      :', user);
console.log('  PASS length:', (pass || '').length, (pass || '').length === 16 ? '✅' : '❌ MUST BE 16');
console.log('  PASS preview:', pass ? pass.slice(0,4) + '...' + pass.slice(-4) : '(missing)');
console.log('  TO        :', to);
console.log('  TO valid? :', to && !to.includes('example.com') ? '✅' : '❌ Fix this');
console.log('════════════════════════════════════\n');

if (!user || !pass || !to) {
  console.error('❌ Missing .env values. Fix before continuing.');
  process.exit(1);
}
if (pass.length !== 16) {
  console.error('❌ Password must be 16 chars (App Password). Currently:', pass.length);
  process.exit(1);
}
if (to.includes('example.com')) {
  console.error('❌ TO_EMAIL uses "example.com" (fake). Use a real email.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user, pass }
});

transporter.verify((err) => {
  if (err) {
    console.error('❌ Connection FAILED:');
    console.error('   ', err.message);
    if (err.responseCode === 534 || err.message.includes('Application-specific')) {
      console.error('\n💡 FIX: Your password is not an App Password.');
      console.error('   Go to: https://myaccount.google.com/apppasswords');
      console.error('   Create one and paste the 16-char password (no spaces) into .env\n');
    }
    process.exit(1);
  }

  console.log('✅ SMTP connection verified!\n');

  transporter.sendMail({
    from: `"RailTrack Test" <${user}>`,
    to: to,
    subject: '✅ Test from RailTrack',
    text: 'If you received this, your email setup is working! 🚆'
  }, (err, info) => {
    if (err) {
      console.error('❌ Send failed:', err.message);
      process.exit(1);
    }
    console.log('🎉 Email sent successfully!');
    console.log('   Message ID:', info.messageId);
    console.log('   Check inbox (and Spam folder) of:', to);
  });
});