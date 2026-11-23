'use strict';
/* LoveSync v1.1 — একসাথে ভিডিও দেখা + ভিডিও কল + চ্যাট + রিঅ্যাকশন (দুজনের জন্য) */

const $ = s => document.querySelector(s);
const BN = '০১২৩৪৫৬৭৮৯';
const toBn = n => String(n).replace(/\d/g, d => BN[d]);
const MONTHS = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
const PRESET = { L: { img: 'img/face_l.jpg', name: 'Priti' }, R: { img: 'img/face_r.jpg', name: 'Evan' } };

/* ---------- সেভ করা তথ্য ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem('ls_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ls_' + k, JSON.stringify(v)); } catch (e) {} }
};
let myName = LS.get('name', ''), room = LS.get('room', ''), myAvatar = LS.get('avatar', ''), side = LS.get('side', '');
let partner = LS.get('partner', { name: '', avatar: '' });
let dates = { meet: { d: LS.get('date', ''), ts: LS.get('dateTs', 0) }, since: { d: LS.get('since', ''), ts: LS.get('sinceTs', 0) } };
let chat = LS.get('chat', []), recents = LS.get('recents', []), unread = 0;
let opt = { vib: LS.get('vib', true), awake: LS.get('awake', true) };
let joinSide = side;

/* ---------- ছোট সাহায্যকারী ---------- */
let toastT;
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('show'), 2800); }
const vib = p => { if (opt.vib && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const cleanRoom = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
let current = 'splash';
function show(name) {
  current = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('#s-' + name).classList.add('active');
  wake(name === 'watch');
}
function setAv(el, a, name) {
  if (a) { el.style.backgroundImage = `url(${a})`; el.textContent = ''; }
  else { el.style.backgroundImage = ''; el.textContent = (name || '❤').trim().charAt(0).toUpperCase() || '❤'; }
}
function ask(title, val = '', type = 'text') {
  return new Promise(res => {
    const m = $('#modal'), i = $('#mI');
    $('#mT').textContent = title; i.type = type; i.value = val; m.classList.remove('hidden'); setTimeout(() => i.focus(), 50);
    const done = v => { m.classList.add('hidden'); $('#mOk').onclick = $('#mC').onclick = null; res(v); };
    $('#mOk').onclick = () => done(i.value.trim());
    $('#mC').onclick = () => done(null);
  });
}
function fmtDate(s) { if (!s) return ''; const [y, m, d] = s.split('-').map(Number); return `${toBn(d)} ${MONTHS[m - 1]}, ${toBn(y)}`; }
const dayDiff = s => { const t = new Date(s + 'T00:00:00'), n = new Date(); n.setHours(0, 0, 0, 0); return Math.round((t - n) / 86400000); };

/* স্ক্রিন জাগিয়ে রাখা */
let wl = null;
async function wake(on) {
  try {
    if (on && opt.awake && !wl && navigator.wakeLock) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); }
    else if (!on && wl) { await wl.release(); wl = null; }
  } catch (e) {}
}

/* ---------- প্রোফাইল ও UI রেন্ডার ---------- */
const presetOpp = () => side === 'L' ? PRESET.R : side === 'R' ? PRESET.L : null;
const partnerAv = () => partner.avatar || (presetOpp() ? presetOpp().img : '');
const partnerName = () => partner.name || (presetOpp() ? presetOpp().name : '');
function renderProfiles() {
  setAv($('#avMe'), myAvatar, myName); setAv($('#avSet'), myAvatar, myName);
  setAv($('#avPartner'), partnerAv(), partnerName()); setAv($('#avChat'), partnerAv(), partnerName());
  const ph = $('#remotePh'), pa = partnerAv();
  if (pa) { ph.style.backgroundImage = `url(${pa})`; ph.textContent = ''; } else { ph.style.backgroundImage = ''; ph.textContent = (partnerName() || '❤').charAt(0); }
  $('#nmMe').textContent = myName || '—'; $('#nmPartner').textContent = partnerName() || '—';
  $('#chName').textContent = partnerName() || 'সঙ্গী'; $('#pbName').textContent = partnerName();
  $('#setName').textContent = myName || '—'; $('#setRoom').textContent = room || '—';
  renderDates();
}
function renderDates() {
  const m = dates.meet.d, s = dates.since.d;
  $('#setDate').textContent = fmtDate(m) || 'ঠিক করা হয়নি';
  $('#setSince').textContent = fmtDate(s) || 'ঠিক করা হয়নি';
  if (!m) { $('#cdBig').textContent = '—'; $('#cdDate').textContent = 'ট্যাপ করে তারিখ ঠিক করো'; }
  else { const d = dayDiff(m); $('#cdBig').textContent = d > 0 ? `${toBn(d)} দিন পর` : d === 0 ? 'আজই! 🥰' : 'তারিখ পার হয়ে গেছে'; $('#cdDate').textContent = `( ${fmtDate(m)} )`; }
  const p = $('#sincePill');
  if (s && dayDiff(s) <= 0) { p.textContent = `💞 ${toBn(-dayDiff(s) + 1)} দিন ধরে একসাথে`; p.classList.remove('hidden'); } else p.classList.add('hidden');
}
let online = false;
function setOnline(on) {
  online = on;
  $('#homeStatus').textContent = on ? `${partnerName() || 'সে'} অনলাইনে আছে 💚` : 'অপেক্ষা করছি... 🕒';
  $('#wstatus').textContent = on ? 'সংযুক্ত আছেন ❤️' : 'অপেক্ষা করছি...';
  $('#wdot').classList.toggle('on', on);
  if (!on) { $('#remoteCam').srcObject = null; $('#remotePh').style.display = 'flex'; pMedia = { cam: true, mic: true }; renderPBadge(); }
  renderChatHead();
}
let pMedia = { cam: true, mic: true };
function renderPBadge() {
  $('#pbIcons').textContent = (pMedia.mic ? '' : '🔇') + (pMedia.cam ? '' : '📷✖');
  if (!pMedia.cam && online) $('#remotePh').style.display = 'flex';
}

