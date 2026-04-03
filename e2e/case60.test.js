describe('TC-60: Successful Password Reset OTP Request', () => {
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

  it('should request password reset OTP successfully with a registered email', async () => {
    console.log('Running TC-60: Check that user can request password reset OTP with a registered email');

    // 1. Click Forgot Password
    await waitFor(element(by.id('forgotPasswordLink')))
      .toBeVisible()
      .whileElement(by.id('loginScrollView'))
      .scroll(100, 'down');
    
    await element(by.id('forgotPasswordLink')).tap();

    // 2. Wait for Forgot Password screen by its testID
    await waitFor(element(by.id('forgotPasswordEmailInput'))).toBeVisible().withTimeout(20000);
    
    // 3. Enter registered email
    await element(by.id('forgotPasswordEmailInput')).tap();
    await element(by.id('forgotPasswordEmailInput')).typeText('himanshush007s@gmail.com');
    
    // Dismiss keyboard by tapping the center of the image (safer)
    await element(by.id('forgotPasswordTitle')).tap();

    // 4. Click Send OTP (Forgot Password button)
    await element(by.id('forgotPasswordScrollView')).scrollTo('bottom');
    
    await waitFor(element(by.id('forgotPasswordSubmitButton'))).toBeVisible().withTimeout(5000);
    await element(by.id('forgotPasswordSubmitButton')).tap();

    // Verification: Stage should change to Reset Password (indicating OTP sent)
    await waitFor(element(by.id('forgotPasswordTitle'))).toHaveText('Reset Password').withTimeout(20000);
    
    // Dismiss success alert
    await element(by.text('OK')).tap();
    
    console.log('TC-60: PASSED - OTP request successful');
  });
});
