export interface TestUser {
  email: string;
  fullName: string;
  password: string;
  phone: string;
}

export function createTestUser(prefix = 'e2e'): TestUser {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    email: `${prefix}.${id}@example.com`,
    fullName: 'E2E Test User',
    password: 'TestPassword123',
    phone: '+56912345678',
  };
}
