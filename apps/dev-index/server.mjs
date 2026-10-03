import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { devUrls } from '../../scripts/dev-urls.mjs';

export function createDevIndex(basePort) {
  const { base, pages, services } = devUrls(basePort);
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Evermore development</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    body { max-width: 42rem; margin: 4rem auto; padding: 0 1.5rem; background: #17191c; color: #e8e4dc; }
    h1 { font-family: Georgia, serif; font-weight: normal; }
    li { margin: 1rem 0; }
    a { color: #dfbd7a; }
    small, p { color: #bab5ac; }
    code { font-size: 1rem; }
  </style>
</head>
<body>
  <h1>Evermore development</h1>
  <p>Local workspace · port slot ${base}</p>
  <h2>Explore</h2>
  <ul>${pages.filter(({ name }) => name !== 'Dev index').map(({ name, url }) => `<li><a href="${url}">${name}</a> <small>${url}</small></li>`).join('')}</ul>
  <h2>Services</h2>
  <ul>${services.map(({ name, address }) => `<li>${name}: <code>${address}</code></li>`).join('')}</ul>
  <p>Links become available when their servers finish starting.</p>
</body>
</html>`;
  return http.createServer((request, response) => {
    if (request.url !== '/') {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(html);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { base, indexPort } = devUrls();
  const server = createDevIndex(base);
  server.on('error', (error) => {
    console.error(`[dev-index] ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(indexPort, '127.0.0.1', () => {
    console.log(`[dev-index] http://localhost:${indexPort}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close());
  }
}
