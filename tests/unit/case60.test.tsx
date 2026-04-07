import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import ForgotPasswordScreen from "../../app/auth/forgot-password";
import { API_ENDPOINTS } from "../../config/api";
import {
    logCaseStep,
    makeTextResponse,
    setupDefaultCaseMocks,
} from "./helpers/caseTestUtils";

describe("TC-60", () => {
  beforeEach(() => {
    setupDefaultCaseMocks();
  });

  it("requests forgot-password OTP successfully", async () => {
    logCaseStep("TC-60", "START", {
      scenario: "registered email OTP request",
      email: "himanshush007s@gmail.com",
    });

    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeTextResponse(true, { message: "OTP sent" }),
    );

    const { getByTestId } = render(<ForgotPasswordScreen />);

    fireEvent.changeText(
      getByTestId("forgotPasswordEmailInput"),
      "himanshush007s@gmail.com",
    );
    fireEvent.press(getByTestId("forgotPasswordSubmitButton"));
    logCaseStep("TC-60", "Submitted forgot-password form");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.FORGOT_PASSWORD,
        expect.objectContaining({ method: "POST" }),
      );
    });

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "resetEmail",
        "himanshush007s@gmail.com",
      );
      expect(alertSpy).toHaveBeenCalledWith(
        "Sent",
        "OTP sent to your email. Enter it to reset your password.",
      );
      expect(getByTestId("forgotPasswordTitle").props.children).toBe(
        "Reset Password",
      );
    });

    logCaseStep("TC-60", "PASS", {
      assertions: [
        "forgot-password API called",
        "resetEmail stored",
        "screen moved to Reset Password",
      ],
    });
  });
});