/* ---------- ক্যামেরা ও মাইক ---------- */
let localCam = null, facing = 'user';
async function getCam(force) {
  if (localCam && !force && localCam.getTracks().every(t => t.readyState === 'live')) return localCam;
  try { localCam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } }, audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (e) {
    try { localCam = await navigator.mediaDevices.getUserMedia({ audio: true }); toast('ক্যামেরা পাওয়া যায়নি, শুধু মাইক চালু'); }
    catch (e2) { localCam = null; toast('ক্যামেরা/মাইকের অনুমতি দাও (ফোন সেটিংস → অ্যাপ → অনুমতি)'); }
  }
  if (localCam) { $('#selfCam').srcObject = localCam; $('#selfCam').play().catch(() => {}); }
  return localCam;
}

/* ---------- সংযোগ (Supabase Realtime + WebRTC) ---------- */
const CFG = window.LS_CONFIG;
const ICE = CFG.ice;
let sb = null, ch = null, joined = false, partnerId = '', roomTok = 0, retryT = null, lastRx = 0;
const myId = uid();
let pc = null, iceBuf = [], callStart = 0;
const isInit = () => !!partnerId && myId < partnerId;

function diag() {
  const c = pc ? pc.iceConnectionState : '—';
  $('#diag').textContent = `সার্ভার ${joined ? '✓' : '✗'} · সঙ্গী ${online ? '✓' : '✗'} · কল ${c === 'connected' || c === 'completed' ? '✓' : c}`;
}
async function roomName() {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('lovesync:' + room));
  return 'ls-' + [...new Uint8Array(d)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function stopRoom() {
  roomTok++; clearTimeout(retryT); closePC(); partnerId = ''; joined = false;
  if (ch && sb) { try { await sb.removeChannel(ch); } catch (e) {} }
  ch = null; setOnline(false);
}
async function startRoom() {
  await stopRoom();
  if (!window.supabase) { toast('লাইব্রেরি লোড হয়নি, অ্যাপ আবার খোলো'); return; }
  if (!sb) sb = supabase.createClient(CFG.url, CFG.key, { realtime: { params: { eventsPerSecond: 20 } } });
  const tok = roomTok, name = await roomName();
  ch = sb.channel(name, { config: { broadcast: { self: false, ack: false }, presence: { key: myId } } });
  ch.on('broadcast', { event: 'm' }, ({ payload }) => { if (payload && payload.from !== myId) onData(payload); });
  ch.on('presence', { event: 'sync' }, onPresence);
  ch.subscribe(async st => {
    if (tok !== roomTok) return;
    if (st === 'SUBSCRIBED') { joined = true; diag(); try { await ch.track({ name: myName }); } catch (e) {} }
    else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(st)) {
      joined = false; diag(); clearTimeout(retryT);
      retryT = setTimeout(() => { if (tok === roomTok) startRoom(); }, 4000);
    }
  });
}
function onPresence() {
  if (!ch) return;
  const ids = Object.keys(ch.presenceState()).filter(k => k !== myId).sort();
  const pid = ids[0] || '';
  if (pid === partnerId) return;
  partnerId = pid;
  if (pid) { lastRx = Date.now(); setOnline(true); onPartnerJoin(); }
  else { setOnline(false); closePC(); }
}
function onPartnerJoin() {
  sendProfile(); sendDates(); sendMedia(); flushPending();
  if (cur && P) send({ t: 'load', v: cur, time: P.time(), playing: P.playing(), hello: true });
  if (chatOpen()) sendSeen();
  if (isInit()) startCall();
}
const send = o => { if (!ch || !joined) return false; try { ch.send({ type: 'broadcast', event: 'm', payload: Object.assign({ from: myId }, o) }); return true; } catch (e) { return false; } };
const sendProfile = () => send({ t: 'profile', name: myName, avatar: myAvatar });
const sendDates = () => ['meet', 'since'].forEach(k => { if (dates[k].d) send({ t: 'date', k, d: dates[k].d, ts: dates[k].ts }); });
const sendMedia = () => { const v = localCam && localCam.getVideoTracks()[0], a = localCam && localCam.getAudioTracks()[0]; send({ t: 'media', cam: !!(v && v.enabled), mic: !!(a && a.enabled) }); };

