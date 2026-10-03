import { devUrls } from './dev-urls.mjs';

const { base, pages, services } = devUrls();
console.log(`\nEvermore development · BASE_PORT=${base}`);
for (const { name, url } of pages) console.log(`  ${name}: ${url}`);
for (const { name, address } of services) console.log(`  ${name}: ${address}`);
console.log('Starting apps and Docker Compose services…\n');
