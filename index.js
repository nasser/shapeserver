const express = require('express'),
      opentype = require('opentype.js'),
      harfbuzz = require('harfbuzz'),
      path = require('path'),
      fs = require("fs")
const app = express()

app.use(express.static('public'))

let fontCache = {}

function readFont(fontFile, cb) {
  if(fontCache[fontFile] != undefined) {
    cb(null, fontCache[fontFile]);
  } else {
    fs.readFile(fontFile, (err, b) => {
      fontCache[fontFile] = b;
      cb(null, fontCache[fontFile]);
    });
  }
}

function shapedPaths(fontFile, text, size, x, y, cb) {
  readFont(fontFile, (err, b) => {
    let font_hb = harfbuzz.createFont(b, size)
    let font_ot = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset+b.byteLength), size)
    let shapedBuffer = harfbuzz.shape(font_hb, text)
    
    let paths = shapedBuffer.map(s => {
      let glyph = font_ot.glyphs.glyphs[s.codepoint];
      // https://lists.freedesktop.org/archives/harfbuzz/2015-December/005371.html
      let path = glyph.getPath(x + s.xOffset, y - s.yOffset, size);
      x += s.xAdvance;
      y -= s.yAdvance;
      return path;
    });
    
    cb(paths);
  });
}

app.get('/', (req, res) => res.send('Hello World!'))

app.get('/svg-test', (req, res) => res.sendFile(path.join(__dirname, 'svg-test.html')))
app.get('/three-test', (req, res) => res.sendFile(path.join(__dirname, 'three-test.html')))

app.get('/shape/*', (req, res) => {
  let fontFile = req.params[0];
  let text = req.query.text;
  let size = req.query.size || 32;
  
  let font = harfbuzz.createFont(fontFile, size)
  let shapedBuffer = harfbuzz.shape(font, text)
  
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(shapedBuffer));
});

app.get('/svg/*', (req, res) => {
  let fontFile = req.params[0];
  let text = req.query.text;
  let size = req.query.size || 32;
  
  shapedPaths(fontFile, text, size, 0, 0, paths => {
    // res.setHeader('Content-Type', 'application/xml+svg');
    res.send(paths.map(p => p.toSVG()).join("\n"));
  });
});

app.get('/commands/*', (req, res) => {
  let fontFile = req.params[0];
  let text = req.query.text;
  let size = req.query.size || 32;
  
  shapedPaths(fontFile, text, size, 0, 0, paths => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(paths.map(p => p.commands))); // ???
  });
});

app.listen(3000, () => console.log('Shaping server listening on http://localhost:3000\n\nTry http://localhost:3000/svg-text or http://localhost:3000/three-test'))