/* কানেকশন পাহারা */
setInterval(() => { if (joined) send({ t: 'ping' }); }, 5000);
setInterval(() => { if (partnerId && online && lastRx && Date.now() - lastRx > 25000) setOnline(false); }, 4000);
setInterval(() => { diag(); if (online && isInit() && (!pc || !['connected', 'completed'].includes(pc.iceConnectionState)) && Date.now() - callStart > 14000) startCall(); }, 6000);
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || !room || !myName) return;
  if (current === 'watch') wake(true);
  if (!ch || !joined) return startRoom();
  try { await ch.track({ name: myName }); } catch (e) {}
  if (localCam && localCam.getTracks().some(t => t.readyState === 'ended')) { await getCam(true); if (isInit()) startCall(); else send({ t: 'recall' }); }
});

/* ভিডিও কল (WebRTC, সিগন্যালিং Supabase দিয়ে) */
function closePC() { if (pc) { try { pc.close(); } catch (e) {} pc = null; } iceBuf = []; $('#remotePh').style.display = 'flex'; $('#remoteCam').srcObject = null; }
function newPC() {
  closePC();
  const p = pc = new RTCPeerConnection({ iceServers: ICE });
  if (localCam && localCam.getTracks().length) localCam.getTracks().forEach(t => p.addTrack(t, localCam));
  else if (isInit()) { p.addTransceiver('video', { direction: 'recvonly' }); p.addTransceiver('audio', { direction: 'recvonly' }); }
  p.onicecandidate = e => { if (e.candidate) send({ t: 'rtc', k: 'ice', c: e.candidate }); };
  p.ontrack = e => { const v = $('#remoteCam'); v.srcObject = e.streams[0] || new MediaStream([e.track]); v.play().catch(() => {}); if (pMedia.cam) $('#remotePh').style.display = 'none'; };
  p.oniceconnectionstatechange = () => { diag(); if (p.iceConnectionState === 'failed' && isInit() && pc === p) startCall(); };
  return p;
}
async function startCall() {
  if (!isInit() || !joined) return;
  callStart = Date.now();
  await getCam();
  try {
    const p = newPC(); const off = await p.createOffer(); await p.setLocalDescription(off);
    send({ t: 'rtc', k: 'offer', sdp: p.localDescription });
  } catch (e) { toast('কল শুরু করা যায়নি'); }
}
async function flushIce() { const b = iceBuf; iceBuf = []; for (const c of b) { try { await pc.addIceCandidate(c); } catch (e) {} } }
async function onRtc(o) {
  try {
    if (o.k === 'offer') {
      await getCam(); const p = newPC(); await p.setRemoteDescription(o.sdp);
      const ans = await p.createAnswer(); await p.setLocalDescription(ans);
      send({ t: 'rtc', k: 'answer', sdp: p.localDescription }); flushIce();
    } else if (o.k === 'answer') {
      if (pc && pc.signalingState === 'have-local-offer') { await pc.setRemoteDescription(o.sdp); flushIce(); }
    } else if (o.k === 'ice') {
      if (pc && pc.remoteDescription) await pc.addIceCandidate(o.c); else iceBuf.push(o.c);
    }
  } catch (e) { /* পরের চেষ্টায় ঠিক হবে */ }
}

/* ---------- ভিডিও (YouTube / Facebook) ---------- */
let cur = null, P = null, yt = null, fbp = null, fbPlaying = false, pending = null, lastT = 0, quietUntil = 0, muted = false;
const quiet = () => Date.now() < quietUntil;
const remote = fn => { quietUntil = Date.now() + 1500; try { fn(); } catch (e) {} };

