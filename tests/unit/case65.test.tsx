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

describe("TC-65", () => {
  beforeEach(() => {
    setupDefaultCaseMocks();
  });

  it("rejects inventory addition for zero units", async () => {
    logCaseStep("TC-65", "START", {
      scenario: "inventory add invalid zero units",
      units: 0,
    });

    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

    mockedAsyncStorageGetItem.mockResolvedValue("token-123");
    (global.fetch as jest.Mock).mockResolvedValue(
      makeJsonResponse(true, { exists: false }),
    );

    const { getByTestId } = render(
      <AddInventoryModal
        visible={true}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );

    fireEvent.changeText(getByTestId("inventoryUnitsInput"), "0");
    fireEvent.press(getByTestId("addInventorySubmitButton"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Error", "Cannot add 0 units");
    });

    const addCalls = (global.fetch as jest.Mock).mock.calls.filter(
      ([url]) => url === API_ENDPOINTS.ADD_INVENTORY,
    );
    expect(addCalls).toHaveLength(0);

    logCaseStep("TC-65", "PASS", {
      assertions: ["validation alert shown", "no add inventory API call"],
    });
  });
});
