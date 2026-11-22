'use strict';
/* LoveSync — দুজনের জন্য: একসাথে ভিডিও দেখা + ভিডিও কল + চ্যাট + রিঅ্যাকশন */

const $ = s => document.querySelector(s);
const ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' }
];
const BN = '০১২৩৪৫৬৭৮৯';
const toBn = n => String(n).replace(/\d/g, d => BN[d]);
const MONTHS = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];

/* ---------- সেভ করা তথ্য ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem('ls_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ls_' + k, JSON.stringify(v)); } catch (e) {} }
};
let myName = LS.get('name', '');
let room = LS.get('room', '');
let myAvatar = LS.get('avatar', '');
let partner = LS.get('partner', { name: '', avatar: '' });
let meetDate = LS.get('date', '');
let meetTs = LS.get('dateTs', 0);
let chat = LS.get('chat', []);
let unread = 0;

/* ---------- ছোট সাহায্যকারী ---------- */
let toastT;
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('show'), 2600); }
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('#' + id).classList.add('active');
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
const cleanRoom = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---------- প্রোফাইল ও UI রেন্ডার ---------- */
function renderProfiles() {
  setAv($('#avMe'), myAvatar, myName);
  setAv($('#avPartner'), partner.avatar, partner.name);
  setAv($('#avSet'), myAvatar, myName);
  const ph = $('#remotePh');
  if (partner.avatar) { ph.style.backgroundImage = `url(${partner.avatar})`; ph.textContent = ''; }
  else { ph.style.backgroundImage = ''; ph.textContent = (partner.name || '❤').charAt(0); }
  $('#setName').textContent = myName || '—';
  $('#setRoom').textContent = room || '—';
  renderCount();
}
function renderCount() {
  $('#setDate').textContent = fmtDate(meetDate) || 'ঠিক করা হয়নি';
  if (!meetDate) { $('#cdBig').textContent = '—'; $('#cdDate').textContent = 'ট্যাপ করে তারিখ ঠিক করো'; return; }
  const t = new Date(meetDate + 'T00:00:00'), n = new Date(); n.setHours(0, 0, 0, 0);
  const d = Math.round((t - n) / 86400000);
  $('#cdBig').textContent = d > 0 ? `${toBn(d)} দিন পর` : d === 0 ? 'আজই! 🥰' : 'তারিখ পার হয়ে গেছে';
  $('#cdDate').textContent = `( ${fmtDate(meetDate)} )`;
}
function fmtDate(s) { if (!s) return ''; const [y, m, d] = s.split('-').map(Number); return `${toBn(d)} ${MONTHS[m - 1]}, ${toBn(y)}`; }
function setOnline(on) {
  $('#homeStatus').textContent = on ? `${partner.name || 'সে'} অনলাইনে আছে 💚` : 'অপেক্ষা করছি... 🕒';
  $('#wstatus').textContent = on ? 'সংযুক্ত আছেন ❤️' : 'অপেক্ষা করছি...';
  $('#wdot').classList.toggle('on', on);
  if (!on) { $('#remoteCam').srcObject = null; }
}

/* ---------- ক্যামেরা ও মাইক ---------- */
let localCam = null, facing = 'user';
async function getCam(force) {
  if (localCam && !force) return localCam;
  try {
    localCam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } }, audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    try { localCam = await navigator.mediaDevices.getUserMedia({ audio: true }); toast('ক্যামেরা পাওয়া যায়নি, শুধু মাইক চালু'); }
    catch (e2) { localCam = null; toast('ক্যামেরা/মাইকের অনুমতি দাও'); }
  }
  if (localCam) { $('#selfCam').srcObject = localCam; $('#selfCam').play().catch(() => {}); }
  return localCam;
}

