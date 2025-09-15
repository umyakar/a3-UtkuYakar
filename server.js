import dotenv from 'dotenv';
dotenv.config({ override: true });

import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 8080;

// security
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "img-src": ["'self'", "data:"],
      "style-src": ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      "script-src": ["'self'"],
      "connect-src": ["'self'"]
    }
  }
}));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'tiny'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// db
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('Missing MONGODB_URI in .env');
  process.exit(1);
}
await mongoose.connect(mongoUri);

// models
const userSchema = new mongoose.Schema({
  username:   { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String },
  githubId:   { type: String, index: true },
  createdAt:  { type: Date, default: Date.now }
}, { versionKey: false });

const itemSchema = new mongoose.Schema({
  userId:       { type: mongoose.Types.ObjectId, ref: 'User', index: true, required: true },
  name:         { type: String, required: true, maxlength: 100 },
  species:      { type: String, maxlength: 100 },
  lastWatered:  { type: Date, required: true },
  intervalDays: { type: Number, required: true, min: 1 },
  sunlight:     { type: String, enum: ['low','medium','high'], default: 'medium' },
  indoors:      { type: Boolean, default: true },
  notes:        { type: String, maxlength: 500 }
}, { timestamps: true, versionKey: false });

const User = mongoose.model('User', userSchema);
const Item = mongoose.model('Item', itemSchema);

// sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7
  },
  store: MongoStore.create({ mongoUrl: mongoUri })
}));

// helpers
function loginUser(req, user, cb) { req.session.userId = user._id.toString(); cb?.(); }
function logoutUser(req, cb) { req.session.destroy(cb); }
async function currentUser(req) { return req.session.userId ? User.findById(req.session.userId).lean() : null; }
function requireAuth(req, res, next) { if (!req.session.userId) return res.status(401).json({ error: 'not authenticated' }); next(); }

// Oauth
const GITHUB_CLIENT_ID     = (process.env.GITHUB_CLIENT_ID || '').trim();
const GITHUB_CLIENT_SECRET = (process.env.GITHUB_CLIENT_SECRET || '').trim();
const GITHUB_CALLBACK_URL  = (process.env.GITHUB_CALLBACK_URL || '').trim();
const OAUTH_ENABLED = Boolean(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET && GITHUB_CALLBACK_URL);

// env debug - Oauth issue
const mask = s => s ? (s.slice(0,4) + '...' + s.slice(-4)) : '(empty)';
console.log('[OAuth] ENABLED:', OAUTH_ENABLED);
console.log('[OAuth] CLIENT_ID:', GITHUB_CLIENT_ID || '(empty)');
console.log('[OAuth] CLIENT_SECRET:', mask(GITHUB_CLIENT_SECRET));
console.log('[OAuth] CALLBACK_URL:', GITHUB_CALLBACK_URL || '(empty)');

// Make unique username if prefered one is taken
async function uniqueUsername(base, githubId) {
  let candidate = base || `gh_${githubId}`;
  let n = 1;
  while (await User.exists({ username: candidate })) {
    candidate = `${base}-${n++}`;
    if (n > 50) { 
      candidate = `gh_${githubId}`;
      if (!await User.exists({ username: candidate })) break;
      candidate = `gh_${githubId}-${n}`;
    }
  }
  return candidate;
}

