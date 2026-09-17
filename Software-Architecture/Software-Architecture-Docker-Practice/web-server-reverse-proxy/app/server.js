const express = require('express');
const app = express();
const port = 3000;

app.get('/api', (req, res) => {
  res.json({ message: 'API response from Node.js' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

app.get('/api/info', (req, res) => {
  res.status(200).json({ info: 'Nhóm 5' });
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});