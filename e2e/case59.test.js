describe('TC-59: Form Validation', () => {
  beforeAll(async () => {
    await device.launchApp({ 
      delete: true, 
      newInstance: true,
      launchArgs: { 
        isDetox: true,
        detoxPrintBusyIdleResources: 'YES' 
      }
    });
    await device.setURLBlacklist(['.*websocket.*', '.*socket.io.*']);
    await device.disableSynchronization();
  });
  
  beforeEach(async () => {
    await device.openURL({ url: 'bloodbuddy://auth/login' });
    await device.disableSynchronization();
    // Wait for the login screen's top element to be visible
    await waitFor(element(by.id('emailInput'))).toBeVisible().withTimeout(45000);
  });

  it('should show validation errors when email or password fields are left empty', async () => {
    console.log('Running TC-59: Check that with incorrect or empty email/password user is not able to log in');

    // Note: Validation in this app triggers on blur.
    
    // Ensure email input is visible and focused
    await waitFor(element(by.id('emailInput')))
      .toBeVisible()
      .whileElement(by.id('loginScrollView'))
      .scroll(50, 'down');
    
    // Tapping between fields to trigger blur
    await element(by.id('emailInput')).tap();
    await element(by.id('passwordInput')).tap();
    await element(by.id('emailInput')).tap();
    
    // We expect the validation messages to appear
    try {
      await waitFor(element(by.text("Email is required"))).toBeVisible().withTimeout(5000);
      await expect(element(by.text("Password is required"))).toBeVisible();
      console.log('TC-06: PASSED - Validation errors are displayed correctly');
    } catch (e) {
      console.log('TC-02: FAILED or Skipped visibility check - focus/blur timing issue');
      throw e;
    }
  });
});
