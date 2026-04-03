import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    Dimensions,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { API_ENDPOINTS } from "../../config/api";
import { getUserFriendlyError } from "../../utils/errorMessages";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

const { width, height } = Dimensions.get("window");

interface EligibilityQuestion {
  id: string;
  question: string;
  category: string;
  hard_reject: boolean; // If yes, auto-reject
  soft_flag: boolean; // If yes, combine with other factors
}

const ELIGIBILITY_QUESTIONS: EligibilityQuestion[] = [
  // Health & Medical History
  {
    id: "q1",
    question:
      "In the past 2 weeks, have you had fever, flu-like symptoms, or taken antibiotics—even if you feel fine now?",
    category: "Health & Medical History",
    hard_reject: true,
    soft_flag: false,
  },
  {
    id: "q2",
    question:
      "Have you ever been advised by a doctor not to donate blood, even temporarily?",
    category: "Health & Medical History",
    hard_reject: true,
    soft_flag: false,
  },
  {
    id: "q3",
    question:
      "Have you had any surgery, dental extraction, or invasive procedure in the last 6 months?",
    category: "Health & Medical History",
    hard_reject: true,
    soft_flag: false,
  },
  {
    id: "q4",
    question:
      "Do you currently take any medicines that were recently started or adjusted?",
    category: "Health & Medical History",
    hard_reject: true,
    soft_flag: false,
  },

  // Lifestyle & Risk Assessment
  {
    id: "q5",
    question:
      "Have you had any needle exposure (tattoo, piercing, injection, IV drip) outside a hospital in the last 6–12 months?",
    category: "Lifestyle & Risk Assessment",
    hard_reject: true,
    soft_flag: false,
  },
  {
    id: "q6",
    question:
      "Have you traveled recently to an area where malaria, dengue, or typhoid is common?",
    category: "Lifestyle & Risk Assessment",
    hard_reject: true,
    soft_flag: false,
  },
  {
    id: "q7",
    question:
      "In the last 12 months, have you had an illness that required hospital admission or IV fluids?",
    category: "Lifestyle & Risk Assessment",
    hard_reject: true,
    soft_flag: false,
  },
  {
    id: "q8",
    question:
      "Have you donated blood or platelets recently (within the last 3 months)?",
    category: "Lifestyle & Risk Assessment",
    hard_reject: true,
    soft_flag: false,
  },

  // Physical Readiness
  {
    id: "q9",
    question:
      "Did you get less than 5–6 hours of sleep last night or skip a major meal today?",
    category: "Physical Readiness",
    hard_reject: false,
    soft_flag: true,
  },
  {
    id: "q10",
    question:
      "Have you experienced dizziness, fainting, or weakness during or after a previous blood donation?",
    category: "Physical Readiness",
    hard_reject: true,
    soft_flag: false,
  },
  {
    id: "q11",
    question:
      "Has your body weight changed significantly in the last few months without trying?",
    category: "Physical Readiness",
    hard_reject: true,
    soft_flag: false,
  },

  // Hidden Red-Flag Questions
  {
    id: "q12",
    question:
      "Have you ever tested positive for any infection but were told it was 'not serious' or 'temporary'?",
    category: "Hidden Red-Flags",
    hard_reject: true,
    soft_flag: false,
  },
  {
    id: "q13",
    question:
      "Do you currently feel completely healthy today, not just generally healthy?",
    category: "Hidden Red-Flags",
    hard_reject: true, // No = reject
    soft_flag: false,
  },
  {
    id: "q14",
    question:
      "Have you consumed alcohol in the last 24–48 hours, even a small amount?",
    category: "Hidden Red-Flags",
    hard_reject: true,
    soft_flag: false,
  },
  {
    id: "q15",
    question:
      "Is there any reason—medical or personal—you feel unsure about donating today?",
    category: "Hidden Red-Flags",
    hard_reject: true,
    soft_flag: false,
  },
];

type AnswerMap = Record<string, boolean | null>;

