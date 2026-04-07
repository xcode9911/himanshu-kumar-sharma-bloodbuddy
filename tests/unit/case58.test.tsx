import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import LoginScreen from "../../app/auth/login";
import { API_ENDPOINTS } from "../../config/api";
import {
    logCaseStep,
    makeJsonResponse,
    mockRouter,
    setupDefaultCaseMocks,
} from "./helpers/caseTestUtils";

describe("TC-58", () => {
  beforeEach(() => {
    setupDefaultCaseMocks();
  });

  it("logs in successfully with valid credentials", async () => {
    logCaseStep("TC-58", "START", {
      scenario: "valid email/password login",
      email: "himanshush007s@gmail.com",
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeJsonResponse(true, {
        token: "jwt-token",
        user: {
          id: 1,
          fullName: "Himanshu Kumar",
          email: "himanshush007s@gmail.com",
          role: "organization",
          phone: "9804089581",
        },
      }),
    );

    const { getByTestId } = render(<LoginScreen />);
    logCaseStep("TC-58", "Rendered login screen");

    fireEvent.changeText(getByTestId("emailInput"), "himanshush007s@gmail.com");
    fireEvent.changeText(getByTestId("passwordInput"), "hello5544");
    fireEvent.press(getByTestId("loginButton"));
    logCaseStep("TC-58", "Submitted login form");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.LOGIN,
        expect.objectContaining({ method: "POST" }),
      );
    });
    logCaseStep("TC-58", "API call verified", {
      endpoint: API_ENDPOINTS.LOGIN,
    });

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "authToken",
        "jwt-token",
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "userData",
        expect.any(String),
      );
      expect(mockRouter.replace).toHaveBeenCalledWith("/navigation");
    });

    logCaseStep("TC-58", "PASS", {
      assertions: [
        "authToken stored",
        "userData stored",
        "navigated to /navigation",
      ],
    });
  });
});
