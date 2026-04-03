describe('TC-58: Successful Login', () => {
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

  it('should login successfully using correct email and password', async () => {
    console.log('Running TC-05: Check that with the correct email and password user is able to log in');

    // 1. Enter Email
    await waitFor(element(by.id('emailInput')))
      .toBeVisible()
      .whileElement(by.id('loginScrollView'))
      .scroll(50, 'down');
      
    await element(by.id('emailInput')).tap();
    await element(by.id('emailInput')).replaceText('himanshush007s@gmail.com');
    
    // Ensure password field is visible before interacting
    await waitFor(element(by.id('passwordInput')))
      .toBeVisible()
      .whileElement(by.id('loginScrollView'))
      .scroll(100, 'down');
    
    // 2. Enter Password
    await element(by.id('passwordInput')).tap();
    await element(by.id('passwordInput')).replaceText('hello5544');
    
    // 3. Wait for a few seconds as requested by the user
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 4. Dismiss keyboard by tapping the Welcome header and scroll to button
    await element(by.id('welcomeText')).tap();
    
    // Ensure login button is visible before tapping
    await waitFor(element(by.id('loginButton')))
      .toBeVisible()
      .whileElement(by.id('loginScrollView'))
      .scroll(100, 'down');
    
    // 5. Finally, hit login button
    await element(by.id('loginButton')).tap();

    // Verification
    await waitFor(element(by.id('loginButton'))).not.toExist().withTimeout(30000);
    console.log('TC-58: PASSED - User logged in successfully');
  });
});
