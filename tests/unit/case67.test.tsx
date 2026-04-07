import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import OrganizationDetailScreen from "../../app/organization/[id]";
import { API_ENDPOINTS } from "../../config/api";
import {
    logCaseStep,
    mockedAsyncStorageGetItem,
    mockedUseLocalSearchParams,
    setupDefaultCaseMocks,
} from "./helpers/caseTestUtils";

describe("TC-67", () => {
  beforeEach(() => {
    setupDefaultCaseMocks();
  });

  it("rejects booking when requested units exceed available units", async () => {
    logCaseStep("TC-67", "START", {
      scenario: "gainer booking fail for insufficient inventory",
      bloodType: "AB+",
      requestedUnits: 9999,
      availableUnits: 2,
    });

    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

    mockedUseLocalSearchParams.mockReturnValue({
      id: "10",
      name: "Org One",
      address: "Kathmandu",
      phone: "9800000000",
      email: "org@example.com",
      logoUrl: "",
      bloodTypes: JSON.stringify(["AB+"]),
      inventory: JSON.stringify([{ bloodType: "AB+", units: 2 }]),
    });

    mockedAsyncStorageGetItem.mockImplementation(async (key: string) => {
      if (key === "userData") {
        return JSON.stringify({ role: "gainer", bloodType: "O+" });
      }
      if (key === "authToken") return "token-123";
      return null;
    });

    const { getByTestId } = render(<OrganizationDetailScreen />);

    await waitFor(() => {
      expect(getByTestId("bookButton_AB+")).toBeTruthy();
    });

    fireEvent.press(getByTestId("bookButton_AB+"));
    fireEvent.changeText(getByTestId("bookingUnitsInput"), "9999");
    fireEvent.press(getByTestId("confirmBookingButton"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Error",
        "Insufficient units. Only 2 unit(s) available for AB+.",
      );
    });

    const bookingCalls = (global.fetch as jest.Mock).mock.calls.filter(
      ([url]) => url === API_ENDPOINTS.CREATE_BOOKING,
    );
    expect(bookingCalls).toHaveLength(0);

    logCaseStep("TC-67", "PASS", {
      assertions: ["insufficient unit alert shown", "no booking API call"],
    });
  });
});