function parseLink(u) {
  u = (u || '').trim();
  const m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  if (m) return { kind: 'yt', id: m[1] };
  if (/facebook\.com|fb\.watch|fb\.com/.test(u)) return { kind: 'fb', url: u };
  return null;
}
function stage(kind) {
  $('#empty').classList.toggle('hidden', !!kind);
  $('#ytbox').classList.toggle('hidden', kind !== 'yt');
  $('#fbbox').classList.toggle('hidden', kind !== 'fb');
}
function stopVideo() {
  try { if (yt && yt.destroy) yt.destroy(); } catch (e) {}
  yt = fbp = P = cur = pending = null; fbPlaying = false;
  $('#ytbox').innerHTML = ''; $('#fbbox').innerHTML = ''; stage(null); $('#bPlay').textContent = '▶️';
}
let ytP = null;
function ytAPI() {
  if (window.YT && YT.Player) return Promise.resolve();
  return ytP || (ytP = new Promise(res => { window.onYouTubeIframeAPIReady = res; const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = () => { ytP = null; toast('YouTube লোড হয়নি, ইন্টারনেট চেক করো'); }; document.head.appendChild(s); }));
}
async function mountYT(id, o) {
  await ytAPI();
  $('#ytbox').innerHTML = '<div id="ytp"></div>';
  yt = new YT.Player('ytp', {
    width: '100%', height: '100%', videoId: id,
    playerVars: { playsinline: 1, rel: 0, modestbranding: 1, autoplay: 1, origin: location.origin, start: Math.floor(o.time || 0) },
    events: {
      onReady: () => {
        P = { play: () => yt.playVideo(), pause: () => yt.pauseVideo(), seek: t => yt.seekTo(t, true), time: () => yt.getCurrentTime() || 0, playing: () => yt.getPlayerState() === 1, mute: b => b ? yt.mute() : yt.unMute() };
        if (o.playing === false) remote(() => yt.pauseVideo());
        applyPending();
      },
      onStateChange: e => {
        if (quiet()) return;
        if (e.data === 1) send({ t: 'play', time: yt.getCurrentTime() });
        else if (e.data === 2) send({ t: 'pause', time: yt.getCurrentTime() });
      },
      onError: () => toast('এই ভিডিও এখানে চালানো যাচ্ছে না (মালিক এমবেড বন্ধ রেখেছেন)')
    }
  });
}
let fbLoad = null, fbOpts = {};
function fbSDK() {
  if (window.FB) return Promise.resolve();
  return fbLoad || (fbLoad = new Promise(res => {
    window.fbAsyncInit = () => { FB.init({ xfbml: false, version: 'v19.0' }); FB.Event.subscribe('xfbml.ready', onFBReady); res(); };
    const s = document.createElement('script'); s.async = true; s.src = 'https://connect.facebook.net/en_US/sdk.js'; s.onerror = () => { fbLoad = null; toast('Facebook লোড হয়নি, ইন্টারনেট চেক করো'); }; document.head.appendChild(s);
  }));
}
async function mountFB(url, o) {
  await fbSDK(); fbOpts = o;
  const box = $('#fbbox');
  box.innerHTML = `<div class="fb-video" id="fbv" data-href="${url.replace(/"/g, '')}" data-width="auto" data-allowfullscreen="true" data-autoplay="true" data-show-text="false"></div>`;
  FB.XFBML.parse(box);
}
function onFBReady(msg) {
  if (msg.type !== 'video') return;
  fbp = msg.instance;
  P = { play: () => fbp.play(), pause: () => fbp.pause(), seek: t => fbp.seek(t), time: () => fbp.getCurrentPosition() || 0, playing: () => fbPlaying, mute: b => b ? fbp.mute() : fbp.unmute() };
  fbp.subscribe('startedPlaying', () => { fbPlaying = true; if (!quiet()) send({ t: 'play', time: P.time() }); });
  fbp.subscribe('paused', () => { fbPlaying = false; if (!quiet()) send({ t: 'pause', time: P.time() }); });
  fbp.subscribe('finishedPlaying', () => { fbPlaying = false; });
  fbp.subscribe('error', () => toast('এই Facebook ভিডিও চালানো যাচ্ছে না (শুধু পাবলিক ভিডিও চলে)'));
  if (fbOpts.time) remote(() => fbp.seek(fbOpts.time));
  if (fbOpts.playing === false) remote(() => fbp.pause());
  applyPending();
}
function applyPending() {
  if (!pending || !P) return;
  const p = pending; pending = null;
  remote(() => { if (p.time != null && Math.abs(P.time() - p.time) > 1) P.seek(p.time); p.playing ? P.play() : P.pause(); });
  lastT = p.time || 0;
}
function loadVideo(v, o = {}) {
  stopVideo(); cur = v; stage(v.kind); addRecent(v);
  v.kind === 'yt' ? mountYT(v.id, o) : mountFB(v.url, o);
}
function localLoad(v) {
  v = v || parseLink($('#url').value);
  if (!v) return toast('শুধু YouTube বা Facebook লিংক দাও');
  loadVideo(v, {}); send({ t: 'load', v, time: 0, playing: true }); $('#url').value = '';
}