if (OAUTH_ENABLED) {
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user, done) => done(null, user._id.toString()));
  passport.deserializeUser(async (id, done) => {
    try { done(null, await User.findById(id).lean()); }
    catch (e) { done(e); }
  });

  passport.use(new GitHubStrategy(
    { clientID: GITHUB_CLIENT_ID, clientSecret: GITHUB_CLIENT_SECRET, callbackURL: GITHUB_CALLBACK_URL },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const githubId = String(profile.id);
        const login    = profile.username || profile._json?.login || `gh_${githubId}`;

        // Already there
        let user = await User.findOne({ githubId });
        if (user) return done(null, user);

        // Link to the existing acc
        const existingByUsername = await User.findOne({ username: login });
        if (existingByUsername) {
          if (!existingByUsername.githubId) {
            existingByUsername.githubId = githubId;
            await existingByUsername.save();
            return done(null, existingByUsername);
          }
        }

        //create unique
        const uname = await uniqueUsername(login, githubId);
        user = await User.create({ username: uname, githubId });
        return done(null, user);
      } catch (e) {
        return done(e);
      }
    }
  ));

  app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

  app.get('/auth/github/callback', (req, res, next) => {
    const code = req.query.code;
    passport.authenticate('github', async (err, user, info) => {
      if (err || !user) {
        console.error('[OAuth] authenticate() failed:', err || '(no user)', 'info:', info);

        const isDup = err && (err.code === 11000 || /duplicate key/i.test(String(err)));
        if (!isDup) {
          try {
            const params = new URLSearchParams({
              client_id: GITHUB_CLIENT_ID,
              client_secret: GITHUB_CLIENT_SECRET,
              code: String(code || ''),
              redirect_uri: GITHUB_CALLBACK_URL
            });
            const r = await fetch('https://github.com/login/oauth/access_token', {
              method: 'POST',
              headers: { Accept: 'application/json' },
              body: params
            });
            console.error('[OAuth] token endpoint response:', await r.json());
          } catch (e2) {
            console.error('[OAuth] manual token exchange error:', e2);
          }
        }

        return res.redirect('/?oauth=failed');
      }

      req.login(user, (e2) => {
        if (e2) {
          console.error('[OAuth] req.login error:', e2);
          return res.redirect('/?oauth=failed');
        }
        req.session.userId = user._id.toString();
        return res.redirect('/app');
      });
    })(req, res, next);
  });
} else {
  app.get('/auth/github', (_req, res) => res.status(503).send('GitHub OAuth not configured.'));
  app.get('/auth/github/callback', (_req, res) => res.redirect('/?oauth=failed'));
}

// config / health
app.get('/api/config', (_req, res) => res.json({ oauthEnabled: OAUTH_ENABLED }));
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// who am i
app.get('/api/me', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.json({ user: null });
  const { _id, username, githubId, createdAt } = user;
  res.json({ user: { _id, username, githubId, createdAt } });
});

// local login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing credentials' });

  const existing = await User.findOne({ username });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash });
    return loginUser(req, user, () => res.json({ ok: true, created: true, username: user.username }));
  }
  if (!existing.passwordHash) return res.status(400).json({ error: 'this account uses GitHub only' });

  const ok = await bcrypt.compare(password, existing.passwordHash);
  if (!ok) return res.status(401).json({ error: 'incorrect password' });
  return loginUser(req, existing, () => res.json({ ok: true, created: false, username: existing.username }));
});

// logout
app.post('/api/auth/logout', (req, res) => logoutUser(req, () => res.json({ ok: true })));

// items
app.get('/api/items', requireAuth, async (req, res) => {
  const user = await currentUser(req);
  const items = await Item.find({ userId: user._id }).sort({ createdAt: -1 }).lean();
  res.json({ items });
});
app.post('/api/items', requireAuth, async (req, res) => {
  const user = await currentUser(req);
  const { name, species, lastWatered, intervalDays, sunlight, indoors, notes } = req.body;
  if (!name || !lastWatered || !intervalDays) return res.status(400).json({ error: 'missing required fields' });
  const item = await Item.create({
    userId: user._id,
    name: String(name).trim(),
    species: species ? String(species).trim() : '',
    lastWatered: new Date(lastWatered),
    intervalDays: Number(intervalDays),
    sunlight: ['low', 'medium', 'high'].includes(sunlight) ? sunlight : 'medium',
    indoors: !!indoors,
    notes: notes ? String(notes).trim() : ''
  });
  res.status(201).json({ item });
});
app.put('/api/items/:id', requireAuth, async (req, res) => {
  const user = await currentUser(req);
  const doc = await Item.findOne({ _id: req.params.id, userId: user._id });
  if (!doc) return res.status(404).json({ error: 'not found' });
  const fields = ['name','species','lastWatered','intervalDays','sunlight','indoors','notes'];
  for (const f of fields) if (f in req.body) {
    if (f === 'intervalDays') doc[f] = Number(req.body[f]);
    else if (f === 'lastWatered') doc[f] = new Date(req.body[f]);
    else if (f === 'indoors') doc[f] = !!req.body[f];
    else doc[f] = req.body[f];
  }
  await doc.save();
  res.json({ item: doc });
});
app.delete('/api/items/:id', requireAuth, async (req, res) => {
  const user = await currentUser(req);
  const r = await Item.deleteOne({ _id: req.params.id, userId: user._id });
  if (r.deletedCount === 0) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// static
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true, lastModified: true, maxAge: '1d',
  setHeaders: res => { res.setHeader('Cache-Control', 'public, max-age=86400'); }
}));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/app', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// errors
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'server error' });
});

app.listen(PORT, () => {
  console.log(`A3 server listening on http://localhost:${PORT}`);
});