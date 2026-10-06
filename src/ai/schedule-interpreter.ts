/**
 * Provider-neutral boundary for AI interpretation.
 * The domain layer must validate every result before making any data change.
 */
export interface ScheduleInterpreter {
  interpretText(input: InterpretTextInput): Promise<ProposedCommand>;
  interpretTimetableImage(input: InterpretTimetableImageInput): Promise<ProposedTimetable>;
}

export type InterpretTextInput = {
  message: string;
  timezone: string;
  receivedAt: Date;
};

export type InterpretTimetableImageInput = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  bytes: Buffer;
  timezone: string;
  caption?: string;
};

export type ProposedCommand = {
  intent: string;
  requiresConfirmation: boolean;
  data: Record<string, unknown>;
  ambiguities: string[];
};

export type ProposedTimetable = {
  schedules: Array<{
    courseName: string;
    dayOfWeek: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
    startTime: string;
    endTime: string;
    location?: string;
  }>;
  ambiguities: string[];
};