/* সাম্প্রতিক ভিডিও */
const sameV = (a, b) => a.kind === b.kind && (a.id || a.url) === (b.id || b.url);
function addRecent(v) {
  recents = [v, ...recents.filter(r => !sameV(r, v))].slice(0, 8); LS.set('recents', recents); renderRecents();
}
function renderRecents() {
  const box = $('#recents'); box.innerHTML = '';
  box.classList.toggle('hidden', !recents.length);
  recents.forEach(v => {
    const b = document.createElement('button'); b.className = 'rc';
    if (v.kind === 'yt') { const i = document.createElement('img'); i.src = `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`; i.alt = ''; b.appendChild(i); } else b.textContent = 'f';
    b.onclick = () => localLoad(v); box.appendChild(b);
  });
}

/* পোলিং: সিক ধরা + ড্রিফট ঠিক করা */
setInterval(() => {
  if (!P) return;
  const t = P.time(), pl = P.playing();
  $('#bPlay').textContent = pl ? '⏸' : '▶️';
  if (!quiet() && Math.abs(t - (lastT + (pl ? 0.7 : 0))) > 1.8) send({ t: 'seek', time: t });
  lastT = t;
}, 700);
setInterval(() => { if (P && isInit() && P.playing()) send({ t: 'tick', time: P.time(), playing: true }); }, 4000);

/* ---------- মেসেজ গ্রহণ ---------- */
let typingUntil = 0;
function onData(o) {
  if (!o || !o.t) return;
  lastRx = Date.now(); if (partnerId && !online) setOnline(true);
  switch (o.t) {
    case 'ping': break;
    case 'profile': partner = { name: o.name || '', avatar: o.avatar || '' }; LS.set('partner', partner); renderProfiles(); setOnline(true); break;
    case 'date': { const k = o.k || 'meet'; if (dates[k] && (o.ts || 0) > dates[k].ts) { dates[k] = { d: o.d, ts: o.ts }; LS.set(k === 'meet' ? 'date' : 'since', o.d); LS.set(k === 'meet' ? 'dateTs' : 'sinceTs', o.ts); renderDates(); } break; }
    case 'media': pMedia = { cam: o.cam, mic: o.mic }; if (pMedia.cam && $('#remoteCam').srcObject) $('#remotePh').style.display = 'none'; renderPBadge(); break;
    case 'recall': if (isInit()) startCall(); break;
    case 'rtc': onRtc(o); break;
    case 'load': if (o.hello && cur && sameV(cur, o.v)) break; loadVideo(o.v, o); break;
    case 'stop': stopVideo(); break;
    case 'play': if (!P) { pending = { time: o.time, playing: true }; break; } remote(() => { if (Math.abs(P.time() - o.time) > 1) P.seek(o.time); P.play(); }); lastT = o.time; break;
    case 'pause': if (!P) { pending = { time: o.time, playing: false }; break; } remote(() => { P.pause(); if (Math.abs(P.time() - o.time) > 1) P.seek(o.time); }); lastT = o.time; break;
    case 'seek': if (!P) { pending = { time: o.time, playing: false }; break; } remote(() => P.seek(o.time)); lastT = o.time; break;
    case 'tick': if (!P) break; remote(() => { if (Math.abs(P.time() - o.time) > 2.5) P.seek(o.time); if (o.playing && !P.playing()) P.play(); }); lastT = o.time; break;
    case 'chat': gotChat(o); break;
    case 'ack': mark(o.id, 'd'); break;
    case 'seen': chat.forEach(m => { if (m.me && m.ts <= o.upto) m.st = 'r'; }); LS.set('chat', chat); if (chatOpen()) renderMsgs(); break;
    case 'typing': typingUntil = Date.now() + 3000; renderChatHead(); break;
    case 'react': floatEmoji(o.e); break;
    case 'love': loveBurst(o.kind); break;
  }
}

