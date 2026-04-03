describe('TC-64: Successful Inventory Addition', () => {
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

  it('should allow organization to add inventory with valid blood group and units', async () => {
    console.log('Running TC-64: Successful Inventory Addition');

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

    // 2. Open Inventory
    await waitFor(element(by.id('homeProfileCard'))).toBeVisible().withTimeout(30000);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await element(by.id('navTab_inventory')).atIndex(0).tap();
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify inventory screen is visible
    await waitFor(element(by.id('addInventoryOpenButton'))).toBeVisible().withTimeout(15000);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. Add blood group
    await element(by.id('addInventoryOpenButton')).tap();
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await waitFor(element(by.id('bloodType_O+'))).toBeVisible().withTimeout(10000);
    await element(by.id('bloodType_O+')).tap(); // Select O+ as blood type
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 4. Add units
    // Adding a random/specific valid unit size like 15
    await element(by.id('inventoryUnitsInput')).tap();
    await element(by.id('inventoryUnitsInput')).replaceText('15');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Dismiss keyboard by tapping on the Title or modal area so the button is completely visible
    await element(by.text('Add Inventory')).tap();
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 5. Click Save
    await waitFor(element(by.id('addInventorySubmitButton'))).toBeVisible().withTimeout(10000);
    await element(by.id('addInventorySubmitButton')).tap();
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verification: Success message or list updates
    // The alert "Success: Inventory added successfully" or "Inventory updated successfully" pops up.
    await waitFor(element(by.text('Success'))).toBeVisible().withTimeout(20000);
    await element(by.text('OK')).tap();

    console.log('TC-64: PASSED - Inventory successfully added');
  });
});
