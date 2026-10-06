import {
  Client,
  Events,
  GatewayIntentBits,
  type Message,
} from "discord.js";

import type {
  InterpretTimetableImageInput,
  ProposedTimetable,
  ScheduleInterpreter,
} from "../ai/schedule-interpreter.js";
import {
  describeWeatherCode,
  OpenMeteoWeatherService,
} from "../weather/open-meteo-weather-service.js";

type SupportedImageMimeType = InterpretTimetableImageInput["mimeType"];
type ImageAttachment = {
  contentType: string | null;
  name: string | null;
  size: number;
  url: string;
};

const maxTimetableImageBytes = 10 * 1024 * 1024;
const maxDiscordMessageLength = 1800;

const imageMimeTypes: Record<string, SupportedImageMimeType> = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
};

const imageExtensions: Record<string, SupportedImageMimeType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const weekdayNames: Record<ProposedTimetable["schedules"][number]["dayOfWeek"], string> = {
  MONDAY: "월요일",
  TUESDAY: "화요일",
  WEDNESDAY: "수요일",
  THURSDAY: "목요일",
  FRIDAY: "금요일",
  SATURDAY: "토요일",
  SUNDAY: "일요일",
};

function resolveImageMimeType(attachment: ImageAttachment): SupportedImageMimeType | null {
  const declaredType = attachment.contentType?.split(";")[0]?.trim().toLowerCase();
  if (declaredType && imageMimeTypes[declaredType]) {
    return imageMimeTypes[declaredType];
  }
  if (declaredType?.startsWith("image/")) {
    return null;
  }

  const extension = attachment.name?.match(/\.([^.]+)$/)?.[1]?.toLowerCase();
  return extension ? imageExtensions[extension] ?? null : null;
}

async function downloadImage(attachment: ImageAttachment): Promise<Buffer> {
  if (attachment.size > maxTimetableImageBytes) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  const response = await fetch(attachment.url, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error("IMAGE_DOWNLOAD_FAILED");
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxTimetableImageBytes) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > maxTimetableImageBytes) {
    throw new Error("IMAGE_TOO_LARGE");
  }
  return bytes;
}

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatTimetablePreview(proposal: ProposedTimetable): string[] {
  const lines = ["**시간표 이미지 인식 미리보기**"];

  if (proposal.schedules.length === 0) {
    lines.push("인식된 수업이 없습니다.");
  } else {
    lines.push(`인식한 수업 ${proposal.schedules.length}개`);
    proposal.schedules.forEach((schedule, index) => {
      const start = parseTimeToMinutes(schedule.startTime);
      const end = parseTimeToMinutes(schedule.endTime);
      const invalidTime = start === null || end === null || end <= start;
      const courseName = schedule.courseName.trim() || "과목명 미확인";
      const location = schedule.location?.trim();
      const timeWarning = invalidTime ? " · ⚠ 시각 확인 필요" : "";

      lines.push(
        `${index + 1}. ${weekdayNames[schedule.dayOfWeek]} ${schedule.startTime}–${schedule.endTime} · ${courseName}${location ? ` · ${location}` : ""}${timeWarning}`,
      );
    });
  }

  const invalidSchedules = proposal.schedules
    .map((schedule, index) => ({ schedule, index }))
    .filter(({ schedule }) => {
      const start = parseTimeToMinutes(schedule.startTime);
      const end = parseTimeToMinutes(schedule.endTime);
      return !schedule.courseName.trim() || start === null || end === null || end <= start;
    });

  const ambiguities = [...proposal.ambiguities];
  for (const { schedule, index } of invalidSchedules) {
    const problems: string[] = [];
    if (!schedule.courseName.trim()) problems.push("과목명");
    const start = parseTimeToMinutes(schedule.startTime);
    const end = parseTimeToMinutes(schedule.endTime);
    if (start === null || end === null || end <= start) problems.push("수업 시각");
    ambiguities.push(`${index + 1}번째 수업의 ${problems.join("·")}을 확인해 주세요.`);
  }

  if (ambiguities.length > 0) {
    lines.push("", "**확인이 필요한 항목**");
    lines.push(...ambiguities.map((ambiguity) => `• ${ambiguity}`));
  }

  lines.push("", "이번 단계에서는 미리보기만 제공하며 시간표를 저장하지 않았습니다.");
  return lines;
}

