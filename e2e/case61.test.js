describe('TC-61: Unsuccessful Password Reset OTP Request', () => {
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
    // Wait for the login screen to be visible
    await waitFor(element(by.id('emailInput'))).toBeVisible().withTimeout(45000);
  });

  it('should not request password reset OTP with an unregistered email', async () => {
    console.log('Running TC-61: Check that user cannot request password reset OTP with an unregistered email');

    // 1. Click Forgot Password
    await waitFor(element(by.id('forgotPasswordLink')))
      .toBeVisible()
      .whileElement(by.id('loginScrollView'))
      .scroll(100, 'down');
    
    await element(by.id('forgotPasswordLink')).tap();

    // 2. Wait for Forgot Password screen by its testID
    await waitFor(element(by.id('forgotPasswordEmailInput'))).toBeVisible().withTimeout(20000);
    
    // 3. Enter unregistered email
    await element(by.id('forgotPasswordEmailInput')).tap();
    await element(by.id('forgotPasswordEmailInput')).typeText('unregistered@example.com');
    
    // Dismiss keyboard by tapping the center of the image (safer)
    await element(by.id('forgotPasswordTitle')).tap();

    // 4. Click Send OTP (Forgot Password button)
    await element(by.id('forgotPasswordScrollView')).scrollTo('bottom');
    
    await waitFor(element(by.id('forgotPasswordSubmitButton'))).toBeVisible().withTimeout(5000);
    await element(by.id('forgotPasswordSubmitButton')).tap();

    // Verification: Stage should NOT change to Reset Password
    // Check that we stay on the "Forgot Password" stage
    await expect(element(by.id('forgotPasswordTitle'))).toHaveText('Forgot Password');
    
    // Check for the error message (Note: on iOS this is often just text in an alert)
    // We wait for the specific error message from the backend
    await waitFor(element(by.text('User with this email does not exist.'))).toBeVisible().withTimeout(15000);
    
    // Dismiss the alert to clean up
    await element(by.text('OK')).tap();
    
    console.log('TC-61: PASSED - Explicit error message verified for unregistered email');
  });
});
