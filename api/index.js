const express = require('express');
const path = require('path');

const app = express();

// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'docs')));

// Routes
app.get('/test', (req, res) => {
  res.send('hello, world');
});

// API to set an item
app.post('/setItem', (req, res) => {
  const { key, value } = req.body;

  if (!key || value === undefined) {
    return res.status(400).json({ error: 'Key and value are required.' });
  }

  storage[key] = value;
  res.json({ message: `Item set: ${key}` });
});

// API to get an item
app.get('/getItem/:key', (req, res) => {
  const key = req.params.key;

  if (key in storage) {
    res.json({ key, value: storage[key] });
  } else {
    res.status(404).json({ error: `Item with key '${key}' not found.` });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
