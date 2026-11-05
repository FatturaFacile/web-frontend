// Generated at runtime, so no password is written in the specs. It satisfies the backend password policy.
const random = () => Math.random().toString(36).slice(2);

export const TEST_PASSWORD = `Aa1!${random()}${random()}`;
