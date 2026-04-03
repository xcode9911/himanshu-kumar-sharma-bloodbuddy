import prisma from "../models/index.js";

export const logInventoryChange = async (
  organizationId: number,
  bloodType: string,
  unitsChanged: number,
  actionType: string,
  previousTotal: number,
  newTotal: number,
  referenceId?: number,
) => {
  try {
    await prisma.inventoryHistory.create({
      data: {
        OrganizationId: organizationId,
        BloodType: bloodType,
        UnitsChanged: unitsChanged,
        ActionType: actionType,
        PreviousTotal: previousTotal,
        NewTotal: newTotal,
        ReferenceId: referenceId ?? null,
      },
    });
  } catch (error) {
    console.error("Error logging inventory change:", error);
  }
};