/* ---------- চ্যাট ---------- */
const chatOpen = () => $('#s-chat').classList.contains('open');
const hm = ts => { const d = new Date(ts); let h = d.getHours(); const m = d.getMinutes(), ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')} ${ap}`; };
function renderChatHead() {
  $('#chStat').textContent = !online ? 'অফলাইন' : Date.now() < typingUntil ? 'লিখছে...' : 'অনলাইন 💚';
}
setInterval(() => { if (chatOpen()) renderChatHead(); }, 1000);
function renderMsgs() {
  const box = $('#msgs'); box.innerHTML = '';
  chat.forEach(m => {
    const d = document.createElement('div'); d.className = 'm' + (m.me ? ' me' : '');
    const av = document.createElement('div'); av.className = 'av'; m.me ? setAv(av, myAvatar, myName) : setAv(av, partnerAv(), partnerName());
    const b = document.createElement('div'); b.className = 'bub'; b.textContent = m.text;
    const s = document.createElement('small'); s.textContent = hm(m.ts);
    if (m.me) { const t = document.createElement('span'); t.className = 'tick' + (m.st === 'r' ? ' r' : ''); t.textContent = m.st === 'p' ? '🕒' : m.st === 's' ? '✓' : '✓✓'; s.appendChild(t); }
    b.appendChild(s); d.append(av, b); box.appendChild(d);
  });
  box.scrollTop = box.scrollHeight;
}
function saveChat() { chat = chat.slice(-200); LS.set('chat', chat); }
function mark(id, st) { const m = chat.find(x => x.id === id); if (m && m.st !== 'r') { m.st = st; saveChat(); if (chatOpen()) renderMsgs(); } }
function sendSeen() { const last = chat.filter(m => !m.me).pop(); if (last) send({ t: 'seen', upto: last.ts }); }
function gotChat(o) {
  if (chat.some(m => m.id === o.id)) return;
  chat.push({ id: o.id, me: false, text: o.text, ts: o.ts }); saveChat();
  send({ t: 'ack', id: o.id }); typingUntil = 0;
  if (chatOpen()) { renderMsgs(); sendSeen(); }
  else { unread++; const b = $('#badge'); b.textContent = toBn(unread); b.classList.remove('hidden'); vib(80); toast(`💬 ${partnerName() || 'সে'}: ${o.text.slice(0, 40)}`); }
}
function flushPending() { chat.forEach(m => { if (m.me && m.st === 'p' && online && send({ t: 'chat', id: m.id, text: m.text, ts: m.ts })) m.st = 's'; }); saveChat(); if (chatOpen()) renderMsgs(); }
function sendMsg() {
  const i = $('#msgIn'), text = i.value.trim(); if (!text) return;
  const m = { id: uid(), me: true, text, ts: Date.now(), st: 'p' }; i.value = '';
  if (online && send({ t: 'chat', id: m.id, text, ts: m.ts })) m.st = 's';
  chat.push(m); saveChat(); renderMsgs();
}
let typedAt = 0;
$('#msgIn').addEventListener('input', () => { if (Date.now() - typedAt > 2000) { typedAt = Date.now(); send({ t: 'typing' }); } });
function openChat() { unread = 0; $('#badge').classList.add('hidden'); renderMsgs(); renderChatHead(); $('#s-chat').classList.add('open'); sendSeen(); }
const closeChat = () => $('#s-chat').classList.remove('open');

/* ইমোজি ও ভালোবাসার বার্তা */
function floatEmoji(e, left) {
  const f = document.createElement('div'); f.className = 'fl'; f.textContent = e; f.style.left = (left != null ? left : 12 + Math.random() * 70) + '%';
  $('#floats').appendChild(f); setTimeout(() => f.remove(), 2700);
}
function loveBurst(kind) {
  const em = kind === 'hug' ? ['🤗', '💞', '🫶'] : ['💌', '❤️', '💕', '😘'];
  for (let i = 0; i < 14; i++) setTimeout(() => floatEmoji(em[i % em.length]), i * 110);
  vib([120, 80, 120, 80, 200]);
  toast(kind === 'hug' ? `🤗 ${partnerName() || 'সে'} তোমাকে জড়িয়ে ধরছে` : `💌 ${partnerName() || 'সে'} তোমাকে মিস করছে`);
}
function sendLove(kind) {
  if (!online || !send({ t: 'love', kind })) return toast('সে এখন অনলাইনে নেই, অনলাইনে এলে পাঠাও');
  for (let i = 0; i < 8; i++) setTimeout(() => floatEmoji(kind === 'hug' ? '🤗' : '💌'), i * 90); vib(60);
}

/* ---------- প্রোফাইল ছবি ---------- */
function makeAvatar(img) {
  const s = 192, c = document.createElement('canvas'); c.width = c.height = s;
  const k = Math.max(s / img.width, s / img.height), w = img.width * k, h = img.height * k;
  c.getContext('2d').drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
  return c.toDataURL('image/jpeg', .82);
}
function setMyAvatar(data) { myAvatar = data; LS.set('avatar', data); renderProfiles(); sendProfile(); renderMsgs(); }
let pickCb = null;
function pickAvatar(cb) { pickCb = cb || null; $('#pick').click(); }
$('#pick').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => { const d = makeAvatar(img); URL.revokeObjectURL(url); setMyAvatar(d); if (pickCb) pickCb(); };
  img.src = url; e.target.value = '';
};
function pickFace(sd) {
  joinSide = sd;
  document.querySelectorAll('.face').forEach(b => b.classList.toggle('sel', b.dataset.side === sd));
  if (sd === 'G') return pickAvatar(() => { side = ''; LS.set('side', ''); });
  const img = new Image(); img.onload = () => { setMyAvatar(makeAvatar(img)); side = sd; LS.set('side', sd); if (!$('#name').value.trim()) $('#name').value = PRESET[sd].name; renderProfiles(); };
  img.src = PRESET[sd].img;
}
document.querySelectorAll('.face').forEach(b => b.onclick = () => pickFace(b.dataset.side));

