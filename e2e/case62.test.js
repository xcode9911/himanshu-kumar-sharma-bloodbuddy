describe('TC-62: Successful Profile Update', () => {
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

  it('should update profile details successfully with valid inputs', async () => {
    console.log('Running TC-62: Successful Profile Update');

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
    await waitFor(element(by.id('editProfileNameInput'))).toBeVisible().withTimeout(15000);

    // 5. Update Profile Details
    const newName = "Himanshu Kumar Sharma";
    const newContact = "9804089581";
    
    await element(by.id('editProfileNameInput')).tap();
    await element(by.id('editProfileNameInput')).replaceText(newName);
    
    await element(by.id('editProfilePhoneInput')).tap();
    await element(by.id('editProfilePhoneInput')).replaceText(newContact);
    
    // Dismiss keyboard before scrolling
    await element(by.text('Edit Profile')).tap(); 
    
    // 6. Swipe up to scroll down to the Save button
    await element(by.id('editProfileScrollView')).swipe('up', 'fast', 0.5);
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await waitFor(element(by.id('editProfileSaveButton'))).toBeVisible().withTimeout(10000);
    await element(by.id('editProfileSaveButton')).tap();

    // 7. Verify Success Alert
    await waitFor(element(by.text('Success'))).toBeVisible().withTimeout(20000);
    await element(by.text('OK')).tap();

    // 8. Verify update (auto-navigates back to Profile)
    await waitFor(element(by.text(newName))).toBeVisible().withTimeout(15000);

    console.log('TC-62: PASSED - Profile updated successfully');
  });
});