export default function EligibilityCheckScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userType?: string }>();
  const userType = params.userType || null;

  const [answers, setAnswers] = useState<AnswerMap>(
    ELIGIBILITY_QUESTIONS.reduce((acc, q) => {
      acc[q.id] = null;
      return acc;
    }, {} as AnswerMap),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState<any>(null);

  // Redirect if not a donor
  useEffect(() => {
    if (userType !== "donor") {
      Alert.alert("Access Denied", "This screen is only for donors", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [userType]);

  const handleAnswer = (questionId: string, isYes: boolean) => {
    const newAnswers = { ...answers };
    // Store the actual user selection (true for Yes, false for No)
    newAnswers[questionId] = isYes;
    setAnswers(newAnswers);
  };

  const handleCheckEligibility = async () => {
    // Check if all questions are answered
    const unanswered = ELIGIBILITY_QUESTIONS.find(
      (q) => answers[q.id] === null,
    );
    if (unanswered) {
      Alert.alert(
        "Incomplete",
        "Please answer all questions before submitting.",
      );
      return;
    }

    await submitAnswers(answers);
  };

  const submitAnswers = async (answersToSubmit: AnswerMap) => {
    setIsLoading(true);

    try {
      const formattedAnswers = Object.keys(answersToSubmit).reduce(
        (acc, key) => {
          acc[key] = answersToSubmit[key] ? "yes" : "no";
          return acc;
        },
        {} as Record<string, string>,
      );

      const token = await AsyncStorage.getItem("authToken");
      const userId = await AsyncStorage.getItem("userId");

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const requestBody = {
        userId: userId ? parseInt(userId, 10) : undefined,
        answers: formattedAnswers,
      };

      console.log("🔍 Sending to:", API_ENDPOINTS.ELIGIBILITY_CHECK);
      console.log("🔍 Headers:", headers);
      console.log("🔍 Request body:", JSON.stringify(requestBody, null, 2));

      const response = await fetch(API_ENDPOINTS.ELIGIBILITY_CHECK, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      console.log("📡 Response status:", response.status);

      if (!response.ok) {
        // Try to parse error message from JSON response
        try {
          const errorData = await response.json();
          console.log("❌ Error response:", errorData);
          throw new Error(
            errorData.message || `Server error: ${response.status}`,
          );
        } catch (jsonError) {
          // If JSON parsing fails, throw status error
          console.log("❌ Raw error:", response.status, response.statusText);
          throw new Error(
            `Server error: ${response.status} ${response.statusText}`,
          );
        }
      }

      const data = await response.json();

      // Update JWT token if provided in response
      if (data.token) {
        await AsyncStorage.setItem("authToken", data.token);
        console.log("✅ JWT token updated after eligibility check");
      }

      setResultData(data);
      setShowResult(true);
    } catch (error: any) {
      console.log("Eligibility check error:", error);
      Alert.alert(
        "Eligibility check failed",
        getUserFriendlyError(
          error,
          "Failed to check eligibility. Please try again.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (showResult && resultData) {
    return <ResultScreen data={resultData} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Eligibility Check</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* All Questions */}
        {ELIGIBILITY_QUESTIONS.map((question, index) => {
          const selectedAnswer = answers[question.id];

          return (
            <View key={question.id} style={styles.questionBlock}>
              {/* Question Number and Text */}
              <View style={styles.questionHeader}>
                <Text style={styles.questionNumber}>{index + 1}.</Text>
                <Text style={styles.questionText}>{question.question}</Text>
              </View>

              {/* Answer Options */}
              <View style={styles.answerContainer}>
                <TouchableOpacity
                  style={[
                    styles.answerOption,
                    selectedAnswer === true && styles.answerOptionSelected,
                  ]}
                  onPress={() => handleAnswer(question.id, true)}
                >
                  <View
                    style={[
                      styles.radioButton,
                      selectedAnswer === true && styles.radioButtonSelected,
                    ]}
                  />
                  <Text
                    style={[
                      styles.answerText,
                      selectedAnswer === true && styles.answerTextSelected,
                    ]}
                  >
                    Yes
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.answerOption,
                    selectedAnswer === false && styles.answerOptionSelected,
                  ]}
                  onPress={() => handleAnswer(question.id, false)}
                >
                  <View
                    style={[
                      styles.radioButton,
                      selectedAnswer === false && styles.radioButtonSelected,
                    ]}
                  />
                  <Text
                    style={[
                      styles.answerText,
                      selectedAnswer === false && styles.answerTextSelected,
                    ]}
                  >
                    No
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleCheckEligibility}
          disabled={isLoading}
        >
          <Text style={styles.submitButtonText}>
            {isLoading ? "Checking..." : "Check Eligibility"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultScreen({ data }: { data: any }) {
  const router = useRouter();

  const isEligible = data.isEligible;
  const disqualifiers = data.disqualifiers || [];
  const softFlags = data.softFlags || [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={isEligible ? "#27AE60" : "#C8102E"}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.resultContent}
      >
        {/* Result Icon */}
        <View
          style={[
            styles.resultIconContainer,
            { backgroundColor: isEligible ? "#27AE60" : "#C8102E" },
          ]}
        >
          <Text style={styles.resultIcon}>{isEligible ? "✓" : "✗"}</Text>
        </View>

        {/* Result Title */}
        <Text
          style={[
            styles.resultTitle,
            { color: isEligible ? "#27AE60" : "#C8102E" },
          ]}
        >
          {isEligible ? "You Are Eligible!" : "Not Eligible"}
        </Text>

        {/* Result Message */}
        <Text style={styles.resultMessage}>
          {isEligible
            ? "Great news! You are eligible to donate blood. Your eligibility status has been recorded."
            : "Thank you for your honesty. Based on your responses, you are not eligible to donate blood at this time."}
        </Text>

        {/* Disqualifiers */}
        {disqualifiers && disqualifiers.length > 0 && (
          <View style={styles.issuesContainer}>
            <Text style={styles.issuesTitle}>❌ Disqualifying Factors:</Text>
            {disqualifiers.map((issue: string, idx: number) => (
              <View key={idx} style={styles.issueItem}>
                <Text style={styles.issueBullet}>•</Text>
                <Text style={styles.issueText}>{issue}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Soft Flags */}
        {softFlags && softFlags.length > 0 && (
          <View style={styles.issuesContainer}>
            <Text style={styles.issuesTitle}>⚠️ Areas of Concern:</Text>
            {softFlags.map((flag: string, idx: number) => (
              <View key={idx} style={styles.issueItem}>
                <Text style={styles.issueBullet}>•</Text>
                <Text style={styles.issueText}>{flag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Additional Info */}
        {!isEligible && (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Next Steps</Text>
            <Text style={styles.infoText}>
              Please consult with a healthcare professional to understand the
              reasons for ineligibility. You may become eligible to donate in
              the future once certain conditions are met.
            </Text>
          </View>
        )}

        {isEligible && (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>What's Next?</Text>
            <Text style={styles.infoText}>
              Your eligibility status has been saved. You can now schedule a
              blood donation appointment at any authorized blood bank.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.resultButtonContainer}>
        <TouchableOpacity
          style={[
            styles.resultButton,
            isEligible ? styles.eligibleButton : styles.completeButton,
          ]}
          onPress={() =>
            router.replace(isEligible ? "/profile" : ("/auth/register" as any))
          }
          activeOpacity={0.8}
        >
          {isEligible ? (
            <View style={styles.buttonContent}>
              <Text style={styles.resultButtonTextComplete}>
                Start Donation
              </Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color="#fff"
                style={styles.arrowIcon}
              />
            </View>
          ) : (
            <Text style={styles.resultButtonTextComplete}>
              Back to Registration
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    "Health & Medical History": "#E74C3C",
    "Lifestyle & Risk Assessment": "#F39C12",
    "Physical Readiness": "#3498DB",
    "Hidden Red-Flags": "#9B59B6",
  };
  return colors[category] || "#C8102E";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: verticalScale(12),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backButton: {
    padding: scale(4),
  },
  headerTitle: {
    fontSize: moderateScale(18),
    fontWeight: "600",
    color: "#C8102E",
  },
  content: {
    flex: 1,
    paddingHorizontal: scale(20),
  },
  questionBlock: {
    marginTop: verticalScale(24),
    marginBottom: verticalScale(16),
  },
  questionHeader: {
    flexDirection: "row" as const,
    marginBottom: verticalScale(16),
  },
  questionNumber: {
    fontSize: moderateScale(16),
    fontWeight: "600",
    color: "#C8102E",
    marginRight: scale(8),
    minWidth: scale(24),
  },
  questionCounter: {
    fontSize: moderateScale(13),
    color: "#999",
    marginTop: verticalScale(24),
    marginBottom: verticalScale(16),
  },
  questionContainer: {
    marginBottom: verticalScale(32),
  },
  questionText: {
    fontSize: moderateScale(16),
    fontWeight: "500",
    color: "#333",
    lineHeight: verticalScale(24),
    flex: 1,
  },
  answerContainer: {
    marginBottom: verticalScale(32),
    gap: scale(12),
  },
  answerOption: {
    flexDirection: "row" as const,
    alignItems: "center",
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
  },
  answerOptionSelected: {
    borderColor: "#C8102E",
    backgroundColor: "#FFF5F5",
  },
  radioButton: {
    width: scale(20),
    height: scale(20),
    borderRadius: moderateScale(10),
    borderWidth: 2,
    borderColor: "#D0D0D0",
    marginRight: scale(12),
  },
  radioButtonSelected: {
    borderColor: "#C8102E",
    backgroundColor: "#C8102E",
  },
  answerText: {
    fontSize: moderateScale(16),
    fontWeight: "500",
    color: "#333",
  },
  answerTextSelected: {
    color: "#C8102E",
    fontWeight: "600",
  },
  bottomContainer: {
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(16),
    paddingBottom: verticalScale(24),
  },
  navigationButtons: {
    flexDirection: "row" as const,
    gap: scale(12),
    marginBottom: verticalScale(12),
  },
  navButton: {
    flex: 1,
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(6),
    borderWidth: 1,
    borderColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: moderateScale(13),
    fontWeight: "600",
    color: "#333",
  },
  navButtonTextDisabled: {
    color: "#999",
  },
  submitButton: {
    backgroundColor: "#D11B31",
    borderRadius: moderateScale(26),
    paddingVertical: verticalScale(16),
    alignItems: "center",
    marginTop: verticalScale(24),
    marginBottom: verticalScale(16),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: moderateScale(18),
    fontWeight: "700",
  },

  // Result Screen Styles
  resultContent: {
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(24),
  },
  resultIconContainer: {
    width: scale(100),
    height: verticalScale(100),
    borderRadius: moderateScale(50),
    justifyContent: "center",
    alignItems: "center",
    marginBottom: verticalScale(20),
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  resultIcon: {
    fontSize: moderateScale(50),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  resultTitle: {
    fontSize: moderateScale(28),
    fontWeight: "700",
    textAlign: "center",
    marginBottom: verticalScale(12),
  },
  resultMessage: {
    fontSize: moderateScale(14),
    color: "#555",
    textAlign: "center",
    lineHeight: verticalScale(20),
    marginBottom: verticalScale(24),
  },
  issuesContainer: {
    backgroundColor: "#FFF5F5",
    borderLeftWidth: moderateScale(4),
    borderLeftColor: "#C8102E",
    borderRadius: moderateScale(8),
    padding: scale(16),
    marginBottom: verticalScale(16),
  },
  issuesTitle: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: "#C8102E",
    marginBottom: verticalScale(12),
  },
  issueItem: {
    flexDirection: "row" as const,
    marginBottom: verticalScale(8),
  },
  issueBullet: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: "#C8102E",
    marginRight: scale(12),
    width: scale(20),
  },
  issueText: {
    fontSize: moderateScale(13),
    color: "#2C3E50",
    flex: 1,
    lineHeight: verticalScale(18),
  },
  infoBox: {
    backgroundColor: "#E8F4F8",
    borderLeftWidth: moderateScale(4),
    borderLeftColor: "#3498DB",
    borderRadius: moderateScale(8),
    padding: scale(16),
    marginBottom: verticalScale(20),
  },
  infoTitle: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: "#2C5282",
    marginBottom: verticalScale(8),
  },
  infoText: {
    fontSize: moderateScale(13),
    color: "#2C3E50",
    lineHeight: verticalScale(18),
  },
  resultButtonContainer: {
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(24),
    gap: scale(12),
  },
  resultButton: {
    paddingVertical: verticalScale(16),
    borderRadius: moderateScale(30),
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 6,
  },
  retryButton: {
    backgroundColor: "#F0F0F0",
    borderWidth: 2,
    borderColor: "#C8102E",
  },
  completeButton: {
    backgroundColor: "#C8102E",
  },
  eligibleButton: {
    backgroundColor: "#D11B31",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  arrowIcon: {
    marginLeft: scale(6),
  },
  resultButtonText: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: "#C8102E",
  },
  resultButtonTextComplete: {
    fontSize: moderateScale(20),
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
