import "dotenv/config";
import prisma from "../src/models/index.js";
import bcrypt from "bcrypt";

async function main() {
  console.log("Seeding started...");

  // Clear existing entries (optional but helps avoid unique constraints on multiple runs)
  await prisma.otp.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.location.deleteMany();
  await prisma.donorResponse.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.bloodRequest.deleteMany();
  await prisma.donationOffer.deleteMany();
  await prisma.campAttendance.deleteMany();
  await prisma.campaignCollaboration.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.inventoryHistory.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.donor.deleteMany();
  await prisma.gainer.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash("password123", 10);

  // 1. Seed Organization
  const orgUser = await prisma.user.create({
    data: {
      FullName: "Metro Red Cross",
      Email: "org@bloodbuddy.com",
      Password: hashedPassword,
      Phone: "9876543210",
      Role: "organization",
      organization: {
        create: {
          OrganizationName: "Metro Red Cross HQ",
          Location: "Downtown Avenue, Cityville",
          Latitude: 40.7128,
          Longitude: -74.0060,
          Contact: "org-contact@bloodbuddy.com",
        },
      },
    },
  });
  console.log("Seeding Organization User:", orgUser.Email);

  // 2. Seed Donor
  const donorUser = await prisma.user.create({
    data: {
      FullName: "John Doe",
      Email: "donor@bloodbuddy.com",
      Password: hashedPassword,
      Phone: "9812345678",
      Role: "donor",
      donor: {
        create: {
          BloodType: "O+",
          EligibilityStatus: "eligible",
          Location: "Green Park, Cityville",
          IsAvailable: true,
        },
      },
    },
  });
  console.log("Seeding Donor User:", donorUser.Email);

  // 3. Seed Gainer
  const gainerUser = await prisma.user.create({
    data: {
      FullName: "Jane Smith",
      Email: "gainer@bloodbuddy.com",
      Password: hashedPassword,
      Phone: "9845678901",
      Role: "gainer",
      gainer: {
        create: {
          Address: "Central Heights, Cityville",
        },
      },
    },
  });
  console.log("Seeding Gainer User:", gainerUser.Email);

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

