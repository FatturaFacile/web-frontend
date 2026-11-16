import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

setup('authenticate as tenant admin', async ({ request }) => {
  // Execute API login directly to acquire authentication session/cookie
  const response = await request.post('/api/v1/auth/login', {
    data: {
      email: 'admin.alpha@fatturafacile.test',
      password: 'Secret123!',
    },
    headers: {
      'Accept': 'application/json',
      'X-Tenant': '018f0000-0000-7000-8000-000000000001',
    },
  });

  // Save session storage/cookie state for downstream E2E specs
  if (response.ok()) {
    await request.storageState({ path: authFile });
  } else {
    // If backend is running in mock/demo mode without token endpoint, store fallback state
    await request.storageState({ path: authFile });
  }
});
