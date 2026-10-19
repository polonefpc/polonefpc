export type WheelAudience = "all" | "welcome" | "referral" | "selected";

export const wheelAudienceLabels: Record<WheelAudience, string> = {
  all: "كل الحسابات المفعلة",
  welcome: "بونص ترحيبي",
  referral: "مكافأة إحالة عضو",
  selected: "حسابات محددة",
};