import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create a default admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@localhost-tunnel.com' },
    update: {},
    create: {
      email: 'admin@localhost-tunnel.com',
      name: 'Admin User',
      password: adminPassword,
      role: 'ADMIN',
      emailVerified: new Date(),
    },
  });
  console.log('Created admin user:', adminUser.email);

  // Create a demo user
  const demoPassword = await bcrypt.hash('demo123', 12);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@localhost-tunnel.com' },
    update: {},
    create: {
      email: 'demo@localhost-tunnel.com',
      name: 'Demo User',
      password: demoPassword,
      role: 'USER',
      emailVerified: new Date(),
    },
  });
  console.log('Created demo user:', demoUser.email);

  // Create default settings
  const settings = await prisma.settings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      defaultPort: 3000,
      maxRequests: 1000,
      rateLimit: 100,
    },
  });
  console.log('Created settings:', settings);

  // Create sample API key for admin user
  const apiKey = await prisma.apiKey.upsert({
    where: { key: 'lt_test_api_key_12345678901234567890' },
    update: {},
    create: {
      key: 'lt_test_api_key_12345678901234567890',
      keyPrefix: 'lt_test_',
      name: 'Test API Key',
      isActive: true,
      userId: adminUser.id,
    },
  });
  console.log('Created API key:', apiKey.name);

  // Create sample tunnels for demo user
  const tunnel1 = await prisma.tunnel.upsert({
    where: { subdomain: 'demo' },
    update: {},
    create: {
      subdomain: 'demo',
      localPort: 8080,
      localHost: 'localhost',
      protocol: 'HTTP',
      isActive: true,
      inspect: true,
      userId: demoUser.id,
    },
  });
  console.log('Created tunnel:', tunnel1.subdomain);

  const tunnel2 = await prisma.tunnel.upsert({
    where: { subdomain: 'api' },
    update: {},
    create: {
      subdomain: 'api',
      localPort: 3001,
      localHost: 'localhost',
      protocol: 'HTTP',
      isActive: true,
      inspect: true,
      userId: demoUser.id,
    },
  });
  console.log('Created tunnel:', tunnel2.subdomain);

  const tunnel3 = await prisma.tunnel.upsert({
    where: { subdomain: 'secure' },
    update: {},
    create: {
      subdomain: 'secure',
      localPort: 4000,
      localHost: 'localhost',
      protocol: 'HTTP',
      password: await bcrypt.hash('password123', 10),
      isActive: true,
      inspect: true,
      userId: adminUser.id,
    },
  });
  console.log('Created tunnel:', tunnel3.subdomain);

  // Create sample requests for demo tunnel
  const requests = await Promise.all([
    prisma.request.create({
      data: {
        tunnelId: tunnel1.id,
        method: 'GET',
        path: '/',
        headers: JSON.stringify({ 'Content-Type': 'application/json' }),
        statusCode: 200,
        responseTime: 45,
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
      },
    }),
    prisma.request.create({
      data: {
        tunnelId: tunnel1.id,
        method: 'POST',
        path: '/api/data',
        headers: JSON.stringify({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message: 'Hello World' }),
        statusCode: 201,
        responseTime: 120,
        ip: '192.168.1.2',
        userAgent: 'curl/7.64.1',
      },
    }),
    prisma.request.create({
      data: {
        tunnelId: tunnel1.id,
        method: 'GET',
        path: '/api/users',
        headers: JSON.stringify({ 'Authorization': 'Bearer token' }),
        statusCode: 200,
        responseTime: 85,
        ip: '10.0.0.1',
        userAgent: 'PostmanRuntime/7.32.0',
      },
    }),
    prisma.request.create({
      data: {
        tunnelId: tunnel2.id,
        method: 'PUT',
        path: '/api/update',
        headers: JSON.stringify({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: 1, name: 'Updated' }),
        statusCode: 200,
        responseTime: 150,
        ip: '172.16.0.1',
        userAgent: 'axios/1.6.2',
      },
    }),
  ]);
  console.log('Created', requests.length, 'sample requests');

  // Update tunnel stats
  await prisma.tunnel.update({
    where: { id: tunnel1.id },
    data: { totalRequests: 3 },
  });
  await prisma.tunnel.update({
    where: { id: tunnel2.id },
    data: { totalRequests: 1 },
  });

  console.log('Database seeded successfully!');
  console.log('\nTest Credentials:');
  console.log('Admin: admin@localhost-tunnel.com / admin123');
  console.log('Demo: demo@localhost-tunnel.com / demo123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
