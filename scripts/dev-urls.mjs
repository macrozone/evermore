export function devUrls(value = process.env.BASE_PORT ?? '3000') {
  const base = Number(value);
  if (!/^\d+$/.test(String(value)) || base < 1024 || base > 65436) {
    throw new Error('BASE_PORT must be an integer between 1024 and 65436');
  }
  const www = `http://localhost:${base}`;
  return {
    base,
    indexPort: base + 90,
    pages: [
      { name: 'www', url: www },
      { name: 'Lab', url: `${www}/lab` },
      { name: 'Moodboards', url: `${www}/moodboards` },
      { name: 'Dev index', url: `http://localhost:${base + 90}` },
    ],
    services: [
      { name: 'Postgres', address: `localhost:${base + 30}` },
      { name: 'Cloud Tasks (gRPC)', address: `localhost:${base + 31}` },
    ],
  };
}