/* ---------- বোতাম ---------- */
async function enterRoom() { await getCam(); show('home'); renderProfiles(); renderRecents(); startRoom(); }
$('#joinBtn').onclick = () => {
  const n = $('#name').value.trim(), r = cleanRoom($('#room').value);
  if (!n) return toast('তোমার নাম লেখো');
  if (r.length < 4) return toast('রুম কোড কমপক্ষে ৪টা অক্ষর/সংখ্যা (ইংরেজিতে) হতে হবে');
  myName = n; room = r; LS.set('name', n); LS.set('room', r); enterRoom();
};
$('#permCard').onclick = async () => { const s = await getCam(true); if (s) toast('অনুমতি পাওয়া গেছে ✅'); };
$('#homeBack').onclick = () => goBack();
$('#homeMenu').onclick = () => { renderProfiles(); show('settings'); };
$('#avMe').onclick = () => pickAvatar(); $('#avSet').onclick = () => pickAvatar(); $('#rPhoto').onclick = () => pickAvatar();
$('#countCard').onclick = () => changeDate('meet', 'দেখা হওয়ার তারিখ');
$('#rDate').onclick = () => changeDate('meet', 'দেখা হওয়ার তারিখ');
$('#rSince').onclick = () => changeDate('since', 'আমরা কবে থেকে একসাথে?');
$('#watchBtn').onclick = () => show('watch');
$('#leaveBtn').onclick = () => show('home');
$('#setBack').onclick = () => show('home');
$('#missBtn').onclick = () => sendLove('miss'); $('#hugBtn').onclick = () => sendLove('hug');
$('#cardBtn').onclick = () => $('#posterView').classList.remove('hidden');
$('#posterClose').onclick = () => $('#posterView').classList.add('hidden');

async function changeDate(k, title) {
  const v = await ask(title, dates[k].d, 'date');
  if (v) { dates[k] = { d: v, ts: Date.now() }; LS.set(k === 'meet' ? 'date' : 'since', v); LS.set(k === 'meet' ? 'dateTs' : 'sinceTs', dates[k].ts); renderDates(); sendDates(); }
}
$('#rName').onclick = async () => { const v = await ask('তোমার নাম', myName); if (v) { myName = v; LS.set('name', v); renderProfiles(); sendProfile(); } };
$('#rRoom').onclick = async () => { const v = cleanRoom((await ask('নতুন রুম কোড (ইংরেজি অক্ষর/সংখ্যা)', room)) || ''); if (v.length >= 4) { room = v; LS.set('room', v); renderProfiles(); startRoom(); toast('নতুন কোডে সংযোগ হচ্ছে...'); } else if (v) toast('কমপক্ষে ৪টা অক্ষর দাও'); };
$('#rCopy').onclick = async () => { try { await navigator.clipboard.writeText(room); toast('রুম কোড কপি হয়েছে ✅'); } catch (e) { toast('কোড: ' + room); } };
$('#rLeave').onclick = () => { stopRoom(); stopVideo(); room = ''; LS.set('room', ''); $('#room').value = ''; setOnline(false); show('join'); };
function toggle(key, sw) { opt[key] = !opt[key]; LS.set(key, opt[key]); $(sw).classList.toggle('on', opt[key]); }
$('#tVib').onclick = () => { toggle('vib', '#swVib'); vib(60); };
$('#tAwake').onclick = () => toggle('awake', '#swAwake');
$('#swVib').classList.toggle('on', opt.vib); $('#swAwake').classList.toggle('on', opt.awake);

