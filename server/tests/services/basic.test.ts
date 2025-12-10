// Simple test to verify authentication service works
import { AuthenticationService } from '../src/services/authenticationService';

describe('Authentication Service Basic Test', () => {
  it('should create authentication service instance', () => {
    const authService = new AuthenticationService({} as any);
    expect(authService).toBeInstanceOf(AuthenticationService);
  });
});