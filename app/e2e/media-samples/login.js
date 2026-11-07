// login.js: sign in and start a session
app.post('/login', async (req, res) => {
  const user = await db.users.findOne({ email: req.body.email });
  const ok = user && (await bcrypt.compare(req.body.password, user.passwordHash));
  if (!ok) return res.status(401).json({ error: 'Wrong email or password' });

  const token = await sessions.create(user.id);
  res.cookie('session', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ ok: true });
});