$('#loadBtn').onclick = () => localLoad();
$('#url').onkeydown = e => { if (e.key === 'Enter') localLoad(); };
$('#pasteBtn').onclick = async () => { try { const t = await navigator.clipboard.readText(); if (t) { $('#url').value = t.trim(); localLoad(); } else toast('ক্লিপবোর্ড খালি'); } catch (e) { toast('পেস্ট করতে ইনপুটে চেপে ধরে Paste দাও'); } };
$('#bPlay').onclick = () => { if (!P) return toast('আগে ভিডিও চালাও'); P.playing() ? P.pause() : P.play(); };
const jump = d => { if (!P) return; const t = Math.max(0, P.time() + d); remote(() => P.seek(t)); lastT = t; send({ t: 'seek', time: t }); };
$('#bBack').onclick = () => jump(-10); $('#bFwd').onclick = () => jump(10);
$('#bMute').onclick = () => { muted = !muted; if (P) P.mute(muted); $('#bMute').textContent = muted ? '🔇' : '🔊'; };
$('#bStop').onclick = () => { if (!cur) return; stopVideo(); send({ t: 'stop' }); };

$('#micBtn').onclick = () => { const t = localCam && localCam.getAudioTracks()[0]; if (!t) return; t.enabled = !t.enabled; $('#micBtn').classList.toggle('off', !t.enabled); $('#micBtn').textContent = t.enabled ? '🎤' : '🔇'; sendMedia(); };
$('#camBtn').onclick = () => { const t = localCam && localCam.getVideoTracks()[0]; if (!t) return; t.enabled = !t.enabled; $('#camBtn').classList.toggle('off', !t.enabled); sendMedia(); };
$('#flipBtn').onclick = async () => {
  if (!localCam) return;
  facing = facing === 'user' ? 'environment' : 'user';
  try {
    const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
    const nt = ns.getVideoTracks()[0], old = localCam.getVideoTracks()[0];
    const snd = pc && pc.getSenders().find(s => s.track && s.track.kind === 'video');
    if (snd) await snd.replaceTrack(nt);
    if (old) { localCam.removeTrack(old); old.stop(); } localCam.addTrack(nt);
    $('#selfCam').srcObject = localCam; $('#selfCam').style.transform = facing === 'user' ? 'scaleX(-1)' : 'none';
  } catch (e) { toast('ক্যামেরা ঘোরানো যায়নি'); facing = facing === 'user' ? 'environment' : 'user'; }
};

document.querySelectorAll('#reacts button').forEach(b => b.onclick = () => { floatEmoji(b.textContent); send({ t: 'react', e: b.textContent }); vib(30); });
$('#chatBtn').onclick = openChat; $('#chatBack').onclick = closeChat;
$('#chatClear').onclick = () => { chat = []; saveChat(); renderMsgs(); };
$('#sendBtn').onclick = sendMsg;
$('#msgIn').onkeydown = e => { if (e.key === 'Enter') sendMsg(); };
$('#emojiBtn').onclick = () => $('#emojiRow').classList.toggle('hidden');
['😀','😍','🥰','😘','😂','😭','🥺','😴','🤗','😡','👍','🙏','❤️','💕','💋','🔥','🎉','🌹'].forEach(e => { const b = document.createElement('button'); b.textContent = e; b.onclick = () => { $('#msgIn').value += e; }; $('#emojiRow').appendChild(b); });

/* ---------- অ্যান্ড্রয়েড ব্যাক বোতাম ---------- */
function goBack() {
  if (!$('#modal').classList.contains('hidden')) { $('#mC').click(); return; }
  if (!$('#posterView').classList.contains('hidden')) { $('#posterClose').click(); return; }
  if (chatOpen()) { closeChat(); return; }
  if (current === 'settings' || current === 'watch') { show('home'); return; }
  if (current === 'home') { const A = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App; if (A && A.minimizeApp) A.minimizeApp(); return; }
  if (current === 'join') { const A = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App; if (A && A.exitApp) A.exitApp(); }
}
try { const A = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App; if (A && A.addListener) A.addListener('backButton', goBack); } catch (e) {}

/* ---------- শুরু ---------- */
$('#name').value = myName; $('#room').value = room;
if (side) document.querySelectorAll('.face').forEach(b => b.classList.toggle('sel', b.dataset.side === side));
renderProfiles(); renderRecents();
setTimeout(() => { if (myName && room) enterRoom(); else show('join'); }, 2600);
