const express = require('express');
const multer = require('multer');
const path = require('path');
const {ImageAnnotatorClient} = require('@google-cloud/vision');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB limit 
});

const app = express();
const port = process.env.PORT || 8080;
const visionClient = new ImageAnnotatorClient();

app.use(express.static('public'));

app.post('/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('<h2>No file uploaded. Please go back and choose an image.</h2>');
    }

    const imageBuffer = req.file.buffer;

    const [response] = await visionClient.labelDetection({ image: { content: imageBuffer } });

    const labels = (response.labelAnnotations || []).map(a => ({
      description: a.description,
      score: a.score
    }));


    const html = buildHtmlResult(req.file.originalname, labels);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);

  } catch (err) {
    console.error('Error analyzing image:', err);
    res.status(500).send(`<h2>Server error: ${escapeHtml(err.message || String(err))}</h2>`);
  }
});


function buildHtmlResult(filename, labels) {
  const rows = labels.map(l => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(l.description)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee; text-align:right">${(l.score*100).toFixed(1)}%</td>
    </tr>`).join('');

  return `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>Labels for ${escapeHtml(filename)}</title>
    <style>
      body{font-family:system-ui, -apple-system, Roboto, "Segoe UI", Arial; margin:28px;}
      .card{max-width:820px;border:1px solid #eee;padding:18px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,0.04)}
      table{width:100%; border-collapse:collapse; margin-top:12px}
      th{ text-align:left; padding:10px 8px; border-bottom:2px solid #ddd }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>Detected labels for <em>${escapeHtml(filename)}</em></h2>
      ${labels.length ? `
        <table>
          <thead><tr><th>Label</th><th style="text-align:right">Confidence</th></tr></thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <p style="color:#666;margin-top:10px">Note: confidence is model's score (0–100%). Lower scores may be noisy.</p>
      ` : `<p>No labels found.</p>`}
      <p><a href="/">Analyze another image</a></p>
    </div>
  </body>
  </html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