/* ---------- সংযোগ (PeerJS) ---------- */
let peer = null, conn = null, me = 0, camCall = null, retryT = null;
const hostId = () => `lsync-${room}-1`;
function stopPeer() { clearTimeout(retryT); try { if (conn) conn.close(); } catch (e) {} try { if (camCall) camCall.close(); } catch (e) {} try { if (peer) peer.destroy(); } catch (e) {} peer = conn = camCall = null; me = 0; }
function startPeer(n = 1) {
  stopPeer();
  peer = new Peer(`lsync-${room}-${n}`, { config: { iceServers: ICE }, debug: 0 });
  peer.on('open', () => { me = n; setOnline(false); if (n === 2) connectHost(); });
  peer.on('connection', c => { if (conn && conn.open) { c.close(); return; } bindConn(c); });
  peer.on('call', onCall);
  peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
  peer.on('error', e => {
    if (e.type === 'unavailable-id') { n === 1 ? startPeer(2) : toast('রুমে আগে থেকেই দুজন আছে'); }
    else if (e.type === 'peer-unavailable') { if (me === 2) retryT = setTimeout(connectHost, 3000); }
    else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) { retryT = setTimeout(() => startPeer(me || 1), 4000); }
  });
}
function connectHost() { if (!peer || peer.destroyed) return; bindConn(peer.connect(hostId(), { reliable: true })); }
function bindConn(c) {
  conn = c;
  const opened = () => {
    setOnline(true); sendProfile(); sendDate();
    if (me === 2) callCam();
    if (cur) send({ t: 'load', v: cur, time: P ? P.time() : 0, playing: P ? P.playing() : false, hello: true });
  };
  c.open ? opened() : c.on('open', opened);
  c.on('data', onData);
  c.on('close', () => { if (conn === c) { conn = null; setOnline(false); if (me === 2) retryT = setTimeout(connectHost, 3000); } });
  c.on('error', () => {});
}
const send = o => { if (conn && conn.open) conn.send(o); };
function sendProfile() { send({ t: 'profile', name: myName, avatar: myAvatar }); }
function sendDate() { if (meetDate) send({ t: 'date', d: meetDate, ts: meetTs }); }

function wireCall(call) {
  camCall = call;
  call.on('stream', s => { const v = $('#remoteCam'); v.srcObject = s; v.play().catch(() => {}); $('#remotePh').style.display = 'none'; });
  call.on('close', () => { $('#remotePh').style.display = 'flex'; });
}
async function callCam() {
  await getCam();
  if (!localCam || !peer) return;
  if (camCall) try { camCall.close(); } catch (e) {}
  wireCall(peer.call(hostId(), localCam, { metadata: { kind: 'cam' } }));
}
async function onCall(call) {
  await getCam();
  if (camCall) try { camCall.close(); } catch (e) {}
  call.answer(localCam || undefined);
  wireCall(call);
}

/* ---------- ভিডিও (YouTube / Facebook) ---------- */
let cur = null, P = null, yt = null, fbp = null, fbPlaying = false, pending = null, lastT = 0, quietUntil = 0, muted = false;
const quiet = () => Date.now() < quietUntil;
const remote = fn => { quietUntil = Date.now() + 1500; try { fn(); } catch (e) {} };

function parseLink(u) {
  u = (u || '').trim();
  let m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
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
  $('#ytbox').innerHTML = ''; $('#fbbox').innerHTML = ''; stage(null);
}

let ytP = null;
function ytAPI() {
  if (window.YT && YT.Player) return Promise.resolve();
  return ytP || (ytP = new Promise(res => { window.onYouTubeIframeAPIReady = res; const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s); }));
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

let fbLoad = null;
function fbSDK() {
  if (window.FB) return Promise.resolve();
  return fbLoad || (fbLoad = new Promise(res => {
    window.fbAsyncInit = () => { FB.init({ xfbml: false, version: 'v19.0' }); FB.Event.subscribe('xfbml.ready', onFBReady); res(); };
    const s = document.createElement('script'); s.async = true; s.src = 'https://connect.facebook.net/en_US/sdk.js'; document.head.appendChild(s);
  }));
}
let fbOpts = {};
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
  stopVideo(); cur = v; stage(v.kind);
  v.kind === 'yt' ? mountYT(v.id, o) : mountFB(v.url, o);
}
function localLoad() {
  const v = parseLink($('#url').value);
  if (!v) return toast('শুধু YouTube বা Facebook লিংক দাও');
  loadVideo(v, {}); send({ t: 'load', v, time: 0, playing: true });
  $('#url').value = '';
}

/* পোলিং: সিক ধরা + ড্রিফট ঠিক করা */
setInterval(() => {
  if (!P) return;
  const t = P.time(), pl = P.playing();
  $('#bPlay').textContent = pl ? '⏸' : '▶️';
  if (!quiet() && Math.abs(t - (lastT + (pl ? 0.7 : 0))) > 1.8) send({ t: 'seek', time: t });
  lastT = t;
}, 700);
setInterval(() => { if (P && me === 1 && P.playing()) send({ t: 'tick', time: P.time(), playing: true }); }, 4000);

