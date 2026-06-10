const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const BUILD_DIR = path.join(__dirname, 'build');

// Serve static files from build directory
app.use(express.static(BUILD_DIR));

// For all other routes, serve index.html (SPA fallback)
app.get('*', (req, res) => {
  const indexPath = path.join(BUILD_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Build not found. Run npm run build first.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Feed Factory CRM Frontend serving on port ${PORT}`);
  console.log(`Serving static files from: ${BUILD_DIR}`);
});
