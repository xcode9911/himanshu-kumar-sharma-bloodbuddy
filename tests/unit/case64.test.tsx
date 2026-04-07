import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import AddInventoryModal from "../../components/AddInventoryModal";
import { API_ENDPOINTS } from "../../config/api";
import {
    logCaseStep,
    makeJsonResponse,
    mockedAsyncStorageGetItem,
    setupDefaultCaseMocks,
} from "./helpers/caseTestUtils";

describe("TC-64", () => {
  beforeEach(() => {
    setupDefaultCaseMocks();
  });

  it("adds inventory successfully with valid blood type and units", async () => {
    logCaseStep("TC-64", "START", {
      scenario: "inventory add success",
      bloodType: "O+",
      units: 15,
    });

    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

    mockedAsyncStorageGetItem.mockResolvedValue("token-123");
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url === API_ENDPOINTS.ADD_INVENTORY) {
        return makeJsonResponse(true, { message: "added" });
      }
      return makeJsonResponse(true, { exists: false });
    });

    const { getByTestId } = render(
      <AddInventoryModal
        visible={true}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );

    fireEvent.press(getByTestId("bloodType_O+"));
    fireEvent.changeText(getByTestId("inventoryUnitsInput"), "15");
    fireEvent.press(getByTestId("addInventorySubmitButton"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.ADD_INVENTORY,
        expect.objectContaining({ method: "POST" }),
      );
      expect(alertSpy).toHaveBeenCalledWith(
        "Success",
        "Inventory added successfully",
      );
    });

    logCaseStep("TC-64", "PASS", {
      assertions: ["add inventory API called", "success alert shown"],
    });
  });
});