/* ---------- মেসেজ গ্রহণ ---------- */
function onData(o) {
  if (!o || !o.t) return;
  switch (o.t) {
    case 'profile': partner = { name: o.name || '', avatar: o.avatar || '' }; LS.set('partner', partner); renderProfiles(); setOnline(true); break;
    case 'date': if ((o.ts || 0) > meetTs) { meetDate = o.d; meetTs = o.ts; LS.set('date', meetDate); LS.set('dateTs', meetTs); renderCount(); } break;
    case 'load': if (o.hello && cur && JSON.stringify(cur) === JSON.stringify(o.v)) break; loadVideo(o.v, o); break;
    case 'stop': stopVideo(); break;
    case 'play': if (!P) { pending = { time: o.time, playing: true }; break; } remote(() => { if (Math.abs(P.time() - o.time) > 1) P.seek(o.time); P.play(); }); lastT = o.time; break;
    case 'pause': if (!P) { pending = { time: o.time, playing: false }; break; } remote(() => { P.pause(); if (Math.abs(P.time() - o.time) > 1) P.seek(o.time); }); lastT = o.time; break;
    case 'seek': if (!P) { pending = { time: o.time, playing: false }; break; } remote(() => P.seek(o.time)); lastT = o.time; break;
    case 'tick': if (!P) break; remote(() => { if (Math.abs(P.time() - o.time) > 2.5) P.seek(o.time); if (o.playing && !P.playing()) P.play(); }); lastT = o.time; break;
    case 'chat': addMsg({ me: false, text: o.text, ts: o.ts }); break;
    case 'react': floatEmoji(o.e); break;
  }
}

