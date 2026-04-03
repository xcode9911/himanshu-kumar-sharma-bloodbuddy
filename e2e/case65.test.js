describe('TC-65: Unsuccessful Inventory Addition', () => {
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

  it('should not allow organization to add inventory with invalid units (negative or zero)', async () => {
    console.log('Running TC-65: Unsuccessful Inventory Addition');

    // 1. Login as organization
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

    // Wait for Home screen to load
    await waitFor(element(by.id('homeProfileCard'))).toBeVisible().withTimeout(30000);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 2. Open Inventory
    await element(by.id('navTab_inventory')).atIndex(0).tap();
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify inventory screen is visible
    await waitFor(element(by.id('addInventoryOpenButton'))).toBeVisible().withTimeout(15000);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Enter modal
    await element(by.id('addInventoryOpenButton')).tap();
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await waitFor(element(by.id('inventoryUnitsInput'))).toBeVisible().withTimeout(5000);

    // 3. Enter units as 0
    await element(by.id('inventoryUnitsInput')).tap();
    await element(by.id('inventoryUnitsInput')).replaceText('0');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Dismiss keyboard
    await element(by.text('Add Inventory')).tap();
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 4. Click Save
    await element(by.id('addInventorySubmitButton')).tap();
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verification: Error alert should pop up
    // Wait for validation alert ("Please enter a valid number of units" or backend error)
    await waitFor(element(by.text('Error'))).toBeVisible().withTimeout(10000);
    await element(by.text('OK')).tap();
    
    // Check that we're still in the modal because submission failed
    await expect(element(by.text('Add Inventory'))).toBeVisible();

    console.log('TC-65: PASSED - Invalid units correctly rejected');
  });
});