function splitDiscordMessage(lines: string[]): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const originalLine of lines) {
    const pieces = originalLine.match(new RegExp(`[\\s\\S]{1,${maxDiscordMessageLength}}`, "g")) ?? [""];
    for (const piece of pieces) {
      const next = current ? `${current}\n${piece}` : piece;
      if (next.length > maxDiscordMessageLength) {
        chunks.push(current);
        current = piece;
      } else {
        current = next;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

async function replyWithTimetablePreview(message: Message, proposal: ProposedTimetable): Promise<void> {
  for (const content of splitDiscordMessage(formatTimetablePreview(proposal))) {
    await message.reply({
      content,
      allowedMentions: { repliedUser: false },
    });
  }
}

export function createDiscordClient(
  interpreter: ScheduleInterpreter,
  weatherService: OpenMeteoWeatherService,
  inputChannelId: string,
): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, (readyClient) => {
    console.info({ user: readyClient.user.tag }, "Discord bot is ready");
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || message.guildId === null || message.channelId !== inputChannelId) {
      return;
    }

    console.info({
      contentLength: message.content.length,
      attachmentCount: message.attachments.size,
    }, "Discord input channel message received");

    const messageText = message.content
      .replace(/<@!?\d+>/g, "")
      .trim();

    const attachments = [...message.attachments.values()];
    if (attachments.length > 0) {
      if (attachments.length !== 1) {
        await message.reply("시간표 이미지는 한 번에 한 장씩 보내주세요.");
        return;
      }

      const [attachment] = attachments;
      if (!attachment) return;

      const mimeType = resolveImageMimeType(attachment);
      if (!mimeType) {
        await message.reply("시간표 이미지는 JPG, PNG, WebP 형식으로 보내주세요.");
        return;
      }

      if (attachment.size > maxTimetableImageBytes) {
        await message.reply("이미지 용량이 10MB를 넘습니다. 크기를 줄여 다시 보내주세요.");
        return;
      }

      try {
        const bytes = await downloadImage(attachment);
        const proposal = await interpreter.interpretTimetableImage({
          mimeType,
          bytes,
          timezone: "Asia/Seoul",
          caption: messageText || undefined,
        });
        await replyWithTimetablePreview(message, proposal);
      } catch (error) {
        const isTooLarge = error instanceof Error && error.message === "IMAGE_TOO_LARGE";
        if (isTooLarge) {
          await message.reply("이미지 용량이 10MB를 넘습니다. 크기를 줄여 다시 보내주세요.");
          return;
        }

        console.error({ errorName: error instanceof Error ? error.name : "unknown" }, "Failed to process timetable image");
        await message.reply("시간표 이미지를 읽지 못했습니다. 더 선명한 JPG, PNG, WebP 이미지로 다시 보내주세요.");
      }
      return;
    }

    if (!messageText) {
      await message.reply("무엇을 도와드릴까요? 일정이나 시간표를 말씀해 주세요.");
      return;
    }

    try {
      const proposal = await interpreter.interpretText({
        message: messageText,
        timezone: "Asia/Seoul",
        receivedAt: new Date(message.createdTimestamp),
      });

      console.info({
        intent: proposal.intent,
        location: proposal.data.location,
        ambiguities: proposal.ambiguities,
      }, "AI proposal received");

      if (proposal.intent === "QUERY_WEATHER") {
        const location = typeof proposal.data.location === "string"
          ? proposal.data.location.trim()
          : "";

        if (!location) {
          await message.reply("어느 지역의 날씨를 알려드릴까요? 예: 서울 날씨 알려줘");
          return;
        }

        const weather = await weatherService.getCurrentWeather(location);
        if (!weather) {
          await message.reply(`'${location}' 지역을 찾지 못했습니다. 도시 이름을 조금 더 구체적으로 알려주세요.`);
          return;
        }

        await message.reply([
          `오늘 ${weather.requestedLocation} 날씨입니다. (${weather.date})`,
          `기온 ${weather.minTemperatureC}°C ~ ${weather.maxTemperatureC}°C`,
          `${describeWeatherCode(weather.weatherCode)} · 현재 ${weather.temperatureC}°C`,
          `체감 ${weather.apparentTemperatureC}°C · 바람 ${weather.windSpeedKmh}km/h`,
          `비 예보: ${weather.precipitationProbabilityMax >= 30 ? "있음" : "낮음"} (강수확률 최대 ${weather.precipitationProbabilityMax}%)`,
          `예상 강수량 ${weather.precipitationSumMm}mm · 현재 강수량 ${weather.precipitationMm}mm`,
          "출처: Open-Meteo",
        ].join("\n"));
        return;
      }

      await message.reply({
        content: [
          `해석 결과: ${proposal.intent}`,
          `확인 필요: ${proposal.requiresConfirmation ? "예" : "아니오"}`,
          `데이터: ${JSON.stringify(proposal.data)}`,
          proposal.ambiguities.length > 0
            ? `모호한 점: ${proposal.ambiguities.join(", ")}`
            : "",
        ].filter(Boolean).join("\n"),
      });
    } catch (error) {
      console.error({ error }, "Failed to interpret Discord message with AI");
      await message.reply("메시지를 해석하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  });

  return client;
}