/* ---------- চ্যাট ---------- */
const hm = ts => { const d = new Date(ts); let h = d.getHours(), m = d.getMinutes(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')} ${ap}`; };
function renderMsgs() {
  const box = $('#msgs'); box.innerHTML = '';
  chat.forEach(m => {
    const d = document.createElement('div'); d.className = 'm' + (m.me ? ' me' : '');
    const av = document.createElement('div'); av.className = 'av'; m.me ? setAv(av, myAvatar, myName) : setAv(av, partner.avatar, partner.name);
    const b = document.createElement('div'); b.className = 'bub'; b.textContent = m.text;
    const s = document.createElement('small'); s.textContent = hm(m.ts); b.appendChild(s);
    d.append(av, b); box.appendChild(d);
  });
  box.scrollTop = box.scrollHeight;
}
function addMsg(m) {
  chat.push(m); chat = chat.slice(-200); LS.set('chat', chat);
  const open = $('#s-chat').classList.contains('open');
  if (open) renderMsgs(); else if (!m.me) { unread++; const b = $('#badge'); b.textContent = toBn(unread); b.classList.remove('hidden'); }
}
function sendMsg() {
  const i = $('#msgIn'), text = i.value.trim(); if (!text) return;
  const m = { me: true, text, ts: Date.now() }; i.value = '';
  send({ t: 'chat', text, ts: m.ts }); addMsg(m);
}
function floatEmoji(e) {
  const f = document.createElement('div'); f.className = 'fl'; f.textContent = e; f.style.left = (12 + Math.random() * 70) + '%';
  $('#floats').appendChild(f); setTimeout(() => f.remove(), 2500);
}

/* ---------- ছবি বাছাই ---------- */
function pickAvatar() { $('#pick').click(); }
$('#pick').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => {
    const s = 192, c = document.createElement('canvas'); c.width = c.height = s;
    const k = Math.max(s / img.width, s / img.height), w = img.width * k, h = img.height * k;
    c.getContext('2d').drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
    myAvatar = c.toDataURL('image/jpeg', .8); LS.set('avatar', myAvatar); URL.revokeObjectURL(url);
    renderProfiles(); sendProfile(); renderMsgs();
  };
  img.src = url; e.target.value = '';
};

/* ---------- বোতাম ---------- */
async function enterRoom() {
  await getCam(); show('s-home'); renderProfiles(); startPeer(1);
}
$('#joinBtn').onclick = async () => {
  const n = $('#name').value.trim(), r = cleanRoom($('#room').value);
  if (!n) return toast('তোমার নাম লেখো');
  if (r.length < 4) return toast('রুম কোড কমপক্ষে ৪টা অক্ষর/সংখ্যা (ইংরেজিতে) হতে হবে');
  myName = n; room = r; LS.set('name', n); LS.set('room', r);
  enterRoom();
};
$('#permCard').onclick = async () => { const s = await getCam(true); if (s) toast('অনুমতি পাওয়া গেছে ✅'); };
$('#homeBack').onclick = () => show('s-join');
$('#homeMenu').onclick = () => { renderProfiles(); show('s-settings'); };
$('#avMe').onclick = pickAvatar; $('#avSet').onclick = pickAvatar;
$('#countCard').onclick = changeDate;
$('#watchBtn').onclick = () => show('s-watch');
$('#leaveBtn').onclick = () => show('s-home');
$('#setBack').onclick = () => show('s-home');

async function changeDate() {
  const v = await ask('দেখা হওয়ার তারিখ', meetDate, 'date');
  if (v) { meetDate = v; meetTs = Date.now(); LS.set('date', v); LS.set('dateTs', meetTs); renderCount(); sendDate(); }
}
$('#rDate').onclick = changeDate;
$('#rName').onclick = async () => { const v = await ask('তোমার নাম', myName); if (v) { myName = v; LS.set('name', v); renderProfiles(); sendProfile(); } };
$('#rRoom').onclick = async () => { const v = cleanRoom((await ask('নতুন রুম কোড (ইংরেজি অক্ষর/সংখ্যা)', room)) || ''); if (v.length >= 4) { room = v; LS.set('room', v); renderProfiles(); startPeer(1); toast('নতুন কোডে সংযোগ হচ্ছে...'); } else if (v) toast('কমপক্ষে ৪টা অক্ষর দাও'); };
$('#rLeave').onclick = () => { stopPeer(); stopVideo(); room = ''; LS.set('room', ''); $('#room').value = ''; setOnline(false); show('s-join'); };

$('#loadBtn').onclick = localLoad;
$('#url').onkeydown = e => { if (e.key === 'Enter') localLoad(); };
$('#bPlay').onclick = () => { if (!P) return toast('আগে ভিডিও চালাও'); P.playing() ? P.pause() : P.play(); };
const jump = d => { if (!P) return; const t = Math.max(0, P.time() + d); remote(() => P.seek(t)); lastT = t; send({ t: 'seek', time: t }); };
$('#bBack').onclick = () => jump(-10); $('#bFwd').onclick = () => jump(10);
$('#bMute').onclick = () => { muted = !muted; if (P) P.mute(muted); $('#bMute').textContent = muted ? '🔇' : '🔊'; };
$('#bStop').onclick = () => { if (!cur) return; stopVideo(); send({ t: 'stop' }); };

$('#micBtn').onclick = () => { const t = localCam && localCam.getAudioTracks()[0]; if (!t) return; t.enabled = !t.enabled; $('#micBtn').classList.toggle('off', !t.enabled); $('#micBtn').textContent = t.enabled ? '🎤' : '🔇'; };
$('#camBtn').onclick = () => { const t = localCam && localCam.getVideoTracks()[0]; if (!t) return; t.enabled = !t.enabled; $('#camBtn').classList.toggle('off', !t.enabled); };
$('#flipBtn').onclick = async () => {
  if (!localCam) return;
  facing = facing === 'user' ? 'environment' : 'user';
  try {
    const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
    const nt = ns.getVideoTracks()[0], old = localCam.getVideoTracks()[0];
    const snd = camCall && camCall.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
    if (snd) await snd.replaceTrack(nt);
    if (old) { localCam.removeTrack(old); old.stop(); } localCam.addTrack(nt);
    $('#selfCam').srcObject = localCam; $('#selfCam').style.transform = facing === 'user' ? 'scaleX(-1)' : 'none';
  } catch (e) { toast('ক্যামেরা ঘোরানো যায়নি'); facing = facing === 'user' ? 'environment' : 'user'; }
};

document.querySelectorAll('#reacts button').forEach(b => b.onclick = () => { floatEmoji(b.textContent); send({ t: 'react', e: b.textContent }); });
$('#chatBtn').onclick = () => { unread = 0; $('#badge').classList.add('hidden'); renderMsgs(); $('#s-chat').classList.add('open'); };
$('#chatBack').onclick = () => $('#s-chat').classList.remove('open');
$('#chatClear').onclick = () => { chat = []; LS.set('chat', chat); renderMsgs(); };
$('#sendBtn').onclick = sendMsg;
$('#msgIn').onkeydown = e => { if (e.key === 'Enter') sendMsg(); };
$('#emojiBtn').onclick = () => $('#emojiRow').classList.toggle('hidden');
const row = $('#emojiRow');
['😀','😍','🥰','😘','😂','😭','🥺','😴','🤗','😡','👍','🙏','❤️','💕','💋','🔥','🎉','🌹'].forEach(e => { const b = document.createElement('button'); b.textContent = e; b.onclick = () => { $('#msgIn').value += e; }; row.appendChild(b); });

/* ---------- শুরু ---------- */
$('#name').value = myName; $('#room').value = room;
renderProfiles();
setTimeout(() => { if (myName && room) enterRoom(); else show('s-join'); }, 2300);
