describe('TC-66: Successful Blood Units Booking', () => {
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

  it('should allow gainer to book blood units when organization has enough units', async () => {
    console.log('Running TC-66: Successful Blood Units Booking');

    // 1. Login as gainer
    await waitFor(element(by.id('emailInput')))
      .toBeVisible()
      .whileElement(by.id('loginScrollView'))
      .scroll(50, 'down');
    await element(by.id('emailInput')).tap();
    await element(by.id('emailInput')).replaceText('joshiabishek987@gmail.com');

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

    // 2. Open organization
    await element(by.id('navTab_organization')).atIndex(0).tap();
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Wait for organizations to load and tap the first one
    await waitFor(element(by.id('orgCard')).atIndex(0)).toBeVisible().withTimeout(15000);
    await element(by.id('orgCard')).atIndex(0).tap();
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      await waitFor(element(by.id('bookButton_AB+')).atIndex(0)).toBeVisible().withTimeout(5000);
      await element(by.id('bookButton_AB+')).atIndex(0).tap();
    } catch {
      try {
        await waitFor(element(by.id('bookButton_O+')).atIndex(0)).toBeVisible().withTimeout(5000);
        await element(by.id('bookButton_O+')).atIndex(0).tap();
      } catch {
        // Fallback to tapping the first "Book Now" text 
        await element(by.text('Book Now')).atIndex(0).tap();
      }
    }
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 4. Request units and Click Book
    await waitFor(element(by.id('bookingUnitsInput'))).toBeVisible().withTimeout(5000);
    await element(by.id('bookingUnitsInput')).tap();
    await element(by.id('bookingUnitsInput')).replaceText('1');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Dismiss keyboard
    await element(by.text('Number of Units')).tap();
    await new Promise(resolve => setTimeout(resolve, 3000));

    await element(by.id('confirmBookingButton')).tap();

    // Verification: Success alert should pop up
    await waitFor(element(by.text('Success'))).toBeVisible().withTimeout(10000);
    await element(by.text('OK')).tap();

    console.log('TC-66: PASSED - Booking request submitted successfully');
  });
});
