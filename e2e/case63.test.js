describe('TC-63: Unsuccessful Profile Update', () => {
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
    await waitFor(element(by.id('emailInput'))).toBeVisible().withTimeout(45000);
  });

  it('should not update profile with invalid phone number', async () => {
    console.log('Running TC-63: Unsuccessful Profile Update');

    // 1. PERFORM LOGIN (exact same as case 5)
    await waitFor(element(by.id('emailInput')))
      .toBeVisible()
      .whileElement(by.id('loginScrollView'))
      .scroll(50, 'down');
    await element(by.id('emailInput')).tap();
    await element(by.id('emailInput')).replaceText('himanshush007s@gmail.com');

    await waitFor(element(by.id('passwordInput')))
      .toBeVisible()
      .whileElement(by.id('loginScrollView'))
      .scroll(100, 'down');
    await element(by.id('passwordInput')).tap();
    await element(by.id('passwordInput')).replaceText('hello5544');

    await new Promise(resolve => setTimeout(resolve, 3000));
    await element(by.id('welcomeText')).tap(); // Dismiss keyboard
    
    await waitFor(element(by.id('loginButton')))
      .toBeVisible()
      .whileElement(by.id('loginScrollView'))
      .scroll(100, 'down');
    await element(by.id('loginButton')).tap();

    // 2. Wait for Home screen and click top profile card
    await waitFor(element(by.id('homeProfileCard'))).toBeVisible().withTimeout(30000);
    await element(by.id('homeProfileCard')).tap();

    // 3. Wait for Profile screen and click edit icon
    await waitFor(element(by.id('profileEditButton'))).toBeVisible().withTimeout(15000);
    await element(by.id('profileEditButton')).tap();

    // 4. Wait for Edit Profile screen
    await waitFor(element(by.id('editProfileScrollView'))).toBeVisible().withTimeout(15000);

    // 5. Scroll to Contact Number and enter invalid value
    await element(by.id('editProfileScrollView')).swipe('up', 'fast', 0.5);
    await waitFor(element(by.id('editProfileContactInput'))).toBeVisible().withTimeout(5000);
    await element(by.id('editProfileContactInput')).tap();
    await element(by.id('editProfileContactInput')).replaceText('123');
    
    // Dismiss keyboard
    await element(by.text('Edit Profile')).tap(); 
    
    // 6. Swipe up to ensure Save button is visible, wait 3 seconds, then Click Save
    await element(by.id('editProfileScrollView')).swipe('up', 'fast', 0.5);
    await new Promise(resolve => setTimeout(resolve, 3000));
    await waitFor(element(by.id('editProfileSaveButton'))).toBeVisible().withTimeout(10000);
    await element(by.id('editProfileSaveButton')).tap();

    // 7. Verify Error Alert
    await waitFor(element(by.text('Invalid input'))).toBeVisible().withTimeout(15000);
    await element(by.text('OK')).tap();

    // 8. Verify error message
    await waitFor(element(by.text('Enter a valid contact number'))).toBeVisible().withTimeout(10000);

    console.log('TC-63: PASSED - Invalid contact number correctly rejected');
  });
});
