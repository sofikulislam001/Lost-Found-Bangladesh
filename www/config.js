/* LoveSync সেটিংস — Supabase Realtime (সিঙ্ক/চ্যাট/কলের সিগন্যাল) */
window.LS_CONFIG = {
  url: 'https://acvjmncxynhblarcvigs.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjdmptbmN4eW5oYmxhcmN2aWdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5NzU0NzYsImV4cCI6MjExMDU1MTQ3Nn0.F3n4OVItDDF4jbdk-5xfdFf6Q_rZv4_Rje2jlIy3_jA',
  ice: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:80?transport=tcp', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp', 'turns:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' }
  ]
};
